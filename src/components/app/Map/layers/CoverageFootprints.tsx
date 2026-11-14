import { useMemo } from 'react'
import { Layer, Source } from 'react-map-gl/maplibre'
import type { FeatureCollection } from 'geojson'
import type { AsfGranule } from '@/lib/asf'

export function BrazilCoverageLayer({ data }: { data: AsfGranule[] }) {
  const fc = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: data.map((g, i) => ({
        type: 'Feature',
        geometry: g.footprint,
        properties: {
          id: g.id,
          dataset: g.dataset,
          startTime: g.startTime,
          polarization: g.polarization.join('+'),
          ageIdx: Math.min(i, 100),
        },
      })),
    }),
    [data]
  )

  if (!data.length) return null

  return (
    <Source id="br-coverage" type="geojson" data={fc}>
      <Layer
        id="br-coverage-fill"
        beforeId="reserves-fill"
        type="fill"
        paint={{
          'fill-color': 'hsl(190 95% 55%)',
          // Swath fills read as a wash once zoomed in; keep them for the national overview only.
          'fill-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4,
            ['interpolate', ['linear'], ['get', 'ageIdx'], 0, 0.2, 100, 0.05],
            7,
            0,
          ],
        }}
      />
      <Layer
        id="br-coverage-outline"
        beforeId="reserves-fill"
        type="line"
        paint={{
          'line-color': 'hsl(190 100% 75%)',
          'line-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4,
            ['interpolate', ['linear'], ['get', 'ageIdx'], 0, 0.7, 100, 0.15],
            9,
            ['interpolate', ['linear'], ['get', 'ageIdx'], 0, 0.35, 100, 0.08],
          ],
          'line-width': 1.0,
        }}
      />
    </Source>
  )
}

export function AsfFootprintsLayer({ data }: { data: AsfGranule[] }) {
  const fc = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: data.slice(0, 8).map((g, i) => ({
        type: 'Feature',
        geometry: g.footprint,
        properties: {
          id: g.id,
          dataset: g.dataset,
          startTime: g.startTime,
          polarization: g.polarization.join('+'),
          flightDirection: g.flightDirection,
          age: i,
        },
      })),
    }),
    [data]
  )

  if (!data.length) return null

  return (
    <Source id="asf-footprints" type="geojson" data={fc}>
      <Layer
        id="asf-footprints-fill"
        beforeId="community-points-anchor"
        type="fill"
        paint={{
          'fill-color': 'hsl(190 95% 60%)',
          // Swaths are ~250 km wide: zoomed in, the whole view sits inside several and the fills stack into a wash.
          'fill-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            6,
            ['interpolate', ['linear'], ['get', 'age'], 0, 0.16, 8, 0.03],
            8.5,
            0,
          ],
        }}
      />
      <Layer
        id="asf-footprints-line"
        beforeId="community-points-anchor"
        type="line"
        paint={{
          'line-color': 'hsl(190 95% 70%)',
          'line-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            6,
            ['interpolate', ['linear'], ['get', 'age'], 0, 0.95, 8, 0.2],
            11,
            ['interpolate', ['linear'], ['get', 'age'], 0, 0.45, 8, 0.1],
          ],
          'line-width': 1.2,
          'line-dasharray': [2, 1.5],
        }}
      />
    </Source>
  )
}
