import type { ProductLayer, RegionId } from './types'
import { useApp, useUi, type CaseTab, type RightTab } from './store'
import { useI18n, type Lang } from './i18n'

export type SarBand = 'nisar' | 'sband' | 's1c'

/** Everything a shared link can carry about the screen. */
export interface UrlState {
  aoi?: RegionId
  layer?: ProductLayer
  t?: number
  polygon?: string
  /** Case panel tab. */
  tab?: CaseTab
  /** Year picked on the case timeline. */
  year?: number
  /** Watch zone highlighted on the map and in the alerts list. */
  zone?: string
  /** Satellite backdrop (on by default). */
  satellite?: boolean
  relief?: boolean
  band?: SarBand
  radd?: boolean
  deter?: boolean
  /** Live NISAR imagery (on by default). */
  radar?: boolean
  nasa?: boolean
  trueColor?: boolean
  /** Right panel open on this tab. */
  panel?: RightTab
  lang?: Lang
  /** Before/after scenes picked by hand in the SAR comparison. */
  sar?: [string, string]
}

const VALID_TABS: readonly CaseTab[] = ['overview', 'timeline', 'alerts']
const VALID_AOIS: readonly RegionId[] = ['YANO', 'ENCH', 'SECA']
const VALID_BANDS: readonly SarBand[] = ['nisar', 'sband', 's1c']
const VALID_PANELS: readonly RightTab[] = ['nisar', 'meta', 'chat']
const VALID_LANGS: readonly Lang[] = ['pt', 'en']
const VALID_LAYERS: readonly ProductLayer[] = [
  'amplitude',
  'coherence',
  'interferogram',
  'displacement',
  'change',
]
const SAFE_ID = /^[\w.:-]{1,120}$/

function pick<T extends string>(raw: string | null, valid: readonly T[]): T | undefined {
  return raw && (valid as readonly string[]).includes(raw) ? (raw as T) : undefined
}

function flag(raw: string | null): boolean | undefined {
  return raw === '1' ? true : raw === '0' ? false : undefined
}

export function readUrlState(search = window.location.search): UrlState {
  const p = new URLSearchParams(search)
  const tRaw = p.get('t')
  const yearRaw = Number(p.get('year'))
  const zone = p.get('zone')
  const sar = p.get('sar')?.split(',')
  return {
    aoi: pick(p.get('aoi'), VALID_AOIS),
    layer: pick(p.get('layer'), VALID_LAYERS),
    t: tRaw && !Number.isNaN(Number(tRaw)) ? Number(tRaw) : undefined,
    polygon: p.get('polygon') || undefined,
    tab: pick(p.get('tab'), VALID_TABS),
    year: Number.isInteger(yearRaw) && yearRaw > 1900 && yearRaw < 2100 ? yearRaw : undefined,
    zone: zone && SAFE_ID.test(zone) ? zone : undefined,
    satellite: flag(p.get('sat')),
    relief: flag(p.get('relief')),
    band: pick(p.get('band'), VALID_BANDS),
    radd: flag(p.get('radd')),
    deter: flag(p.get('deter')),
    radar: flag(p.get('radar')),
    nasa: flag(p.get('nasa')),
    trueColor: flag(p.get('tc')),
    panel: pick(p.get('panel'), VALID_PANELS),
    lang: pick(p.get('lang'), VALID_LANGS),
    sar: sar && sar.length === 2 && sar.every((s) => SAFE_ID.test(s)) ? [sar[0], sar[1]] : undefined,
  }
}

const bit = (b: boolean) => (b ? '1' : '0')

export function buildPermalink(state: UrlState, base = window.location.origin + window.location.pathname): string {
  const p = new URLSearchParams()
  const s = state
  if (s.aoi) p.set('aoi', s.aoi)
  if (s.tab && s.tab !== 'overview') p.set('tab', s.tab)
  if (s.year !== undefined) p.set('year', String(s.year))
  if (s.zone) p.set('zone', s.zone)
  if (s.layer) p.set('layer', s.layer)
  if (s.t !== undefined) p.set('t', String(s.t))
  if (s.polygon) p.set('polygon', s.polygon)
  if (s.satellite !== undefined) p.set('sat', bit(s.satellite))
  if (s.relief !== undefined) p.set('relief', bit(s.relief))
  if (s.band) p.set('band', s.band)
  if (s.radd !== undefined) p.set('radd', bit(s.radd))
  if (s.deter !== undefined) p.set('deter', bit(s.deter))
  if (s.radar !== undefined) p.set('radar', bit(s.radar))
  if (s.nasa !== undefined) p.set('nasa', bit(s.nasa))
  if (s.trueColor !== undefined) p.set('tc', bit(s.trueColor))
  if (s.panel) p.set('panel', s.panel)
  if (s.sar) p.set('sar', s.sar.join(','))
  if (s.lang) p.set('lang', s.lang)
  const qs = p.toString().replace(/%2C/g, ',')
  return qs ? `${base}?${qs}` : base
}

