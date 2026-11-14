import { useMemo } from 'react'
import { ArrowRight, ChartLine, ChevronLeft, Layers3, Radar, ScrollText, Sun, type LucideIcon } from 'lucide-react'
import { Sidebar } from './Sidebar/Sidebar'
import { SarMap } from './Map/SarMap'
import { OverlayLegend, FocusedTiBadge, MapOptions } from './Map/OverlayLegend'
import { AskBar } from './Chatbot/AskBar'
import { SarPreview } from './Map/SarPreview'
import { Legend } from './Map/Legend'
import { LayerToggle } from './Map/LayerToggle'
import { RightPanel } from './RightPanel/RightPanel'
import { Timeline } from './Timeline/Timeline'
import { ExportMenu } from './Export/ExportMenu'
import { ShareDialog } from './PublicShare/ShareDialog'
import { PhenomenonBriefing } from './Briefing/PhenomenonBriefing'
import { NisarControl } from './Map/NisarControl'
import { ICON_BY_PHENOMENON } from './Map/CaseMarkers'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { REGIONS } from '@/lib/regions'
import { useApp, useMapView, useUi } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { backToOverview, markExplore, showRadar } from '@/lib/story'
import { LanguageToggle } from '@/components/common/LanguageToggle'

const REVEAL = 'animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none'

