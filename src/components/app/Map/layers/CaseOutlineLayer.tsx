import { useMemo } from 'react'
import { Layer, Source } from 'react-map-gl/maplibre'
import type { FeatureCollection, Polygon } from 'geojson'
import { CASES } from '@/data/cases'
import { useApp } from '@/lib/store'
import { useCaseOutline, type Outline } from '@/lib/useCaseOutline'

const WORLD = [
  [-180, -85],
  [180, -85],
  [180, 85],
  [-180, 85],
  [-180, -85],
]

// The world with the case boundary punched out, so everything outside the cut-out is dimmed.
function maskOf(f: Outline): FeatureCollection<Polygon> {
  const holes = f.geometry.type === 'Polygon' ? [f.geometry.coordinates[0]] : f.geometry.coordinates.map((p) => p[0])
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [WORLD, ...holes] } }],
  }
}

/** The official boundary of the active case, with the rest of the map dimmed. */
export function CaseOutlineLayer() {
  const aoiActive = useApp((s) => s.aoiActive)
  const activeRegion = useApp((s) => s.activeRegion)
  const c = CASES[activeRegion]
  const outline = useCaseOutline(aoiActive ? c.outline : null)
  const mask = useMemo(() => (outline ? maskOf(outline) : null), [outline])

  if (!aoiActive || !outline || !mask) return null
  return (
    <>
      <Source id="case-mask" key={`mask-${activeRegion}`} type="geojson" data={mask}>
        <Layer id="case-mask-fill" type="fill" paint={{ 'fill-color': 'hsl(150 40% 3%)', 'fill-opacity': 0.55 }} />
      </Source>
      <Source id="case-outline" key={`outline-${activeRegion}`} type="geojson" data={outline}>
        <Layer
          id="case-outline-glow"
          type="line"
          paint={{ 'line-color': c.color, 'line-width': 7, 'line-opacity': 0.25, 'line-blur': 4 }}
        />
        <Layer id="case-outline-line" type="line" paint={{ 'line-color': c.color, 'line-width': 2 }} />
      </Source>
    </>
  )
}
