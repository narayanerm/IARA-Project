import { useState } from 'react'
import { ArrowLeft, BookOpen, ChartColumn, Siren, type LucideIcon } from 'lucide-react'
import { CASES, CASE_ORDER, type CaseStudy } from '@/data/cases'
import { useApp } from '@/lib/store'
import { useT, type TKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CaseAlerts } from './CaseAlerts'
import { CaseSar } from './CaseSar'
import { CaseSeries } from './CaseSeries'
import { CaseStory } from './CaseStory'
import { CASE_ICON, useTr } from './shared'

type Tab = 'overview' | 'timeline' | 'alerts'

const TABS: Array<{ id: Tab; icon: LucideIcon; label: TKey }> = [
  { id: 'overview', icon: BookOpen, label: 'case.tab.overview' },
  { id: 'timeline', icon: ChartColumn, label: 'case.tab.timeline' },
  { id: 'alerts', icon: Siren, label: 'case.tab.alerts' },
]

/**
 * The single surface of a case. It waits for the camera to land, then slides in beside the map
 * (or up from the bottom on phones). The way out is always back to the three cards.
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
  const Icon = CASE_ICON[c.id]
  const index = CASE_ORDER.indexOf(c.id) + 1

  return (
    <aside className="case-panel" data-tour="story" aria-label={tr(c.analysis)}>
      <header className="shrink-0 px-4 pt-3.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearAoi}
            className="-ml-1.5 inline-flex h-8 items-center gap-1.5 rounded-lg px-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('case.back')}
          </button>
          <span className="ml-auto text-[12px] font-semibold tabular-nums text-muted-foreground">
            0{index} / 0{CASE_ORDER.length}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: c.color }}>
          <Icon className="h-4 w-4" />
          {tr(c.analysis)}
        </div>
        <h2 className="mt-1 text-[clamp(1.35rem,1.1rem+0.9vw,1.75rem)] font-bold leading-[1.05] tracking-[-0.03em]">
          {tr(c.place)}
        </h2>
      </header>

      <div role="tablist" aria-label={t('case.tabs')} className="mt-2 flex shrink-0 gap-1 border-b border-border px-3">
        {TABS.map(({ id, icon: TIcon, label }) => {
          const active = tab === id
          return (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={cn(
                'relative flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap text-[13px] font-medium transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <TIcon className="h-3.5 w-3.5 shrink-0" />
              {t(label)}
              {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full" style={{ background: c.color }} />}
            </button>
          )
        })}
      </div>

      <div key={tab} role="tabpanel" className="min-h-0 flex-1 overflow-y-auto overscroll-contain animate-in fade-in duration-300 motion-reduce:animate-none">
        {tab === 'overview' && <CaseStory c={c} />}
        {tab === 'timeline' && (
          <>
            <CaseSeries c={c} />
            <div className="mx-4 border-t border-border" />
            <CaseSar c={c} />
          </>
        )}
        {tab === 'alerts' && <CaseAlerts c={c} />}
      </div>
    </aside>
  )
}
