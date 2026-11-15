import { useEffect, useState } from 'react'
import { searchGranules } from './asf'

/**
 * Radar archive for one area (the case's crop box). Every image is produced for exactly that box,
 * so any two dates overlay pixel for pixel:
 *  - Sentinel-1 (C-band): radiometrically terrain-corrected scenes from the Microsoft Planetary
 *    Computer (collection sentinel-1-rtc). The data API crops each scene to the box on the server
 *    at full resolution (10 m pixels), north-up, in lon/lat.
 *  - NISAR (L-band): public GCOV browse images from ASF (lon/lat grid, ~180 m pixels), cropped
 *    to the same box in the browser.
 */

export type Bbox = [number, number, number, number]
type LonLat = [number, number]

export type ArchiveMission = 'Sentinel-1' | 'NISAR'

export interface ArchiveScene {
  id: string
  /** YYYY-MM-DD (UTC) */
  date: string
  mission: ArchiveMission
  band: 'C' | 'L'
  /** Image source: a crop URL (Sentinel-1) or the whole browse image (NISAR). */
  url: string
  /** NISAR only: footprint ring, used to place the browse image. */
  ring?: LonLat[]
  /** Page where the scene can be inspected or downloaded. */
  sourceUrl: string
}

const PC_STAC = 'https://planetarycomputer.microsoft.com/api/stac/v1/search'
const PC_DATA = 'https://planetarycomputer.microsoft.com/api/data/v1'

/** Output width (px) of every crop; height follows the box's aspect ratio. */
export const CROP_WIDTH = 1000

export function cropSize(bbox: Bbox, width = CROP_WIDTH): { width: number; height: number } {
  const [w, s, e, n] = bbox
  const k = Math.cos((((s + n) / 2) * Math.PI) / 180)
  return { width, height: Math.round((width * (n - s)) / ((e - w) * k)) }
}

