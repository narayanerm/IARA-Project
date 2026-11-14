import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { ForecastLegend } from './ForecastLegend'
import {
  fetchFlowForecast,
  AMAZON_RIVER_PREVIEWS,
  findForecastReach,
  fetchFloodChance,
  loadFloodForecastSnapshot,
  FLOOD_ATTRIBUTION,
  FLOOD_EXTENT_LAYER,
  FLOOD_LAYER,
  SUBSEASONAL_RIVERS,
  SEASONAL_BASINS,
  MODIS_FLOOD,
  VIIRS_FLOOD,
  WATER_LAYERS,
  isFloodLayer,
  isObservedFlood,
  observedFloodStart,
  NASA_FLOOD_ATTRIBUTION,
  NASA_FLOOD_VIEWER,
  findRegionalFloodSignals,
  FLOOD_VIEWER,
  GEOGLOWS_VIEWER,
  GWIS_ATTRIBUTION,
  GWIS_VIEWER,
  type FlowForecast,
  type FloodLayer,
  type WaterLayer,
  type FloodSignal,
  type FloodChance,
  type ForecastPoint,
  type GlofasSignal,
} from '@/lib/predictive-models'

type FlowResult = { point: ForecastPoint; data: FlowForecast | null } | { point: ForecastPoint; error: true }

const WATER_LABELS: Record<WaterLayer, [string, string]> = {
  [FLOOD_LAYER]: ['Trechos em risco', 'River reaches at risk'],
  [FLOOD_EXTENT_LAYER]: ['Inundação estimada', 'Estimated inundation'],
  [SUBSEASONAL_RIVERS]: ['Vazão subsazonal · rios', 'Subseasonal flow · rivers'],
  [SEASONAL_BASINS]: ['Vazão sazonal · bacias', 'Seasonal flow · basins'],
  [VIIRS_FLOOD]: ['Inundação observada · VIIRS', 'Observed flooding · VIIRS'],
  [MODIS_FLOOD]: ['Inundação observada · MODIS', 'Observed flooding · MODIS'],
}

