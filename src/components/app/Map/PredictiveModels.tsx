import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { ForecastLegend } from './ForecastLegend'
import {
  fetchFlowForecast,
  AMAZON_RIVER_SITES,
  fetchFloodChance,
  resolveRiverForecast,
  FLOOD_ATTRIBUTION,
  FLOOD_EXTENT_LAYER,
  FLOOD_LAYER,
  RIVER_FLOW,
  SUBSEASONAL_RIVERS,
  SEASONAL_BASINS,
  MODIS_FLOOD,
  VIIRS_FLOOD,
  pointInForecastBounds,
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
  type WaterOption,
  type FloodSignal,
  type FloodChance,
  type ForecastPoint,
  type ForecastBounds,
  type GlofasSignal,
} from '@/lib/predictive-models'

type FlowResult = { point: ForecastPoint; data: FlowForecast | null } | { point: ForecastPoint; error: true }

const WATER_LABELS: Record<WaterOption, [string, string]> = {
  [RIVER_FLOW]: ['Previsão de vazão · GEOGLOWS', 'River flow forecast · GEOGLOWS'],
  [FLOOD_LAYER]: ['Trechos em risco', 'River reaches at risk'],
  [FLOOD_EXTENT_LAYER]: ['Inundação estimada', 'Estimated inundation'],
  [SUBSEASONAL_RIVERS]: ['Vazão subsazonal · rios', 'Subseasonal flow · rivers'],
  [SEASONAL_BASINS]: ['Vazão sazonal · bacias', 'Seasonal flow · basins'],
  [VIIRS_FLOOD]: ['Inundação observada · VIIRS', 'Observed flooding · VIIRS'],
  [MODIS_FLOOD]: ['Inundação observada · MODIS', 'Observed flooding · MODIS'],
}

