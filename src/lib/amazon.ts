import type { Polygon } from 'geojson'
import { AMAZON_BIOME } from '@/data/layers/indigenous-lands'

// The app works only with the Amazon biome (same simplified IBGE polygon drawn on the map).

const RINGS: number[][][] = AMAZON_BIOME.features.flatMap((f) =>
  f.geometry.type === 'Polygon'
    ? [f.geometry.coordinates[0]]
    : f.geometry.type === 'MultiPolygon'
      ? f.geometry.coordinates.map((p) => p[0])
      : []
)

function inRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function inAmazon(lon: number, lat: number): boolean {
  return RINGS.some((r) => inRing(lon, lat, r))
}

/** Bounding box of the Amazon biome: [west, south, east, north]. */
export const AMAZON_BBOX: [number, number, number, number] = (() => {
  const pts = RINGS.flat()
  const lons = pts.map((p) => p[0])
  const lats = pts.map((p) => p[1])
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
})()

/** True if a footprint overlaps the Amazon biome (vertex, centre or biome vertex inside). */
export function footprintInAmazon(footprint: Polygon): boolean {
  const ring = footprint.coordinates[0]
  if (ring.some(([x, y]) => inAmazon(x, y))) return true
  const cx = ring.reduce((a, p) => a + p[0], 0) / ring.length
  const cy = ring.reduce((a, p) => a + p[1], 0) / ring.length
  if (inAmazon(cx, cy)) return true
  return RINGS.some((r) => r.some(([x, y]) => inRing(x, y, ring)))
}
