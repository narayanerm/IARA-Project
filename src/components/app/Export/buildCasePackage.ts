import type { Feature, FeatureCollection, Geometry, MultiPolygon, Point, Polygon, Position } from 'geojson'
import { RISK_COLOR, type CaseStudy, type L, type RiskLevel } from '@/data/cases'
import { COMMUNITY_DATA, type RiversideProps, type TiPointProps } from '@/data/layers/communities'
import { worldviewSnapshot } from '@/data/phenomena-briefing'
import type { Lang } from '@/lib/i18n'
import { captureMapCanvas, getSnapshotMap } from '@/lib/mapSnapshot'
import {
  AMAZON_RIVER_SITES,
  GEOGLOWS_VIEWER,
  fetchFlowForecast,
  pointInForecastBounds,
  resolveRiverForecast,
  type FlowForecast,
} from '@/lib/predictive-models'
import { REGIONS } from '@/lib/regions'
import {
  closestScene,
  findOpticalScene,
  loadArchive,
  sceneImageUrl,
  type ArchiveScene,
  type Bbox,
} from '@/lib/sarArchive'
import type { Outline } from '@/lib/useCaseOutline'
import { makeZip, type ZipEntry } from '@/lib/zip'
import { satelliteTiles } from '../Map/layers/CaseImageryLayer'

/**
 * Builds the export package of the open case: everything the site shows inside the case boundary
 * (official outline, critical areas, alerts, SAR and optical scenes, time series, river stage,
 * communities, sources), plus a snapshot of the map as it is on screen.
 *
 * Alert feeds that the site does not have yet keep an empty, documented slot in `alerts.json`
 * (see ALERT_SLOTS) so a real feed can be plugged in without changing the package layout.
 */

export type ExportStep = 'map' | 'layers' | 'sar' | 'optical' | 'alerts' | 'zip'

export interface ExportContext {
  c: CaseStudy
  lang: Lang
  outline: Outline | null
  population: number | null
  /** Year picked on the case time series (the latest when none was picked). */
  year: number
  /** SAR mosaic band shown on the map, if any. */
  sarBand: 'nisar' | 'sband' | 's1c' | null
  raddOn: boolean
  deterOn: boolean
  /** Scenes picked in the SAR comparator; used instead of the series dates when they match the case box. */
  sarPick?: { bbox: Bbox; before: ArchiveScene | null; after: ArchiveScene | null } | null
  onStep?: (step: ExportStep) => void
}

const BASE = import.meta.env.BASE_URL
const ANALYSIS = `${BASE}analysis/data/`
const absolute = (path: string) => new URL(path, window.location.href).href
const SLUG: Record<CaseStudy['id'], string> = { YANO: 'yanomami', ENCH: 'manaus', SECA: 'manaquiri' }
const DETER_WFS = 'https://terrabrasilis.dpi.inpe.br/geoserver/deter-amz/ows'
const RADD_TILE =
  'https://tiles.globalforestwatch.org/wur_radd_alerts/v20261108/dynamic/{z}/{x}/{y}.png?start_date=2020-01-01'

// ---------- small helpers ----------

const tr = (l: L, lang: Lang) => l[lang]
const today = () => new Date().toISOString().slice(0, 10)

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])
}

async function getJson<T>(url: string, ms = 20000): Promise<T> {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms) })
  if (!r.ok) throw new Error(`${r.status}`)
  return (await r.json()) as T
}

async function getBytes(url: string, ms = 30000): Promise<Uint8Array<ArrayBuffer>> {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms) })
  if (!r.ok) throw new Error(`${r.status}`)
  return new Uint8Array(await r.arrayBuffer())
}

function csv(rows: Array<Array<string | number | boolean | null | undefined>>): string {
  const cell = (v: string | number | boolean | null | undefined) => {
    if (v == null) return ''
    const s = String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}

const json = (v: unknown) => JSON.stringify(v, null, 2)

function bboxPolygon([w, s, e, n]: Bbox): Polygon {
  return { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] }
}

function inRing([x, y]: Position, ring: Position[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function inOutline(p: Position, o: Outline | null): boolean {
  if (!o) return false
  const polys = o.geometry.type === 'Polygon' ? [o.geometry.coordinates] : o.geometry.coordinates
  return polys.some(([outer, ...holes]) => inRing(p, outer) && !holes.some((h) => inRing(p, h)))
}

function geomCenter(g: Geometry): Position | null {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === 'number') {
      const [x, y] = c as number[]
      w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y)
    } else if (Array.isArray(c)) c.forEach(walk)
  }
  if ('coordinates' in g) walk(g.coordinates)
  return Number.isFinite(w) ? [(w + e) / 2, (s + n) / 2] : null
}

/** Records what could not be fetched, so the README says it instead of failing the whole export. */
class Missing {
  items: string[] = []
  async try<T>(label: string, p: () => Promise<T>): Promise<T | null> {
    try {
      return await p()
    } catch (e) {
      this.items.push(`${label} (${(e as Error).message})`)
      return null
    }
  }
}

// ---------- data loaders ----------

type DeterProps = { classname: string | null; view_date: string | null; areamunkm: number | null; municipality?: string | null }

