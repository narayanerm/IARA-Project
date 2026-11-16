import { useMemo, useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  ErrorBar,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { RISK_COLOR, type CaseStudy, type RiskLevel } from '@/data/cases'
import { useI18n } from '@/lib/i18n'
import { useApp, useUi } from '@/lib/store'
import { useCaseCriticalRisk } from '@/lib/useCaseCriticalRisk'
import {
  useIaraForecast,
  type EnchForecast,
  type SecaForecast,
  type YanoForecast,
} from '@/lib/useIaraForecast'
import {
  useIaraExtent,
  type EnchExtentMeta,
  type SecaExtentMeta,
  type YanoExtentMeta,
} from '@/lib/useIaraExtent'

const COLORS = {
  water: '#5AA7C9',
  flood: '#F59E42',
  severe: '#F0524F',
  ok: '#4CB7A5',
  mid: '#E4B23A',
  hi: '#E97A4B',
  critical: '#D53E4F',
  grid: 'rgba(255,255,255,0.08)',
  axis: 'rgba(255,255,255,0.4)',
}

const COPY = {
  pt: {
    modelKind: {
      YANO: 'XGBoost · Sentinel-1 + Hansen GFC',
      ENCH: 'SARIMAX + LSTM · ANA 14990000 + ENSO',
      SECA: 'Logística + Monte Carlo · ANA 14990000',
    },
    modelText: {
      YANO: 'Onde o garimpo tende a abrir novas frentes, no próximo ano.',
      ENCH: 'Até onde a água pode chegar quando o Rio Negro atinge o pico previsto.',
      SECA: 'Qual anel dos lagos de Manaquiri deve secar no auge da estiagem.',
    },
    loading: 'Carregando previsão…',
    error: 'Previsão indisponível no momento.',
    trainedAt: 'Treinado em 15.11.2026 · RTX 5090',
    atRiskTitle: 'Comunidades em risco',
    atRiskSubtitle: 'Mesmos pontos destacados no mapa, ranqueados pelo modelo.',
    levelLabel: { critical: 'Crítico', high: 'Alto', watch: 'Atenção' } as Record<RiskLevel, string>,
    modelDetailsOpen: 'Esconder detalhes do modelo',
    modelDetailsClosed: 'Mostrar detalhes do modelo',
    yanoHero: 'Área prevista de desmate',
    yanoHorizon: (yr: number) => `no próximo ano (${yr})`,
    yanoBuckets: { critical: 'Crítico', high: 'Alto', moderate: 'Moderado' },
    yanoBucketBy: 'por nível de risco',
    yanoQuality: 'Qualidade',
    yanoQualityDetails: (roc: string, rec: string, prec: string) =>
      `ROC-AUC ${roc} · recall@5% ${rec} · precision@5% ${prec}`,
    enchHero: 'Alcance máximo previsto',
    enchHorizon: (date: string) => `pico em ${fmtDate(date)}`,
    enchPeak: 'Pico previsto',
    enchPeakAbove: (dm: string) => `+${dm} m acima da cota de 29 m`,
    enchChannelKm: 'canal normal',
    enchExtraKm: 'extra em cheia',
    enchChartTitle: 'Previsão da cota · banda P10–P90',
    enchMarkers: { d7: 'em 7 d', d30: 'em 30 d', d365: 'em 1 ano' },
    enchExceedTitle: 'Risco de exceder cotas críticas',
    enchExceed29: 'P(≥ 29 m)',
    enchExceed30: 'P(≥ 30 m)',
    enchQuality: 'Qualidade (holdout 2010–2014)',
    enchQualityDetails: (nse7: string, nse30: string) =>
      `LSTM — NSE 7 d: ${nse7} · 30 d: ${nse30}`,
    secaHero: 'Área que seca no pico',
    secaHorizon: 'retração além do permanente',
    secaPermanent: 'Lagos permanentes',
    secaRetraction: 'Anel que seca',
    secaBarTitle: 'Dias isolados por comunidade · 365 d',
    secaAxisX: 'dias',
    secaQuality: 'Qualidade (holdout)',
    secaQualityDetails: (roc: string, n: number) =>
      `ROC-AUC ${roc} · Monte Carlo n=${n.toLocaleString('pt-BR')}`,
  },
  en: {
    modelKind: {
      YANO: 'XGBoost · Sentinel-1 + Hansen GFC',
      ENCH: 'SARIMAX + LSTM · ANA 14990000 + ENSO',
      SECA: 'Logistic + Monte Carlo · ANA 14990000',
    },
    modelText: {
      YANO: 'Where mining is likely to open new fronts in the next year.',
      ENCH: 'How far the water reaches when Rio Negro hits the predicted peak.',
      SECA: 'Which ring of the Manaquiri lakes dries out at the drought peak.',
    },
    loading: 'Loading forecast…',
    error: 'Forecast unavailable right now.',
    trainedAt: 'Trained on 2026-11-15 · RTX 5090',
    atRiskTitle: 'At-risk communities',
    atRiskSubtitle: 'Same points highlighted on the map, ranked by the model.',
    levelLabel: { critical: 'Critical', high: 'High', watch: 'Watch' } as Record<RiskLevel, string>,
    modelDetailsOpen: 'Hide model details',
    modelDetailsClosed: 'Show model details',
    yanoHero: 'Predicted deforestation area',
    yanoHorizon: (yr: number) => `next year (${yr})`,
    yanoBuckets: { critical: 'Critical', high: 'High', moderate: 'Moderate' },
    yanoBucketBy: 'by risk level',
    yanoQuality: 'Quality',
    yanoQualityDetails: (roc: string, rec: string, prec: string) =>
      `ROC-AUC ${roc} · recall@5% ${rec} · precision@5% ${prec}`,
    enchHero: 'Maximum flood reach',
    enchHorizon: (date: string) => `peak on ${fmtDate(date)}`,
    enchPeak: 'Predicted peak',
    enchPeakAbove: (dm: string) => `+${dm} m above the 29 m flood stage`,
    enchChannelKm: 'normal channel',
    enchExtraKm: 'extra at peak',
    enchChartTitle: 'Level forecast · P10–P90 band',
    enchMarkers: { d7: 'in 7 d', d30: 'in 30 d', d365: 'in 1 year' },
    enchExceedTitle: 'Probability of exceeding critical stages',
    enchExceed29: 'P(≥ 29 m)',
    enchExceed30: 'P(≥ 30 m)',
    enchQuality: 'Quality (2010–2014 holdout)',
    enchQualityDetails: (nse7: string, nse30: string) =>
      `LSTM — NSE 7 d: ${nse7} · 30 d: ${nse30}`,
    secaHero: 'Area that dries at peak',
    secaHorizon: 'retraction beyond the permanent lake',
    secaPermanent: 'Permanent lakes',
    secaRetraction: 'Drying ring',
    secaBarTitle: 'Isolated days per community · 365 d',
    secaAxisX: 'days',
    secaQuality: 'Quality (holdout)',
    secaQualityDetails: (roc: string, n: number) =>
      `ROC-AUC ${roc} · Monte Carlo n=${n.toLocaleString('en-US')}`,
  },
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return d ? `${d}.${m}.${y}` : iso
}

function useCopy(): (typeof COPY)['pt'] {
  const lang = useI18n((s) => s.lang)
  return COPY[lang] ?? COPY.pt
}

export function IaraForecastPanel({ c }: { c: CaseStudy }) {
  const copy = useCopy()
  const fc = useIaraForecast(c.id)
  const ext = useIaraExtent(c.id)
  const loading = fc.loading || ext.loading
  const error = fc.error || ext.error

  return (
    <section className="space-y-3 px-5 py-5">
      <header>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ background: c.color }}
            aria-hidden
          />
          <h3 className="text-[14px] font-semibold leading-tight">{copy.modelKind[c.id]}</h3>
        </div>
        <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{copy.modelText[c.id]}</p>
      </header>

      {/* Headline: the map pins in sentence form. Simple, no jargon.
          Matches the forecast-driven CaseMarkers so the panel and the map agree. */}
      <AtRiskList c={c} copy={copy} />

      {/* Model detail: the previous panel body (hero numbers, charts, metrics)
          is now opt-in. Collapsed by default so the main view stays didactic. */}
      {loading ? (
        <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> {copy.loading}
        </p>
      ) : error || !fc.data || !ext.data ? (
        <p className="text-[12.5px] text-muted-foreground">{copy.error}</p>
      ) : (
        <ModelDetails
          openLabel={copy.modelDetailsOpen}
          closedLabel={copy.modelDetailsClosed}
        >
          {fc.data.kind === 'YANO' && ext.data.meta.kind === 'YANO' ? (
            <YanoBlock forecast={fc.data} extent={ext.data.meta} copy={copy} />
          ) : fc.data.kind === 'ENCH' && ext.data.meta.kind === 'ENCH' ? (
            <EnchBlock forecast={fc.data} extent={ext.data.meta} copy={copy} />
          ) : fc.data.kind === 'SECA' && ext.data.meta.kind === 'SECA' ? (
            <SecaBlock forecast={fc.data} extent={ext.data.meta} copy={copy} />
          ) : null}
          <p className="font-mono text-[10.5px] text-muted-foreground">{copy.trainedAt}</p>
        </ModelDetails>
      )}
    </section>
  )
}

