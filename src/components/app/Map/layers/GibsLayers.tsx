import { Layer, Source } from 'react-map-gl/maplibre'
import { TRUE_COLOR_LAYER, gibsMaxZoom, gibsTileUrl, type GibsLayer } from '@/lib/gibs'
import { rasterFade } from '../hooks/useRasterFade'

export function GibsTrueColorLayer({ on }: { on: boolean }) {
  if (!on) return null
  return (
    <Source
      id="gibs-truecolor"
      type="raster"
      tiles={[gibsTileUrl(TRUE_COLOR_LAYER)]}
      tileSize={256}
      maxzoom={gibsMaxZoom(TRUE_COLOR_LAYER)}
      attribution="NASA GIBS · MODIS"
    >
      <Layer
        id="gibs-truecolor-layer"
        beforeId="reserves-fill"
        type="raster"
        maxzoom={gibsMaxZoom(TRUE_COLOR_LAYER) + 3}
        paint={{ 'raster-opacity': rasterFade(TRUE_COLOR_LAYER, 0.55), 'raster-saturation': -0.1 }}
      />
    </Source>
  )
}

export function GibsOverlayLayer({ on, gibs }: { on: boolean; gibs: GibsLayer | null | undefined }) {
  if (!on || !gibs) return null
  if (gibs.kind === 'raster') {
    return (
      <Source
        id="gibs-raster"
        key={`gibs-${gibs.identifier}`}
        type="raster"
        tiles={[gibsTileUrl(gibs)]}
        tileSize={256}
        maxzoom={gibsMaxZoom(gibs)}
        attribution={`NASA GIBS · ${gibs.sensor}`}
      >
        <Layer
          id="gibs-raster-layer"
          beforeId="reserves-fill"
          type="raster"
          maxzoom={gibsMaxZoom(gibs) + 3}
          paint={{ 'raster-opacity': rasterFade(gibs, 0.6) }}
        />
      </Source>
    )
  }
  return (
    <Source
      id="gibs-vector"
      key={`gibs-${gibs.identifier}`}
      type="vector"
      tiles={[gibsTileUrl(gibs)]}
      minzoom={0}
      maxzoom={7}
      attribution={`NASA GIBS · ${gibs.sensor}`}
    >
      <Layer
        id="gibs-vector-glow"
        beforeId="community-points-anchor"
        type="circle"
        source-layer={gibs.identifier}
        paint={{
          'circle-radius': 10,
          'circle-color': gibs.paintColor,
          'circle-opacity': 0.25,
          'circle-blur': 1,
        }}
      />
      <Layer
        id="gibs-vector-dot"
        beforeId="community-points-anchor"
        type="circle"
        source-layer={gibs.identifier}
        paint={{
          'circle-radius': 3.2,
          'circle-color': gibs.paintColor,
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 0.6,
          'circle-opacity': 0.95,
        }}
      />
    </Source>
  )
}
