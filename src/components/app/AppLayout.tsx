import { HelpCircle, MessageSquare, Mountain, Radar, Satellite, type LucideIcon } from 'lucide-react'
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
  const rightOpen = useUi((s) => s.rightOpen)
  const openRight = useUi((s) => s.openRight)
  const setRightOpen = useUi((s) => s.setRightOpen)
  const nisarVisible = useApp((s) => s.nisarVisible)
  const setNisarVisible = useApp((s) => s.setNisarVisible)
  const aoiActive = useApp((s) => s.aoiActive)
  const clearAoi = useApp((s) => s.clearAoi)

  return (
    <section id="app" className="flex h-[100svh] w-full flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-card px-3 sm:px-4">
        <button
          type="button"
          onClick={clearAoi}
          className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${t('app.name')}: ${t('case.home')}`}
          title={t('case.home')}
        >
          <img src="/marca/iara-simbolo-escuro.svg" alt="" aria-hidden="true" className="h-7 w-7 shrink-0" />
          <span className="text-sm font-semibold">{t('app.name')}</span>
        </button>

        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          {/* Map tools only make sense once a case is open. */}
          {aoiActive && (
            <>
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
              <span className="mx-0.5 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
              <HeaderToggle
                icon={MessageSquare}
                label={t('rp.chat')}
                hint={t('ask.label')}
                on={rightOpen}
                onToggle={() => (rightOpen ? setRightOpen(false) : openRight('chat'))}
              />
              <span data-tour="share">
                <ShareDialog />
              </span>
              <span className="hidden md:inline-flex">
                <ExportMenu />
              </span>
            </>
          )}
          {!aoiActive && (
            <button
              onClick={() => triggerTutorial()}
              className="hidden h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-background/40 px-2.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
              title={t('appLayout.tour')}
            >
              <HelpCircle className="h-3.5 w-3.5" />
              tour
            </button>
          )}
          <LanguageToggle compact />
        </div>
      </div>

      <div data-tour="map" className="relative min-h-0 flex-1 overflow-hidden">
        <SarMap />
        <CaseView />
        <CasePicker introDone={introDone} />
        {/* Assistant and tools open as a drawer over the map instead of a permanent rail. */}
        {aoiActive && rightOpen && (
          <div className="absolute inset-y-0 right-0 z-40 max-w-full shadow-2xl animate-in slide-in-from-right-6 fade-in duration-300 motion-reduce:animate-none">
            <RightPanel />
          </div>
        )}
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