async function deterArchive(outline: Outline | null): Promise<Feature<Polygon | MultiPolygon, DeterProps>[]> {
  const fc = await getJson<FeatureCollection<Polygon | MultiPolygon, DeterProps>>(
    `${ANALYSIS}deter-mineracao-regional-2019-2026.geojson`
  )
  return fc.features.filter((f) => {
    const c = geomCenter(f.geometry)
    return c ? inOutline(c, outline) : false
  })
}

async function deterLive(bbox: Bbox): Promise<{ since: string; features: Feature<Polygon | MultiPolygon, DeterProps>[] }> {
  const since = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10)
  const url = new URL(DETER_WFS)
  url.searchParams.set('service', 'WFS')
  url.searchParams.set('version', '2.0.0')
  url.searchParams.set('request', 'GetFeature')
  url.searchParams.set('typeName', 'deter-amz:deter_amz')
  url.searchParams.set('outputFormat', 'application/json')
  url.searchParams.set('count', '500')
  url.searchParams.set('CQL_FILTER', `view_date >= '${since}' AND BBOX(geom, ${bbox.join(',')})`)
  const fc = await getJson<FeatureCollection<Polygon | MultiPolygon, DeterProps>>(url.toString(), 25000)
  return { since, features: fc.features }
}

interface Communities {
  riverside: Feature<Point, RiversideProps>[]
  indigenous: Feature<Point, TiPointProps>[]
}

async function communities(outline: Outline | null): Promise<Communities> {
  const [rib, ti] = await Promise.all([
    getJson<FeatureCollection<Point, RiversideProps>>(COMMUNITY_DATA.riverside),
    getJson<FeatureCollection<Point, TiPointProps>>(COMMUNITY_DATA.tiPoints),
  ])
  return {
    riverside: rib.features.filter((f) => inOutline(f.geometry.coordinates, outline)),
    indigenous: ti.features.filter((f) => inOutline(f.geometry.coordinates, outline)),
  }
}

interface MosaicMeta {
  band: string
  url: string
  bbox: Bbox
  dateRange?: [string, string]
  scenesComposited?: number
  buildDate?: string
  source: string
}

async function mosaics(slug: string): Promise<MosaicMeta[]> {
  type Meta = { bbox: Bbox; dateRange?: [string, string]; scenesComposited?: number; buildDate?: string; source: string }
  type Bounds = { north: number; south: number; west: number; east: number }
  const out: MosaicMeta[] = []
  const [l, s, c] = await Promise.allSettled([
    getJson<Meta>(`${ANALYSIS}${slug}-nisar-mosaic.meta.json`),
    getJson<Meta>(`${ANALYSIS}${slug}-nisar-sband-mosaic.meta.json`),
    getJson<Bounds>(`${ANALYSIS}sentinel1-${slug}-mosaic.bounds.json`),
  ])
  if (l.status === 'fulfilled') out.push({ ...l.value, band: 'NISAR L (24 cm)', url: absolute(`${ANALYSIS}${slug}-nisar-mosaic.png`) })
  if (s.status === 'fulfilled') out.push({ ...s.value, band: 'NISAR S (10 cm)', url: absolute(`${ANALYSIS}${slug}-nisar-sband-mosaic.png`) })
  if (c.status === 'fulfilled') {
    const b = c.value
    out.push({
      band: 'Sentinel-1 C (5,6 cm)',
      url: absolute(`${ANALYSIS}sentinel1-${slug}-mosaic.png`),
      bbox: [b.west, b.south, b.east, b.north],
      source: 'Sentinel-1 GRD · ESA Copernicus · ASF DAAC',
    })
  }
  return out
}

interface LocalGranule {
  granuleName: string
  startTime: string
  path: number
  frame: number
  flightDirection: string
  polarization: string
  sourceBrowse: string
}

async function localS1Catalog(slug: string): Promise<LocalGranule[]> {
  const file = slug === 'yanomami' ? 'sentinel1-catalog.json' : `sentinel1-${slug}-catalog.json`
  return getJson<LocalGranule[]>(`${ANALYSIS}${file}`)
}

interface FlowOutlook {
  site: string
  point: [number, number]
  riverId: number
  days: FlowForecast['days']
  /** Ensemble members (of 51) above the 2-year high-flow level in the next 7 days, when the site snapshot has it. */
  membersAboveHighFlow: number | null
  source: string
}

async function flowOutlook(bbox: Bbox): Promise<FlowOutlook | null> {
  const site = AMAZON_RIVER_SITES.find(({ point }) => pointInForecastBounds(point, bbox))
  if (!site) return null
  const signal = AbortSignal.timeout(25000)
  const { id, saved } = await resolveRiverForecast(site.point, signal)
  if (id === null) return null
  const flow = saved?.flow ?? (await fetchFlowForecast(id, signal))
  return {
    site: site.name,
    point: site.point as [number, number],
    riverId: id,
    days: flow.days,
    membersAboveHighFlow: typeof saved?.chance === 'number' ? Math.round((saved.chance / 100) * 51) : null,
    source: `GEOGLOWS · ECMWF (${GEOGLOWS_VIEWER})`,
  }
}

// ---------- alert slots ----------

