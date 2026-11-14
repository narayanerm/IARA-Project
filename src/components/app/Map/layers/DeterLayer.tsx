import { Layer, Source } from 'react-map-gl/maplibre'
import type { useDeterAlerts } from '@/lib/useDeterAlerts'

export function DeterLayer({
  focusedTi,
  deter,
}: {
  focusedTi: string | null
  deter: ReturnType<typeof useDeterAlerts>
}) {
  if (!focusedTi || !deter.features.features.length) return null
  return (
    <Source id="deter-alerts" key={`deter-${focusedTi}`} type="geojson" data={deter.features}>
      <Layer
        id="deter-alerts-fill"
        type="fill"
        paint={{
          'fill-color': [
            'case',
            ['boolean', ['in', 'MINERACAO', ['upcase', ['coalesce', ['get', 'classname'], '']]], false], 'hsl(0 90% 60%)',
            ['boolean', ['in', 'GARIMPO', ['upcase', ['coalesce', ['get', 'classname'], '']]], false], 'hsl(0 90% 60%)',
            ['boolean', ['in', 'DESMATAMENTO', ['upcase', ['coalesce', ['get', 'classname'], '']]], false], 'hsl(28 95% 60%)',
            ['boolean', ['in', 'DEGRADACAO', ['upcase', ['coalesce', ['get', 'classname'], '']]], false], 'hsl(48 85% 55%)',
            'hsl(190 85% 60%)',
          ],
          'fill-opacity': 0.55,
        }}
      />
      <Layer
        id="deter-alerts-line"
        type="line"
        paint={{ 'line-color': '#fff', 'line-opacity': 0.75, 'line-width': 0.7 }}
      />
    </Source>
  )
}