/* ------------------------------------------------------------------ */
/* Live screen state: what is on screen now, and what a link restores.  */
/* ------------------------------------------------------------------ */

let sharedSar: [string, string] | null = null

/** SAR before/after pair from the opened link, handed over once when the archive loads. */
export function takeSharedSar(): [string, string] | null {
  const v = sharedSar
  sharedSar = null
  return v
}

/** What is on screen now, keeping only what differs from a fresh visit. */
export function screenState(): UrlState {
  const a = useApp.getState()
  const u = useUi.getState()
  if (!a.aoiActive) return {}
  return {
    aoi: a.activeRegion,
    tab: a.caseTab,
    year: a.caseYear ?? undefined,
    zone: a.hotspotId ?? undefined,
    layer: a.activeLayer !== 'change' ? a.activeLayer : undefined,
    satellite: u.satelliteOn ? undefined : false,
    relief: u.reliefOn ? true : undefined,
    band: u.yanomamiBand ?? undefined,
    radd: u.yanomamiRaddOn ? true : undefined,
    deter: u.yanomamiDeterOn ? true : undefined,
    radar: a.nisarVisible ? undefined : false,
    nasa: a.nasaOverlay ? true : undefined,
    trueColor: a.trueColorOverlay ? true : undefined,
    panel: u.rightOpen && u.rightTab !== 'chat' ? u.rightTab : undefined,
    sar: u.sarPair ?? undefined,
    lang: useI18n.getState().lang,
  }
}

export function screenLink(base?: string): string {
  return buildPermalink(screenState(), base)
}

/** Puts the app in the state a link describes. */
export function applyUrlState(s: UrlState) {
  const app = useApp.getState()
  // The link's language wins for this visit only; the visitor's saved choice stays untouched.
  if (s.lang && s.lang !== useI18n.getState().lang) useI18n.setState({ lang: s.lang })
  if (s.aoi) {
    app.setActiveRegion(s.aoi)
    if (s.tab) app.setCaseTab(s.tab)
    if (s.year) app.setCaseYear(s.year)
    if (s.zone) app.setHotspot(s.zone)
    sharedSar = s.sar ?? null
  }
  if (s.layer) app.setActiveLayer(s.layer)
  if (s.t !== undefined) app.setTimeIndex(s.t)
  useApp.setState({
    ...(s.radar !== undefined && { nisarVisible: s.radar }),
    ...(s.nasa !== undefined && { nasaOverlay: s.nasa }),
    ...(s.trueColor !== undefined && { trueColorOverlay: s.trueColor }),
  })
  useUi.setState({
    ...(s.satellite !== undefined && { satelliteOn: s.satellite }),
    ...(s.relief !== undefined && { reliefOn: s.relief }),
    ...(s.band && { yanomamiBand: s.band }),
    ...(s.radd !== undefined && { yanomamiRaddOn: s.radd }),
    ...(s.deter !== undefined && { yanomamiDeterOn: s.deter }),
  })
  if (s.panel) useUi.getState().openRight(s.panel)
}

let syncing = false
let syncTimer: number | undefined

function scheduleSync() {
  if (!syncing) return
  window.clearTimeout(syncTimer)
  syncTimer = window.setTimeout(() => {
    const next = screenLink()
    if (next !== window.location.href) window.history.replaceState(window.history.state, '', next)
  }, 200)
}

/** Keeps the address bar on what is on screen, so a copied URL reopens the same view. */
export function startUrlSync(): () => void {
  syncing = true
  const offs = [useApp.subscribe(scheduleSync), useUi.subscribe(scheduleSync), useI18n.subscribe(scheduleSync)]
  return () => {
    syncing = false
    window.clearTimeout(syncTimer)
    offs.forEach((off) => off())
  }
}
