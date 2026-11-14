import { useMemo } from 'react'
import { Layer, Source } from 'react-map-gl/maplibre'
import type { FeatureCollection } from 'geojson'
import { YANO_MINING } from '@/data/mocks/yanomami-mining'
import type { RegionId } from '@/lib/types'

export function YanoChangeLayer({ activeRegion }: { activeRegion: RegionId }) {
  const fc = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: YANO_MINING.map((p) => ({
        type: 'Feature',
        geometry: p.geometry,
        properties: {
          id: p.id,
          name: p.name,
          displacement: p.displacementMmPerYear,
          coherence: p.coherence,
        },
      })),
    }),
    []
  )

  if (activeRegion !== 'YANO') return null

  return (
    <Source id="yano-change" type="geojson" data={fc}>
      <Layer
        id="yano-change-fill"
        beforeId="community-points-anchor"
        type="fill"
        paint={{
          'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'displacement'],
            -12, 'hsl(10, 85%, 40%)',
            -8, 'hsl(20, 85%, 50%)',
            -4, 'hsl(38, 85%, 58%)',
            0, 'hsl(140, 30%, 45%)',
            2, 'hsl(150, 60%, 45%)',
          ],
          'fill-opacity': 0.72,
        }}
      />
      <Layer
        id="yano-change-outline"
        beforeId="community-points-anchor"
        type="line"
        paint={{ 'line-color': 'hsl(0 0% 100% / 0.4)', 'line-width': 0.8 }}
      />
    </Source>
  )
}