/**
 * One slot per kind of alert, present in every case. `from_site` holds what the site already reads;
 * `official_alerts` is the reserved space for the official feeds still to be connected.
 */
interface AlertSlot {
  applies_to_case: boolean
  description: L
  from_site: unknown[]
  official_alerts: {
    status: 'awaiting_feed' | 'connected'
    items: unknown[]
    feeds_to_connect: Array<{ name: string; url: string }>
  }
}

const ALERT_SLOTS = {
  flood: {
    description: {
      pt: 'Alertas de cheia e inundação: boletins oficiais, alertas da Defesa Civil e extensão de água observada.',
      en: 'Flood alerts: official bulletins, Civil Defense alerts and observed water extent.',
    },
    feedsToConnect: [
      { name: 'SGB · Sistema de Alerta Hidrológico (SACE) Amazonas', url: 'https://www.sgb.gov.br/sace/amazonas/ultimo_boletim.php' },
      { name: 'Defesa Civil · Interface de Divulgação de Alertas Públicos (IDAP / CAP)', url: 'https://idapfront.mdr.gov.br/' },
      { name: 'CEMADEN · alertas', url: 'https://www.gov.br/cemaden/' },
      { name: 'ANA · HidroWeb', url: 'https://www.snirh.gov.br/hidroweb/' },
    ],
  },
  mining: {
    description: {
      pt: 'Alertas de garimpo e abertura de floresta: DETER (INPE), RADD (radar Sentinel-1) e MapBiomas Alerta.',
      en: 'Mining and forest-clearing alerts: DETER (INPE), RADD (Sentinel-1 radar) and MapBiomas Alerta.',
    },
    feedsToConnect: [
      { name: 'MapBiomas Alerta (API, requer chave)', url: 'https://plataforma.alerta.mapbiomas.org/' },
      { name: 'GFW · alertas integrados RADD/GLAD', url: 'https://data.globalforestwatch.org/' },
    ],
  },
  drought: {
    description: {
      pt: 'Alertas de estiagem: vazante extrema, isolamento de comunidades e situação de emergência.',
      en: 'Drought alerts: extreme low water, isolated communities and emergency declarations.',
    },
    feedsToConnect: [
      { name: 'SGB · Sistema de Alerta Hidrológico (SACE) Amazonas', url: 'https://www.sgb.gov.br/sace/amazonas/ultimo_boletim.php' },
      { name: 'S2iD · reconhecimentos de situação de emergência', url: 'https://s2id.mi.gov.br/' },
    ],
  },
} satisfies Record<string, { description: L; feedsToConnect: Array<{ name: string; url: string }> }>

// ---------- map snapshot ----------

async function mapPng(ctx: ExportContext): Promise<Uint8Array<ArrayBuffer> | null> {
  const canvas = await captureMapCanvas()
  const map = getSnapshotMap()
  if (!canvas || !map) return null
  const g = canvas.getContext('2d')
  if (!g) return null
  const { c, lang } = ctx
  const k = canvas.width / Math.max(1, map.getCanvas().clientWidth)

  // Critical areas are HTML markers on screen, so they are drawn onto the copy.
  g.textBaseline = 'middle'
  for (const h of c.hotspots) {
    const p = map.project(h.center)
    const x = p.x * k
    const y = p.y * k
    if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) continue
    g.beginPath()
    g.arc(x, y, 7 * k, 0, Math.PI * 2)
    g.fillStyle = RISK_COLOR[h.level]
    g.fill()
    g.lineWidth = 2 * k
    g.strokeStyle = '#ffffff'
    g.stroke()
    g.font = `600 ${13 * k}px system-ui, sans-serif`
    g.lineWidth = 3 * k
    g.strokeStyle = 'rgba(0,0,0,0.75)'
    const tx = h.labelLeft ? x - 12 * k - g.measureText(h.name).width : x + 12 * k
    g.strokeText(h.name, tx, y)
    g.fillStyle = '#ffffff'
    g.fillText(h.name, tx, y)
  }

  // Caption band: what, where, when, and the map credits.
  const bar = 70 * k
  g.fillStyle = 'rgba(8,14,11,0.78)'
  g.fillRect(0, canvas.height - bar, canvas.width, bar)
  const ctr = map.getCenter()
  const pad = 16 * k
  g.textBaseline = 'alphabetic'
  g.fillStyle = '#ffffff'
  g.font = `700 ${15 * k}px system-ui, sans-serif`
  g.fillText(`IARA · ${tr(c.analysis, lang)} · ${tr(c.place, lang)}`, pad, canvas.height - bar + 24 * k)

  // Legend of the critical-area levels, right-aligned on the title line.
  g.font = `500 ${12 * k}px system-ui, sans-serif`
  let lx = canvas.width - pad
  for (const l of ['watch', 'high', 'critical'] as RiskLevel[]) {
    const label = LEVEL_LABEL[l][lang]
    lx -= g.measureText(label).width
    g.fillStyle = 'rgba(255,255,255,0.85)'
    g.fillText(label, lx, canvas.height - bar + 24 * k)
    lx -= 10 * k
    g.beginPath()
    g.arc(lx, canvas.height - bar + 20 * k, 5 * k, 0, Math.PI * 2)
    g.fillStyle = RISK_COLOR[l]
    g.fill()
    lx -= 16 * k
  }
  const areas = lang === 'pt' ? 'Áreas críticas' : 'Critical areas'
  lx -= g.measureText(areas).width - 6 * k
  g.fillStyle = 'rgba(255,255,255,0.6)'
  g.fillText(areas, lx, canvas.height - bar + 24 * k)

  g.font = `400 ${12 * k}px system-ui, sans-serif`
  g.fillStyle = 'rgba(255,255,255,0.85)'
  g.fillText(
    `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · ${lang === 'pt' ? 'centro' : 'centre'} ${ctr.lng.toFixed(4)}, ${ctr.lat.toFixed(4)} · zoom ${map.getZoom().toFixed(1)}`,
    pad,
    canvas.height - bar + 44 * k
  )
  const attrib = document.querySelector('.maplibregl-ctrl-attrib-inner')?.textContent?.trim()
  if (attrib) {
    g.fillStyle = 'rgba(255,255,255,0.6)'
    g.font = `400 ${10.5 * k}px system-ui, sans-serif`
    g.fillText(fit(g, attrib, canvas.width - 2 * pad), pad, canvas.height - bar + 61 * k)
  }

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null
}

