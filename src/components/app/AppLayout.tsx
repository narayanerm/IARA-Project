import { SarMap } from './Map/SarMap'
import { RightPanel } from './RightPanel/RightPanel'
import { AskBar } from './Chatbot/AskBar'
import { ExportMenu } from './Export/ExportMenu'
import { ShareDialog } from './PublicShare/ShareDialog'
import { triggerTutorial } from './Tutorial/Tutorial'
import { CasePicker } from './Cases/CasePicker'
import { CaseView } from './Cases/CaseView'
import { cn } from '@/lib/utils'
import { useApp, useUi } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import type { ForecastMapProps } from '@/lib/predictive-models'

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
  const caseArrived = useApp((s) => s.caseArrived)
  const [forecastMap, setForecastMap] = useState<ForecastMapProps | null>(null)

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
              <HeaderToggle
                label={t('map.radar')}
                hint={t('map.radarHint')}
                on={nisarVisible}
                onToggle={() => setNisarVisible(!nisarVisible)}
              />
              <span className="mx-0.5 hidden h-4 w-px bg-white/25 sm:block" aria-hidden="true" />
              <HeaderToggle
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
              className="hidden h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-3 font-sans text-[13px] font-bold tracking-[-0.005em] text-foreground/85 transition-colors hover:bg-black/55 hover:text-foreground hover:backdrop-blur-md sm:inline-flex"
              title={t('appLayout.tour')}
            >
              Tour
            </button>
          )}
          <LanguageToggle compact />
        </div>
      </div>

      <div data-tour="map" className="absolute inset-0 overflow-hidden">
        <SarMap forecast={aoiActive ? forecastMap : null} />
        <CaseView onForecastMapChange={setForecastMap} />
        <CasePicker introDone={introDone} />
        {/* Floating ask bar, only inside a case once the camera has arrived: centred in the map area the
            case panel leaves free, clear of the SAR band panel. It unrolls from a tuft of leaves, steps
            aside while the assistant panel is open, and hides on phones (the case sheet covers the bottom). */}
        {introDone && !rightOpen && aoiActive && caseArrived && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-30 hidden justify-center md:flex md:left-[calc(clamp(340px,30vw,420px)+24px)] md:right-[256px] md:bottom-6">
            <AskBar reveal className="pointer-events-auto" />
          </div>
        )}
        {/* Assistant and tools open as a floating drawer below the header (also on the home screen, for questions asked in the ask bar). */}
        {rightOpen && (
          <div className="absolute bottom-3 right-3 top-[68px] z-40 max-w-[calc(100%-24px)] overflow-hidden rounded-[14px] shadow-2xl animate-in slide-in-from-right-6 fade-in duration-300 motion-reduce:animate-none">
            <RightPanel />
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
          ? 'border-transparent bg-white/15 text-foreground backdrop-blur-md hover:bg-white/25'
          : 'border-transparent text-foreground/85 hover:bg-black/55 hover:text-foreground hover:backdrop-blur-md',
        className
      )}
    >
      <span>{label}</span>
    </button>
  )
}
import { useState } from 'react'
