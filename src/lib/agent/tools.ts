/**
 * The tool kit the IARA assistant uses to drive the site. Each tool has an OpenAI-style JSON
 * schema (sent to the model) and an executor that changes the app stores, exactly like a click
 * would. Executors never throw: they return a short result the model reads to plan its next step.
 */
import { CASES, CASE_ORDER } from '@/data/cases'
import { INDIGENOUS_LANDS, polygonCentroid } from '@/data/layers/indigenous-lands'
import { useApp, useUi, type CaseTab, type RightTab } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import type { ProductLayer, RegionId } from '@/lib/types'

export interface ToolSpec {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

type Args = Record<string, unknown>
type Executor = (args: Args) => Promise<unknown> | unknown

const CASE_IDS = CASE_ORDER as string[]
const CASE_TABS: CaseTab[] = ['overview', 'timeline', 'forecast']
const PANEL_TABS: RightTab[] = ['chat', 'nisar', 'meta']
const SAR_LAYERS: ProductLayer[] = ['amplitude', 'coherence', 'interferogram', 'displacement', 'change']
// Rough Amazon box: keeps a wrong coordinate from sending the camera to the ocean.
const AMAZON = { minLon: -80, maxLon: -43, minLat: -19, maxLat: 9 }

const ALL_HOTSPOTS = CASE_ORDER.flatMap((id) => CASES[id].hotspots.map((h) => ({ ...h, caseId: id })))

const fn = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []): ToolSpec => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required } },
})

export const TOOL_SPECS: ToolSpec[] = [
  fn(
    'open_case',
    'Open one of the three case studies: the camera flies there and the case panel opens. YANO = illegal gold mining in the Yanomami land, ENCH = flooding in Manaus, SECA = drought in Manaquiri.',
    { case_id: { type: 'string', enum: CASE_IDS } },
    ['case_id']
  ),
  fn('close_case', 'Close the open case and go back to the home screen with the three case cards.'),
  fn(
    'open_case_tab',
    'Switch the case panel tab. overview = story, numbers and pains of the people; timeline = yearly series chart, river/flow outlook and SAR before/after; alerts = risk zones (hotspots) and forecasts. Opens the case first if case_id is given and differs from the open one.',
    {
      tab: { type: 'string', enum: CASE_TABS },
      case_id: { type: 'string', enum: CASE_IDS },
    },
    ['tab']
  ),
  fn(
    'focus_hotspot',
    'Highlight one risk zone (hotspot) of a case, fly the camera to it and open the alerts tab. Use the hotspot ids from the catalog.',
    { hotspot_id: { type: 'string', enum: ALL_HOTSPOTS.map((h) => h.id) } },
    ['hotspot_id']
  ),
  fn(
    'set_case_year',
    'Pick a year on the open case time series (it also changes the SAR before/after view). Only years listed in the catalog for that case exist.',
    { year: { type: 'integer' } },
    ['year']
  ),
  fn(
    'fly_to',
    'Move the map camera to a coordinate in the Brazilian Amazon. Use it for places that are not a hotspot or Indigenous land (a city, a river, a village).',
    {
      lon: { type: 'number', description: 'longitude, decimal degrees (west is negative)' },
      lat: { type: 'number', description: 'latitude, decimal degrees (south is negative)' },
      zoom: { type: 'number', description: '5 = whole state, 9 = municipality, 12 = neighbourhood' },
    },
    ['lon', 'lat']
  ),
  fn('reset_camera', 'Put the camera back on the framing of the open case.'),
  fn(
    'focus_indigenous_land',
    'Fly to an Indigenous land (Terra Indígena) by name or people, for example "Yanomami", "Kayapó", "Vale do Javari".',
    { name: { type: 'string' } },
    ['name']
  ),
  fn(
    'set_map_layers',
    'Turn map layers on or off. Only pass the layers you want to change. satellite = Sentinel-2 photo basemap; relief = 3D terrain; radar = live NISAR SAR imagery; nasa_overlay = NASA GIBS layer; true_color = MODIS true colour.',
    {
      satellite: { type: 'boolean' },
      relief: { type: 'boolean' },
      radar: { type: 'boolean' },
      nasa_overlay: { type: 'boolean' },
      true_color: { type: 'boolean' },
    }
  ),
  fn(
    'set_sar_product',
    'Choose which SAR product the radar layer shows.',
    { product: { type: 'string', enum: SAR_LAYERS } },
    ['product']
  ),
  fn(
    'set_radar_opacity',
    'Set the opacity of the radar (NISAR) layer, from 0.1 to 1.',
    { opacity: { type: 'number' } },
    ['opacity']
  ),
  fn(
    'open_side_panel',
    'Open a tab of the right side panel. chat = this assistant, nisar = NISAR scene picker, meta = technical metadata of the SAR scene.',
    { tab: { type: 'string', enum: PANEL_TABS } },
    ['tab']
  ),
  fn('set_language', 'Switch the site language.', { lang: { type: 'string', enum: ['pt', 'en'] } }, ['lang']),
  fn(
    'get_case_details',
    'Read the full content of a case (story, numbers, pains, series, hotspots, sources) to answer questions about it. Call it before answering factual questions.',
    { case_id: { type: 'string', enum: CASE_IDS } },
    ['case_id']
  ),
]

