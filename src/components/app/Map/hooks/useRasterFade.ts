import { gibsMaxZoom, type GibsLayer } from '@/lib/gibs'

// Coarse NASA rasters (km-scale pixels) fade out past their native zoom instead of smearing over the map.
export function rasterFade(layer: GibsLayer, opacity: number) {
  const z = gibsMaxZoom(layer)
  return ['interpolate', ['linear'], ['zoom'], z, opacity, z + 1.5, opacity * 0.4, z + 3, 0] as [
    'interpolate',
    ['linear'],
    ['zoom'],
    number,
    number,
    number,
    number,
    number,
    number,
  ]
}
