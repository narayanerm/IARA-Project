import { useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { CASES, CASE_ORDER, type CaseStudy } from '@/data/cases'
import { useApp } from '@/lib/store'
import { useT, type TKey } from '@/lib/i18n'
import { CaseAlerts } from './CaseAlerts'
import { CaseSar } from './CaseSar'
import { CaseSeries } from './CaseSeries'
import { CaseStory } from './CaseStory'
import { useTr } from './shared'

type Tab = 'overview' | 'timeline' | 'alerts'

const TABS: Array<{ id: Tab; label: TKey }> = [
  { id: 'overview', label: 'case.tab.overview' },
  { id: 'timeline', label: 'case.tab.timeline' },
  { id: 'alerts', label: 'case.tab.alerts' },
]

/**
 * The single surface of a case. It waits for the camera to land, then slides in as a sheet docked
 * to the left edge (or up from the bottom on phones). The way out is always back to the cases.
 */
export function CaseView() {
  const aoiActive = useApp((s) => s.aoiActive)
  const arrived = useApp((s) => s.caseArrived)
  const activeRegion = useApp((s) => s.activeRegion)
  if (!aoiActive || !arrived) return null
  return <CasePanel key={activeRegion} c={CASES[activeRegion]} />
}

function CasePanel({ c }: { c: CaseStudy }) {
  const t = useT()
  const tr = useTr()
  const clearAoi = useApp((s) => s.clearAoi)
  const [tab, setTab] = useState<Tab>('overview')
  const panelRef = useRef<HTMLElement>(null)
  const index = CASE_ORDER.indexOf(c.id) + 1
  const tabIndex = TABS.findIndex((x) => x.id === tab)

  // Scroll progress goes straight to a CSS variable so reading never re-renders the panel.
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const max = el.scrollHeight - el.clientHeight
    panelRef.current?.style.setProperty('--progress', max > 0 ? String(el.scrollTop / max) : '0')
  }
  const pick = (id: Tab) => {
    setTab(id)
    panelRef.current?.style.setProperty('--progress', '0')
  }

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
          <button type="button" onClick={clearAoi} className="case-panel-back">
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
            {t('case.back')}
          </button>
          <span className="case-panel-count">
            <b>0{index}</b> / 0{CASE_ORDER.length}
          </span>
        </div>
        <div className="case-panel-kicker">{tr(c.analysis)}</div>
        <h2 className="case-panel-title">{tr(c.place)}</h2>

        <div role="tablist" aria-label={t('case.tabs')} className="case-tabs">
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
        {tab === 'timeline' && (
          <>
            <CaseSeries c={c} />
            <div className="mx-5 border-t border-border" />
            <CaseSar c={c} />
          </>
        )}
        {tab === 'alerts' && <CaseAlerts c={c} />}
      </div>
    </aside>
  )
}