export function AppLayout() {
  const t = useT()
  const stage = useUi((s) => s.stage)
  const briefingOpen = useUi((s) => s.briefingOpen)
  const setBriefingOpen = useUi((s) => s.setBriefingOpen)
  const rightOpen = useUi((s) => s.rightOpen)
  const detailOpen = useMapView((s) => s.detailOpen)
  const nasaOverlay = useApp((s) => s.nasaOverlay)
  const trueColorOverlay = useApp((s) => s.trueColorOverlay)
  const toggleNasaOverlay = useApp((s) => s.toggleNasaOverlay)
  const toggleTrueColorOverlay = useApp((s) => s.toggleTrueColorOverlay)

  const onRadar = stage === 'radar' || stage === 'explore'
  const exploring = stage === 'explore'

  return (
    <section id="app" className="h-[100svh] w-full flex flex-col overflow-hidden bg-background">
      {/* Top bar, left to right in story order: case → radar layers → view options → language → share/export */}
      <header className="flex h-14 shrink-0 items-stretch gap-3 border-b border-border bg-card px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}marca/iara-horizontal-sem-subtitulo-escuro.svg`}
            alt={t('app.name')}
            className="hidden lg:block h-9 w-auto shrink-0"
          />
          <img src={`${import.meta.env.BASE_URL}marca/iara-simbolo-escuro.svg`} alt={t('app.name')} className="lg:hidden h-9 w-9 shrink-0" />
          <CaseCrumb />
        </div>

        <nav className="hidden md:flex min-w-0 flex-1 items-stretch border-l border-border pl-2">
          <LayerToggle />
        </nav>
        <div className="flex-1 md:hidden" />

        <div className="flex shrink-0 items-center gap-1.5">
          <ViewToggle
            icon={Layers3}
            label={t('overlay.nasa')}
            pressed={nasaOverlay}
            onClick={toggleNasaOverlay}
            className="hidden sm:inline-flex"
          />
          <ViewToggle
            icon={Sun}
            label={t('overlay.trueColor')}
            pressed={trueColorOverlay}
            onClick={toggleTrueColorOverlay}
            className="hidden sm:inline-flex"
          />
          <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
          <LanguageToggle compact />
          <ShareDialog />
          <ExportMenu />
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <div className="relative flex-1 min-w-0 overflow-hidden">
          <SarMap />

          {/* top-left: phone layer tabs, then the NISAR control once exploring */}
          <div className="absolute left-4 top-4 flex max-w-[calc(100%-2rem)] flex-col items-start gap-2">
            {onRadar && (
              <div className={cn('md:hidden', REVEAL)}>
                <LayerToggle variant="float" />
              </div>
            )}
            {exploring && (
              <div className={cn('hidden md:block', REVEAL)}>
                <NisarControl />
              </div>
            )}
          </div>

          {/* top-right column: what the image shows, map legend and options, SAR preview.
              Map options (with the satellite switch) are there from the first screen. */}
          <div className="pointer-events-none absolute right-4 top-4 bottom-36 flex w-[min(280px,calc(100%-2rem))] flex-col items-end gap-2 overflow-y-auto overscroll-contain [scrollbar-width:none]">
            {onRadar && (
              <div className="hidden w-full sm:block">
                <RadarCaption />
              </div>
            )}
            <FocusedTiBadge />
            {onRadar ? (
              <div className={cn('hidden w-full sm:block', REVEAL)}>
                <OverlayLegend />
              </div>
            ) : (
              <div className="w-[200px] max-w-full">
                <MapOptions />
              </div>
            )}
            {exploring && (
              <div className={cn('pointer-events-auto hidden w-full sm:block', REVEAL)}>
                <SarPreview />
              </div>
            )}
          </div>

          {/* bottom dock: everything stacks here so nothing overlaps; pb clears the map attribution */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 px-4 pb-9">
            {briefingOpen && <PhenomenonBriefing />}

            {onRadar && !briefingOpen && (
              <div className="pointer-events-auto w-full sm:hidden">
                <RadarCaption />
              </div>
            )}

            {exploring && !briefingOpen && (
              <div className="flex w-full items-end gap-3">
                <div className={cn('pointer-events-auto hidden shrink-0 sm:block', REVEAL)}>
                  <Legend />
                </div>
                <div className={cn('pointer-events-auto min-w-0 max-w-[720px] flex-1', REVEAL)}>
                  <Timeline />
                </div>
              </div>
            )}

            {stage !== 'overview' && !briefingOpen && !detailOpen && (
              <div className={cn('pointer-events-auto flex items-center gap-2', REVEAL)}>
                <button
                  onClick={() => setBriefingOpen(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-raised"
                >
                  <ScrollText className="h-4 w-4 text-muted-foreground" />
                  {t('briefing.reopen')}
                </button>
                {stage === 'case' && (
                  <button
                    onClick={() => showRadar()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <Radar className="h-4 w-4" />
                    {t('briefing.toRadar')}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            {!briefingOpen && !rightOpen && !exploring && !detailOpen && <AskBar className="pointer-events-auto" />}

            {!exploring && !briefingOpen && !detailOpen && <TimelineTab locked={stage !== 'radar'} />}
          </div>
        </div>
        <RightPanel />
      </div>
    </section>
  )
}

/** Case name in the top bar. In a case, clicking it goes back to the three-case overview. */
function CaseCrumb() {
  const t = useT()
  const stage = useUi((s) => s.stage)
  const activeRegion = useApp((s) => s.activeRegion)
  const region = useMemo(() => REGIONS.find((r) => r.id === activeRegion)!, [activeRegion])

  if (stage === 'overview') {
    return (
      <div className="hidden min-w-0 border-l border-border pl-3 sm:block">
        <div className="truncate text-[13px] font-semibold text-foreground">{t('case.overview')}</div>
      </div>
    )
  }

  const Icon = ICON_BY_PHENOMENON[region.phenomenon]
  return (
    <div className="min-w-0 border-l border-border pl-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={backToOverview}
            aria-label={`${t(`region.${region.id}.phen`)}, ${t(`region.${region.id}.city`)}. ${t('case.back')}`}
            className="group flex min-w-0 max-w-[260px] items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-raised"
          >
            <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
            <span className="hidden min-w-0 leading-tight sm:block">
              <span className="block truncate text-[13px] font-semibold text-foreground">
                {t(`region.${region.id}.phen`)}
              </span>
              <span className="block truncate text-[12px] text-muted-foreground">{t(`region.${region.id}.city`)}</span>
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('case.back')}</TooltipContent>
      </Tooltip>
    </div>
  )
}

/** View option toggle: label shown from 1440px, icon + tooltip below that. */
function ViewToggle({
  icon: Icon,
  label,
  pressed,
  onClick,
  className,
}: {
  icon: LucideIcon
  label: string
  pressed: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          aria-pressed={pressed}
          aria-label={label}
          className={cn(
            'h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[13px] font-medium transition-colors',
            pressed ? 'bg-raised text-foreground' : 'text-muted-foreground hover:bg-raised hover:text-foreground',
            className
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="hidden min-[1440px]:inline">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="min-[1440px]:hidden">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

/** Small caption saying what the radar image on the map shows for this case. */
function RadarCaption() {
  const t = useT()
  const activeRegion = useApp((s) => s.activeRegion)
  return (
    <div
      key={activeRegion}
      role="status"
      className={cn('pointer-events-auto w-full rounded-md border border-border bg-card px-3 py-2.5', REVEAL)}
    >
      <div className="text-[12px] font-medium text-water">{t(`radar.title.${activeRegion}`)}</div>
      <p className="mt-0.5 text-[13px] leading-snug text-foreground">{t(`radar.caption.${activeRegion}`)}</p>
    </div>
  )
}

/** Collapsed timeline: a slim tab at the bottom edge. Opens the time series once a case is on radar. */
function TimelineTab({ locked }: { locked: boolean }) {
  const t = useT()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={locked ? undefined : () => markExplore()}
          aria-disabled={locked || undefined}
          aria-label={locked ? `${t('timeline.tab')}. ${t('timeline.locked')}` : t('timeline.tab')}
          className={cn(
            'pointer-events-auto inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-[12px] font-medium transition-colors',
            locked ? 'cursor-not-allowed text-muted-foreground' : 'text-foreground hover:bg-raised'
          )}
        >
          <ChartLine className="h-3.5 w-3.5" aria-hidden />
          {t('timeline.tab')}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{locked ? t('timeline.locked') : t('timeline.tab')}</TooltipContent>
    </Tooltip>
  )
}
