import { Layer, Source } from 'react-map-gl/maplibre'

import { useApp } from '@/lib/store'
import { useIaraExtent } from '@/lib/useIaraExtent'

/**
 * Renders the IARA predicted-extent overlay per case:
 *   - YANO: polygon of pixels predicted to be deforested within 1 year, clipped
 *     by the TI Yanomami perimeter, coloured by risk bucket.
 *   - ENCH: polygon of the maximum flood corridor around the Rio Negro course
 *     at the peak P90 level predicted for the next 365 days.
 *   - SECA: polygon of the lake area that retracts between wet and dry Sentinel-1
 *     scenes (Otsu on VV), highlighting the ring the lake loses in extreme drought.
 */
export function IaraForecastLayer({ beforeId }: { beforeId?: string }) {
  const activeRegion = useApp((s) => s.activeRegion)
  const caseTab = useApp((s) => s.caseTab)
  const { data } = useIaraExtent(activeRegion)

  // Only draw the forecast overlay when the user is actually looking at the
  // alerts/forecast panel — otherwise the colored polygons cover the base map
  // without any legend nearby to explain them.
  if (caseTab !== 'forecast') return null
  if (!data || !data.geojson.features.length) return null

  // YANO: forecast raster vectorized into pixel-aligned polygons produced visible
  // straight-line artefacts on the map (grid edges from the source raster). Disable
  // for now; re-enable once the vectorizer smooths or morphologically closes them.
  if (data.meta.kind === 'YANO') {
    return null
  }

  if (data.meta.kind === 'ENCH') {
    return (
      <Source id="iara-ench-extent" type="geojson" data={data.geojson}>
        <Layer
          id="iara-ench-maxflood-fill"
          type="fill"
          beforeId={beforeId}
          filter={['==', ['get', 'kind'], 'max_flood']}
          paint={{
            'fill-color': '#F59E42',
            'fill-opacity': 0.4,
            'fill-outline-color': '#F0A050',
          }}
        />
        <Layer
          id="iara-ench-channel-fill"
          type="fill"
          beforeId={beforeId}
          filter={['==', ['get', 'kind'], 'channel']}
          paint={{
            'fill-color': '#5AA7C9',
            'fill-opacity': 0.45,
            'fill-outline-color': '#5AA7C9',
          }}
        />
      </Source>
    )
  }

  // SECA
  return (
    <Source id="iara-seca-extent" type="geojson" data={data.geojson}>
      <Layer
        id="iara-seca-permanent-fill"
        type="fill"
        beforeId={beforeId}
        filter={['==', ['get', 'kind'], 'permanent']}
        paint={{
          'fill-color': '#5AA7C9',
          'fill-opacity': 0.4,
          'fill-outline-color': '#5AA7C9',
        }}
      />
      <Layer
        id="iara-seca-retraction-fill"
        type="fill"
        beforeId={beforeId}
        filter={['==', ['get', 'kind'], 'retraction']}
        paint={{
          'fill-color': '#E97A4B',
          'fill-opacity': 0.55,
          'fill-outline-color': '#F05A20',
        }}
      />
    </Source>
  )
}
