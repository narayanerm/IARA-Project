import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import {
  fetchFlowForecast,
  FLOOD_ATTRIBUTION,
  FLOOD_EXTENT_LAYER,
  FLOOD_LAYER,
  floodLegend,
  FLOOD_VIEWER,
  GEOGLOWS_VIEWER,
  GWIS_ATTRIBUTION,
  GWIS_LEGEND,
  GWIS_VIEWER,
  type FlowForecast,
  type FloodLayer,
  type ForecastPoint,
} from '@/lib/predictive-models'

type FlowResult = { point: ForecastPoint; data: FlowForecast | null } | { point: ForecastPoint; error: true }

export function PredictiveModels({ mode, onModeChange, onClose, point, fireDate, fireDates, onFireDate, fireError, floodError, floodLayer, onFloodLayer }: {
  mode: 'river' | 'fire'
  onModeChange: (mode: 'river' | 'fire') => void
  onClose: () => void
  point: ForecastPoint | null
  fireDate: string
  fireDates: string[]
  onFireDate: (date: string) => void
  fireError: boolean
  floodError: boolean
  floodLayer: FloodLayer
  onFloodLayer: (layer: FloodLayer) => void
}) {
  const lang = useI18n((s) => s.lang)
  const pt = lang === 'pt'
  const [result, setResult] = useState<FlowResult | null>(null)
  const [attempt, setAttempt] = useState(0)
  const selected = mode === 'river' ? point : null

  useEffect(() => {
    if (!selected) return
    const controller = new AbortController()
    fetchFlowForecast(selected, AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]))
      .then((data) => { if (!controller.signal.aborted) setResult({ point: selected, data }) })
      .catch(() => { if (!controller.signal.aborted) setResult({ point: selected, error: true }) })
    return () => controller.abort()
  }, [selected, attempt])

  const current = result?.point === selected ? result : null
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
          {pt ? 'Risco de cheia' : 'Flood risk'}
        </button>
        <button type="button" aria-pressed={mode === 'fire'} onClick={() => onModeChange('fire')} className="rounded-md border border-border px-2 py-1 aria-pressed:bg-primary/20">
          {pt ? 'Perigo de fogo' : 'Fire danger'}
        </button>
      </div>
      {mode === 'river' ? (
        <>
          <label className="mb-2 flex flex-wrap items-center gap-2">
            {pt ? 'Camada' : 'Layer'}
            <select value={floodLayer} onChange={(e) => onFloodLayer(e.target.value === FLOOD_LAYER ? FLOOD_LAYER : FLOOD_EXTENT_LAYER)} className="rounded border border-border bg-background p-1">
              <option value={FLOOD_LAYER}>{pt ? 'Trechos em risco' : 'River reaches at risk'}</option>
              <option value={FLOOD_EXTENT_LAYER}>{pt ? 'Inundação estimada' : 'Estimated inundation'}</option>
            </select>
          </label>
          <p className="text-xs">{floodLayer === FLOOD_LAYER
            ? (pt ? 'Trechos com sinal de cheia nos próximos 15 dias. As cores comparam a vazão prevista com o histórico.' : 'River reaches with a flood signal over the next 15 days. Colors compare forecast discharge with historical flows.')
            : (pt ? 'Estimativa experimental das áreas inundáveis em grandes bacias com sinal de cheia intensa.' : 'Experimental estimate of inundation in large basins with a severe flood signal.')}
          </p>
          <img src={floodLegend(floodLayer)} alt={pt ? 'Legenda da previsão de cheia' : 'Flood forecast legend'} className="mt-2 max-w-full rounded bg-white" />
          {floodError && <p role="status" className="mt-2">{pt ? 'Parte do mapa de cheias não pôde ser carregada.' : 'Some flood forecast tiles could not be loaded.'}</p>}
          <a href={FLOOD_VIEWER} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs underline">{FLOOD_ATTRIBUTION}</a>
          <p className="mt-3 border-t border-border pt-2 text-xs">{pt ? 'Clique perto de um rio para ver a previsão de vazão do trecho mais próximo.' : 'Click near a river to see the streamflow forecast for the closest modeled reach.'}</p>
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
      ) : (
        <>
          <label className="flex flex-wrap items-center gap-2">
            {pt ? 'Data da previsão (UTC)' : 'Forecast date (UTC)'}
            <select value={fireDate} onChange={(e) => onFireDate(e.target.value)} className="rounded border border-border bg-background p-1">
              {fireDates.map((date) => <option key={date} value={date}>{formatDate(date)}</option>)}
            </select>
          </label>
          <p className="mt-2 text-xs">{pt ? 'Condições meteorológicas favoráveis a incêndios. Áreas sem cor podem estar sem dados.' : 'Weather conditions favorable to wildfires. Uncolored areas may have no data.'}</p>
          <img src={GWIS_LEGEND} alt={pt ? 'Legenda das classes do índice meteorológico de perigo de fogo' : 'Fire Weather Index danger class legend'} className="mt-2 rounded bg-white" />
          {fireError && <p role="status" className="mt-2">{pt ? 'Parte da camada de previsão não pôde ser carregada.' : 'Some forecast tiles could not be loaded.'}</p>}
          <a href={GWIS_VIEWER} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs underline">{GWIS_ATTRIBUTION}</a>
        </>
      )}
    </section>
  )
}