export function PredictiveModels({ mode, layers, bounds, point, showRiverFlow, showFloodChance, fireDate, fireDates, onFireDate, fireError, floodError, floodLayer, onFloodLayer, onFloodFocus, onFloodSignals, onFloodChance, selectedGlofas, observedDate, onObservedDate, outlookRunDate, outlookError, onOutlookRetry }: {
  mode: 'river' | 'fire'
  layers: readonly WaterOption[]
  bounds: ForecastBounds
  point: ForecastPoint | null
  showRiverFlow: boolean
  showFloodChance: boolean
  fireDate: string
  fireDates: string[]
  onFireDate: (date: string) => void
  fireError: boolean
  floodError: boolean
  floodLayer: WaterOption
  onFloodLayer: (layer: WaterOption) => void
  observedDate: string
  onObservedDate: (date: string) => void
  outlookRunDate: string | null
  outlookError: boolean
  onOutlookRetry: () => void
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
  const selected = showRiverFlow ? point : null
  const referencePoint = AMAZON_RIVER_SITES.find(({ point: candidate }) => pointInForecastBounds(candidate, bounds))

  useEffect(() => {
    if (!showRiverFlow) return
    const controller = new AbortController()
    const referencePoints = AMAZON_RIVER_SITES.filter(({ point }) => pointInForecastBounds(point, bounds))
      .map(({ point }) => ({ point, color: '#94a3b8' }))
    onFloodSignals(referencePoints)
    if (!isFloodLayer(floodLayer)) return
    findRegionalFloodSignals(floodLayer, bounds, AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]))
      .then((signals) => {
        if (controller.signal.aborted) return
        setRegionalSignal({ layer: floodLayer, point: signals[0]?.point ?? null })
        onFloodSignals([...referencePoints, ...signals.slice(0, 24)])
      })
      .catch(() => { if (!controller.signal.aborted) setRegionalSignal({ layer: floodLayer, point: 'error' }) })
    return () => controller.abort()
  }, [showRiverFlow, floodLayer, bounds, onFloodSignals])

  useEffect(() => {
    if (!selected) return
    const controller = new AbortController()
    const updateChance = (chance: FloodChance) => {
      if (controller.signal.aborted) return
      const next = { point: selected, chance }
      setChanceResult(next)
      onFloodChance(next)
    }
    if (showFloodChance && !selectedGlofas) updateChance('loading')
    const selection = resolveRiverForecast(selected, controller.signal)
    selection.then(({ id, saved }) => saved?.flow ?? (id === null ? null : fetchFlowForecast(id, AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]))))
      .then((data) => { if (!controller.signal.aborted) setResult({ point: selected, data }) })
      .catch(() => {
        if (controller.signal.aborted) return
        setResult({ point: selected, error: true })
      })
    if (showFloodChance && !selectedGlofas) {
      selection.then(({ id, saved }) => saved?.chance ?? (id === null ? 'unavailable' as const : fetchFloodChance(id, AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]))))
        .then(updateChance)
        .catch(() => updateChance('unavailable'))
    }
    return () => controller.abort()
  }, [selected, attempt, onFloodChance, selectedGlofas, showFloodChance])

  const current = result?.point === selected ? result : null
  const chance = chanceResult?.point === selected ? chanceResult?.chance : 'loading'
  const dateFormat = new Intl.DateTimeFormat(pt ? 'pt-BR' : 'en', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const formatDate = (date: string) => dateFormat.format(new Date(date))
  const flowFormat = new Intl.NumberFormat(pt ? 'pt-BR' : 'en', { maximumFractionDigits: 1 })

  return (
    <div className="min-w-0 text-sm">
      {mode === 'river' ? (
        <>
          <label className="mb-2 flex flex-wrap items-center gap-2">
            {pt ? 'Camada' : 'Layer'}
            <select value={floodLayer} onChange={(e) => {
              const layer = layers.find((value) => value === e.target.value)
              if (layer) onFloodLayer(layer)
            }} className="max-w-full rounded border border-border bg-background p-1">
              {layers.map((layer) => <option key={layer} value={layer}>{WATER_LABELS[layer][pt ? 0 : 1]}</option>)}
            </select>
          </label>
          {floodLayer !== RIVER_FLOW && !isFloodLayer(floodLayer) ? (
            <>
              <WaterOutlook layer={floodLayer} date={observedDate} onDate={onObservedDate} pt={pt} error={floodError} />
              {floodLayer === SUBSEASONAL_RIVERS && (
                <p role="status" className="mt-2 text-xs">
                  {outlookRunDate
                    ? `${pt ? 'Previsão emitida em' : 'Forecast issued'} ${formatDate(outlookRunDate)} (UTC)`
                    : outlookError
                      ? (pt ? 'Previsão subsazonal indisponível.' : 'Subseasonal outlook unavailable.')
                      : (pt ? 'Buscando a previsão mais recente…' : 'Finding the latest outlook…')}
                  {(outlookError || floodError) && (
                    <button type="button" onClick={onOutlookRetry} className="ml-1 underline">{pt ? 'Tentar novamente' : 'Retry'}</button>
                  )}
                </p>
              )}
            </>
          ) : isFloodLayer(floodLayer) ? (
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
              pt ? 'Buscando sinais neste recorte…' : 'Checking this case area for signals…'
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
                {pt ? 'Sem sinais nesta camada dentro do recorte.' : 'No signals for this layer inside the case area.'}
              </>
            )}
          </div>
          {floodError && <p role="status" className="mt-2">{pt ? 'Parte do mapa de cheias não pôde ser carregada.' : 'Some flood forecast tiles could not be loaded.'}</p>}
          <a href={FLOOD_VIEWER} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs underline">{FLOOD_ATTRIBUTION}</a>
          </>
          ) : null}
          {showRiverFlow && (
          <>
          <h4 className="mt-3 border-t border-border pt-2 text-sm font-semibold">
            {pt ? 'Vazão prevista · GEOGLOWS' : 'Streamflow forecast · GEOGLOWS'}
          </h4>
          {referencePoint && selected === referencePoint.point && <p className="mt-1 text-xs">{referencePoint.name}</p>}
          {!showFloodChance && (
            <p className="mt-1 text-xs text-muted-foreground">
              {pt ? 'Previsão diária do trecho do rio. A perspectiva sazonal acima compara vazões com o normal para a época.'
                : 'Daily forecast for the selected reach. The outlook above compares flows with what is normal for the season.'}
            </p>
          )}
          <p className="mt-2 text-xs">{pt ? 'Clique perto de um rio no recorte para ver a previsão do trecho mais próximo.' : 'Click near a river in the case area to see the forecast for the closest modeled reach.'}</p>
          {referencePoint && (
            <button type="button" className="mt-2 rounded border border-border px-2 py-1 text-xs hover:bg-secondary" onClick={() => onFloodFocus(referencePoint.point)}>
              {pt ? `Ver no mapa · ${referencePoint.name}` : `Show on map · ${referencePoint.name}`}
            </button>
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
              <>
              <div className="mb-2 rounded border border-border bg-secondary/30 p-2 text-xs">
                <span className="block text-muted-foreground">{pt ? 'Próxima vazão mediana prevista' : 'Next forecast median flow'} · {formatDate(current.data.days[0].date)}</span>
                <strong className="text-lg tabular-nums">{flowFormat.format(current.data.days[0].median)} m³/s</strong>
              </div>
              <details>
              <summary className="cursor-pointer py-1 text-xs underline">{pt ? 'Ver vazão por dia' : 'See daily streamflow'}</summary>
              <table className="mt-1 w-full text-xs tabular-nums">
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
              </details>
              </>
            )}
          </div>
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
          {showFloodChance && selected && !selectedGlofas && <p className="mt-1 text-xs text-muted-foreground">{pt
            ? 'A porcentagem indica quantos cenários GEOGLOWS superam o limiar de vazão diária de 2 anos ao menos uma vez em 7 dias (UTC).'
            : 'The percentage is the share of GEOGLOWS scenarios exceeding the 2-year daily flow threshold at least once over 7 days (UTC).'}
          </p>}
          {showFloodChance && selected && !selectedGlofas && (
            <div className="mt-2 text-xs" aria-live="polite">
              {typeof chance === 'number'
                ? <strong>{pt ? 'Chance em 7 dias' : '7-day chance'} · {chance}%</strong>
                : chance === 'unavailable'
                  ? <>{pt ? 'Chance indisponível.' : 'Chance unavailable.'}{' '}
                    <button type="button" className="underline" onClick={() => setAttempt((n) => n + 1)}>{pt ? 'Tentar novamente' : 'Retry'}</button></>
                  : (pt ? 'Calculando a chance de vazão alta…' : 'Calculating high-flow chance…')}
            </div>
          )}
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
    </div>
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
