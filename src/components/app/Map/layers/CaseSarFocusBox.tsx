import { Layer, Source } from 'react-map-gl/maplibre'
import type { Feature, Polygon } from 'geojson'
import { CASES } from '@/data/cases'
import { useApp } from '@/lib/store'

/**
 * Thin dashed rectangle marking the `sarBbox` on the map — the geographic focus
 * of the timeline tab's before/after sliders. Without it, a user sees the SAR
 * slider imagery but can't tell where on the map that image actually is.
 * Only shown when the user is on the `timeline` tab (nothing to anchor otherwise).
 */
export function CaseSarFocusBox({ beforeId }: { beforeId?: string }) {
  const activeRegion = useApp((s) => s.activeRegion)
  const aoiActive = useApp((s) => s.aoiActive)
  const caseTab = useApp((s) => s.caseTab)
  if (!aoiActive || caseTab !== 'timeline') return null
  const c = CASES[activeRegion]
  const [w, s, e, n] = c.sarBbox
  const box: Feature<Polygon> = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
    },
  }
  return (
    <Source id={`case-sar-focus-${activeRegion}`} type="geojson" data={box}>
      <Layer
        id={`case-sar-focus-${activeRegion}-line`}
        type="line"
        beforeId={beforeId}
        paint={{
          'line-color': c.color,
          'line-width': 1.4,
          'line-opacity': 0.9,
          'line-dasharray': [3, 3],
        }}
      />
    </Source>
  )
}
