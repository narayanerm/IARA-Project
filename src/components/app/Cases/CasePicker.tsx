import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { CASES, CASE_ORDER } from '@/data/cases'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'
import type { RegionId } from '@/lib/types'
import { cn } from '@/lib/utils'
import { CASE_ICON, useTr } from './shared'
import { SatCover } from './SatCover'
import './cases.css'

// The chosen card fills the row before the picker dissolves into the map and the flight starts.
const EXPAND_MS = 720

/**
 * Entry point and the only way between cases. Three tall cards with a satellite still of each
 * place; picking one grows it over the others, then the picker fades and the map flies there.
 * Leaving a case always comes back here.
 */
export function CasePicker({ introDone }: { introDone: boolean }) {
  const t = useT()
  const tr = useTr()
  const aoiActive = useApp((s) => s.aoiActive)
  const setActiveRegion = useApp((s) => s.setActiveRegion)
  const [chosen, setChosen] = useState<RegionId | null>(null)
  const timer = useRef<number | undefined>(undefined)

  // Back from a case: reset so the cards come in again.
  useEffect(() => {
    if (!aoiActive) setChosen(null)
  }, [aoiActive])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const choose = (id: RegionId) => {
    if (chosen) return
    setChosen(id)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    timer.current = window.setTimeout(() => setActiveRegion(id), reduce ? 0 : EXPAND_MS)
  }

  const hidden = aoiActive
  return (
    <div
      className={cn('case-picker', introDone && 'is-ready', chosen && 'is-choosing', hidden && 'is-hidden')}
      aria-hidden={hidden}
      inert={hidden}
    >
      <div className="case-picker-inner">
        <header className="case-picker-head">
          <p className="case-eyebrow">{t('case.eyebrow')}</p>
          <h1 className="text-balance">{t('case.pickTitle')}</h1>
          <p className="case-picker-sub text-balance">{t('case.pickSub')}</p>
        </header>

        <nav className="case-row" data-tour="cases" aria-label={t('case.switch')}>
          {CASE_ORDER.map((id, i) => {
            const c = CASES[id]
            const Icon = CASE_ICON[id]
            return (
              <button
                key={id}
                type="button"
                className={cn('case-card', chosen === id && 'is-chosen')}
                style={{ '--case': c.color, '--i': i } as React.CSSProperties}
                onClick={() => choose(id)}
                aria-label={`${tr(c.analysis)}: ${tr(c.place)}`}
              >
                <SatCover center={c.cover.center} zoom={c.cover.zoom} className="case-card-cover" />
                <span className="case-card-shade" aria-hidden="true" />
                <span className="case-card-top" aria-hidden="true">
                  <span className="case-card-index">0{i + 1}</span>
                  <span className="case-card-icon">
                    <Icon strokeWidth={1.8} />
                  </span>
                </span>
                <span className="case-card-body" aria-hidden="true">
                  <span className="case-card-analysis">{tr(c.analysis)}</span>
                  <span className="case-card-theme">{tr(c.theme)}</span>
                  <span className="case-card-place">{tr(c.place)}</span>
                  <span className="case-card-meta">
                    <span className="case-card-meta-rows">
                      {c.meta.map((m) => (
                        <span key={m.label.pt} className="case-card-meta-row">
                          <span className="case-card-meta-label">{tr(m.label)}</span>
                          <span className="case-card-meta-value">{tr(m.value)}</span>
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="case-card-go">
                    {t('case.explore')}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </span>
              </button>
            )
          })}
        </nav>
        <p className="case-picker-credit">{t('case.coverCredit')}</p>
      </div>
    </div>
  )
}
