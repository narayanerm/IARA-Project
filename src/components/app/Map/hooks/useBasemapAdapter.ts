import { useEffect } from 'react'
import * as maplibregl from 'maplibre-gl'
import { HIDDEN_UNDER_SATELLITE } from '../constants'

const isBasemapLayer = (map: maplibregl.Map, layer: maplibregl.LayerSpecification) =>
  'source' in layer &&
  typeof layer.source === 'string' &&
  !layer.source.startsWith('gibs') &&
  map.getSource(layer.source)?.type === 'vector'

// Restyles the dark basemap so its labels stay readable over the satellite imagery and the
// vector layers that would double-print under it are hidden. Returns a function that undoes it.
function adaptBasemapToImagery(map: maplibregl.Map): () => void {
  const undo: Array<() => void> = []
  for (const layer of map.getStyle().layers) {
    if (!isBasemapLayer(map, layer)) continue
    if (layer.type === 'symbol') {
      const color = map.getPaintProperty(layer.id, 'text-color')
      const halo = map.getPaintProperty(layer.id, 'text-halo-color')
      const width = map.getPaintProperty(layer.id, 'text-halo-width')
      map.setPaintProperty(layer.id, 'text-color', 'hsl(0 0% 94%)')
      map.setPaintProperty(layer.id, 'text-halo-color', 'hsl(222 47% 6% / 0.85)')
      map.setPaintProperty(layer.id, 'text-halo-width', 1.4)
      undo.push(() => {
        map.setPaintProperty(layer.id, 'text-color', color)
        map.setPaintProperty(layer.id, 'text-halo-color', halo)
        map.setPaintProperty(layer.id, 'text-halo-width', width)
      })
      continue
    }
    if (!('source-layer' in layer) || !HIDDEN_UNDER_SATELLITE.has(layer['source-layer'] ?? '')) continue
    if (map.getLayoutProperty(layer.id, 'visibility') === 'none') continue
    map.setLayoutProperty(layer.id, 'visibility', 'none')
    undo.push(() => map.setLayoutProperty(layer.id, 'visibility', 'visible'))
  }
  return () => {
    for (const fn of undo) fn()
  }
}

export function useBasemapAdapter(
  getMap: () => maplibregl.Map | undefined,
  satelliteOn: boolean,
  mapLoaded: boolean
) {
  useEffect(() => {
    const m = getMap()
    if (!m || !mapLoaded || !satelliteOn) return
    return adaptBasemapToImagery(m)
  }, [getMap, satelliteOn, mapLoaded])
}