/** Sentinel-1 VV backscatter in dB, grey scale: open water dark, city bright. */
export function sentinel1CropUrl(itemId: string, bbox: Bbox, width = CROP_WIDTH): string {
  const { height } = cropSize(bbox, width)
  const q = new URLSearchParams({
    collection: 'sentinel-1-rtc',
    item: itemId,
    assets: 'vv',
    expression: '10*log10(vv)',
    asset_as_band: 'True',
    rescale: '-22,0',
  })
  return `${PC_DATA}/item/bbox/${bbox.join(',')}/${width}x${height}.png?${q}`
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

function coversBbox(ring: number[][], [w, s, e, n]: Bbox): boolean {
  return [
    [w, s],
    [w, n],
    [e, s],
    [e, n],
    [(w + e) / 2, (s + n) / 2],
  ].every(([x, y]) => pointInRing(x, y, ring))
}

interface StacItem {
  id: string
  properties: { datetime: string }
  geometry: { type: string; coordinates: number[][][] | number[][][][] }
}

function outerRings(g: StacItem['geometry']): number[][][] {
  return g.type === 'MultiPolygon'
    ? (g.coordinates as number[][][][]).map((p) => p[0])
    : [(g.coordinates as number[][][])[0]]
}

async function fetchSentinel1(bbox: Bbox): Promise<ArchiveScene[]> {
  const [w, s, e, n] = bbox
  const out: ArchiveScene[] = []
  let body: Record<string, unknown> | null = {
    collections: ['sentinel-1-rtc'],
    intersects: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
    limit: 1000,
  }
  for (let page = 0; body && page < 5; page++) {
    const res = await fetch(PC_STAC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) throw new Error(`Planetary Computer ${res.status}`)
    const j = (await res.json()) as { features: StacItem[]; links?: Array<{ rel: string; body?: Record<string, unknown> }> }
    for (const f of j.features) {
      if (!outerRings(f.geometry).some((r) => coversBbox(r, bbox))) continue
      out.push({
        id: f.id,
        date: f.properties.datetime.slice(0, 10),
        mission: 'Sentinel-1',
        band: 'C',
        url: sentinel1CropUrl(f.id, bbox),
        sourceUrl: `https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-1-rtc/items/${f.id}`,
      })
    }
    body = j.links?.find((l) => l.rel === 'next')?.body ?? null
  }
  return out
}

async function fetchNisar(bbox: Bbox): Promise<ArchiveScene[]> {
  const list = await searchGranules({ platform: 'NISAR', processingLevel: 'GCOV', bbox, maxResults: 500 })
  return list
    .filter((g) => coversBbox(g.footprint.coordinates[0], bbox))
    .map((g) => {
      const url = g.previewUrl ?? g.browseUrl
      return url
        ? {
            id: g.id,
            date: g.startTime.slice(0, 10),
            mission: 'NISAR' as const,
            band: 'L' as const,
            url,
            ring: g.footprint.coordinates[0] as LonLat[],
            sourceUrl: g.vertexUrl,
          }
        : null
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
}

export interface ArchiveState {
  scenes: ArchiveScene[]
  loading: boolean
  error: string | null
}

const archiveCache = new Map<string, Promise<{ scenes: ArchiveScene[]; error: string | null }>>()

/** Fetches the archive once per box; the case panel and the map share the result. */
function loadArchive(bbox: Bbox) {
  const key = bbox.join(',')
  let p = archiveCache.get(key)
  if (!p) {
    p = Promise.allSettled([fetchSentinel1(bbox), fetchNisar(bbox)]).then((results) => {
      const all = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
      const errors = results.flatMap((r) => (r.status === 'rejected' ? [String(r.reason?.message ?? r.reason)] : []))
      const seen = new Set<string>()
      const scenes = all
        .sort((a, b) => a.date.localeCompare(b.date))
        .filter((s) => {
          const k = `${s.date}:${s.mission}`
          if (seen.has(k)) return false
          seen.add(k)
          return true
        })
      if (!scenes.length) archiveCache.delete(key)
      return { scenes, error: errors.length ? errors.join(' · ') : null }
    })
    archiveCache.set(key, p)
  }
  return p
}

/** All scenes covering `bbox`, oldest first, one per day and mission. */
export function useSarArchive(bbox: Bbox | undefined): ArchiveState {
  const [state, setState] = useState<ArchiveState>({ scenes: [], loading: !!bbox, error: null })
  const key = bbox?.join(',')

  useEffect(() => {
    if (!bbox) return
    let cancelled = false
    setState((s) => ({ ...s, loading: true }))
    loadArchive(bbox).then((r) => {
      if (!cancelled) setState({ scenes: r.scenes, loading: false, error: r.scenes.length ? null : r.error })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state
}

/**
 * Image of the scene cropped to `bbox`, ready for a map image source: the server crop URL for
 * Sentinel-1, a PNG data URL drawn in the browser for NISAR (its browse host allows CORS).
 */
export async function sceneImageUrl(scene: ArchiveScene, bbox: Bbox): Promise<string> {
  if (scene.mission === 'Sentinel-1') return sentinel1CropUrl(scene.id, bbox, 2000)
  const c = document.createElement('canvas')
  const { width, height } = cropSize(bbox)
  c.width = width
  c.height = height
  await drawScene(c, scene, bbox)
  return c.toDataURL('image/png')
}

/** Closest scene to `iso` in `mission` (or any), null if nothing within `maxDays`. */
export function closestScene(
  scenes: ArchiveScene[],
  iso: string,
  mission?: ArchiveMission,
  maxDays = 90
): ArchiveScene | null {
  const t = new Date(iso).getTime()
  const dist = (s: ArchiveScene) => Math.abs(new Date(s.date).getTime() - t) / 86400_000
  const pool = mission ? scenes.filter((s) => s.mission === mission) : scenes
  const best = pool.reduce<ArchiveScene | null>((b, s) => (!b || dist(s) < dist(b) ? s : b), null)
  return best && dist(best) <= maxDays ? best : null
}

/* ------------------------------------------------------------------ */
/* Drawing                                                              */
/* ------------------------------------------------------------------ */

export interface Drawn {
  /** Share of the box covered by valid radar data (0–1). */
  coverage: number
}

const bitmapCache = new Map<string, Promise<ImageBitmap>>()

function loadBitmap(url: string): Promise<ImageBitmap> {
  let p = bitmapCache.get(url)
  if (!p) {
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`image ${r.status}`)
        return r.blob()
      })
      .then((b) => createImageBitmap(b))
    p.catch(() => bitmapCache.delete(url))
    bitmapCache.set(url, p)
  }
  return p
}

const nisarGrid = new Map<string, { w: number; n: number; dx: number; dy: number }>()

/**
 * NISAR GCOV browse images sit on a regular lon/lat grid with square pixels and transparent padding.
 * The opaque swath's left/right extent matches the footprint's lon extent, which gives the pixel size.
 * The swath can be cut by the image's top or bottom edge (seen on track 140), so latitude is anchored
 * on the edge that is not cut. Checked against Sentinel-1 over Manaus: offsets of 0.1–0.3 km
 * (one to two browse pixels) for every scene.
 */
function nisarGeoref(scene: ArchiveScene, bmp: ImageBitmap) {
  const hit = nisarGrid.get(scene.id)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = bmp.width
  c.height = bmp.height
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bmp, 0, 0)
  const d = ctx.getImageData(0, 0, c.width, c.height).data
  let x0 = c.width
  let x1 = -1
  let y0 = c.height
  let y1 = -1
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (d[(y * c.width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  const ring = scene.ring ?? []
  const lons = ring.map((p) => p[0])
  const lats = ring.map((p) => p[1])
  const lonMin = Math.min(...lons)
  const latMin = Math.min(...lats)
  const latMax = Math.max(...lats)
  const px = (Math.max(...lons) - lonMin) / (x1 + 1 - x0)
  const cutTop = y0 <= 1
  const cutBottom = y1 >= c.height - 2
  const n = cutTop && !cutBottom ? latMin + (y1 + 1) * px : latMax + y0 * px
  const g = { w: lonMin - x0 * px, n, dx: px, dy: px }
  nisarGrid.set(scene.id, g)
  return g
}

/** Draws the scene over the whole canvas, which represents `bbox` (north-up, lon/lat linear). */
export async function drawScene(canvas: HTMLCanvasElement, scene: ArchiveScene, bbox: Bbox): Promise<Drawn> {
  const bmp = await loadBitmap(scene.url)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const W = canvas.width
  const H = canvas.height
  ctx.fillStyle = '#06100C'
  ctx.fillRect(0, 0, W, H)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  if (scene.mission === 'Sentinel-1') {
    ctx.drawImage(bmp, 0, 0, W, H)
  } else {
    const g = nisarGeoref(scene, bmp)
    const [w, s, e, n] = bbox
    ctx.drawImage(bmp, (w - g.w) / g.dx, (g.n - n) / g.dy, (e - w) / g.dx, (n - s) / g.dy, 0, 0, W, H)
  }
  if (scene.mission === 'Sentinel-1') return { coverage: 1 }
  // NISAR: share of the box with image data (the padding around the swath stays background-coloured).
  const d = ctx.getImageData(0, 0, W, H).data
  let valid = 0
  let total = 0
  for (let y = 2; y < H; y += 8) {
    for (let x = 2; x < W; x += 8) {
      const i = (y * W + x) * 4
      total++
      if (!(d[i] === 6 && d[i + 1] === 16 && d[i + 2] === 12)) valid++
    }
  }
  return { coverage: total ? valid / total : 0 }
}

/* ------------------------------------------------------------------ */
/* Optical image of the same period                                     */
/* ------------------------------------------------------------------ */

export interface OpticalScene {
  id: string
  date: string
  /** Cloud cover of the whole Sentinel-2 tile, in %. */
  cloud: number
  url: string
}

const opticalCache = new Map<string, Promise<OpticalScene | null>>()

/**
 * Sentinel-2 L2A true-colour scene closest to `iso` (±75 days) that covers the whole box, favouring
 * fewer clouds (score = days apart + cloud %). Cropped to the box by the Planetary Computer.
 */
export function findOpticalScene(bbox: Bbox, iso: string): Promise<OpticalScene | null> {
  const key = `${bbox.join(',')}|${iso}`
  let p = opticalCache.get(key)
  if (!p) {
    p = (async () => {
      const t = new Date(`${iso}T12:00:00Z`).getTime()
      const day = 86400_000
      const [w, s, e, n] = bbox
      const body = {
        collections: ['sentinel-2-l2a'],
        intersects: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
        datetime: `${new Date(t - 75 * day).toISOString()}/${new Date(t + 75 * day).toISOString()}`,
        query: { 'eo:cloud_cover': { lt: 60 } },
        limit: 500,
      }
      const res = await fetch(PC_STAC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error(`Planetary Computer ${res.status}`)
      const j = (await res.json()) as { features: Array<StacItem & { properties: { 'eo:cloud_cover': number } }> }
      const best = j.features
        .filter((f) => outerRings(f.geometry).some((r) => coversBbox(r, bbox)))
        .map((f) => {
          const days = Math.abs(new Date(f.properties.datetime).getTime() - t) / day
          return { f, score: days + f.properties['eo:cloud_cover'] }
        })
        .sort((a, b) => a.score - b.score)[0]?.f
      if (!best) return null
      const { width, height } = cropSize(bbox, 2000)
      // The true-colour image (TCI) made by ESA looks the same before and after the 2022 change in
      // Sentinel-2 processing (a colour formula on raw bands darkens pre-2022 scenes).
      const q = new URLSearchParams({
        collection: 'sentinel-2-l2a',
        item: best.id,
        assets: 'visual',
        asset_bidx: 'visual|1,2,3',
        nodata: '0',
      })
      return {
        id: best.id,
        date: best.properties.datetime.slice(0, 10),
        cloud: Math.round(best.properties['eo:cloud_cover']),
        url: `${PC_DATA}/item/bbox/${bbox.join(',')}/${width}x${height}.jpg?${q}`,
      }
    })()
    p.catch(() => opticalCache.delete(key))
    opticalCache.set(key, p)
  }
  return p
}
