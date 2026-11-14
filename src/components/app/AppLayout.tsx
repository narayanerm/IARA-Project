import { useState } from 'react'
import { CloudSun, HelpCircle, Layers3, Sun } from 'lucide-react'
import { Sidebar } from './Sidebar/Sidebar'
import { SarMap } from './Map/SarMap'
import { RightPanel } from './RightPanel/RightPanel'
import { AskBar } from './Chatbot/AskBar'
import { ExportMenu } from './Export/ExportMenu'
import { ShareDialog } from './PublicShare/ShareDialog'
import { triggerTutorial } from './Tutorial/Tutorial'
import { PhenomenonBriefing } from './Briefing/PhenomenonBriefing'
import { NisarControl } from './Map/NisarControl'
import { cn } from '@/lib/utils'
import { useApp, useUi } from '@/lib/store'
import { useI18n, useT } from '@/lib/i18n'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { PredictiveModels } from './Map/PredictiveModels'
import { FLOOD_LAYER, gwisDates, isFloodLayer, observedFloodStart, type FloodChance, type WaterLayer, type FloodSignal, type ForecastPoint } from '@/lib/predictive-models'
import { inAmazon } from '@/lib/amazon'

export function AppLayout() {
  const t = useT()
  const forecastLabel = useI18n((s) => s.lang === 'pt' ? 'Previsões' : 'Forecasts')
  const [forecastMode, setForecastMode] = useState<'river' | 'fire' | null>(null)
  const [forecastPoint, setForecastPoint] = useState<ForecastPoint | null>(null)
  const [floodChance, setFloodChance] = useState<{ point: ForecastPoint; chance: FloodChance } | null>(null)
  const [forecastDates, setForecastDates] = useState(gwisDates)
  const [fireDate, setFireDate] = useState<string | null>(null)
  const [fireError, setFireError] = useState(false)
  const [floodError, setFloodError] = useState(false)
  const [floodLayer, setFloodLayer] = useState<WaterLayer>(FLOOD_LAYER)
  const [observationDate, setObservationDate] = useState(() => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10))
  const observedDate = observationDate < observedFloodStart(floodLayer) ? observedFloodStart(floodLayer) : observationDate
  const canSelectRiver = forecastMode === 'river' && isFloodLayer(floodLayer)
  const [floodFocus, setFloodFocus] = useState<ForecastPoint | null>(null)
  const [floodSignals, setFloodSignals] = useState<FloodSignal[]>([])
  const selectedGlofas = forecastPoint
    ? floodSignals.find(({ point, glofas }) => glofas && point[0] === forecastPoint[0] && point[1] === forecastPoint[1])?.glofas
    : undefined
  const selectedFireDate = fireDate && forecastDates.includes(fireDate) ? fireDate : forecastDates[0]
  const nasaOverlay = useApp((s) => s.nasaOverlay)
  const trueColorOverlay = useApp((s) => s.trueColorOverlay)
  const toggleNasaOverlay = useApp((s) => s.toggleNasaOverlay)
  const toggleTrueColorOverlay = useApp((s) => s.toggleTrueColorOverlay)
  const rightOpen = useUi((s) => s.rightOpen)
  const popupOpen = useUi((s) => s.popupOpen)

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
          <button
            type="button"
            aria-label={forecastLabel}
            aria-expanded={forecastMode !== null}
            title={forecastLabel}
            onClick={() => {
              if (forecastMode) {
                setForecastMode(null)
                return
              }
              setForecastDates(gwisDates())
              setFireError(false)
              setFloodError(false)
              setFloodSignals([])
              setFloodFocus(null)
              setForecastMode('river')
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-xs hover:bg-secondary aria-expanded:bg-primary/20"
          >
            <CloudSun className="size-4" />
            <span className="hidden lg:inline">{forecastLabel}</span>
          </button>
          <span data-tour="share"><ShareDialog /></span>
          <ExportMenu />
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <div data-tour="map" className="relative isolate flex-1 min-w-0">
          <SarMap
            fireDate={forecastMode === 'fire' ? selectedFireDate : null}
            floodLayer={forecastMode === 'river' ? floodLayer : null}
            observedDate={observedDate}
            floodFocus={forecastMode === 'river' ? floodFocus : null}
            floodSignals={forecastMode === 'river' ? floodSignals : []}
            riverPoint={canSelectRiver ? forecastPoint : null}
            riverChance={canSelectRiver && forecastPoint ? (selectedGlofas ?? (floodChance?.point === forecastPoint ? floodChance.chance : 'loading')) : null}
            onRiverSelect={canSelectRiver ? (point) => {
              if (inAmazon(...point)) setForecastPoint(point)
            } : undefined}
            onFireTileError={() => setFireError(true)}
            onFloodTileError={() => setFloodError(true)}
          />
          {forecastMode && (
            <PredictiveModels
              mode={forecastMode}
              onModeChange={(mode) => {
                if (mode === forecastMode) return
                setFireError(false)
                setFloodError(false)
                setFloodSignals([])
                setFloodFocus(null)
                setForecastMode(mode)
              }}
              onClose={() => setForecastMode(null)}
              point={forecastPoint}
              fireDate={selectedFireDate}
              fireDates={forecastDates}
              onFireDate={(date) => { setFireError(false); setFireDate(date) }}
              fireError={fireError}
              floodError={floodError}
              floodLayer={floodLayer}
              observedDate={observedDate}
              onObservedDate={(date) => { setFloodError(false); setObservationDate(date) }}
              onFloodFocus={(point) => { setForecastPoint(point); setFloodFocus([...point]) }}
              onFloodSignals={setFloodSignals}
              onFloodChance={setFloodChance}
              selectedGlofas={selectedGlofas}
              onFloodLayer={(layer) => { setFloodError(false); setFloodSignals([]); setFloodFocus(null); setForecastPoint(null); setFloodLayer(layer) }}
            />
          )}
          <div data-tour="nisar" className="absolute left-4 top-4 hidden md:block">
            <NisarControl />
          </div>
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