function fit(g: CanvasRenderingContext2D, text: string, width: number): string {
  if (g.measureText(text).width <= width) return text
  let t = text
  while (t.length > 1 && g.measureText(`${t}…`).width > width) t = t.slice(0, t.lastIndexOf(' ') > 0 ? t.lastIndexOf(' ') : t.length - 1)
  return `${t}…`
}

const LEVEL_LABEL: Record<RiskLevel, L> = {
  critical: { pt: 'crítico', en: 'critical' },
  high: { pt: 'alto', en: 'high' },
  watch: { pt: 'atenção', en: 'watch' },
}

// ---------- GeoJSON ----------

interface Layers {
  deterArchive: Feature<Polygon | MultiPolygon, DeterProps>[]
  deterLive: { since: string; features: Feature<Polygon | MultiPolygon, DeterProps>[] } | null
  communities: Communities | null
}

async function loadLayers(ctx: ExportContext, miss: Missing): Promise<Layers> {
  const { c, outline } = ctx
  const yano = c.id === 'YANO'
  const frame = REGIONS.find((r) => r.id === c.id)!.bbox as Bbox
  const [archive, live, comm] = await Promise.all([
    yano ? miss.try('DETER mineração (arquivo local)', () => deterArchive(outline)) : Promise.resolve([]),
    yano ? miss.try('DETER (INPE TerraBrasilis, últimos 12 meses)', () => deterLive(frame)) : Promise.resolve(null),
    miss.try(ctx.lang === 'pt' ? 'Comunidades e terras indígenas' : 'Communities and Indigenous lands', () => communities(outline)),
  ])
  return { deterArchive: archive ?? [], deterLive: live, communities: comm }
}

function buildGeoJson(ctx: ExportContext, layers: Layers): FeatureCollection {
  const { c, outline } = ctx
  const frame = REGIONS.find((r) => r.id === c.id)!.bbox as Bbox
  const boundarySource =
    c.outline.kind === 'ti'
      ? { source: 'FUNAI (via INPE) · terras indígenas', source_url: 'https://www.gov.br/funai/pt-br/atuacao/terras-indigenas/geoprocessamento-e-mapas' }
      : {
          source: 'IBGE · Malha Municipal (servicodados)',
          source_url: `https://servicodados.ibge.gov.br/api/v3/malhas/municipios/${c.outline.code}`,
        }
  const features: Feature[] = []

  if (outline) {
    features.push({
      type: 'Feature',
      geometry: outline.geometry,
      properties: { layer: 'boundary', name: c.outline.kind === 'ti' ? `TI ${c.outline.name}` : c.placeShort, ...boundarySource },
    })
  }
  features.push({
    type: 'Feature',
    geometry: bboxPolygon(c.sarBbox),
    properties: { layer: 'sar_aoi', name: 'SAR / optical crop box', note: 'Area used for the SAR before/after and Sentinel-2 crops' },
  })
  features.push({
    type: 'Feature',
    geometry: bboxPolygon(frame),
    properties: { layer: 'case_frame', name: 'Case map frame' },
  })
  for (const h of c.hotspots) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: h.center },
      properties: {
        layer: 'critical_area',
        id: h.id,
        name: h.name,
        level: h.level,
        color: RISK_COLOR[h.level],
        note_pt: h.note.pt,
        note_en: h.note.en,
        approximate_location: !!h.approx,
      },
    })
  }
  for (const f of layers.deterArchive) {
    features.push({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        layer: 'deter_mining_archive',
        class: f.properties.classname,
        date: f.properties.view_date,
        area_km2: f.properties.areamunkm,
        municipality: f.properties.municipality ?? null,
        source: 'INPE DETER · mineração 2019–2026',
      },
    })
  }
  for (const f of layers.deterLive?.features ?? []) {
    features.push({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        layer: 'deter_live',
        class: f.properties.classname,
        date: f.properties.view_date,
        area_km2: f.properties.areamunkm,
        municipality: f.properties.municipality ?? null,
        source: 'INPE DETER · TerraBrasilis WFS',
      },
    })
  }
  for (const f of layers.communities?.riverside ?? []) {
    const p = f.properties
    features.push({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        layer: 'riverside_community',
        name: p.nome,
        type: p.tipo,
        municipality: p.municipio,
        river: p.rio,
        nearest_city: p.cidade_prox,
        distance_to_city_km: p.dist_cidade_km,
        access_difficulty: p.dificuldade,
        main_activity_municipality: p.atividade_principal_mun,
        source: 'IBGE (pacote de dados da equipe)',
      },
    })
  }
  for (const f of layers.communities?.indigenous ?? []) {
    const p = f.properties
    features.push({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        layer: 'indigenous_land',
        name: p.nome,
        people: p.etnia,
        phase: p.fase,
        area_km2: p.area_km2,
        source: 'FUNAI (via INPE)',
      },
    })
  }

  return {
    type: 'FeatureCollection',
    // Non-standard but widely read; keeps the provenance with the file.
    ...({ name: `iara-${SLUG[c.id]}`, generated_at: new Date().toISOString() } as object),
    features,
  } as FeatureCollection
}

