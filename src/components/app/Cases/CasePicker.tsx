import { ArrowRight, House } from 'lucide-react'
import { CASES, CASE_ORDER } from '@/data/cases'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CASE_ICON, useTr } from './shared'
import './cases.css'

/**
 * Entry point of the app. After the intro the three case cards sit over the map; picking one
 * slides them up into a compact switcher while the map flies to that region.
 */
export function CasePicker({ introDone }: { introDone: boolean }) {
  const t = useT()
  const tr = useTr()
  const aoiActive = useApp((s) => s.aoiActive)
  const activeRegion = useApp((s) => s.activeRegion)
  const setActiveRegion = useApp((s) => s.setActiveRegion)
  const clearAoi = useApp((s) => s.clearAoi)

  return (
    <div className={cn('case-picker', aoiActive && 'is-docked', introDone && 'is-ready')}>
      <div className="case-scrim" aria-hidden="true" />

      <div className="case-intro" aria-hidden={aoiActive}>
        <h1 className="text-balance">{t('case.pickTitle')}</h1>
        <p className="text-balance">{t('case.pickSub')}</p>
      </div>

      <nav className="case-row" data-tour="cases" aria-label={t('case.switch')}>
        <button
          type="button"
          className="case-home"
          onClick={clearAoi}
          tabIndex={aoiActive ? 0 : -1}
          aria-hidden={!aoiActive}
          aria-label={t('case.home')}
          title={t('case.home')}
        >
          <House className="h-4 w-4" />
        </button>

        {CASE_ORDER.map((id, i) => {
          const c = CASES[id]
          const Icon = CASE_ICON[id]
          const current = aoiActive && activeRegion === id
          return (
            <button
              key={id}
              type="button"
              className={cn('case-card', current && 'is-current')}
              style={{ '--case': c.color, '--i': i } as React.CSSProperties}
              onClick={() => setActiveRegion(id)}
              aria-current={current ? 'true' : undefined}
              aria-label={`${tr(c.analysis)}: ${tr(c.place)}`}
            >
              <span className="case-card-hero" aria-hidden="true">
                <span className="case-card-icon">
                  <Icon strokeWidth={1.6} />
                </span>
                <span className="case-card-theme">{tr(c.theme)}</span>
                <span className="case-card-analysis">{tr(c.analysis)}</span>
                <span className="case-card-place">{tr(c.place)}</span>
                <span className="case-card-go">
                  {t('case.explore')}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </span>
              <span className="case-card-dock" aria-hidden="true">
                <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                <span className="truncate">{tr(c.theme)}</span>
                <span className="case-card-dock-place truncate">{c.placeShort}</span>
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
