import { Sidebar } from './Sidebar/Sidebar'
import { SarMap } from './Map/SarMap'
import { RightPanel } from './RightPanel/RightPanel'
import { Timeline } from './Timeline/Timeline'
import { ExportMenu } from './Export/ExportMenu'
import { ShareDialog } from './PublicShare/ShareDialog'
import { triggerTutorial } from './Tutorial/Tutorial'
import { HelpCircle } from 'lucide-react'
import { PhenomenonBriefing } from './Briefing/PhenomenonBriefing'
import { NisarControl } from './Map/NisarControl'
import { Layers3, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { LanguageToggle } from '@/components/common/LanguageToggle'

export function AppLayout() {
  const t = useT()
  const nasaOverlay = useApp((s) => s.nasaOverlay)
  const trueColorOverlay = useApp((s) => s.trueColorOverlay)
  const toggleNasaOverlay = useApp((s) => s.toggleNasaOverlay)
  const toggleTrueColorOverlay = useApp((s) => s.toggleTrueColorOverlay)

  return (
    <section id="app" className="h-[100svh] w-full flex flex-col bg-background">
      <div className="flex h-12 items-center justify-between border-b border-border/60 bg-card/40 backdrop-blur-xl px-4">
        <div className="flex min-w-0 items-center gap-2">
          <img
            src="/marca/iara-simbolo-escuro.svg"
            alt=""
            aria-hidden="true"
            className="h-7 w-7 shrink-0"
          />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold">{t('app.name')}</div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={toggleNasaOverlay}
            className={cn(
              'hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 h-8 text-[13px] font-mono transition-colors',
              nasaOverlay
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'bg-background/40 border-border text-muted-foreground hover:text-foreground'
            )}
            aria-pressed={nasaOverlay}
          >
            <Layers3 className="h-3.5 w-3.5" />
            {t('overlay.nasa')}
          </button>
          <button
            onClick={toggleTrueColorOverlay}
            className={cn(
              'hidden xl:inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 h-8 text-[13px] font-mono transition-colors',
              trueColorOverlay
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'bg-background/40 border-border text-muted-foreground hover:text-foreground'
            )}
            aria-pressed={trueColorOverlay}
          >
            <Sun className="h-3.5 w-3.5" />
            {t('overlay.trueColor')}
          </button>
          <button
            onClick={() => triggerTutorial()}
            className="hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-background/40 px-2.5 h-8 text-[13px] font-mono text-muted-foreground hover:text-foreground transition-colors"
            title={t('appLayout.tour')}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            tour
          </button>
          <LanguageToggle compact />
          <span data-tour="share"><ShareDialog /></span>
          <ExportMenu />
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <div data-tour="map" className="relative flex-1 min-w-0">
          <SarMap />
          <div data-tour="nisar" className="absolute left-4 top-4 hidden md:block">
            <NisarControl />
          </div>
          <div className="pointer-events-none absolute inset-x-3 bottom-9 flex items-end gap-3">
            <div className="pointer-events-auto flex-1 min-w-0 max-w-[860px]">
              <Timeline />
            </div>
          </div>
          <PhenomenonBriefing />
        </div>
        <RightPanel />
      </div>
    </section>
  )
}