// ---------- public entry points ----------

export function packageName(c: CaseStudy): string {
  return `iara-${SLUG[c.id]}-${today()}`
}

export async function exportGeoJson(ctx: ExportContext): Promise<Blob> {
  ctx.onStep?.('layers')
  const layers = await loadLayers(ctx, new Missing())
  return new Blob([json(buildGeoJson(ctx, layers))], { type: 'application/geo+json' })
}

export async function exportMapImage(ctx: ExportContext): Promise<Blob | null> {
  ctx.onStep?.('map')
  const png = await mapPng(ctx)
  return png ? new Blob([png], { type: 'image/png' }) : null
}

export async function exportPackage(ctx: ExportContext): Promise<Blob> {
  const { c, lang } = ctx
  const pt = lang === 'pt'
  const miss = new Missing()
  const dir = `${packageName(c)}/`
  const files: ZipEntry[] = []
  const add = (name: string, data: ZipEntry['data']) => files.push({ name: dir + name, data })
  const point = c.series.points.find((p) => p.year === ctx.year) ?? c.series.points[c.series.points.length - 1]
  const frame = REGIONS.find((r) => r.id === c.id)!.bbox as Bbox
  const slug = SLUG[c.id]

  // 1. What is on screen.
  ctx.onStep?.('map')
  const png = await miss.try(pt ? 'Imagem do mapa' : 'Map image', () => mapPng(ctx))
  if (png) add('map.png', png)

  // 2. Vector layers inside the boundary.
  ctx.onStep?.('layers')
  const layers = await loadLayers(ctx, miss)
  add('area.geojson', json(buildGeoJson(ctx, layers)))

  // 3. SAR: scenes over the crop box, the before/after picked in the comparator (or of the series year), local mosaics.
  ctx.onStep?.('sar')
  const pick =
    ctx.sarPick && ctx.sarPick.bbox.join(',') === c.sarBbox.join(',') && (ctx.sarPick.before || ctx.sarPick.after)
      ? ctx.sarPick
      : null
  const beforeDate = pick?.before?.date ?? point.sar?.before ?? c.series.points[0].date ?? point.date ?? today()
  const afterDate = pick?.after?.date ?? point.sar?.after ?? point.date ?? today()
  const [archive, mosaicList, localCat] = await Promise.all([
    miss.try(pt ? 'Arquivo SAR (Planetary Computer / ASF)' : 'SAR archive (Planetary Computer / ASF)', () =>
      withTimeout(loadArchive(c.sarBbox), 45000)
    ),
    miss.try(pt ? 'Metadados dos mosaicos SAR' : 'SAR mosaic metadata', () => mosaics(slug)),
    miss.try(pt ? 'Catálogo Sentinel-1 local' : 'Local Sentinel-1 catalog', () => localS1Catalog(slug)),
  ])
  const scenes: ArchiveScene[] = archive?.scenes ?? []
  const pair = {
    before: pick?.before ?? closestScene(scenes, beforeDate, 'Sentinel-1'),
    after: pick?.after ?? closestScene(scenes, afterDate, 'Sentinel-1'),
  }
  for (const [tag, s] of [
    ['before', pair.before],
    ['after', pair.after],
  ] as const) {
    if (!s) continue
    const kind = s.mission === 'NISAR' ? 'nisar-l' : 'sentinel1-vv'
    // Sentinel-1 is cropped on the server; NISAR browse images are cropped in the browser, as in the comparator.
    const bytes = await miss.try(`${s.mission} ${s.date}`, async () => getBytes(await sceneImageUrl(s, c.sarBbox), 45000))
    if (bytes) add(`sar/${tag}_${s.date}_${kind}.png`, bytes)
  }
  const sceneRows: Array<Array<string | number | null>> = [
    ['date', 'mission', 'band', 'scene_id', 'origin', 'image_url', 'source_url'],
    ...scenes.map((s) => [s.date, s.mission, s.band, s.id, s.mission === 'NISAR' ? 'ASF DAAC' : 'Microsoft Planetary Computer', s.url, s.sourceUrl]),
    ...(localCat ?? []).map((g) => [
      g.startTime.slice(0, 10),
      'Sentinel-1 GRD',
      'C',
      g.granuleName,
      `ASF (catálogo local · path ${g.path} frame ${g.frame} ${g.flightDirection} ${g.polarization})`,
      g.sourceBrowse,
      `https://search.asf.alaska.edu/#/?searchType=List%20Search&searchList=${g.granuleName}`,
    ]),
  ]
  add('sar/scenes.csv', csv(sceneRows))

  // 4. Visible (optical) imagery for the same dates.
  ctx.onStep?.('optical')
  const [optBefore, optAfter] = await Promise.all([
    miss.try(`Sentinel-2 ${beforeDate}`, () => withTimeout(findOpticalScene(c.sarBbox, beforeDate), 30000)),
    miss.try(`Sentinel-2 ${afterDate}`, () => withTimeout(findOpticalScene(c.sarBbox, afterDate), 30000)),
  ])
  for (const [tag, s] of [
    ['before', optBefore],
    ['after', optAfter],
  ] as const) {
    if (!s) continue
    const bytes = await miss.try(`Sentinel-2 ${s.date}`, () => getBytes(s.url, 45000))
    if (bytes) add(`optical/${tag}_${s.date}_sentinel2-rgb.jpg`, bytes)
  }

  // 5. Alerts, with slots for the feeds still to be connected.
  ctx.onStep?.('alerts')
  const flow = c.id === 'YANO' ? null : await miss.try(pt ? 'Previsão de vazão GEOGLOWS' : 'GEOGLOWS flow forecast', () => flowOutlook(frame))
  const levelCount = (['critical', 'high', 'watch'] as RiskLevel[]).map((l) => ({
    level: l,
    count: c.hotspots.filter((h) => h.level === l).length,
  }))
  // Official feeds are not connected yet: their items stay empty until a feed fills them.
  const slot = (kind: keyof typeof ALERT_SLOTS, applicable: boolean, fromSite: unknown[]): AlertSlot => ({
    applies_to_case: applicable,
    description: ALERT_SLOTS[kind].description,
    from_site: fromSite,
    official_alerts: { status: 'awaiting_feed', items: [], feeds_to_connect: ALERT_SLOTS[kind].feedsToConnect },
  })
  const alerts = {
    generated_at: new Date().toISOString(),
    case: c.id,
    risk: { level: c.risk.level, summary: c.risk.summary },
    critical_areas: { by_level: levelCount, items: c.hotspots },
    flood: slot('flood', c.id === 'ENCH', c.id === 'ENCH' && flow ? [{ type: 'river_flow_forecast', ...flow }] : []),
    mining: slot(
      'mining',
      c.id === 'YANO',
      c.id === 'YANO'
        ? [
            ...(layers.deterLive
              ? [{ type: 'deter_live', source: 'INPE DETER', since: layers.deterLive.since, count: layers.deterLive.features.length, layer_in_geojson: 'deter_live' }]
              : []),
            { type: 'deter_mining_archive', source: 'INPE DETER', period: '2019–2026', count: layers.deterArchive.length, layer_in_geojson: 'deter_mining_archive' },
            { type: 'radd_tiles', source: 'Wageningen University · GFW', tile_url: RADD_TILE, note: 'Raster tiles; shown on the map when the RADD card is on.' },
          ]
        : []
    ),
    drought: slot('drought', c.id === 'SECA', c.id === 'SECA' && flow ? [{ type: 'river_flow_forecast', ...flow }] : []),
  }
  add('alerts.json', json(alerts))

  // 6. Tables and the full structured record.
  add(
    'critical-areas.csv',
    csv([
      ['id', 'name', 'level', 'lon', 'lat', 'approximate_location', 'note_pt', 'note_en'],
      ...c.hotspots.map((h) => [h.id, h.name, h.level, h.center[0], h.center[1], !!h.approx, h.note.pt, h.note.en]),
    ])
  )
  add(
    'time-series.csv',
    csv([
      ['year', 'date', `value_${c.series.unit}`, 'sar_before', 'sar_after', 'note_pt', 'note_en'],
      ...c.series.points.map((p) => [p.year, p.date ?? null, p.value, p.sar?.before ?? null, p.sar?.after ?? null, p.note.pt, p.note.en]),
    ])
  )
  if (c.riverStage) {
    add(
      'river-stage.csv',
      csv([
        ['year', 'date', 'annual_max_m', 'provisional'],
        ...c.riverStage.peaks.map((p) => [p.year, p.date, p.value, !!p.approx]),
      ])
    )
  }
  if (flow) {
    add(
      'flow-forecast.csv',
      csv([['date', 'median_m3s', 'p25_m3s', 'p75_m3s'], ...flow.days.map((d) => [d.date, d.median, d.lower, d.upper])])
    )
  }

  const data = {
    generated_at: new Date().toISOString(),
    app: 'IARA · NASA Space Apps 2026',
    language: lang,
    case: {
      id: c.id,
      theme: c.theme,
      place: c.place,
      headline: c.headline,
      meta: c.meta,
      hero: c.hero,
      stats: c.stats,
      population_2022: ctx.population,
      boundary: c.outline,
      ibge_code: c.ibgeCode ?? null,
      map_frame_bbox: frame,
      sar_crop_bbox: c.sarBbox,
      selected_year: point.year,
    },
    screen: {
      sar_mosaic_on_map: ctx.sarBand,
      radd_on_map: ctx.raddOn,
      deter_on_map: ctx.deterOn,
    },
    risk: c.risk,
    critical_areas: c.hotspots,
    series: c.series,
    river_stage: c.riverStage
      ? {
          station: c.riverStage.station,
          station_url: c.riverStage.stationUrl,
          thresholds: c.riverStage.thresholds,
          peaks: c.riverStage.peaks,
          record_low: c.riverStage.recordLow,
          sources: c.riverStage.sources,
        }
      : null,
    sar: {
      reading: c.sarReading,
      selected_pair: { picked_in_comparator: !!pick, before_date: beforeDate, after_date: afterDate, ...pair },
      archive_scene_count: scenes.length,
      mosaics: mosaicList ?? [],
    },
    optical: {
      sentinel2_before: optBefore,
      sentinel2_after: optAfter,
      s2cloudless_2025_tiles: satelliteTiles(c.sarBbox),
      modis_true_color: {
        before: worldviewSnapshot(beforeDate, c.sarBbox),
        after: worldviewSnapshot(afterDate, c.sarBbox),
      },
    },
    river_flow_forecast: flow,
    communities: {
      riverside_count: layers.communities?.riverside.length ?? null,
      indigenous_lands_count: layers.communities?.indigenous.length ?? null,
    },
    sources: c.sources,
    news: c.news ?? [],
    missing: miss.items,
  }
  add('data.json', json(data))

  add('README.md', readme(ctx, { files, dir, point, picked: !!pick, beforeDate, afterDate, layers, flow, scenes: scenes.length, missing: miss.items }))

  ctx.onStep?.('zip')
  return makeZip(files)
}

