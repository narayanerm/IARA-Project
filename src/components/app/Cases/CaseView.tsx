import { useEffect, useRef } from 'react'
import { ArrowLeft, Play } from 'lucide-react'
import { CASES, CASE_ORDER, type CaseStudy } from '@/data/cases'
import { useApp, type CaseTab, useCaseVideo, useCaseVideoActive } from '@/lib/store'
import { useT, type TKey } from '@/lib/i18n'
import { CaseLeanAlerts } from './CaseFloodAlerts'
import { CaseSar } from './CaseSar'
import { CaseStory } from './CaseStory'
import { useTr } from './shared'
import { type SetCaseForecastMap } from './CaseForecasts'

type Tab = CaseTab

const TABS: Array<{ id: Tab; label: TKey }> = [
  { id: 'overview', label: 'case.tab.overview' },
  { id: 'timeline', label: 'case.tab.timeline' },
  { id: 'forecast', label: 'case.tab.forecast' },
]

/**
 * The single surface of a case. It waits for the camera to land, then slides in as a sheet docked
 * to the left edge (or up from the bottom on phones). The way out is always back to the cases.
 */
export function CaseView({ onForecastMapChange }: { onForecastMapChange: SetCaseForecastMap }) {
  const aoiActive = useApp((s) => s.aoiActive)
  const arrived = useApp((s) => s.caseArrived)
  const activeRegion = useApp((s) => s.activeRegion)
  // The case panel waits for the case video (Flood, Drought) to end or be skipped.
  const videoOn = useCaseVideoActive() !== null
  if (!aoiActive || !arrived || videoOn) return null
  return <CasePanel key={activeRegion} c={CASES[activeRegion]} onForecastMapChange={onForecastMapChange} />
}

function CasePanel({ c }: { c: CaseStudy; onForecastMapChange: SetCaseForecastMap }) {
  const t = useT()
  const tr = useTr()
  const clearAoi = useApp((s) => s.clearAoi)
  const videoSeen = useCaseVideo((s) => !!s.seen[c.id])
  const playCaseVideo = useCaseVideo((s) => s.playCaseVideo)
  // The tab lives in the store so the assistant can open it too; reset the scroll bar when it changes.
  const tab = useApp((s) => s.caseTab)
  const setTab = useApp((s) => s.setCaseTab)
  const panelRef = useRef<HTMLElement>(null)
  const index = CASE_ORDER.indexOf(c.id) + 1
  const tabIndex = TABS.findIndex((x) => x.id === tab)

  // Scroll progress goes straight to a CSS variable so reading never re-renders the panel.
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const max = el.scrollHeight - el.clientHeight
    panelRef.current?.style.setProperty('--progress', max > 0 ? String(el.scrollTop / max) : '0')
  }
  const pick = (id: Tab) => setTab(id)
  useEffect(() => {
    panelRef.current?.style.setProperty('--progress', '0')
  }, [tab])

  return (
    <aside
      ref={panelRef}
      className="case-panel"
      data-tour="story"
      aria-label={tr(c.analysis)}
      style={{ '--case': c.color, '--tab': tabIndex } as React.CSSProperties}
    >
      <header className="shrink-0 px-5 pt-4">
        <div className="flex items-center">
          <button type="button" onClick={clearAoi} className="case-panel-back" data-tour="case-back">
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
            {t('case.back')}
          </button>
          {videoSeen && (
            <button
              type="button"
              onClick={() => playCaseVideo(c.id)}
              className="case-panel-video"
              title={t('case.videoHint')}
            >
              <Play className="h-2.5 w-2.5 fill-current" strokeWidth={2} aria-hidden="true" />
              {t('case.video')}
            </button>
          )}
          <span className="case-panel-count">
            <b>0{index}</b> / 0{CASE_ORDER.length}
          </span>
        </div>
        <div className="case-panel-kicker">{tr(c.analysis)}</div>
        <h2 className="case-panel-title">{tr(c.place)}</h2>

        <div role="tablist" aria-label={t('case.tabs')} className="case-tabs" data-tour="case-tabs">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={tab === id}
              onClick={() => pick(id)}
              className="case-tab"
            >
              {t(label)}
            </button>
          ))}
          <span className="case-tabs-indicator" aria-hidden="true" />
        </div>
      </header>
      <div className="case-progress mx-5 shrink-0" aria-hidden="true" />

      <div key={tab} role="tabpanel" className="case-scroll" onScroll={onScroll}>
        {tab === 'overview' && <CaseStory c={c} />}
        {tab === 'timeline' && <CaseSar c={c} yearPicker />}
        {tab === 'forecast' && <CaseLeanAlerts c={c} />}
      </div>
    </aside>
  )
}
