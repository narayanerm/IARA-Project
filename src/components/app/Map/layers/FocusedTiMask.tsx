import { Layer, Source } from 'react-map-gl/maplibre'
import { worldWithHoleFC } from '@/lib/polygon-bbox'
import { firstRingOf } from '../hooks/useFocusedTi'
import type { FocusedTiState } from '../hooks/useFocusedTi'

// Dark hole-mask over the world minus the focused TI + cyan outline on top.
export function FocusedTiMask({ focused }: { focused: FocusedTiState }) {
  if (!focused.name || !focused.feature) return null
  const keySuffix = focused.funaiFeature ? 'f' : 'l'
  return (
    <>
      <Source
        id="focused-ti-mask"
        key={`mask-${focused.name}-${keySuffix}`}
        type="geojson"
        data={worldWithHoleFC(firstRingOf(focused.feature))}
      >
        <Layer
          id="focused-ti-mask-fill"
          type="fill"
          paint={{ 'fill-color': 'hsl(222 47% 5%)', 'fill-opacity': 0.75 }}
        />
      </Source>
      <Source
        id="focused-ti-outline-src"
        key={`outline-${focused.name}`}
        type="geojson"
        data={focused.feature}
      >
        <Layer
          id="focused-ti-outline"
          type="line"
          paint={{ 'line-color': 'hsl(190 95% 70%)', 'line-width': 2.5, 'line-opacity': 1 }}
        />
      </Source>
    </>
  )
}
