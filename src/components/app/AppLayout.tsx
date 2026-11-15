import { Sidebar } from './Sidebar/Sidebar'
import { SarMap } from './Map/SarMap'
import { RightPanel } from './RightPanel/RightPanel'
import { AskBar } from './Chatbot/AskBar'
import { ExportMenu } from './Export/ExportMenu'
import { ShareDialog } from './PublicShare/ShareDialog'
import { triggerTutorial } from './Tutorial/Tutorial'
import { HelpCircle } from 'lucide-react'
import { PhenomenonBriefing } from './Briefing/PhenomenonBriefing'
import { NisarControl } from './Map/NisarControl'
import { LayoutGrid, Layers3, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp, useUi } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { FEATURES } from '@/lib/features'
import { CaseSidebar } from './CaseSidebar/CaseSidebar'
import { CaseImageryToggle } from './Map/overlays/CaseImageryToggle'

export function AppLayout() {
  const t = useT()
  const nasaOverlay = useApp((s) => s.nasaOverlay)
  const trueColorOverlay = useApp((s) => s.trueColorOverlay)
  const toggleNasaOverlay = useApp((s) => s.toggleNasaOverlay)
  const toggleTrueColorOverlay = useApp((s) => s.toggleTrueColorOverlay)
  const rightOpen = useUi((s) => s.rightOpen)
  const popupOpen = useUi((s) => s.popupOpen)
  const setCaseSelectOpen = useUi((s) => s.setCaseSelectOpen)

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
          {FEATURES.nasaOverlay && (
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
          )}
          {FEATURES.trueColorToggle && (
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
          )}
          <button
            onClick={() => setCaseSelectOpen(true)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-primary/40 bg-primary/10 px-2.5 h-8 text-[13px] font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            {t('caseSelect.switch')}
          </button>
          {FEATURES.guidedTour && (
          <button
            onClick={() => triggerTutorial()}
            className="hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-background/40 px-2.5 h-8 text-[13px] font-mono text-muted-foreground hover:text-foreground transition-colors"
            title={t('appLayout.tour')}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            tour
          </button>
          )}
          <LanguageToggle compact />
          <span data-tour="share"><ShareDialog /></span>
          <ExportMenu />
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {FEATURES.legacySidebar ? <Sidebar /> : <CaseSidebar />}
        <div data-tour="map" className="relative flex-1 min-w-0">
          <SarMap />
          {FEATURES.nisarLive ? (
            <div data-tour="nisar" className="absolute left-4 top-4 hidden md:block">
              <NisarControl />
            </div>
          ) : (
            <div className="absolute left-4 top-4 z-20">
              <CaseImageryToggle />
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-3 bottom-9 flex flex-col items-center gap-2">
            {!rightOpen && !popupOpen && <AskBar className="pointer-events-auto" />}
          </div>
          <PhenomenonBriefing />
        </div>
        <RightPanel />
      </div>
    </section>
  )
}
