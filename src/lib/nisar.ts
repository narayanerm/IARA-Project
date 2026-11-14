import type { Polygon } from 'geojson'

// Live NISAR catalog from the ASF Search API (same backend as ASF Vertex).
// Nothing is downloaded: we read metadata + the public, georeferenced browse
// images (PNG + KML) that ASF publishes for every NISAR product.

export type NisarProduct = 'GCOV' | 'GUNW'

/** First acquisition of the public, calibrated (PROVISIONAL) NISAR L-band release. */
export const NISAR_PROVISIONAL_START = '2026-06-17T00:00:00Z'
/** Earliest public NISAR L-band products (pre-calibration BETA, from Oct 2025). */
export const NISAR_FIRST_DATA = '2025-10-01T00:00:00Z'
/** Pseudo track key: every track merged into one chronological series. */
export const ALL_TRACKS = 'all'

const SEARCH_URL = 'https://api.daac.asf.alaska.edu/services/search/param'

interface NisarRaw {
  granuleName: string
  productType: string | null
  collectionName?: string | null
  flightDirection: 'ASCENDING' | 'DESCENDING' | null
  path: number | null
  frame: number | null
  orbit: string[] | string | null
  startTime: string
  stopTime: string
  wkt: string
  downloadUrl: string | null
  fileName?: string | null
  browse: string[] | null
  nisar?: {
    additionalUrls?: string[]
    crid?: string
    frameCoverage?: string
    mainBandPolarization?: string[]
    rangeBandwidth?: string[]
    sizeMB?: Record<string, { bytes?: number; format?: string }>
  } | null
}

export interface NisarScene {
  id: string
  product: NisarProduct
  collection: string
  /** Relative orbit (track) number. */
  track: number | null
  frame: number | null
  direction: 'A' | 'D' | null
  cycle: string | null
  /** Polarization mode token from the file name, e.g. DHDH (dual-pol HH+HV), SHSH (HH only). */
  polMode: string | null
  polarizations: string[]
  startTime: string
  stopTime: string
  /** Acquisition date (GCOV) or reference date (GUNW), YYYY-MM-DD. */
  date: string
  /** GUNW only: secondary date, YYYY-MM-DD. */
  date2: string | null
  crid: string | null
  frameCoverage: string | null
  sizeBytes: number | null
  footprint: Polygon
  downloadUrl: string | null
  vertexUrl: string
  browsePng: string | null
  browseThumb: string | null
  browseKml: string | null
  qaReportUrl: string | null
  /** Pre-calibration BETA product (before the PROVISIONAL release). */
  beta: boolean
}

/** MapLibre image-source corners: top-left, top-right, bottom-right, bottom-left. */
export type ImageCorners = [[number, number], [number, number], [number, number], [number, number]]

function parseWktPolygon(wkt: string): Polygon | null {
  const m = wkt.match(/^POLYGON\s*\(\((.+)\)\)$/i)
  if (!m) return null
  const ring = m[1]
    .split(/\)\s*,\s*\(/)[0]
    .split(',')
    .map((pair) => {
      const [lon, lat] = pair.trim().split(/\s+/).map(Number)
      return [lon, lat] as [number, number]
    })
  if (ring.length < 4 || ring.some(([a, b]) => Number.isNaN(a) || Number.isNaN(b))) return null
  return { type: 'Polygon', coordinates: [ring] }
}

// NISAR_L2_PR_GCOV_034_140_D_090_4005_DHDH_A_20261102T221630_...
// NISAR_L2_PR_GUNW_032_140_D_090_033_4000_SH_20261009T221629_20261009T221704_20261021T221629_...
function parseName(name: string) {
  const parts = name.split('_')
  const product = parts[3]
  const cycle = parts[4] ?? null
  if (product === 'GUNW') {
    return { cycle, polMode: parts[10] ?? null }
  }
  return { cycle, polMode: parts[9] ?? null }
}