/* ------------------------------------------------------------------ */

const app = () => useApp.getState()
const ui = () => useUi.getState()
const isCase = (v: unknown): v is RegionId => typeof v === 'string' && CASE_IDS.includes(v)

/** Resolves once the camera has landed in the open case (or after a timeout). */
function waitForArrival(timeoutMs = 7000): Promise<void> {
  if (app().caseArrived) return Promise.resolve()
  return new Promise((resolve) => {
    const stop = useApp.subscribe((s) => {
      if (s.caseArrived) {
        stop()
        clearTimeout(timer)
        resolve()
      }
    })
    const timer = setTimeout(() => {
      stop()
      resolve()
    }, timeoutMs)
  })
}

function openCase(id: RegionId) {
  const st = app()
  if (st.aoiActive && st.activeRegion === id) return false
  st.setActiveRegion(id)
  return true
}

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^ti\s+/, '').trim()
}

function findLand(query: string) {
  const q = norm(query)
  if (q.length < 3) return null
  return (
    INDIGENOUS_LANDS.features.find((f) => norm(f.properties.name) === q) ??
    INDIGENOUS_LANDS.features.find((f) => norm(f.properties.name).includes(q) || q.includes(norm(f.properties.name))) ??
    INDIGENOUS_LANDS.features.find((f) => (f.properties.ethnicities ?? []).some((e) => norm(e).includes(q)))
  )
}

const EXECUTORS: Record<string, Executor> = {
  async open_case({ case_id }) {
    if (!isCase(case_id)) return { error: `unknown case ${String(case_id)}` }
    const flew = openCase(case_id)
    await waitForArrival()
    return { ok: true, case: case_id, note: flew ? 'camera flew in, panel open on overview' : 'case was already open' }
  },

  close_case() {
    app().clearAoi()
    ui().setRightOpen(false)
    return { ok: true }
  },

  async open_case_tab({ tab, case_id }) {
    if (!CASE_TABS.includes(tab as CaseTab)) return { error: `unknown tab ${String(tab)}` }
    if (isCase(case_id)) openCase(case_id)
    if (!app().aoiActive) return { error: 'no case is open; call open_case first or pass case_id' }
    app().setCaseTab(tab as CaseTab)
    await waitForArrival()
    return { ok: true, case: app().activeRegion, tab }
  },

  async focus_hotspot({ hotspot_id }) {
    const h = ALL_HOTSPOTS.find((x) => x.id === hotspot_id)
    if (!h) return { error: `unknown hotspot ${String(hotspot_id)}` }
    openCase(h.caseId)
    await waitForArrival()
    const st = app()
    st.setCaseTab('forecast')
    st.setHotspot(h.id)
    st.requestFlyTo(h.center, Math.max(CASES[h.caseId].camera.zoom + 1.5, 10))
    return { ok: true, case: h.caseId, hotspot: h.name, level: h.level }
  },

  set_case_year({ year }) {
    const st = app()
    if (!st.aoiActive) return { error: 'no case is open' }
    const years = CASES[st.activeRegion].series.points.map((p) => p.year)
    const y = Number(year)
    if (!years.includes(y)) return { error: `year not in series; available: ${years.join(', ')}` }
    st.setCaseYear(y)
    st.setCaseTab('timeline')
    return { ok: true, year: y }
  },

  fly_to({ lon, lat, zoom }) {
    const x = Number(lon)
    const y = Number(lat)
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { error: 'lon/lat must be numbers' }
    if (x < AMAZON.minLon || x > AMAZON.maxLon || y < AMAZON.minLat || y > AMAZON.maxLat)
      return { error: 'coordinate is outside the Brazilian Amazon' }
    const z = zoom === undefined ? 9 : Math.min(16, Math.max(3, Number(zoom) || 9))
    app().requestFlyTo([x, y], z)
    return { ok: true, center: [x, y], zoom: z }
  },

  reset_camera() {
    if (!app().aoiActive) return { error: 'no case is open' }
    app().requestHome()
    return { ok: true }
  },

  focus_indigenous_land({ name }) {
    const f = findLand(String(name ?? ''))
    if (!f) return { error: `no Indigenous land matches "${String(name)}"` }
    const center = polygonCentroid(f.geometry)
    app().setFocusedTi(f.properties.name)
    app().requestFlyTo(center, f.properties.area_km2 > 50_000 ? 6.5 : f.properties.area_km2 > 10_000 ? 7.5 : 8.5)
    return { ok: true, land: f.properties.name, peoples: f.properties.ethnicities ?? [], area_km2: f.properties.area_km2 }
  },

  set_map_layers(args) {
    const st = app()
    const u = ui()
    const changed: Record<string, boolean> = {}
    if (typeof args.satellite === 'boolean' && args.satellite !== u.satelliteOn) {
      u.toggleSatellite()
      changed.satellite = args.satellite
    }
    if (typeof args.relief === 'boolean' && args.relief !== u.reliefOn) {
      u.toggleRelief()
      changed.relief = args.relief
    }
    if (typeof args.radar === 'boolean') {
      st.setNisarVisible(args.radar)
      changed.radar = args.radar
    }
    if (typeof args.nasa_overlay === 'boolean' && args.nasa_overlay !== st.nasaOverlay) {
      st.toggleNasaOverlay()
      changed.nasa_overlay = args.nasa_overlay
    }
    if (typeof args.true_color === 'boolean' && args.true_color !== st.trueColorOverlay) {
      st.toggleTrueColorOverlay()
      changed.true_color = args.true_color
    }
    return { ok: true, changed, note: st.aoiActive ? undefined : 'layer buttons only show inside a case' }
  },

  set_sar_product({ product }) {
    if (!SAR_LAYERS.includes(product as ProductLayer)) return { error: `unknown product ${String(product)}` }
    app().setActiveLayer(product as ProductLayer)
    app().setNisarVisible(true)
    return { ok: true, product }
  },

  set_radar_opacity({ opacity }) {
    const o = Math.min(1, Math.max(0.1, Number(opacity) || 0.85))
    app().setNisarVisible(true)
    app().setNisarOpacity(o)
    return { ok: true, opacity: o }
  },

  open_side_panel({ tab }) {
    if (!PANEL_TABS.includes(tab as RightTab)) return { error: `unknown tab ${String(tab)}` }
    if (!app().aoiActive) return { error: 'the side panel only opens inside a case' }
    ui().openRight(tab as RightTab)
    return { ok: true, tab }
  },

  set_language({ lang }) {
    if (lang !== 'pt' && lang !== 'en') return { error: 'lang must be pt or en' }
    useI18n.getState().setLang(lang)
    return { ok: true, lang }
  },

  get_case_details({ case_id }) {
    if (!isCase(case_id)) return { error: `unknown case ${String(case_id)}` }
    const lang = useI18n.getState().lang
    const c = CASES[case_id]
    const tr = (l: { pt: string; en: string }) => l[lang]
    return {
      id: c.id,
      theme: tr(c.theme),
      place: tr(c.place),
      headline: tr(c.headline),
      hero: `${c.hero.value} ${tr(c.hero.label)} (${c.hero.source})`,
      stats: c.stats.map((s) => `${s.value} ${tr(s.label)} (${s.source})`),
      meta: c.meta.map((m) => `${tr(m.label)}: ${tr(m.value)}`),
      story: c.story.map(tr),
      pains: c.pains.map((p) => `${tr(p.title)}: ${tr(p.body)}`),
      series: {
        title: tr(c.series.title),
        unit: c.series.unit,
        points: c.series.points.map((p) => ({ year: p.year, value: p.value, note: tr(p.note) })),
        source: c.series.source.label,
      },
      risk: { level: c.risk.level, summary: tr(c.risk.summary) },
      hotspots: c.hotspots.map((h) => ({ id: h.id, name: h.name, level: h.level, note: tr(h.note) })),
      sar_reading: tr(c.sarReading),
      sources: c.sources.map((s) => s.label),
    }
  },
}