// ---------- README ----------

function readme(
  ctx: ExportContext,
  x: {
    files: ZipEntry[]
    dir: string
    point: { year: number }
    picked: boolean
    beforeDate: string
    afterDate: string
    layers: Layers
    flow: FlowOutlook | null
    scenes: number
    missing: string[]
  }
): string {
  const { c, lang } = ctx
  const pt = lang === 'pt'
  const names = x.files.map((f) => f.name.slice(x.dir.length))
  const has = (n: string) => names.includes(n)
  const list = (prefix: string) => names.filter((n) => n.startsWith(prefix))
  const L: string[] = []
  const boundary =
    c.outline.kind === 'ti'
      ? pt ? `Terra Indígena ${c.outline.name} (limite FUNAI)` : `${c.outline.name} Indigenous Land (FUNAI boundary)`
      : pt ? `Município de ${c.placeShort}, AM (malha IBGE, código ${c.outline.code})` : `${c.placeShort} municipality, AM (IBGE boundary, code ${c.outline.code})`

  L.push(`# IARA · ${tr(c.analysis, lang)} · ${tr(c.place, lang)}`, '')
  L.push(pt ? `Gerado em ${new Date().toISOString()} pelo IARA (NASA Space Apps 2026).` : `Generated on ${new Date().toISOString()} by IARA (NASA Space Apps 2026).`, '')
  L.push(pt ? '## Recorte' : '## Area', '')
  L.push(`- ${pt ? 'Limite' : 'Boundary'}: ${boundary}`)
  L.push(`- ${pt ? 'Caixa SAR/óptico' : 'SAR/optical box'}: ${c.sarBbox.join(', ')} (W, S, E, N)`)
  if (x.picked) {
    L.push(`- ${pt ? 'Datas escolhidas no comparador de radar' : 'Dates picked in the radar comparator'}: ${pt ? 'antes' : 'before'} ${x.beforeDate}, ${pt ? 'depois' : 'after'} ${x.afterDate}`)
  } else {
    L.push(`- ${pt ? 'Ano selecionado na série' : 'Year picked on the series'}: ${x.point.year} (${pt ? 'antes' : 'before'} ${x.beforeDate}, ${pt ? 'depois' : 'after'} ${x.afterDate})`)
  }
  if (ctx.population) L.push(`- ${pt ? 'População (Censo 2022, IBGE)' : 'Population (2022 Census, IBGE)'}: ${ctx.population.toLocaleString(pt ? 'pt-BR' : 'en-US')}`)
  L.push('')

  L.push(pt ? '## Arquivos' : '## Files', '')
  const row = (n: string, d: string) => L.push(`- \`${n}\`: ${d}`)
  if (has('map.png')) row('map.png', pt ? 'o mapa como estava na tela, com as áreas críticas e a legenda.' : 'the map as it was on screen, with critical areas and caption.')
  row('area.geojson', pt
    ? 'camadas vetoriais para QGIS/ArcGIS. Campo `layer`: `boundary`, `sar_aoi`, `case_frame`, `critical_area`' + (c.id === 'YANO' ? ', `deter_live`, `deter_mining_archive`' : '') + ', `riverside_community`, `indigenous_land`.'
    : 'vector layers for QGIS/ArcGIS. Field `layer`: `boundary`, `sar_aoi`, `case_frame`, `critical_area`' + (c.id === 'YANO' ? ', `deter_live`, `deter_mining_archive`' : '') + ', `riverside_community`, `indigenous_land`.')
  row('alerts.json', pt
    ? 'alertas por tipo (`flood` enchente, `mining` garimpo, `drought` seca). Em cada bloco, `from_site` traz o que o IARA já tem e `official_alerts` é o espaço reservado para os alertas oficiais (status `awaiting_feed` até a fonte ser conectada; `feeds_to_connect` lista as fontes).'
    : 'alerts by kind (`flood`, `mining`, `drought`). In each block, `from_site` holds what IARA already has and `official_alerts` is the space kept for official alerts (status `awaiting_feed` until the feed is connected; `feeds_to_connect` lists the feeds).')
  row('critical-areas.csv', pt ? 'áreas críticas com nível (crítico, alto, atenção) e coordenadas.' : 'critical areas with level (critical, high, watch) and coordinates.')
  row('time-series.csv', `${tr(c.series.title, lang)} (${c.series.unit}). ${pt ? 'Fonte' : 'Source'}: ${c.series.source.label}.`)
  if (has('river-stage.csv')) row('river-stage.csv', pt ? `máximas anuais em ${c.riverStage!.station}.` : `annual maxima at ${c.riverStage!.station}.`)
  if (has('flow-forecast.csv') && x.flow) row('flow-forecast.csv', pt ? `previsão de vazão (mediana e faixa P25–P75) em ${x.flow.site}, GEOGLOWS/ECMWF.` : `river flow forecast (median and P25–P75) at ${x.flow.site}, GEOGLOWS/ECMWF.`)
  row('sar/scenes.csv', pt ? `${x.scenes} cenas SAR que cobrem a caixa (Sentinel-1 RTC e NISAR GCOV), mais o catálogo Sentinel-1 do projeto.` : `${x.scenes} SAR scenes covering the box (Sentinel-1 RTC and NISAR GCOV), plus the project Sentinel-1 catalog.`)
  for (const n of list('sar/').filter((n) => n.endsWith('.png'))) {
    row(n, n.includes('nisar')
      ? pt ? 'recorte NISAR banda L (imagem de visualização GCOV, ~180 m) da caixa SAR.' : 'NISAR L-band crop (GCOV browse image, ~180 m) of the SAR box.'
      : pt ? 'recorte Sentinel-1 (VV, dB de -22 a 0) da caixa SAR, 10 m.' : 'Sentinel-1 crop (VV, dB from -22 to 0) of the SAR box, 10 m.')
  }
  for (const n of list('optical/')) row(n, pt ? 'recorte Sentinel-2 L2A em cor natural da mesma caixa.' : 'Sentinel-2 L2A natural-colour crop of the same box.')
  row('data.json', pt ? 'tudo acima em formato estruturado, com links das imagens, mosaicos NISAR/Sentinel-1 e fontes.' : 'everything above in structured form, with image links, NISAR/Sentinel-1 mosaics and sources.')
  L.push('')

  L.push(pt ? '## Como ler o radar' : '## Reading the radar', '', tr(c.sarReading, lang), '')

  L.push(pt ? '## Fontes' : '## Sources', '')
  const seen = new Set<string>()
  for (const s of [c.series.source, ...c.sources, ...(c.riverStage?.sources ?? [])]) {
    if (seen.has(s.url)) continue
    seen.add(s.url)
    L.push(`- [${s.label}](${s.url})`)
  }
  L.push(
    '- [Microsoft Planetary Computer · Sentinel-1 RTC / Sentinel-2 L2A](https://planetarycomputer.microsoft.com/)',
    '- [ASF DAAC · NISAR / Sentinel-1](https://search.asf.alaska.edu/)',
    '- [EOX · Sentinel-2 cloudless](https://s2maps.eu/)'
  )
  if (c.id === 'YANO') L.push('- [INPE · DETER / TerraBrasilis](https://terrabrasilis.dpi.inpe.br/)')
  if (x.flow) L.push(`- [GEOGLOWS · ECMWF](${GEOGLOWS_VIEWER})`)
  L.push('')

  L.push(pt ? '## Limitações' : '## Limitations', '')
  L.push(pt
    ? '- Nenhum pixel bruto é rotulado como enchente, garimpo ou dano confirmado. Os recortes de radar e óptico são para interpretação e checagem.'
    : '- No raw pixel is labelled as confirmed flood, mining or damage. Radar and optical crops are for interpretation and checking.')
  L.push(pt
    ? '- Áreas críticas marcadas como aproximadas indicam a região, não um ponto exato.'
    : '- Critical areas marked approximate point to a region, not an exact spot.')
  L.push(pt
    ? '- Previsões de vazão são modeladas (GEOGLOWS) e não substituem os boletins oficiais do SGB e da Defesa Civil.'
    : '- Flow forecasts are modelled (GEOGLOWS) and do not replace official SGB and Civil Defense bulletins.')
  if (x.missing.length) {
    L.push('', pt ? '## Não disponível no momento da exportação' : '## Not available at export time', '')
    for (const m of x.missing) L.push(`- ${m}`)
  }
  L.push('')
  return L.join('\n')
}
