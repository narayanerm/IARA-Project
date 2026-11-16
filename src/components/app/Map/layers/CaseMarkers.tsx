import { Marker } from 'react-map-gl/maplibre'
import { CASES, RISK_COLOR, type RiskLevel } from '@/data/cases'
import { useApp } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { useCaseCriticalRisk } from '@/lib/useCaseCriticalRisk'

const LEVEL_LABEL: Record<'pt' | 'en', Record<RiskLevel, string>> = {
  pt: { critical: 'Crítico', high: 'Alto', watch: 'Atenção' },
  en: { critical: 'Critical', high: 'High', watch: 'Watch' },
}

/** Pulsing watch zones of the active case. Risk level per hotspot comes from the
 *  predictive model output when available (e.g. SECA via seca-isolation-forecast.json),
 *  falling back to the hand-picked level in cases.ts otherwise. */
export function CaseMarkers() {
  const aoiActive = useApp((s) => s.aoiActive)
  const activeRegion = useApp((s) => s.activeRegion)
  const hotspotId = useApp((s) => s.hotspotId)
  const setHotspot = useApp((s) => s.setHotspot)
  const arrived = useApp((s) => s.caseArrived)
  const caseTab = useApp((s) => s.caseTab)
  const lang = useI18n((s) => s.lang)
  const criticalRisk = useCaseCriticalRisk(activeRegion)
  const levelLabels = LEVEL_LABEL[lang]

  // The hotspots are forecast-driven alerts, so they only belong on the map when
  // the alerts/forecast tab is open (otherwise they'd float with no legend).
  if (!aoiActive || !arrived || caseTab !== 'forecast') return null

  return (
    <>
      {CASES[activeRegion].hotspots.map((h, i) => {
        const forecast = criticalRisk?.[h.id]
        const level = forecast?.level ?? h.level
        const insight = forecast?.insight[lang]
        return (
          <Marker key={h.id} longitude={h.center[0]} latitude={h.center[1]} anchor="center">
            <button
              type="button"
              className={`hotspot hotspot-in${hotspotId === h.id ? ' is-active' : ''}${h.labelLeft ? ' is-left' : ''}`}
              style={{ '--c': RISK_COLOR[level], '--delay': `${i * 0.35}s`, '--delay-in': `${200 + i * 120}ms` } as React.CSSProperties}
              onClick={(e) => {
                e.stopPropagation()
                setHotspot(h.id)
              }}
              aria-label={insight ? `${h.name} — ${insight}` : h.name}
            >
              <span className="hotspot-label">{h.name}</span>
              {insight && (
                <span className="hotspot-tip" role="tooltip">
                  <span className="hotspot-tip-kicker">{levelLabels[level]}</span>
                  <span className="hotspot-tip-body">{insight}</span>
                </span>
              )}
            </button>
          </Marker>
        )
      })}
    </>
  )
}
