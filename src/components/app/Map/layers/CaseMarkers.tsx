import { Marker } from 'react-map-gl/maplibre'
import { CASES, RISK_COLOR } from '@/data/cases'
import { useApp, usePlaces } from '@/lib/store'
import { YANOMAMI_PLACES } from '@/data/yanomamiPlaces'

/** Pulsing watch zones of the active case. */
export function CaseMarkers() {
  const aoiActive = useApp((s) => s.aoiActive)
  const activeRegion = useApp((s) => s.activeRegion)
  const hotspotId = useApp((s) => s.hotspotId)
  const setHotspot = useApp((s) => s.setHotspot)
  const arrived = useApp((s) => s.caseArrived)
  const placePhase = usePlaces((s) => s.placePhase)

  if (!aoiActive || !arrived || placePhase !== 'idle') return null
  // In the Yanomami case, a watch zone that is also a notable place is drawn by YanomamiPlaceMarkers instead.
  const hotspots =
    activeRegion === 'YANO'
      ? CASES[activeRegion].hotspots.filter((h) => !YANOMAMI_PLACES.some((p) => p.id === h.id))
      : CASES[activeRegion].hotspots

  return (
    <>
      {hotspots.map((h, i) => (
        <Marker key={h.id} longitude={h.center[0]} latitude={h.center[1]} anchor="center">
          <button
            type="button"
            className={`hotspot hotspot-in${hotspotId === h.id ? ' is-active' : ''}${h.labelLeft ? ' is-left' : ''}`}
            style={{ '--c': RISK_COLOR[h.level], '--delay': `${i * 0.35}s`, '--delay-in': `${200 + i * 120}ms` } as React.CSSProperties}
            onClick={(e) => {
              e.stopPropagation()
              setHotspot(h.id)
            }}
            aria-label={h.name}
          >
            <span className="hotspot-label">{h.name}</span>
          </button>
        </Marker>
      ))}
    </>
  )
}