function normalize(r: NisarRaw): NisarScene | null {
  const product = r.productType === 'GCOV' || r.productType === 'GUNW' ? r.productType : null
  if (!product) return null
  const footprint = parseWktPolygon(r.wkt)
  if (!footprint) return null
  const { cycle, polMode } = parseName(r.granuleName)
  const browse = r.browse ?? []
  const browsePng = browse.find((u) => u.endsWith('_LATLON.png')) ?? null
  const browseThumb = browse.find((u) => u.endsWith('_LATLON_thumbnail.png')) ?? null
  const extra = r.nisar?.additionalUrls ?? []
  const browseKml =
    extra.find((u) => u.endsWith('_LATLON.kml')) ??
    (browsePng ? browsePng.replace(/_LATLON\.png$/, '_LATLON.kml') : null)
  const qaReportUrl = extra.find((u) => u.endsWith('_QA_REPORT.pdf')) ?? null
  const h5 = r.fileName && r.nisar?.sizeMB ? r.nisar.sizeMB[r.fileName] : undefined
  const date = r.startTime.slice(0, 10)
  const date2 = product === 'GUNW' ? r.stopTime.slice(0, 10) : null
  return {
    id: r.granuleName,
    product,
    collection: r.collectionName ?? `NISAR_L2_${product}`,
    track: r.path,
    frame: r.frame,
    direction: r.flightDirection ? (r.flightDirection[0] as 'A' | 'D') : null,
    cycle,
    polMode,
    polarizations: r.nisar?.mainBandPolarization ?? [],
    startTime: r.startTime,
    stopTime: r.stopTime,
    date,
    date2,
    crid: r.nisar?.crid ?? null,
    frameCoverage: r.nisar?.frameCoverage ?? null,
    sizeBytes: h5?.bytes ?? null,
    footprint,
    downloadUrl: r.downloadUrl,
    vertexUrl: `https://search.asf.alaska.edu/#/?dataset=NISAR&zoom=7&granule=${encodeURIComponent(r.granuleName)}`,
    browsePng,
    browseThumb,
    browseKml,
    qaReportUrl,
    beta: /BETA/i.test(r.collectionName ?? ''),
  }
}

export interface NisarQuery {
  bbox: [number, number, number, number]
  products: NisarProduct[]
  start?: string
  end?: string
  maxResults?: number
}

const TTL_MS = 15 * 60 * 1000
const memCache = new Map<string, { at: number; data: NisarScene[] }>()
const inflight = new Map<string, Promise<NisarScene[]>>()

export async function searchNisar(q: NisarQuery): Promise<NisarScene[]> {
  const key = JSON.stringify(q)
  const hit = memCache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data
  const pending = inflight.get(key)
  if (pending) return pending

  const url = new URL(SEARCH_URL)
  url.searchParams.set('platform', 'NISAR')
  url.searchParams.set('processingLevel', q.products.join(','))
  url.searchParams.set('bbox', q.bbox.join(','))
  url.searchParams.set('start', q.start ?? NISAR_FIRST_DATA)
  if (q.end) url.searchParams.set('end', q.end)
  url.searchParams.set('maxResults', String(q.maxResults ?? 1000))
  url.searchParams.set('output', 'jsonlite')

  const p = (async () => {
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`ASF search ${res.status}`)
    const body = (await res.json()) as { results?: NisarRaw[] }
    const seen = new Set<string>()
    const scenes: NisarScene[] = []
    for (const r of body.results ?? []) {
      const s = normalize(r)
      if (!s || seen.has(s.id)) continue
      seen.add(s.id)
      scenes.push(s)
    }
    scenes.sort((a, b) => a.startTime.localeCompare(b.startTime))
    memCache.set(key, { at: Date.now(), data: scenes })
    return scenes
  })()
  inflight.set(key, p)
  try {
    return await p
  } finally {
    inflight.delete(key)
  }
}

// ---- Browse-image georeferencing (KML GroundOverlay) ----

const cornerCache = new Map<string, Promise<ImageCorners | null>>()

function parseKmlCorners(kml: string): ImageCorners | null {
  const quad = kml.match(/LatLonQuad>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/i)
  if (quad) {
    const pts = quad[1]
      .trim()
      .split(/\s+/)
      .map((p) => p.split(',').map(Number))
      .filter((p) => p.length >= 2 && !Number.isNaN(p[0]) && !Number.isNaN(p[1]))
      .map((p) => [p[0], p[1]] as [number, number])
    // KML LatLonQuad order is counter-clockwise from lower-left: LL, LR, UR, UL.
    if (pts.length >= 4) return [pts[3], pts[2], pts[1], pts[0]]
  }
  const num = (tag: string) => {
    const m = kml.match(new RegExp(`<${tag}>\\s*([-0-9.eE+]+)\\s*</${tag}>`, 'i'))
    return m ? Number(m[1]) : NaN
  }
  const n = num('north')
  const s = num('south')
  const e = num('east')
  const w = num('west')
  if ([n, s, e, w].every((v) => !Number.isNaN(v))) {
    return [
      [w, n],
      [e, n],
      [e, s],
      [w, s],
    ]
  }
  return null
}