/** Tools that only read: they don't count as "the assistant did something on the site". */
export const READ_ONLY_TOOLS = new Set(['get_case_details'])

export async function runTool(name: string, rawArgs: string | Args | undefined): Promise<unknown> {
  const exec = EXECUTORS[name]
  if (!exec) return { error: `unknown tool ${name}` }
  let args: Args = {}
  try {
    args = typeof rawArgs === 'string' ? (rawArgs.trim() ? JSON.parse(rawArgs) : {}) : (rawArgs ?? {})
  } catch {
    return { error: 'arguments were not valid JSON' }
  }
  try {
    return await exec(args)
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

/** Compact catalog for the system prompt: ids the model must use, plus what is on screen now. */
export function siteSnapshot() {
  const st = app()
  const u = ui()
  const lang = useI18n.getState().lang
  return {
    language: lang,
    screen: st.aoiActive ? 'case' : 'home (three case cards)',
    open_case: st.aoiActive ? st.activeRegion : null,
    case_tab: st.aoiActive ? st.caseTab : null,
    case_year: st.caseYear,
    hotspot: st.hotspotId,
    layers: {
      satellite: u.satelliteOn,
      relief: u.reliefOn,
      radar: st.nisarVisible,
      sar_product: st.activeLayer,
      radar_opacity: Number(st.nisarOpacity.toFixed(2)),
      nasa_overlay: st.nasaOverlay,
      true_color: st.trueColorOverlay,
    },
    side_panel: u.rightOpen ? u.rightTab : 'closed',
  }
}

export function caseCatalog() {
  const lang = useI18n.getState().lang
  return CASE_ORDER.map((id) => {
    const c = CASES[id]
    return {
      id,
      theme: c.theme[lang],
      place: c.place[lang],
      headline: c.headline[lang],
      center: c.camera.center,
      series_years: c.series.points.map((p) => p.year),
      hotspots: c.hotspots.map((h) => `${h.id} (${h.name}, ${h.level})`),
    }
  })
}