function AtRiskList({ c, copy }: { c: CaseStudy; copy: ReturnType<typeof useCopy> }) {
  const lang = useI18n((s) => s.lang)
  const risks = useCaseCriticalRisk(c.id)
  const hotspotId = useApp((s) => s.hotspotId)
  const setHotspot = useApp((s) => s.setHotspot)
  const requestFlyTo = useApp((s) => s.requestFlyTo)
  const clearCaseOverlays = useUi((s) => s.clearCaseOverlays)
  // Sort by the model's own urgency score so the panel's order matches "most
  // critical first" without assuming a specific ordering in cases.ts.
  const rows = c.hotspots
    .map((h) => ({ h, r: risks?.[h.id] }))
    .sort((a, b) => (a.r?.score ?? Number.POSITIVE_INFINITY) - (b.r?.score ?? Number.POSITIVE_INFINITY))

  // Zoom in close enough to see the community clearly but not so close that the
  // basemap loses context. Clamp so a small case bbox doesn't blow past 13.
  const focusZoom = Math.min(13, c.camera.zoom + 2.5)

  return (
    <div className="space-y-2">
      <div>
        <div className="text-[13px] font-semibold text-foreground">{copy.atRiskTitle}</div>
        <div className="text-[11.5px] text-muted-foreground">{copy.atRiskSubtitle}</div>
      </div>
      <ul className="space-y-1.5">
        {rows.map(({ h, r }) => {
          const level: RiskLevel = r?.level ?? h.level
          const insight = r?.insight[lang]
          const active = hotspotId === h.id
          return (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => {
                  clearCaseOverlays()
                  setHotspot(h.id)
                  requestFlyTo(h.center, focusZoom)
                }}
                aria-pressed={active}
                className={`group flex w-full flex-col items-stretch rounded-md border px-2.5 py-2 text-left transition-colors ${
                  active
                    ? 'border-border bg-secondary'
                    : 'border-border/60 bg-background/40 hover:border-border hover:bg-background/70'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: RISK_COLOR[level] }}
                  />
                  <span className="text-[12.5px] font-semibold text-foreground">{h.name}</span>
                  <span
                    className="ml-auto font-mono text-[9.5px] uppercase tracking-wider"
                    style={{ color: RISK_COLOR[level] }}
                  >
                    {copy.levelLabel[level]}
                  </span>
                </div>
                {insight && (
                  <p className="mt-1 text-[11.5px] leading-snug text-foreground/80">{insight}</p>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ModelDetails({
  openLabel,
  closedLabel,
  children,
}: {
  openLabel: string
  closedLabel: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-md border border-border/60 bg-background/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11.5px] font-mono uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown
          className="h-3.5 w-3.5 transition-transform"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        />
        {open ? openLabel : closedLabel}
      </button>
      {open && <div className="space-y-3 border-t border-border/60 px-3 py-3">{children}</div>}
    </div>
  )
}

// ---------- YANO -----------------------------------------------------------

function YanoBlock({
  forecast,
  extent,
  copy,
}: {
  forecast: YanoForecast
  extent: YanoExtentMeta
  copy: ReturnType<typeof useCopy>
}) {
  const buckets = extent.buckets
  const total = extent.total_area_km2
  const maxBucket = Math.max(1, ...buckets.map((b) => b.area_km2))
  return (
    <div className="space-y-3">
      <HeroCard
        label={copy.yanoHero}
        value={`${total.toFixed(0)} km²`}
        valueColor={COLORS.critical}
        sub={copy.yanoHorizon(extent.forecast_year)}
      />

      <ChartCard title={copy.yanoBucketBy}>
        <ul className="space-y-1.5">
          {buckets.map((b) => (
            <li key={b.bucket} className="space-y-1">
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-muted-foreground">
                  {copy.yanoBuckets[b.bucket as keyof typeof copy.yanoBuckets] ?? b.bucket}
                </span>
                <span className="tabular-nums font-semibold" style={{ color: b.color }}>
                  {b.area_km2.toFixed(0)} km²
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border/40">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(b.area_km2 / maxBucket) * 100}%`, background: b.color }}
                />
              </div>
            </li>
          ))}
        </ul>
      </ChartCard>

      <QualityFootnote
        title={copy.yanoQuality}
        details={copy.yanoQualityDetails(
          forecast.metrics.test.roc_auc.toFixed(2),
          `${Math.round(forecast.metrics.test.recall_at_top_5pct * 100)}%`,
          `${Math.round(forecast.metrics.test.precision_at_top_5pct * 100)}%`,
        )}
      />
    </div>
  )
}