async function cornersFromKml(url: string): Promise<ImageCorners | null> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`KML ${r.status}`)
  return parseKmlCorners(await r.text())
}

/**
 * Fallback when the KML is not public (older PROVISIONAL products keep it in the
 * login-protected bucket): the LATLON PNG is a regular lat/lon grid with a transparent
 * background, so the extent of its opaque pixels matches the footprint's lon/lat extent.
 * Linear mapping between the two gives the image corners (checked against the KML: ~0.001°).
 */
async function cornersFromImage(scene: NisarScene): Promise<ImageCorners | null> {
  if (!scene.browsePng) return null
  const blob = await (await fetch(scene.browsePng)).blob()
  const bmp = await createImageBitmap(blob)
  const W = 1200
  const H = Math.max(1, Math.round((bmp.height * W) / bmp.width))
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(bmp, 0, 0, W, H)
  bmp.close()
  const d = ctx.getImageData(0, 0, W, H).data
  let x0 = W
  let x1 = -1
  let y0 = H
  let y1 = -1
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < x0 || y1 < y0) return null
  const ring = scene.footprint.coordinates[0]
  const lons = ring.map((p) => p[0])
  const lats = ring.map((p) => p[1])
  const lonMin = Math.min(...lons)
  const lonMax = Math.max(...lons)
  const latMin = Math.min(...lats)
  const latMax = Math.max(...lats)
  const dx = (lonMax - lonMin) / (x1 + 1 - x0)
  const dy = (latMax - latMin) / (y1 + 1 - y0)
  const w = lonMin - x0 * dx
  const e = lonMin + (W - x0) * dx
  const n = latMax + y0 * dy
  const s = latMax - (H - y0) * dy
  return [
    [w, n],
    [e, n],
    [e, s],
    [w, s],
  ]
}

export function browseCorners(scene: NisarScene): Promise<ImageCorners | null> {
  const key = scene.id
  let p = cornerCache.get(key)
  if (!p) {
    const kml = scene.browseKml
    // Only the browse bucket is public; product-bucket KMLs need an Earthdata login.
    const viaKml = kml && kml.includes('/BROWSE/') ? cornersFromKml(kml) : Promise.resolve(null)
    p = viaKml
      .catch(() => null)
      .then((c) => c ?? cornersFromImage(scene))
      .catch(() => null)
    cornerCache.set(key, p)
  }
  return p
}

// ---- Helpers ----

export function trackKey(s: Pick<NisarScene, 'track' | 'frame' | 'direction'>): string {
  return `${s.track ?? '?'}-${s.frame ?? '?'}-${s.direction ?? '?'}`
}

export function trackLabel(key: string): string {
  const [track, frame, dir] = key.split('-')
  const d = dir === 'A' ? 'asc' : dir === 'D' ? 'desc' : dir
  return `T${track} · F${frame} · ${d}`
}

export function formatBytes(b: number | null): string {
  if (b == null) return '—'
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`
  if (b >= 1e6) return `${(b / 1e6).toFixed(0)} MB`
  return `${Math.round(b / 1e3)} kB`
}

function pointInRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Share of `bbox` (0–1) inside the scene footprint polygon, by sampling a 20×20 grid. */
export function bboxOverlap(scene: NisarScene, bbox: [number, number, number, number]): number {
  const ring = scene.footprint.coordinates[0]
  const N = 20
  let hits = 0
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = bbox[0] + ((i + 0.5) / N) * (bbox[2] - bbox[0])
      const y = bbox[1] + ((j + 0.5) / N) * (bbox[3] - bbox[1])
      if (pointInRing(x, y, ring)) hits++
    }
  }
  return hits / (N * N)
}

/** Brand caption date format: DD.MM.YYYY */
export function brandDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}
