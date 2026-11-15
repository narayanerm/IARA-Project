import { useEffect, useState } from 'react'
import { CloudSun, Satellite } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import {
  FLOOD_LAYER, FLOOD_EXTENT_LAYER, MODIS_FLOOD, VIIRS_FLOOD, SUBSEASONAL_RIVERS, SEASONAL_BASINS,
  gwisDates, isFloodLayer, observedFloodStart, pointInForecastBounds,
  type FloodChance, type FloodSignal, type ForecastBounds, type ForecastMapProps,
  type ForecastPoint, type WaterLayer,
} from '@/lib/predictive-models'
import { PredictiveModels } from '../Map/PredictiveModels'

const LAYERS = {
  flood: [FLOOD_LAYER, FLOOD_EXTENT_LAYER],
  drought: [SUBSEASONAL_RIVERS, SEASONAL_BASINS],
  observed: [MODIS_FLOOD, VIIRS_FLOOD],
  fire: [],
} as const

export type SetCaseForecastMap = (forecast: ForecastMapProps | null) => void

export function CaseForecasts({ kind, bounds, initialDate, onMapChange }: {
  kind: keyof typeof LAYERS
  bounds: ForecastBounds
  initialDate?: string
  onMapChange: SetCaseForecastMap
}) {
  const pt = useI18n((s) => s.lang === 'pt')
  const [enabled, setEnabled] = useState(kind === 'flood' || kind === 'drought')
  const [waterLayer, setWaterLayer] = useState<WaterLayer>(LAYERS[kind][0] ?? FLOOD_LAYER)
  const [observationDate, setObservationDate] = useState(() => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10))
  const [useCaseDate, setUseCaseDate] = useState(true)
  const date = useCaseDate && initialDate && initialDate >= observedFloodStart(waterLayer) ? initialDate : observationDate
  const [fireDates] = useState(gwisDates)
  const [fireDate, setFireDate] = useState(fireDates[0])
  const [fireError, setFireError] = useState(false)
  const [floodError, setFloodError] = useState(false)
  const [point, setPoint] = useState<ForecastPoint | null>(null)
  const [focus, setFocus] = useState<ForecastPoint | null>(null)
  const [signals, setSignals] = useState<FloodSignal[]>([])
  const [chance, setChance] = useState<{ point: ForecastPoint; chance: FloodChance } | null>(null)
  const selectedGlofas = point
    ? signals.find((signal) => signal.glofas && signal.point[0] === point[0] && signal.point[1] === point[1])?.glofas
    : undefined
  const riverChance = point ? (selectedGlofas ?? (chance?.point === point ? chance.chance : 'loading')) : null
  const canSelectRiver = kind === 'flood' && isFloodLayer(waterLayer)
  const Icon = kind === 'observed' ? Satellite : CloudSun
  const title = {
    flood: pt ? 'Previsão de cheia' : 'Flood forecast',
    drought: pt ? 'Perspectiva de vazão e seca' : 'River flow and drought outlook',
    observed: pt ? 'Inundação observada por satélite' : 'Satellite-observed flooding',
    fire: pt ? 'Perigo meteorológico de fogo' : 'Fire weather danger',
  }[kind]

  useEffect(() => () => onMapChange(null), [onMapChange])

  useEffect(() => {
    onMapChange(enabled ? {
      fireDate: kind === 'fire' ? fireDate : null,
      floodLayer: kind === 'fire' ? null : waterLayer,
      observedDate: date,
      floodFocus: focus,
      floodSignals: signals,
      riverPoint: point,
      riverChance,
      onRiverSelect: canSelectRiver ? (candidate) => {
        if (pointInForecastBounds(candidate, bounds)) setPoint(candidate)
      } : undefined,
      onFireTileError: () => setFireError(true),
      onFloodTileError: () => setFloodError(true),
    } : null)
  }, [enabled, kind, fireDate, waterLayer, date, focus, signals, point, riverChance, canSelectRiver, bounds, onMapChange])

  return (
    <section className="mx-5 my-4 space-y-3 rounded-md border border-border/70 bg-background/40 p-3">
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
        <button type="button" aria-pressed={enabled} onClick={() => {
          setEnabled(!enabled)
          setFireError(false)
          setFloodError(false)
        }} className="ml-auto shrink-0 rounded border border-border px-2 py-1 text-xs hover:bg-secondary">
          {enabled ? (pt ? 'Ocultar' : 'Hide') : (pt ? 'Mostrar' : 'Show')}
        </button>
      </div>
      {enabled && (
        <PredictiveModels
          mode={kind === 'fire' ? 'fire' : 'river'}
          layers={LAYERS[kind]}
          bounds={bounds}
          point={point}
          fireDate={fireDate}
          fireDates={fireDates}
          onFireDate={(next) => { setFireError(false); setFireDate(next) }}
          fireError={fireError}
          floodError={floodError}
          floodLayer={waterLayer}
          onFloodLayer={(layer) => {
            setFloodError(false)
            setSignals([])
            setFocus(null)
            setPoint(null)
            setWaterLayer(layer)
          }}
          observedDate={date}
          onObservedDate={(next) => { setFloodError(false); setUseCaseDate(false); setObservationDate(next) }}
          onFloodFocus={(next) => { setPoint(next); setFocus([...next]) }}
          onFloodSignals={setSignals}
          onFloodChance={setChance}
          selectedGlofas={selectedGlofas}
        />
      )}
    </section>
  )
}
