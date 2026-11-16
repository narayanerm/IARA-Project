import { Suspense, lazy, useEffect, useState } from 'react'
import { triggerTutorial } from './Tutorial/Tutorial'
import { CasePicker } from './Cases/CasePicker'
import { cn } from '@/lib/utils'
import { useApp, useUi } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import type { ForecastMapProps } from '@/lib/predictive-models'

// Heavy parts load as separate chunks. The map (MapLibre) and the case view only matter once the
// hub is showing, the assistant and the share/export tools only when opened, so none of them
// competes with the intro for bandwidth or main-thread time.
const loadSarMap = () => import('./Map/SarMap')
const loadCaseView = () => import('./Cases/CaseView')
const SarMap = lazy(() => loadSarMap().then((m) => ({ default: m.SarMap })))
const CaseView = lazy(() => loadCaseView().then((m) => ({ default: m.CaseView })))
const RightPanel = lazy(() => import('./RightPanel/RightPanel').then((m) => ({ default: m.RightPanel })))
const AskBar = lazy(() => import('./Chatbot/AskBar').then((m) => ({ default: m.AskBar })))
const ExportMenu = lazy(() => import('./Export/ExportMenu').then((m) => ({ default: m.ExportMenu })))
const ShareDialog = lazy(() => import('./PublicShare/ShareDialog').then((m) => ({ default: m.ShareDialog })))

export function AppLayout({ introDone = true }: { introDone?: boolean }) {
  const t = useT()
  const satelliteOn = useUi((s) => s.satelliteOn)
  const reliefOn = useUi((s) => s.reliefOn)
  const toggleSatellite = useUi((s) => s.toggleSatellite)
  const toggleRelief = useUi((s) => s.toggleRelief)
  const rightOpen = useUi((s) => s.rightOpen)
  const aoiActive = useApp((s) => s.aoiActive)
  const clearAoi = useApp((s) => s.clearAoi)
  const caseArrived = useApp((s) => s.caseArrived)
  const [forecastMap, setForecastMap] = useState<ForecastMapProps | null>(null)
  // The opaque case picker covers the map until a case is chosen, so the map only has to exist once
  // the intro is over. Its code is fetched a moment after the intro starts, then mounted at the end.
  const mapOn = introDone || aoiActive
  useEffect(() => {
    const id = window.setTimeout(() => {
      loadSarMap().catch(() => {})
      loadCaseView().catch(() => {})
    }, 1500)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <section id="app" className="relative h-[100svh] w-full overflow-hidden bg-background">
      {/* Floating header: no bar of its own, the controls sit straight on the map and only get a backdrop on hover. */}
      <div className="hdr-float pointer-events-none absolute inset-x-0 top-0 z-50 flex h-14 items-center justify-between gap-2 px-3 sm:px-5 [&>*]:pointer-events-auto">
        <button
          type="button"
          onClick={clearAoi}
          className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${t('app.name')}: ${t('case.home')}`}
          title={t('case.home')}
        >
          <img src="/marca/iara-horizontal-sem-subtitulo-escuro.svg" alt={t('app.name')} className="-ml-2 h-11 w-auto shrink-0 drop-shadow-[0_1px_6px_rgb(0_0_0/0.6)]" />
        </button>

        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => triggerTutorial()}
            className="hidden h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-3 font-sans text-[13px] font-bold tracking-[-0.005em] text-foreground/75 transition-colors hover:bg-black/55 hover:text-foreground hover:backdrop-blur-xl hover:backdrop-saturate-150 sm:inline-flex"
            title={t('appLayout.tour')}
          >
            Tour
          </button>
          {/* Map tools only make sense once a case is open. */}
          {aoiActive && (
            <>
              <HeaderToggle
                label={t('map.satellite')}
                hint={t('map.satelliteHint')}
                on={satelliteOn}
                onToggle={toggleSatellite}
              />
              <HeaderToggle
                label={t('map.relief')}
                hint={t('map.reliefHint')}
                on={reliefOn}
                onToggle={toggleRelief}
                className="hidden sm:inline-flex"
              />
              <Suspense fallback={null}>
                <span data-tour="share">
                  <ShareDialog />
                </span>
                <span className="hidden md:inline-flex">
                  <ExportMenu />
                </span>
              </Suspense>
            </>
          )}
          <LanguageToggle compact />
        </div>
      </div>

      <div data-tour="map" className="absolute inset-0 overflow-hidden">
        <Suspense fallback={null}>
          {mapOn && <SarMap forecast={aoiActive ? forecastMap : null} />}
        </Suspense>
        <Suspense fallback={null}>
          <CaseView onForecastMapChange={setForecastMap} />
        </Suspense>
        <CasePicker introDone={introDone} />
        {/* Floating ask bar, only inside a case once the camera has arrived: centred in the map area the
            case panel leaves free, clear of the SAR band panel. It unrolls from a tuft of leaves and stays
            in place while the assistant panel is open, so the capybara can repeat the answer in her
            balloon. Hidden on phones (the case sheet covers the bottom). */}
        {introDone && aoiActive && caseArrived && (
          <div className="pointer-events-none absolute inset-x-3 bottom-10 z-30 hidden justify-center md:flex md:left-[calc(clamp(340px,30vw,420px)+24px)] md:right-[460px] md:bottom-14">
            <div data-tour="ask" className="pointer-events-auto flex w-full max-w-[640px]">
              <Suspense fallback={null}>
                <AskBar reveal />
              </Suspense>
            </div>
          </div>
        )}
        {/* Assistant and tools open as a floating drawer below the header (also on the home screen, for questions asked in the ask bar). */}
        {rightOpen && (
          <div className="glass-panel absolute bottom-3 right-3 top-[68px] z-40 max-w-[calc(100%-24px)] overflow-hidden rounded-[18px] animate-in slide-in-from-right-6 fade-in duration-300 motion-reduce:animate-none">
            <Suspense fallback={null}>
              <RightPanel />
            </Suspense>
          </div>
        )}
      </div>
    </section>
  )
}

function HeaderToggle({
  label,
  hint,
  on,
  onToggle,
  className,
}: {
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
        'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 font-sans text-[13px] font-bold tracking-[-0.005em] transition-colors active:scale-[0.97]',
        on
          ? 'border-transparent bg-white/15 text-foreground/80 backdrop-blur-xl backdrop-saturate-150 hover:bg-white/25 hover:text-foreground'
          : 'border-transparent text-foreground/75 hover:bg-black/55 hover:text-foreground hover:backdrop-blur-xl hover:backdrop-saturate-150',
        className
      )}
    >
      <span>{label}</span>
    </button>
  )
}
