import { HelpCircle, Mountain, Satellite, type LucideIcon } from 'lucide-react'
import { SarMap } from './Map/SarMap'
import { MapDock } from './MapDock'
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
  const aoiActive = useApp((s) => s.aoiActive)
  const clearAoi = useApp((s) => s.clearAoi)
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
              <span className="mx-0.5 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
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
              className="hidden h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-3 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground sm:inline-flex"
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
        <SarMap forecast={aoiActive ? forecastMap : null} />
        <CaseView onForecastMapChange={setForecastMap} />
        <CasePicker introDone={introDone} />
        {aoiActive && <SarButton />}
        {/* Floating assistant ask bar at the bottom of the map. */}
        {aoiActive && <MapDock />}
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
        'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors active:scale-[0.97] xl:px-3',
        on
          ? 'border-foreground/70 bg-foreground text-background'
          : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground',
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      <span className="hidden xl:inline">{label}</span>
    </button>
  )
}
import { useState } from 'react'
