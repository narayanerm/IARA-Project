import { Layer, Source } from 'react-map-gl/maplibre'
import { RELIEF_LAYER, RELIEF_PAINT } from '../constants'

// Always in the style once labels are known (hidden while off, so no DEM tiles load): it marks where
// imagery ends and labels begin, so the satellite stays under the shading whichever is switched on first.
export function TerrainSource({ on, beforeId }: { on: boolean; beforeId: string | undefined }) {
  if (!beforeId) return null
  return (
    <Source
      id="terrain-dem"
      type="raster-dem"
      tiles={['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png']}
      tileSize={256}
      encoding="terrarium"
      maxzoom={13}
      attribution="AWS Terrain Tiles"
    >
      <Layer
        id={RELIEF_LAYER}
        type="hillshade"
        beforeId={beforeId}
        layout={{ visibility: on ? 'visible' : 'none' }}
        paint={RELIEF_PAINT}
      />
    </Source>
  )
}
