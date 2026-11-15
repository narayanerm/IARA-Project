import { SarMap } from './Map/SarMap'
import { RightPanel } from './RightPanel/RightPanel'
import { AskBar } from './Chatbot/AskBar'
import { SarButton } from './Map/overlays/SarButton'
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
  const aoiActive = useApp((s) => s.aoiActive)
  const clearAoi = useApp((s) => s.clearAoi)
  const caseArrived = useApp((s) => s.caseArrived)
  const [forecastMap, setForecastMap] = useState<ForecastMapProps | null>(null)

  return (
    <section id="app" className="flex h-[100svh] w-full flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border/70 bg-background px-3 sm:px-5">
        <button
          type="button"
          onClick={clearAoi}
          className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${t('app.name')}: ${t('case.home')}`}
          title={t('case.home')}
        >
          <img src="/marca/iara-simbolo-escuro.svg" alt="" aria-hidden="true" className="h-7 w-7 shrink-0" />
          <span className="text-[15px] font-normal tracking-[0.18em] [font-variation-settings:'wdth'_125]">{t('app.name')}</span>
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
              <span className="mx-0.5 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
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
              className="hidden h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-3 font-sans text-[13px] font-bold tracking-[-0.005em] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground sm:inline-flex"
              title={t('appLayout.tour')}
            >
              Tour
            </button>
          )}
          <LanguageToggle compact />
        </div>
      </div>

      <div data-tour="map" className="relative min-h-0 flex-1 overflow-hidden">
        <SarMap forecast={aoiActive ? forecastMap : null} />
        <CaseView onForecastMapChange={setForecastMap} />
        <CasePicker introDone={introDone} />
        {aoiActive && <SarButton />}
        {/* Floating ask bar: on the home screen under the case cards, inside a case centred in the
            map area the case panel leaves free. It steps aside while the assistant panel is open,
            while the camera flies, and on phones inside a case (the case sheet covers the bottom). */}
        {introDone && !rightOpen && (!aoiActive || caseArrived) && (
          <div
            className={cn(
              'pointer-events-none absolute inset-x-3 bottom-3 z-30 flex justify-center animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none',
              aoiActive && 'hidden md:flex md:left-[calc(clamp(340px,30vw,420px)+24px)] md:right-6 md:bottom-6'
            )}
          >
            <AskBar className={cn('pointer-events-auto', !aoiActive && 'max-w-[560px]')} />
          </div>
        )}
        {/* Assistant and tools open as a drawer over the map (also on the home screen, for questions asked in the ask bar). */}
        {rightOpen && (
          <div className="absolute inset-y-0 right-0 z-40 max-w-full shadow-2xl animate-in slide-in-from-right-6 fade-in duration-300 motion-reduce:animate-none">
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
        'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 font-sans text-[13px] font-bold tracking-[-0.005em] transition-colors active:scale-[0.97]',
        on
          ? 'border-foreground/70 bg-foreground text-background'
          : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground',
        className
      )}
    >
      <span>{label}</span>
    </button>
  )
}
import { useState } from 'react'
