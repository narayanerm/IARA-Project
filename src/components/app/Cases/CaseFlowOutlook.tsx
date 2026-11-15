import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import {
  AMAZON_RIVER_SITES,
  fetchFloodChance,
  fetchFlowForecast,
  GEOGLOWS_VIEWER,
  pointInForecastBounds,
  resolveRiverForecast,
  type FlowForecast,
  type ForecastBounds,
} from '@/lib/predictive-models'

export function CaseFlowOutlook({ kind, bounds }: {
  kind: 'flood' | 'drought'
  bounds: ForecastBounds
}) {
  const pt = useI18n((s) => s.lang === 'pt')
  const site = AMAZON_RIVER_SITES.find(({ point }) => pointInForecastBounds(point, bounds))
  const [attempt, setAttempt] = useState(0)
  const [flow, setFlow] = useState<FlowForecast | 'unavailable' | null>(null)
  const [chance, setChance] = useState<number | 'unavailable' | null>(null)
  const isFlood = kind === 'flood'

  useEffect(() => {
    if (!site) return
    const controller = new AbortController()
    const { signal } = controller
    const selection = resolveRiverForecast(site.point, signal)

    selection.then(({ id, saved }) => saved?.flow ?? (id === null ? 'unavailable' as const :
      fetchFlowForecast(id, AbortSignal.any([signal, AbortSignal.timeout(20000)]))))
      .then((result) => { if (!signal.aborted) setFlow(result) })
      .catch(() => { if (!signal.aborted) setFlow('unavailable') })

    if (isFlood) {
      selection.then(({ id, saved }) => saved?.chance ?? (id === null ? 'unavailable' as const :
        fetchFloodChance(id, AbortSignal.any([signal, AbortSignal.timeout(45000)]))))
        .then((result) => { if (!signal.aborted) setChance(result) })
        .catch(() => { if (!signal.aborted) setChance('unavailable') })
    }
    return () => controller.abort()
  }, [attempt, isFlood, site])

  const today = new Date().toISOString().slice(0, 10)
  const nextWeek = new Date(Date.parse(today) + 7 * 86_400_000).toISOString().slice(0, 10)
  const days = flow && flow !== 'unavailable'
    ? flow.days.filter(({ date }) => date >= today && date < nextWeek)
    : []
  const extreme = days.reduce<FlowForecast['days'][number] | undefined>((best, day) =>
    !best || (isFlood ? day.median > best.median : day.median < best.median) ? day : best, undefined)
  const locale = pt ? 'pt-BR' : 'en-US'
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const retry = () => {
    setFlow(null)
    setChance(null)
    setAttempt((value) => value + 1)
  }

  return (
    <section className="mx-5 mb-4 space-y-2 rounded-md border border-border/70 bg-secondary/30 p-3 text-xs">
      <h3 className="text-sm font-semibold">{pt ? 'Previsão de vazão' : 'River flow outlook'}</h3>
      {site && <p className="text-muted-foreground">{site.name}</p>}
      <div aria-live="polite">
        {extreme ? (
          <>
            <p>{isFlood
              ? (pt ? 'Maior mediana prevista nos próximos 7 dias' : 'Highest forecast median over the next 7 days')
              : (pt ? 'Menor mediana prevista nos próximos 7 dias' : 'Lowest forecast median over the next 7 days')}</p>
            <p className="mt-1">
              <strong className="text-lg tabular-nums">{number.format(extreme.median)} m³/s</strong>
              {' · '}{date.format(new Date(extreme.date))} (00:00 UTC)
            </p>
            <p className="text-muted-foreground">P25–P75 · {number.format(extreme.lower)}–{number.format(extreme.upper)} m³/s</p>
          </>
        ) : site && flow === null ? (
          <p>{pt ? 'Carregando previsão…' : 'Loading forecast…'}</p>
        ) : (
          <p>
            {pt ? 'Previsão de vazão indisponível.' : 'River flow forecast unavailable.'}{' '}
            {site && <button type="button" className="underline" onClick={retry}>{pt ? 'Tentar novamente' : 'Retry'}</button>}
          </p>
        )}
        {isFlood && site && (
          <p className="mt-2">
            {typeof chance === 'number'
              ? (pt
                ? `${chance}% dos cenários superam o limiar histórico de vazão diária de 2 anos em 7 dias.`
                : `${chance}% of scenarios exceed the historical 2-year daily flow threshold within 7 days.`)
              : chance === 'unavailable'
                ? (pt ? 'Chance de vazão alta indisponível.' : 'High-flow chance unavailable.')
                : (pt ? 'Calculando a chance de vazão alta…' : 'Calculating high-flow chance…')}
          </p>
        )}
      </div>
      {!isFlood && extreme && (
        <p className="text-muted-foreground">{pt
          ? 'Consulte a aba Alertas para comparar a vazão com o normal da estação no GloFAS.'
          : 'See the GloFAS outlook in Alerts for a comparison with normal seasonal flow.'}</p>
      )}
      <a href={GEOGLOWS_VIEWER} target="_blank" rel="noreferrer" className="inline-block underline">GEOGLOWS · ECMWF</a>
    </section>
  )
}
