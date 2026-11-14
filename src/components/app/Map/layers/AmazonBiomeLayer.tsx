import { Layer, Source } from 'react-map-gl/maplibre'
import { AMAZON_BIOME } from '@/data/layers/indigenous-lands'

export function AmazonBiomeLayer() {
  return (
    <Source id="amazon-biome" type="geojson" data={AMAZON_BIOME}>
      <Layer
        id="amazon-biome-fill"
        type="fill"
        paint={{ 'fill-color': 'hsl(145 65% 35%)', 'fill-opacity': 0.08 }}
      />
      <Layer
        id="amazon-biome-line"
        type="line"
        paint={{
          'line-color': 'hsl(145 70% 55%)',
          'line-opacity': 0.45,
          'line-width': 1.3,
          'line-dasharray': [3, 2],
        }}
      />
    </Source>
  )
}