export function PredictiveModels({ mode, onModeChange, onClose, point, fireDate, fireDates, onFireDate, fireError, floodError, floodLayer, onFloodLayer, onFloodFocus, onFloodSignals, onFloodChance, selectedGlofas, observedDate, onObservedDate }: {
  mode: 'river' | 'fire'
  onModeChange: (mode: 'river' | 'fire') => void
  onClose: () => void
  point: ForecastPoint | null
  fireDate: string
  fireDates: string[]
  onFireDate: (date: string) => void
  fireError: boolean
  floodError: boolean
  floodLayer: WaterLayer
  onFloodLayer: (layer: WaterLayer) => void
  observedDate: string
  onObservedDate: (date: string) => void
  onFloodFocus: (point: ForecastPoint) => void
  onFloodSignals: (signals: FloodSignal[]) => void
  onFloodChance: (result: { point: ForecastPoint; chance: FloodChance }) => void
  selectedGlofas?: GlofasSignal
}) {
  const lang = useI18n((s) => s.lang)
  const pt = lang === 'pt'
  const [result, setResult] = useState<FlowResult | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [chanceResult, setChanceResult] = useState<{ point: ForecastPoint; chance: FloodChance } | null>(null)
  const [regionalSignal, setRegionalSignal] = useState<{ layer: FloodLayer; point: ForecastPoint | null | 'error' } | null>(null)
  const selected = mode === 'river' && isFloodLayer(floodLayer) ? point : null

  useEffect(() => {
    if (mode !== 'river' || !isFloodLayer(floodLayer)) return
    const controller = new AbortController()
    const referencePoints = floodLayer === FLOOD_LAYER
      ? AMAZON_RIVER_PREVIEWS.map((point) => ({ point, color: '#94a3b8' }))
      : []
    onFloodSignals(referencePoints)
    findRegionalFloodSignals(floodLayer, AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]))
      .then((signals) => {
        if (controller.signal.aborted) return
        setRegionalSignal({ layer: floodLayer, point: signals[0]?.point ?? null })
        onFloodSignals([...referencePoints, ...signals])
      })
      .catch(() => { if (!controller.signal.aborted) setRegionalSignal({ layer: floodLayer, point: 'error' }) })
    return () => controller.abort()
  }, [mode, floodLayer, onFloodSignals])

  useEffect(() => {
    if (!selected) return
    const controller = new AbortController()
    const updateChance = (chance: FloodChance) => {
      if (controller.signal.aborted) return
      const next = { point: selected, chance }
      setChanceResult(next)
      onFloodChance(next)
    }
    if (!selectedGlofas) updateChance('loading')
    const selection = loadFloodForecastSnapshot(AbortSignal.any([controller.signal, AbortSignal.timeout(3000)]))
      .then(async (snapshot) => {
        controller.signal.throwIfAborted()
        const saved = snapshot?.forecasts.find(({ point }) => point[0] === selected[0] && point[1] === selected[1])
        if (saved) return { id: saved.flow.riverId, saved }
        const id = await findForecastReach(selected, AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]))
        return { id, saved: snapshot?.forecasts.find(({ flow }) => flow.riverId === id) }
      })
    selection.then(({ id, saved }) => saved?.flow ?? (id === null ? null : fetchFlowForecast(id, AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]))))
      .then((data) => { if (!controller.signal.aborted) setResult({ point: selected, data }) })
      .catch(() => {
        if (controller.signal.aborted) return
        setResult({ point: selected, error: true })
      })
    if (!selectedGlofas) {
      selection.then(({ id, saved }) => saved?.chance ?? (id === null ? 'unavailable' as const : fetchFloodChance(id, AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]))))
        .then(updateChance)
        .catch(() => updateChance('unavailable'))
    }
    return () => controller.abort()
  }, [selected, attempt, onFloodChance, selectedGlofas])

  const current = result?.point === selected ? result : null
  const chance = chanceResult?.point === selected ? chanceResult?.chance : 'loading'
  const dateFormat = new Intl.DateTimeFormat(pt ? 'pt-BR' : 'en', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const formatDate = (date: string) => dateFormat.format(new Date(date))
  const flowFormat = new Intl.NumberFormat(pt ? 'pt-BR' : 'en', { maximumFractionDigits: 1 })

  return (
    <section aria-label={pt ? 'Previsões' : 'Forecasts'} className="absolute left-3 top-16 z-[450] max-h-[calc(100%-9rem)] w-[min(19rem,calc(100%-1.5rem))] overflow-auto rounded-lg border border-border bg-card p-3 text-sm shadow-xl md:top-28">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">{pt ? 'Previsões' : 'Forecasts'}</h2>
        <button type="button" onClick={onClose} aria-label={pt ? 'Fechar previsões' : 'Close forecasts'} className="rounded p-1 hover:bg-secondary">
          <X className="size-4" />
        </button>
      </div>
      <div className="mb-3 flex gap-1">
        <button type="button" aria-pressed={mode === 'river'} onClick={() => onModeChange('river')} className="rounded-md border border-border px-2 py-1 aria-pressed:bg-primary/20">
          {pt ? 'Cheia e seca' : 'Flood & drought'}
        </button>
        <button type="button" aria-pressed={mode === 'fire'} onClick={() => onModeChange('fire')} className="rounded-md border border-border px-2 py-1 aria-pressed:bg-primary/20">
          {pt ? 'Perigo de fogo' : 'Fire danger'}
        </button>
      </div>
      {mode === 'river' ? (
        <>
          <label className="mb-2 flex flex-wrap items-center gap-2">
            {pt ? 'Camada' : 'Layer'}
            <select value={floodLayer} onChange={(e) => {
              const layer = WATER_LAYERS.find((value) => value === e.target.value)
              if (layer) onFloodLayer(layer)
            }} className="max-w-full rounded border border-border bg-background p-1">
              {WATER_LAYERS.map((layer) => <option key={layer} value={layer}>{WATER_LABELS[layer][pt ? 0 : 1]}</option>)}
            </select>
          </label>
          {!isFloodLayer(floodLayer) ? (
            <WaterOutlook layer={floodLayer} date={observedDate} onDate={onObservedDate} pt={pt} error={floodError} />
          ) : (
          <>
          <p className="text-xs">{floodLayer === FLOOD_LAYER
            ? (pt ? 'Trechos com sinal de cheia nos próximos 15 dias. As cores comparam a vazão prevista com o histórico.' : 'River reaches with a flood signal over the next 15 days. Colors compare forecast discharge with historical flows.')
            : (pt ? 'Estimativa experimental das áreas inundáveis em grandes bacias com sinal de cheia intensa.' : 'Experimental estimate of inundation in large basins with a severe flood signal.')}
          </p>
          <ForecastLegend layer={floodLayer} pt={pt} />
          <p className="mt-2 text-xs">{pt ? 'Os pontos coloridos indicam a localização aproximada dos sinais.' : 'Colored dots show approximate signal locations.'}</p>
          {floodLayer === FLOOD_LAYER && <p className="mt-1 text-xs">{pt ? 'Os pontos cinza abrem previsões de vazão.' : 'Gray dots open river-flow forecasts.'}</p>}
          <div className="mt-2 text-xs" aria-live="polite">
            {regionalSignal?.layer !== floodLayer ? (
              pt ? 'Buscando sinais na região amazônica…' : 'Checking the Amazon region for signals…'
            ) : regionalSignal.point === 'error' ? (
              pt ? 'Não foi possível verificar a região.' : 'Could not check the region.'
            ) : regionalSignal.point ? (
              <button type="button" className="rounded border border-border px-2 py-1 hover:bg-secondary" onClick={() => {
                if (regionalSignal.point && regionalSignal.point !== 'error') onFloodFocus(regionalSignal.point)
              }}>
                {pt ? 'Ir para um sinal previsto' : 'Zoom to a forecast signal'}
              </button>
            ) : (
              <>
                {pt ? 'Sem sinais nesta camada dentro do contorno da Amazônia brasileira.' : 'No signals for this layer inside the Brazilian Amazon boundary.'}
                {floodLayer === FLOOD_LAYER && AMAZON_RIVER_PREVIEWS.length > 0 && (
                  <>
                    <button type="button" className="mt-1 rounded border border-border px-2 py-1 hover:bg-secondary" onClick={() => onFloodFocus(AMAZON_RIVER_PREVIEWS[0])}>
                      {pt ? 'Ver previsão no Rio Negro' : 'View Rio Negro forecast'}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
          {floodError && <p role="status" className="mt-2">{pt ? 'Parte do mapa de cheias não pôde ser carregada.' : 'Some flood forecast tiles could not be loaded.'}</p>}
          <a href={FLOOD_VIEWER} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs underline">{FLOOD_ATTRIBUTION}</a>
          <p className="mt-3 border-t border-border pt-2 text-xs">{pt ? 'Clique perto de um rio dentro do contorno para ver a previsão do trecho mais próximo.' : 'Click near a river inside the boundary to see the forecast for the closest modeled reach.'}</p>
          {selectedGlofas?.band && (
            <p className="mt-2 text-xs font-semibold">
              {pt
                ? `GloFAS: ${selectedGlofas.band.range} de chance de superar o limiar de ${selectedGlofas.band.threshold} anos em 15 dias.`
                : `GloFAS: ${selectedGlofas.band.range} chance of exceeding the ${selectedGlofas.band.threshold}-year threshold over 15 days.`}
            </p>
          )}
          {selectedGlofas && !selectedGlofas.band && (
            <p className="mt-2 text-xs">{pt ? 'Esta camada GloFAS não fornece uma porcentagem para este ponto.' : 'This GloFAS layer supplies no percentage for this point.'}</p>
          )}
          {selected && !selectedGlofas && <p className="mt-1 text-xs text-muted-foreground">{pt
            ? 'A porcentagem indica quantos cenários GEOGLOWS superam o limiar de vazão diária de 2 anos ao menos uma vez em 7 dias (UTC).'
            : 'The percentage is the share of GEOGLOWS scenarios exceeding the 2-year daily flow threshold at least once over 7 days (UTC).'}
          </p>}
          {selected && !selectedGlofas && (
            <div className="mt-2 text-xs" aria-live="polite">
              {typeof chance === 'number'
                ? <strong>{pt ? 'Chance em 7 dias' : '7-day chance'} · {chance}%</strong>
                : chance === 'unavailable'
                  ? <>{pt ? 'Chance indisponível.' : 'Chance unavailable.'}{' '}
                    <button type="button" className="underline" onClick={() => setAttempt((n) => n + 1)}>{pt ? 'Tentar novamente' : 'Retry'}</button></>
                  : (pt ? 'Calculando a chance de vazão alta…' : 'Calculating high-flow chance…')}
            </div>
          )}
          <div aria-live="polite" className="mt-2">
            {selected && !current && <p>{pt ? 'Carregando previsão…' : 'Loading forecast…'}</p>}
            {current && 'error' in current && (
              <p>
                {pt ? 'Erro ao carregar a previsão.' : 'Could not load the forecast.'}{' '}
                <button type="button" className="underline" onClick={() => { setResult(null); setAttempt((n) => n + 1) }}>
                  {pt ? 'Tentar novamente' : 'Retry'}
                </button>
              </p>
            )}
            {current && 'data' in current && !current.data?.days.length && <p>{pt ? 'Nenhuma previsão disponível aqui.' : 'No forecast available here.'}</p>}
            {current && 'data' in current && !!current.data?.days.length && (
              <table className="w-full text-xs tabular-nums">
                <caption className="mb-1 text-left">
                  {pt ? 'Trecho' : 'Reach'} {current.data.riverId} · m³/s · 00:00 UTC
                </caption>
                <thead>
                  <tr className="text-muted-foreground">
                    <th scope="col" className="text-left">{pt ? 'Data' : 'Date'}</th>
                    <th scope="col" className="text-right">{pt ? 'Mediana' : 'Median'}</th>
                    <th scope="col" className="text-right">P25–P75</th>
                  </tr>
                </thead>
                <tbody>
                  {current.data.days.map(({ date, median, lower, upper }) => (
                    <tr key={date} className="border-t border-border">
                      <td className="py-1">{formatDate(date)}</td>
                      <td className="text-right">{flowFormat.format(median)}</td>
                      <td className="text-right">{flowFormat.format(lower)}–{flowFormat.format(upper)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <a href={GEOGLOWS_VIEWER} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs underline">GEOGLOWS · ECMWF</a>
          </>
          )}
        </>
      ) : (
        <>
          <label className="flex flex-wrap items-center gap-2">
            {pt ? 'Data da previsão (UTC)' : 'Forecast date (UTC)'}
            <select value={fireDate} onChange={(e) => onFireDate(e.target.value)} className="rounded border border-border bg-background p-1">
              {fireDates.map((date) => <option key={date} value={date}>{formatDate(date)}</option>)}
            </select>
          </label>
          <p className="mt-2 text-xs">{pt ? 'Condições meteorológicas favoráveis a incêndios. Áreas sem cor podem estar sem dados.' : 'Weather conditions favorable to wildfires. Uncolored areas may have no data.'}</p>
          <ForecastLegend layer="fire" pt={pt} />
          {fireError && <p role="status" className="mt-2">{pt ? 'Parte da camada de previsão não pôde ser carregada.' : 'Some forecast tiles could not be loaded.'}</p>}
          <a href={GWIS_VIEWER} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs underline">{GWIS_ATTRIBUTION}</a>
        </>
      )}
    </section>
  )
}

function WaterOutlook({ layer, date, onDate, pt, error }: {
  layer: Exclude<WaterLayer, FloodLayer>
  date: string
  onDate: (date: string) => void
  pt: boolean
  error: boolean
}) {
  const observed = isObservedFlood(layer)
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const start = observedFloodStart(layer)
  return (
    <div className="space-y-2 text-xs">
      {observed ? (
        <>
          <label className="flex flex-wrap items-center gap-2">
            {pt ? 'Data da observação (UTC)' : 'Observation date (UTC)'}
            <input type="date" value={date} min={start} max={today} onChange={(e) => {
              const value = e.target.value
              if (value >= start && value <= today) onDate(value)
            }} className="rounded border border-border bg-background p-1" />
          </label>
          <p>{pt
            ? 'Imagem óptica composta de três dias. Áreas com dados insuficientes ficam transparentes.'
            : 'Three-day optical composite. Areas with insufficient data are transparent.'}</p>
        </>
      ) : (
        <p>{layer === SUBSEASONAL_RIVERS
          ? (pt ? 'Perspectiva semanal de vazão nos rios em relação ao normal para a época.' : 'Weekly outlook for river flow relative to what is normal for the season.')
          : (pt ? 'Perspectiva mensal de vazão nas bacias em relação ao normal para a época.' : 'Monthly outlook for basin flow relative to what is normal for the season.')}
        </p>
      )}
      <ForecastLegend layer={layer} pt={pt} />
      {error && <p role="status">{pt ? 'Parte da camada não pôde ser carregada.' : 'Some map tiles could not be loaded.'}</p>}
      <a href={observed ? NASA_FLOOD_VIEWER : FLOOD_VIEWER} target="_blank" rel="noreferrer" className="block underline">
        {observed ? NASA_FLOOD_ATTRIBUTION : FLOOD_ATTRIBUTION}
      </a>
      {!observed && (
        <div className="space-y-2 border-t border-border pt-2">
          <h3 className="font-semibold">{pt ? 'Seca no Brasil' : 'Drought in Brazil'}</h3>
          <a href="https://sace.sgb.gov.br/" target="_blank" rel="noreferrer" className="block underline">
            {pt ? 'SGB/SACE · níveis dos rios e alertas de vazante' : 'SGB/SACE · river levels and low-water alerts'}
          </a>
          <a href="https://www.gov.br/cemaden/pt-br/assuntos/monitoramento/impactos-seca/monitoramento-de-seca-para-o-brasil" target="_blank" rel="noreferrer" className="block underline">
            {pt ? 'Cemaden · boletins de seca e perspectivas de chuva' : 'Cemaden · drought bulletins and rainfall outlooks'}
          </a>
        </div>
      )}
    </div>
  )
}
