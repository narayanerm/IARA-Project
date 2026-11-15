import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { CASES, CASE_ORDER } from '@/data/cases'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'
import type { RegionId } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useTr } from './shared'
import { SatCover } from './SatCover'
import './cases.css'

// The chosen panel takes the whole strip before the picker dissolves into the map.
const EXPAND_MS = 820

/**
 * Entry point and the only way between cases: three full-height satellite panels, edge to edge,
 * whose images bleed into each other. Hovering one widens it and reveals its details; picking it
 * swallows the strip, then the picture dissolves into the map while the camera flies there.
 */
export function CasePicker({ introDone }: { introDone: boolean }) {
  const t = useT()
  const tr = useTr()
  const aoiActive = useApp((s) => s.aoiActive)
  const setActiveRegion = useApp((s) => s.setActiveRegion)
  const [chosen, setChosen] = useState<RegionId | null>(null)
  const timer = useRef<number | undefined>(undefined)

  // Back from a case: reset so the panels wipe in again.
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
      <h1 className="sr-only">{t('case.pickTitle')}</h1>

      <nav className="case-row" data-tour="cases" aria-label={t('case.switch')}>
        {CASE_ORDER.map((id, i) => {
          const c = CASES[id]
          return (
            <button
              key={id}
              type="button"
              className={cn('case-card', chosen === id && 'is-chosen')}
              style={{ '--case': c.color, '--i': i } as React.CSSProperties}
              onClick={() => choose(id)}
              aria-label={`${tr(c.analysis)}: ${tr(c.place)}`}
            >
              <span className="case-card-cover" aria-hidden="true">
                <SatCover center={c.cover.center} zoom={c.cover.zoom - 1} className="case-frame is-wide" />
                <SatCover center={c.cover.center} zoom={c.cover.zoom} className="case-frame is-close" />
              </span>
              <span className="case-card-shade" aria-hidden="true" />

              <span className="case-card-tag" aria-hidden="true">
                <span>0{i + 1}</span>
                <span className="case-card-tag-label">{tr(c.analysis)}</span>
              </span>

              <span className="case-card-body" aria-hidden="true">
                <span className="case-card-word">{tr(c.theme)}</span>
                <span className="case-card-rule" />
                <span className="case-card-reveal">
                  <span className="case-card-reveal-inner">
                    <span className="case-card-place">{tr(c.place)}</span>
                    <span className="case-card-meta">
                      {c.meta.map((m) => (
                        <span key={m.label.pt} className="case-card-meta-row">
                          <span className="case-card-meta-label">{tr(m.label)}</span>
                          <span className="case-card-meta-value">{tr(m.value)}</span>
                        </span>
                      ))}
                    </span>
                    <span className="case-card-go">
                      {t('case.explore')}
                      <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
                    </span>
                  </span>
                </span>
              </span>
              <span className="case-card-frame" aria-hidden="true" />
            </button>
          )
        })}
      </nav>

      <div className="case-hud" aria-hidden="true">
        <span>{t('case.eyebrow')}</span>
        <span className="case-hud-hint">{t('case.pickHint')}</span>
      </div>
      <p className="case-picker-credit">{t('case.coverCredit')}</p>
    </div>
  )
}
