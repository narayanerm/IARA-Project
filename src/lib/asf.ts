import type { Polygon } from 'geojson'

export type AsfPlatform =
  | 'NISAR'
  | 'Sentinel-1'
  | 'ALOS-2'
  | 'ALOS'
  | 'UAVSAR'

export interface AsfGranuleRaw {
  granuleName: string
  dataset: string | null
  beamMode: string | null
  flightDirection: 'ASCENDING' | 'DESCENDING' | null
  instrument: string | null
  orbit: string[] | string | null
  path: number | null
  frame: number | null
  polarization: string | null
  productType: string | null
  productTypeDisplay: string | null
  startTime: string
  stopTime: string
  wkt: string
  downloadUrl: string | null
  sizeMB: number | null
  browse: string[] | null
  thumb: string | null
  nisar?: { mainBandPolarization?: string[] } | null
}

export interface AsfGranule {
  id: string
  dataset: string
  beamMode: string | null
  flightDirection: 'ASCENDING' | 'DESCENDING' | null
  instrument: string
  orbit: string | null
  path: number | null
  frame: number | null
  polarization: string[]
  productType: string
  productTypeDisplay: string | null
  startTime: string
  stopTime: string
  sizeMB: number | null
  downloadUrl: string | null
  vertexUrl: string
  browseUrl: string | null
  thumbUrl: string | null
  footprint: Polygon
}

export interface AsfSearchParams {
  platform: AsfPlatform
  bbox?: [number, number, number, number]
  intersectsPoint?: [number, number]
  start?: string
  end?: string
  maxResults?: number
  processingLevel?: string
  relativeOrbit?: number
  frame?: number
  flightDirection?: 'ASCENDING' | 'DESCENDING'
}

const BASE_URL = 'https://api.daac.asf.alaska.edu/services/search/param'

const PLATFORM_DEFAULTS: Record<
  AsfPlatform,
  { processingLevel?: string; band: 'L' | 'S' | 'C' }
> = {
  NISAR: { processingLevel: 'GCOV', band: 'L' },
  'Sentinel-1': { processingLevel: 'GRD_HD', band: 'C' },
  'ALOS-2': { band: 'L' },
  ALOS: { processingLevel: 'L1.5', band: 'L' },
  UAVSAR: { band: 'L' },
}

const cache = new Map<string, { at: number; data: AsfGranule[] }>()
const inflight = new Map<string, Promise<AsfGranule[]>>()
const TTL_MS = 10 * 60 * 1000

function cacheKey(p: AsfSearchParams) {
  return JSON.stringify(p)
}

function parseWktPolygon(wkt: string): Polygon | null {
  const m = wkt.match(/^POLYGON\s*\(\((.+)\)\)$/i)
  if (!m) return null
  const rings = m[1].split('),(').map((ring) =>
    ring
      .replace(/^\(|\)$/g, '')
      .split(',')
      .map((pair) => {
        const [lon, lat] = pair.trim().split(/\s+/).map(Number)
        return [lon, lat] as [number, number]
      })
  )
  if (!rings.length || !rings[0].length) return null
  return { type: 'Polygon', coordinates: rings }
}

function normalizePolarization(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .split(/[+,/\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
}

function normalize(r: AsfGranuleRaw): AsfGranule | null {
  const footprint = parseWktPolygon(r.wkt)
  if (!footprint) return null
  const orbit = Array.isArray(r.orbit) ? (r.orbit[0] ?? null) : r.orbit
  return {
    id: r.granuleName,
    dataset: r.dataset ?? r.instrument ?? '—',
    beamMode: r.beamMode,
    flightDirection: r.flightDirection,
    instrument: r.instrument ?? '—',
    orbit,
    path: r.path,
    frame: r.frame,
    polarization: r.polarization
      ? normalizePolarization(r.polarization)
      : (r.nisar?.mainBandPolarization ?? []),
    productType: r.productType ?? '—',
    productTypeDisplay: r.productTypeDisplay,
    startTime: r.startTime,
    stopTime: r.stopTime,
    sizeMB: r.sizeMB,
    downloadUrl: r.downloadUrl,
    vertexUrl: `https://search.asf.alaska.edu/#/?zoom=8&granule=${encodeURIComponent(r.granuleName)}`,
    browseUrl:
      r.browse?.find((u) => u.endsWith('_LATLON_thumbnail.png')) ?? r.browse?.[0] ?? null,
    thumbUrl: r.thumb ?? null,
    footprint,
  }
}

function deduplicateByGranule(list: AsfGranule[]): AsfGranule[] {
  const seen = new Map<string, AsfGranule>()
  for (const g of list) {
    const base = g.id.split('-')[0]
    if (!seen.has(base)) seen.set(base, g)
  }
  return Array.from(seen.values())
}

export async function searchGranules(
  params: AsfSearchParams,
  { signal }: { signal?: AbortSignal } = {}
): Promise<AsfGranule[]> {
  const key = cacheKey(params)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data
  const pending = inflight.get(key)
  if (pending) return pending
  // Not tied to the caller's AbortSignal: other components may be awaiting the same request.
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const p = fetchGranules(params)
  inflight.set(key, p)
  try {
    return await p
  } finally {
    inflight.delete(key)
  }
}

async function fetchGranules(params: AsfSearchParams): Promise<AsfGranule[]> {
  const key = cacheKey(params)

  const defaults = PLATFORM_DEFAULTS[params.platform]
  const url = new URL(BASE_URL)
  url.searchParams.set('platform', params.platform)
  url.searchParams.set('output', 'jsonlite')
  url.searchParams.set('maxResults', String(params.maxResults ?? 20))
  if (params.processingLevel || defaults.processingLevel) {
    url.searchParams.set('processingLevel', params.processingLevel ?? defaults.processingLevel!)
  }
  if (params.start) url.searchParams.set('start', params.start)
  if (params.end) url.searchParams.set('end', params.end)
  if (params.bbox) {
    url.searchParams.set(
      'bbox',
      `${params.bbox[0]},${params.bbox[1]},${params.bbox[2]},${params.bbox[3]}`
    )
  }
  if (params.intersectsPoint) {
    url.searchParams.set(
      'intersectsWith',
      `POINT(${params.intersectsPoint[0]} ${params.intersectsPoint[1]})`
    )
  }
  if (params.relativeOrbit !== undefined) {
    url.searchParams.set('relativeOrbit', String(params.relativeOrbit))
  }
  if (params.frame !== undefined) {
    url.searchParams.set('frame', String(params.frame))
  }
  if (params.flightDirection) {
    url.searchParams.set('flightDirection', params.flightDirection)
  }

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`ASF search ${res.status}`)
  const body = (await res.json()) as { results?: AsfGranuleRaw[] }
  const raw = body.results ?? []
  const normalized = raw.map(normalize).filter((x): x is AsfGranule => !!x)
  const deduped = deduplicateByGranule(normalized).sort((a, b) =>
    b.startTime.localeCompare(a.startTime)
  )
  cache.set(key, { at: Date.now(), data: deduped })
  return deduped
}

export function bandFor(platform: AsfPlatform): 'L' | 'S' | 'C' {
  return PLATFORM_DEFAULTS[platform].band
}
