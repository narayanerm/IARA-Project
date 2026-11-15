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
 *
 * Ported from manaus-flood-case branch. Adapted to main's AsfGranule shape (browseUrl/thumbUrl).
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
  url: string
  ring?: LonLat[]
  /** NISAR: every frame of that date over the box, drawn on top of each other as a mosaic. */
  parts?: Array<{ id: string; url: string; ring: LonLat[] }>
  sourceUrl: string
}

const PC_STAC = 'https://planetarycomputer.microsoft.com/api/stac/v1/search'
const PC_DATA = 'https://planetarycomputer.microsoft.com/api/data/v1'

export const CROP_WIDTH = 1000

export function cropSize(bbox: Bbox, width = CROP_WIDTH): { width: number; height: number } {
  const [w, s, e, n] = bbox
  const k = Math.cos((((s + n) / 2) * Math.PI) / 180)
  return { width, height: Math.round((width * (n - s)) / ((e - w) * k)) }
}

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
    const res = await fetch(PC_STAC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Planetary Computer ${res.status}`)
    const j = (await res.json()) as {
      features: StacItem[]
      links?: Array<{ rel: string; body?: Record<string, unknown> }>
    }
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

/** NISAR scenes left out after visual review over Manaus (they do not line up with the other dates). */
const NISAR_EXCLUDED_DATES = new Set(['2026-06-23', '2026-11-02'])

/** Share of the box covered by any of the rings, sampled on a 9×7 grid. */
function coverage(rings: number[][][], [w, s, e, n]: Bbox): number {
  let hit = 0
  let total = 0
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 7; j++) {
      const x = w + ((e - w) * (i + 0.5)) / 9
      const y = s + ((n - s) * (j + 0.5)) / 7
      total++
      if (rings.some((r) => pointInRing(x, y, r))) hit++
    }
  }
  return hit / total
}

/** Dates kept when their frames cover at least this share of the box (the rest is drawn dark). */
const NISAR_MIN_COVERAGE = 0.3

async function fetchNisar(bbox: Bbox): Promise<ArchiveScene[]> {
  const list = await searchGranules({
    platform: 'NISAR',
    processingLevel: 'GCOV',
    bbox,
    maxResults: 2000,
  })
  // One scene per date: frames that only cover part of the box are combined with the others of the same day.
  const byDate = new Map<string, typeof list>()
  for (const g of list) {
    const day = g.startTime.slice(0, 10)
    if (NISAR_EXCLUDED_DATES.has(day) || !(g.browseUrl ?? g.thumbUrl)) continue
    byDate.set(day, [...(byDate.get(day) ?? []), g])
  }
  const out: ArchiveScene[] = []
  for (const [day, frames] of byDate) {
    const rings = frames.map((g) => g.footprint.coordinates[0] as LonLat[])
    if (coverage(rings, bbox) < NISAR_MIN_COVERAGE) continue
    // Frames that cover the whole box go last so they end up on top.
    const parts = frames
      .map((g, i) => ({ id: g.id, url: (g.browseUrl ?? g.thumbUrl)!, ring: rings[i], full: coversBbox(rings[i], bbox) }))
      .sort((x, y) => Number(x.full) - Number(y.full))
      .map(({ id, url, ring }) => ({ id, url, ring }))
    const top = parts[parts.length - 1]
    out.push({
      id: `NISAR_${day}`,
      date: day,
      mission: 'NISAR',
      band: 'L',
      url: top.url,
      ring: top.ring,
      parts,
      sourceUrl: frames[frames.length - 1].vertexUrl,
    })
  }
  return out.sort((x, y) => x.date.localeCompare(y.date))
}

export interface ArchiveState {
  scenes: ArchiveScene[]
  loading: boolean
  error: string | null
}

const archiveCache = new Map<string, Promise<{ scenes: ArchiveScene[]; error: string | null }>>()

function loadArchive(bbox: Bbox) {
  const key = bbox.join(',')
  let p = archiveCache.get(key)
  if (!p) {
    p = Promise.allSettled([fetchSentinel1(bbox), fetchNisar(bbox)]).then((results) => {
      const all = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
      const errors = results.flatMap((r) =>
        r.status === 'rejected' ? [String(r.reason?.message ?? r.reason)] : []
      )
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

export async function sceneImageUrl(scene: ArchiveScene, bbox: Bbox): Promise<string> {
  if (scene.mission === 'Sentinel-1') return sentinel1CropUrl(scene.id, bbox, 2000)
  const c = document.createElement('canvas')
  const { width, height } = cropSize(bbox)
  c.width = width
  c.height = height
  await drawScene(c, scene, bbox)
  return c.toDataURL('image/png')
}

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

export interface Drawn {
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
    const [w, s, e, n] = bbox
    const parts = scene.parts ?? [{ id: scene.id, url: scene.url, ring: scene.ring ?? [] }]
    for (const part of parts) {
      const img = part.url === scene.url ? bmp : await loadBitmap(part.url).catch(() => null)
      if (!img) continue
      const g = nisarGeoref({ ...scene, id: part.id, url: part.url, ring: part.ring }, img)
      ctx.drawImage(img, (w - g.w) / g.dx, (g.n - n) / g.dy, (e - w) / g.dx, (n - s) / g.dy, 0, 0, W, H)
    }
  }
  if (scene.mission === 'Sentinel-1') return { coverage: 1 }
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

export interface OpticalScene {
  id: string
  date: string
  cloud: number
  url: string
}

const opticalCache = new Map<string, Promise<OpticalScene | null>>()

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
      const res = await fetch(PC_STAC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Planetary Computer ${res.status}`)
      const j = (await res.json()) as {
        features: Array<StacItem & { properties: { 'eo:cloud_cover': number } }>
      }
      const best = j.features
        .filter((f) => outerRings(f.geometry).some((r) => coversBbox(r, bbox)))
        .map((f) => {
          const days = Math.abs(new Date(f.properties.datetime).getTime() - t) / day
          return { f, score: days + f.properties['eo:cloud_cover'] }
        })
        .sort((a, b) => a.score - b.score)[0]?.f
      if (!best) return null
      const { width, height } = cropSize(bbox, 2000)
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
