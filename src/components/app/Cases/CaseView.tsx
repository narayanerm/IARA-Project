import { useEffect, useState } from 'react'
import { BookOpen, ChartColumn, Radar, Siren, type LucideIcon } from 'lucide-react'
import { CASES, type CaseStudy } from '@/data/cases'
import { useApp, useUi } from '@/lib/store'
import { useT, type TKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CaseAlerts, CaseHotspots, CaseRisk } from './CaseAlerts'
import { CaseSar } from './CaseSar'
import { CaseSeries } from './CaseSeries'
import { CaseStory } from './CaseStory'
import { useMediaQuery } from './shared'

type Tab = 'story' | 'alerts' | 'sar' | 'series'

const TABS: Array<{ id: Tab; icon: LucideIcon; label: TKey }> = [
  { id: 'story', icon: BookOpen, label: 'case.tab.story' },
  { id: 'alerts', icon: Siren, label: 'case.tab.alerts' },
  { id: 'sar', icon: Radar, label: 'case.tab.sar' },
  { id: 'series', icon: ChartColumn, label: 'case.tab.series' },
]

// Panels wait for the camera flight before sliding in.
const ENTER = 'animate-in fade-in duration-500 fill-mode-both motion-reduce:animate-none'

/** The focused analysis of one case: story, alerts, radar and time series around the map. */
export function CaseView() {
  const aoiActive = useApp((s) => s.aoiActive)
  const activeRegion = useApp((s) => s.activeRegion)
  if (!aoiActive) return null
  return <CaseLayout key={activeRegion} c={CASES[activeRegion]} />
}

function CaseLayout({ c }: { c: CaseStudy }) {
  const rightOpen = useUi((s) => s.rightOpen)
  const desktop = useMediaQuery('(min-width: 768px)')
  const xl = useMediaQuery('(min-width: 1280px)')
  const wide = desktop && xl && !rightOpen
  const [tab, setTab] = useState<Tab>('story')

  // Tabs that only exist in the narrower layouts fall back to the story when the layout widens.
  useEffect(() => {
    if (wide && tab !== 'story') setTab('story')
    else if (desktop && tab === 'series') setTab('story')
  }, [wide, desktop, tab])

  const body =
    tab === 'alerts' ? (
      <CaseAlerts c={c} />
    ) : tab === 'sar' ? (
      <CaseSar c={c} />
    ) : tab === 'series' ? (
      <CaseSeries c={c} className="!border-0 !bg-transparent !shadow-none" />
    ) : (
      <CaseStory c={c} />
    )

  if (!desktop) {
    return (
      <aside className={cn('glass !bg-card absolute inset-x-0 bottom-0 z-10 flex h-[48svh] flex-col rounded-t-2xl slide-in-from-bottom-6 delay-500', ENTER)}>
        <Tabs tab={tab} onChange={setTab} tabs={TABS} color={c.color} />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{body}</div>
      </aside>
    )
  }

  return (
    <>
      <aside
        data-tour="story"
        className={cn(
          'glass !bg-card absolute bottom-3 left-3 top-[62px] z-10 flex w-[372px] flex-col rounded-2xl slide-in-from-left-6 delay-700',
          ENTER
        )}
      >
        {!wide && <Tabs tab={tab} onChange={setTab} tabs={TABS.slice(0, 3)} color={c.color} />}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{body}</div>
      </aside>

      {wide && (
        <aside
          className={cn(
            'glass !bg-card absolute bottom-10 right-3 top-[62px] z-10 w-[336px] overflow-y-auto overscroll-contain rounded-2xl slide-in-from-right-6 delay-1000',
            ENTER
          )}
        >
          <CaseRisk c={c} />
          <div className="mx-4 border-t border-border/70" />
          <CaseSar c={c} />
          <div className="mx-4 border-t border-border/70" />
          <CaseHotspots c={c} />
        </aside>
      )}

      <CaseSeries
        c={c}
        className={cn(
          'absolute bottom-3 left-[396px] z-10 slide-in-from-bottom-6 delay-1000',
          wide ? 'right-[360px]' : 'right-12',
          ENTER
        )}
      />
    </>
  )
}

function Tabs({
  tab,
  onChange,
  tabs,
  color,
}: {
  tab: Tab
  onChange: (t: Tab) => void
  tabs: typeof TABS
  color: string
}) {
  const t = useT()
  return (
    <div role="tablist" aria-label={t('case.tabs')} className="flex shrink-0 border-b border-border/70 px-2">
      {tabs.map(({ id, icon: Icon, label }) => {
        const active = tab === id
        return (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              'relative flex h-11 flex-1 items-center justify-center gap-1.5 text-[13px] font-medium transition-colors',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {t(label)}
            {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full" style={{ background: color }} />}
          </button>
        )
      })}
    </div>
  )
}
