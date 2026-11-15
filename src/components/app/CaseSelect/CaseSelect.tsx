import { ArrowRight, Droplets, Pickaxe, Sun, X, type LucideIcon } from 'lucide-react'
import { CASES, CASE_ORDER } from '@/data/cases'
import { useApp, useUi } from '@/lib/store'
import { useT, type TKey } from '@/lib/i18n'
import type { RegionId } from '@/lib/types'

// IARA brand colours (dark theme): flooded forest, water, forest
const ACCENT: Record<RegionId, { color: string; icon: LucideIcon }> = {
  YANO: { color: '#F07A45', icon: Pickaxe },
  ENCH: { color: '#5AA7C9', icon: Droplets },
  SECA: { color: '#4F9A6A', icon: Sun },
}

/**
 * Start screen of the MVP: pick one of the three case studies (mining, flood, drought).
 * Picking a case activates its region, which flies the map to the community and opens the case panel.
 */
export function CaseSelect() {
  const t = useT()
  const open = useUi((s) => s.caseSelectOpen)
  const setOpen = useUi((s) => s.setCaseSelectOpen)
  const setActiveRegion = useApp((s) => s.setActiveRegion)

  if (!open) return null

  const pick = (id: RegionId) => {
    setActiveRegion(id)
    setOpen(false)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="case-select-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/85 backdrop-blur-md p-4 animate-in fade-in duration-300 motion-reduce:animate-none"
    >
      <div className="relative w-full max-w-5xl">
        <button
          onClick={() => setOpen(false)}
          className="absolute -top-2 right-0 rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted"
          aria-label={t('caseSelect.close')}
        >
          <X className="h-5 w-5" />
        </button>

        <img src="/marca/iara-horizontal-escuro.svg" alt="IARA" className="h-12 w-auto" />

        <h1 id="case-select-title" className="mt-6 text-3xl md:text-[34px] font-semibold tracking-[-0.025em]">
          {t('caseSelect.title')}
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-muted-foreground leading-relaxed">{t('caseSelect.lead')}</p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {CASE_ORDER.map((id) => {
            const c = CASES[id]
            const { color, icon: Icon } = ACCENT[id]
            return (
              <button
                key={id}
                onClick={() => pick(id)}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-all hover:-translate-y-0.5 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="h-1.5 w-full" style={{ background: color }} />
                <div className="flex flex-1 flex-col p-5">
                  <div
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wider"
                    style={{ color }}
                  >
                    <Icon className="h-4 w-4" />
                    {t(`region.${id}.phen` as TKey)}
                  </div>
                  <div className="mt-3 text-xl font-semibold tracking-[-0.02em] leading-tight">{c.community}</div>
                  <div className="mt-0.5 text-[13px] font-mono text-muted-foreground">{c.place}</div>
                  <p className="mt-3 flex-1 text-[14px] text-foreground/85 leading-snug">{c.hook}</p>
                  <div
                    className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold transition-transform group-hover:translate-x-0.5"
                    style={{ color }}
                  >
                    {t('caseSelect.open')}
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <button
          onClick={() => setOpen(false)}
          className="mt-5 text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t('caseSelect.skip')}
        </button>
      </div>
    </div>
  )
}