// ---------- ENCH -----------------------------------------------------------

function EnchBlock({
  forecast,
  extent,
  copy,
}: {
  forecast: EnchForecast
  extent: EnchExtentMeta
  copy: ReturnType<typeof useCopy>
}) {
  const chartData = useMemo(
    () =>
      forecast.daily.map((d) => ({
        date: d.date,
        p50: d.p50,
        band: [d.p10, d.p90] as [number, number],
      })),
    [forecast],
  )
  const markers = useMemo(() => {
    const at = (i: number) => forecast.daily[Math.min(i, forecast.daily.length - 1)]
    return [
      { label: copy.enchMarkers.d7, row: at(7) },
      { label: copy.enchMarkers.d30, row: at(30) },
      { label: copy.enchMarkers.d365, row: at(forecast.daily.length - 1) },
    ]
  }, [forecast, copy])

  const yMin = Math.floor(Math.min(...chartData.map((d) => d.band[0])) - 1)
  const yMax = Math.ceil(Math.max(...chartData.map((d) => d.band[1]), 30) + 1)

  return (
    <div className="space-y-3">
      <HeroCard
        label={copy.enchHero}
        value={`${extent.flood_extent_km2.toFixed(0)} km²`}
        valueColor={COLORS.flood}
        sub={copy.enchHorizon(extent.peak_date)}
      />

      <div className="grid grid-cols-3 gap-2 text-[11.5px]">
        <MiniStat label={copy.enchPeak} value={`${extent.peak_p90_m.toFixed(2)} m`} color={COLORS.severe} />
        <MiniStat label={copy.enchChannelKm} value={`${extent.channel_area_km2.toFixed(0)} km²`} color={COLORS.water} />
        <MiniStat label={copy.enchExtraKm} value={`+${extent.flood_extent_km2.toFixed(0)} km²`} color={COLORS.flood} />
      </div>
      <div className="text-[11px] text-muted-foreground">
        {copy.enchPeakAbove(extent.delta_over_flood_m.toFixed(2))}
      </div>

      <ChartCard title={copy.enchChartTitle}>
        <div className="h-44 w-full">
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 4, right: 10, bottom: 4, left: -18 }}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: COLORS.axis }}
                tickFormatter={(v) => v.slice(5, 7) + '/' + v.slice(2, 4)}
                minTickGap={40}
                stroke={COLORS.axis}
              />
              <YAxis
                domain={[yMin, yMax]}
                tick={{ fontSize: 9, fill: COLORS.axis }}
                stroke={COLORS.axis}
                width={30}
              />
              <Area dataKey="band" stroke="none" fill={COLORS.water} fillOpacity={0.22} isAnimationActive={false} />
              <Line dataKey="p50" stroke={COLORS.water} strokeWidth={1.4} dot={false} isAnimationActive={false} />
              <ReferenceLine y={29} stroke={COLORS.flood} strokeDasharray="4 3" label={{ value: '29 m', position: 'right', fill: COLORS.flood, fontSize: 9 }} />
              <ReferenceLine y={30} stroke={COLORS.severe} strokeDasharray="4 3" label={{ value: '30 m', position: 'right', fill: COLORS.severe, fontSize: 9 }} />
              {markers.map((m, idx) => (
                <ReferenceDot key={idx} x={m.row.date} y={m.row.p50} r={3} fill="#fff" stroke={COLORS.water} strokeWidth={1.5} isFront />
              ))}
              <Tooltip
                contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', fontSize: 11 }}
                labelFormatter={(l) => String(l)}
                formatter={(val: number | [number, number], name) => {
                  if (name === 'band') {
                    const [lo, hi] = val as [number, number]
                    return [`${lo.toFixed(2)} – ${hi.toFixed(2)} m`, 'banda']
                  }
                  return [`${(val as number).toFixed(2)} m`, 'mediana']
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title={copy.enchExceedTitle}>
        <div className="space-y-2">
          {[
            { k: copy.enchExceed29, v: forecast.p_exceed_29m, color: COLORS.flood },
            { k: copy.enchExceed30, v: forecast.p_exceed_30m, color: COLORS.severe },
          ].map((row) => (
            <div key={row.k}>
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-muted-foreground">{row.k}</span>
                <span className="tabular-nums font-semibold" style={{ color: row.color }}>
                  {(row.v * 100).toFixed(1).replace('.', ',')}%
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-border/40">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, row.v * 100)}%`, background: row.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </ChartCard>

      <QualityFootnote
        title={copy.enchQuality}
        details={copy.enchQualityDetails(
          forecast.metrics.lstm['7'].nse.toFixed(3),
          forecast.metrics.lstm['30'].nse.toFixed(3),
        )}
      />
    </div>
  )
}

// ---------- SECA -----------------------------------------------------------

function SecaBlock({
  forecast,
  extent,
  copy,
}: {
  forecast: SecaForecast
  extent: SecaExtentMeta
  copy: ReturnType<typeof useCopy>
}) {
  const bars = useMemo(
    () =>
      forecast.communities.map((com) => {
        const low = com.isolated_days.p50 - com.isolated_days.p10
        const high = com.isolated_days.p90 - com.isolated_days.p50
        const color =
          com.isolated_days.p50 >= 35
            ? COLORS.critical
            : com.isolated_days.p50 >= 20
              ? COLORS.hi
              : com.isolated_days.p50 >= 10
                ? COLORS.mid
                : COLORS.ok
        return {
          name: com.name,
          p50: Math.round(com.isolated_days.p50),
          err: [low, high] as [number, number],
          color,
        }
      }),
    [forecast],
  )
  const aucs = forecast.communities
    .map((c) => c.metrics.test?.roc_auc)
    .filter((v): v is number => typeof v === 'number')
  const avgAuc = aucs.length ? aucs.reduce((a, b) => a + b, 0) / aucs.length : NaN

  return (
    <div className="space-y-3">
      <HeroCard
        label={copy.secaHero}
        value={`${extent.retraction_area_km2.toFixed(0)} km²`}
        valueColor={COLORS.hi}
        sub={copy.secaHorizon}
      />

      <div className="grid grid-cols-2 gap-2 text-[11.5px]">
        <MiniStat label={copy.secaPermanent} value={`${extent.permanent_area_km2.toFixed(0)} km²`} color={COLORS.water} />
        <MiniStat label={copy.secaRetraction} value={`${extent.retraction_area_km2.toFixed(0)} km²`} color={COLORS.hi} />
      </div>

      <ChartCard title={copy.secaBarTitle}>
        <div className="h-40 w-full">
          <ResponsiveContainer>
            <BarChart data={bars} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
              <CartesianGrid stroke={COLORS.grid} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: COLORS.axis }}
                stroke={COLORS.axis}
                label={{ value: copy.secaAxisX, position: 'insideBottom', offset: -2, fontSize: 10, fill: COLORS.axis }}
              />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: COLORS.axis }} stroke={COLORS.axis} width={90} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', fontSize: 11 }}
                formatter={(val: number, _n, entry) => {
                  const err = (entry?.payload?.err ?? [0, 0]) as [number, number]
                  return [`${val} d (P10 ${val - err[0]} · P90 ${val + err[1]})`, 'isolamento']
                }}
              />
              <Bar dataKey="p50" barSize={14} isAnimationActive={false}>
                {bars.map((b, i) => (
                  <Cell key={i} fill={b.color} />
                ))}
                <ErrorBar dataKey="err" width={5} strokeWidth={1.4} stroke="rgba(255,255,255,0.75)" direction="x" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <QualityFootnote
        title={copy.secaQuality}
        details={copy.secaQualityDetails(Number.isFinite(avgAuc) ? avgAuc.toFixed(3) : '—', forecast.n_mc)}
      />
    </div>
  )
}

// ---------- shared ---------------------------------------------------------

function HeroCard({
  label,
  value,
  valueColor,
  sub,
}: {
  label: string
  value: string
  valueColor: string
  sub: string
}) {
  return (
    <div className="rounded-md border border-border bg-gradient-to-br from-background/60 to-background/20 px-3 py-3">
      <div className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 tabular-nums font-semibold" style={{ color: valueColor, fontSize: '1.9rem', lineHeight: 1.05 }}>
        {value}
      </div>
      <div className="mt-0.5 text-[11.5px] text-muted-foreground">{sub}</div>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded border border-border/60 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="tabular-nums font-semibold" style={{ color }}>{value}</div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 px-3 py-2.5">
      <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  )
}

function QualityFootnote({ title, details }: { title: string; details: string }) {
  return (
    <div className="rounded-md border border-dashed border-border/60 px-3 py-2">
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="mt-0.5 font-mono text-[10.5px] text-foreground/80">{details}</div>
    </div>
  )
}
