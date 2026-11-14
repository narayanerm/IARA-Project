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
