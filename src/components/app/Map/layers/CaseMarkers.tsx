import { Marker } from 'react-map-gl/maplibre'
import { CASES, RISK_COLOR } from '@/data/cases'
import { useApp } from '@/lib/store'

/** Pulsing watch zones of the active case. */
export function CaseMarkers() {
  const aoiActive = useApp((s) => s.aoiActive)
  const activeRegion = useApp((s) => s.activeRegion)
  const hotspotId = useApp((s) => s.hotspotId)
  const setHotspot = useApp((s) => s.setHotspot)
  const arrived = useApp((s) => s.caseArrived)

  if (!aoiActive || !arrived) return null

  return (
    <>
      {CASES[activeRegion].hotspots.map((h, i) => (
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
