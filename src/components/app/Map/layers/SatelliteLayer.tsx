import { Layer, Source } from 'react-map-gl/maplibre'
import { RELIEF_LAYER, SATELLITE_ATTRIBUTION, SATELLITE_TILES } from '../constants'

export function SatelliteLayer({ on, beforeId }: { on: boolean; beforeId: string | undefined }) {
  if (!on || !beforeId) return null
  return (
    <Source
      id="satellite"
      type="raster"
      tiles={[SATELLITE_TILES]}
      tileSize={256}
      maxzoom={14}
      attribution={SATELLITE_ATTRIBUTION}
    >
      <Layer
        id="satellite-layer"
        type="raster"
        beforeId={RELIEF_LAYER}
        // No cross-fade: each arriving tile would otherwise keep the map repainting for 300 ms mid-zoom.
        paint={{ 'raster-brightness-max': 0.88, 'raster-saturation': -0.05, 'raster-fade-duration': 0 }}
      />
    </Source>
  )
}
