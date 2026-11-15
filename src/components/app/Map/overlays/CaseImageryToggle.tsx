import { LocateFixed, Radar, Satellite } from 'lucide-react'
import { CASES } from '@/data/cases'
import { useApp, useUi } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

/** Switch for the imagery shown inside the case area on the background map. */
export function CaseImageryToggle() {
  const t = useT()
  const aoiActive = useApp((s) => s.aoiActive)
  const activeRegion = useApp((s) => s.activeRegion)
  const mode = useUi((s) => s.caseImagery)
  const setMode = useUi((s) => s.setCaseImagery)
  const sar = useUi((s) => s.sarMapScene)
  const optical = useUi((s) => s.opticalMapScene)
  const recenter = useApp((s) => s.recenter)
  if (!aoiActive || !CASES[activeRegion].sarCrop) return null

  const btn = (id: 'satellite' | 'sar', Icon: typeof Satellite, label: string) => (
    <button
      onClick={() => setMode(id)}
      aria-pressed={mode === id}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
        mode === id ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )

  return (
    <div className="glass rounded-xl border border-border/60 bg-card/90 p-1 shadow-lg">
      <div className="flex gap-1">
        {btn('satellite', Satellite, t('caseMap.satellite'))}
        {btn('sar', Radar, t('caseMap.sar'))}
      </div>
      <div className="px-1.5 pb-0.5 pt-1 text-[11px] font-mono text-muted-foreground">
        {mode === 'satellite'
          ? optical
            ? t('caseMap.satDated', { date: fmtDate(optical.date), cloud: String(optical.cloud), sar: sar ? fmtDate(sar.date) : '—' })
            : t('caseMap.satNote')
          : sar
            ? t('caseMap.sarNote', { mission: sar.mission, date: fmtDate(sar.date) })
            : t('archive.loadingImage')}
      </div>
      <button
        onClick={recenter}
        className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md border border-border/60 px-2 py-1.5 text-[13px] font-medium text-foreground/90 hover:border-primary/50 hover:text-primary"
      >
        <LocateFixed className="h-4 w-4" />
        {t('caseMap.recenter', { place: CASES[activeRegion].place.split(' ·')[0] })}
      </button>
    </div>
  )
}
