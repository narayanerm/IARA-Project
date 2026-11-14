import { Layer, Source } from 'react-map-gl/maplibre'
import type { FeatureCollection } from 'geojson'

export function IbgeMunicipiosLayer({ on, data }: { on: boolean; data: FeatureCollection | null }) {
  if (!on || !data) return null
  return (
    <Source id="ibge-municipios" type="geojson" data={data}>
      <Layer
        id="ibge-municipios-line"
        type="line"
        paint={{
          'line-color': 'hsl(0 0% 100% / 0.4)',
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.3, 10, 1.1],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0, 8, 0.6, 11, 0.9],
        }}
      />
    </Source>
  )
}
