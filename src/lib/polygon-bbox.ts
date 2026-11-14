import type { Polygon, FeatureCollection, Feature } from 'geojson'

export type Bbox = [number, number, number, number]

export function worldWithHoleFC(holeRing: number[][]): FeatureCollection<Polygon> {
  const feature: Feature<Polygon> = {
    type: 'Feature',
    properties: {},
    geometry: worldWithHole(holeRing),
  }
  return { type: 'FeatureCollection', features: [feature] }
}

export function polygonBbox(poly: Polygon): Bbox {
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  for (const ring of poly.coordinates) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon
      if (lat < minLat) minLat = lat
      if (lon > maxLon) maxLon = lon
      if (lat > maxLat) maxLat = lat
    }
  }
  return [minLon, minLat, maxLon, maxLat]
}

// MapLibre image source requires 4 corners TL, TR, BR, BL in [lon, lat].
export function bboxToImageCoords(
  bbox: Bbox
): [[number, number], [number, number], [number, number], [number, number]] {
  const [minLon, minLat, maxLon, maxLat] = bbox
  return [
    [minLon, maxLat],
    [maxLon, maxLat],
    [maxLon, minLat],
    [minLon, minLat],
  ]
}

// GeoJSON Polygon that covers the world EXCEPT the given hole (the TI).
// Used as a mask layer: fill this with background color to hide everything outside the TI.
export function worldWithHole(holeRing: number[][]): Polygon {
  const worldRing: number[][] = [
    [-179.9, -85],
    [179.9, -85],
    [179.9, 85],
    [-179.9, 85],
    [-179.9, -85],
  ]
  const closedHole =
    holeRing.length && holeRing[0][0] === holeRing[holeRing.length - 1][0] &&
    holeRing[0][1] === holeRing[holeRing.length - 1][1]
      ? holeRing
      : [...holeRing, holeRing[0]]
  return { type: 'Polygon', coordinates: [worldRing, closedHole] }
}

// World mask with one hole per outer ring, for areas made of several polygons.
export function worldWithHolesFC(holeRings: number[][][]): FeatureCollection<Polygon> {
  const [first, ...rest] = holeRings
  const base = worldWithHole(first ?? [])
  const closed = rest.map((r) =>
    r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1]) ? [...r, r[0]] : r
  )
  const geometry: Polygon = { type: 'Polygon', coordinates: [...base.coordinates, ...closed] }
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry }] }
}

const KM_PER_DEG_LAT = 111.32

export function bboxAround([lon, lat]: [number, number], km: number): Bbox {
  const dLat = km / KM_PER_DEG_LAT
  const dLon = km / (KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180))
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat]
}

export function circleRing([lon, lat]: [number, number], km: number, steps = 64): number[][] {
  const dLat = km / KM_PER_DEG_LAT
  const dLon = km / (KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180))
  const ring: number[][] = []
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI
    ring.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)])
  }
  return ring
}

export function bboxesIntersect(a: Bbox, b: Bbox): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]
}

export function haversineKm([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]): number {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}
