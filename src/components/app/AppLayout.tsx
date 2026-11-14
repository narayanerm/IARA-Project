import { HelpCircle, Mountain, Radar, Satellite, type LucideIcon } from 'lucide-react'
import { SarMap } from './Map/SarMap'
import { RightPanel } from './RightPanel/RightPanel'
import { ExportMenu } from './Export/ExportMenu'
import { ShareDialog } from './PublicShare/ShareDialog'
import { triggerTutorial } from './Tutorial/Tutorial'
import { CasePicker } from './Cases/CasePicker'
import { CaseView } from './Cases/CaseView'
import { cn } from '@/lib/utils'
import { useApp, useUi } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { LanguageToggle } from '@/components/common/LanguageToggle'

export function AppLayout({ introDone = true }: { introDone?: boolean }) {
  const t = useT()
  const satelliteOn = useUi((s) => s.satelliteOn)
  const reliefOn = useUi((s) => s.reliefOn)
  const toggleSatellite = useUi((s) => s.toggleSatellite)
  const toggleRelief = useUi((s) => s.toggleRelief)
  const nisarVisible = useApp((s) => s.nisarVisible)
  const setNisarVisible = useApp((s) => s.setNisarVisible)
  const clearAoi = useApp((s) => s.clearAoi)

  return (
    <section id="app" className="h-[100svh] w-full flex flex-col bg-background">
      <div className="flex h-12 items-center justify-between gap-2 border-b border-border/60 bg-card/40 backdrop-blur-xl px-3 sm:px-4">
        <button
          type="button"
          onClick={clearAoi}
          className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${t('app.name')}: ${t('case.home')}`}
          title={t('case.home')}
        >
          <img src="/marca/iara-simbolo-escuro.svg" alt="" aria-hidden="true" className="h-7 w-7 shrink-0" />
          <span className="hidden text-sm font-semibold sm:inline">{t('app.name')}</span>
        </button>

        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <HeaderToggle
            icon={Satellite}
            label={t('map.satellite')}
            hint={t('map.satelliteHint')}
            on={satelliteOn}
            onToggle={toggleSatellite}
          />
          <HeaderToggle
            icon={Mountain}
            label={t('map.relief')}
            hint={t('map.reliefHint')}
            on={reliefOn}
            onToggle={toggleRelief}
            className="hidden sm:inline-flex"
          />
          <HeaderToggle
            icon={Radar}
            label={t('map.radar')}
            hint={t('map.radarHint')}
            on={nisarVisible}
            onToggle={() => setNisarVisible(!nisarVisible)}
          />
          <button
            onClick={() => triggerTutorial()}
            className="hidden lg:inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-background/40 px-2.5 h-8 text-[13px] font-mono text-muted-foreground hover:text-foreground transition-colors"
            title={t('appLayout.tour')}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            tour
          </button>
          <LanguageToggle compact />
          <span data-tour="share">
            <ShareDialog />
          </span>
          <span className="hidden sm:inline-flex">
            <ExportMenu />
          </span>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div data-tour="map" className="relative flex-1 min-w-0 overflow-hidden">
          <SarMap />
          <CaseView />
          <CasePicker introDone={introDone} />
        </div>
        <div className="hidden md:block">
          <RightPanel />
        </div>
      </div>
    </section>
  )
}

function HeaderToggle({
  icon: Icon,
  label,
  hint,
  on,
  onToggle,
  className,
}: {
  icon: LucideIcon
  label: string
  hint: string
  on: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      aria-label={label}
      title={hint}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-[13px] transition-colors xl:px-2.5',
        on
          ? 'border-primary/40 bg-primary/15 text-primary'
          : 'border-border bg-background/40 text-muted-foreground hover:text-foreground',
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden xl:inline">{label}</span>
    </button>
  )
}
