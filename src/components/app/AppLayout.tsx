import { useMemo, useState } from 'react'
import { CloudSun, Radar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Sidebar } from './Sidebar/Sidebar'
import { SarMap } from './Map/SarMap'
import { Legend } from './Map/Legend'
import { LayerToggle } from './Map/LayerToggle'
import { RightPanel } from './RightPanel/RightPanel'
import { Timeline } from './Timeline/Timeline'
import { ExportMenu } from './Export/ExportMenu'
import { ShareDialog } from './PublicShare/ShareDialog'
import { PhenomenonBriefing } from './Briefing/PhenomenonBriefing'
import { NisarControl } from './Map/NisarControl'
import { Layers3, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { REGIONS } from '@/lib/regions'
import { useApp } from '@/lib/store'
import { useI18n, useT } from '@/lib/i18n'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { PredictiveModels } from './Map/PredictiveModels'
import { FLOOD_LAYER, gwisDates, type FloodChance, type FloodLayer, type FloodSignal, type ForecastPoint } from '@/lib/predictive-models'

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
  const [floodLayer, setFloodLayer] = useState<FloodLayer>(FLOOD_LAYER)
  const [floodFocus, setFloodFocus] = useState<ForecastPoint | null>(null)
  const [floodSignals, setFloodSignals] = useState<FloodSignal[]>([])
  const selectedFireDate = fireDate && forecastDates.includes(fireDate) ? fireDate : forecastDates[0]
  const activeRegion = useApp((s) => s.activeRegion)
  const nasaOverlay = useApp((s) => s.nasaOverlay)
  const trueColorOverlay = useApp((s) => s.trueColorOverlay)
  const toggleNasaOverlay = useApp((s) => s.toggleNasaOverlay)
  const toggleTrueColorOverlay = useApp((s) => s.toggleTrueColorOverlay)
  const region = useMemo(() => REGIONS.find((r) => r.id === activeRegion)!, [activeRegion])

  return (
    <section id="app" className="h-[100svh] w-full flex flex-col bg-background">
      <div className="flex h-12 items-center justify-between border-b border-border/60 bg-card/40 backdrop-blur-xl px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/15 ring-1 ring-primary/30">
            <Radar className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold">
              {t('app.name')} · {t(`region.${region.id}.phen`)}
            </div>
            <div className="truncate text-[13px] text-muted-foreground font-mono">
              {t(`region.${region.id}.city`)}
            </div>
          </div>
        </div>

        <div className="hidden xl:block shrink-0">
          <LayerToggle />
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
          <Badge variant="outline" className="font-mono hidden 2xl:flex whitespace-nowrap">
            NISAR · L-band · HH + HV
          </Badge>
          <ShareDialog />
          <ExportMenu />
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <div className="relative isolate flex-1 min-w-0">
          <SarMap
            fireDate={forecastMode === 'fire' ? selectedFireDate : null}
            floodLayer={forecastMode === 'river' ? floodLayer : null}
            floodFocus={forecastMode === 'river' ? floodFocus : null}
            floodSignals={forecastMode === 'river' ? floodSignals : []}
            riverPoint={forecastMode === 'river' ? forecastPoint : null}
            riverChance={forecastMode === 'river' && forecastPoint ? (floodChance?.point === forecastPoint ? floodChance.chance : 'loading') : null}
            onRiverSelect={forecastMode === 'river' ? setForecastPoint : undefined}
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
              onFloodFocus={(point) => { setForecastPoint(point); setFloodFocus([...point]) }}
              onFloodSignals={setFloodSignals}
              onFloodChance={setFloodChance}
              onFloodLayer={(layer) => { setFloodError(false); setFloodSignals([]); setFloodFocus(null); setFloodLayer(layer) }}
            />
          )}
          <div className="absolute left-3 top-3 xl:hidden">
            <LayerToggle />
          </div>
          <div className="absolute left-4 top-4 hidden md:block">
            <NisarControl />
          </div>
          <div className="pointer-events-none absolute inset-x-3 bottom-9 flex items-end gap-3">
            <div className="pointer-events-auto hidden 2xl:block shrink-0">
              <Legend />
            </div>
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
