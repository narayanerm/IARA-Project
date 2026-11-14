import { Layer, Source } from 'react-map-gl/maplibre'
import { AFFECTED_AREAS } from '@/data/layers/affected-areas'
import type { RegionId } from '@/lib/types'

export function AffectedAreasLayer({ activeRegion }: { activeRegion: RegionId }) {
  return (
    <Source
      id="affected-areas"
      key={`affected-${activeRegion}`}
      type="geojson"
      data={AFFECTED_AREAS[activeRegion]}
    >
      <Layer
        id="affected-fill"
        type="fill"
        paint={{
          'fill-color': [
            'match',
            ['get', 'kind'],
            'mining', 'hsl(0, 95%, 55%)',
            'flood', 'hsl(210, 95%, 62%)',
            'drought-shrink', 'hsl(38, 95%, 60%)',
            'drought-original', 'hsl(200, 60%, 50%)',
            'hsl(0, 0%, 60%)',
          ],
          'fill-opacity': ['match', ['get', 'kind'], 'drought-original', 0.08, 0.45],
        }}
      />
      <Layer
        id="affected-outline"
        type="line"
        paint={{
          'line-color': [
            'match',
            ['get', 'kind'],
            'mining', 'hsl(0, 100%, 75%)',
            'flood', 'hsl(210, 95%, 80%)',
            'drought-shrink', 'hsl(38, 95%, 80%)',
            'drought-original', 'hsl(200, 60%, 75%)',
            'hsl(0, 0%, 80%)',
          ],
          'line-width': 2.2,
          'line-opacity': 1,
        }}
      />
      <Layer
        id="affected-label"
        type="symbol"
        layout={{
          'text-field': ['concat', ['to-string', ['get', 'area_km2']], ' km²'],
          'text-size': 13,
          'text-font': ['Noto Sans Regular'],
          'text-letter-spacing': 0.02,
        }}
        paint={{ 'text-color': '#fff', 'text-halo-color': '#000', 'text-halo-width': 2 }}
      />
    </Source>
  )
}
