import { ArrowDown, ArrowRight, ArrowUp, ExternalLink, Loader2 } from 'lucide-react'
import { RISK_COLOR, type CaseStudy, type RiskLevel, type RiverStage, type StageReading } from '@/data/cases'
import { useI18n } from '@/lib/i18n'
import { useDeterAlerts } from '@/lib/useDeterAlerts'
import { IaraForecastPanel } from './IaraForecast'
import { YANO_DETER_BBOX } from './CaseAlerts'
import { SectionTitle } from './shared'

const WATER = '#5AA7C9'

const COPY = {
  pt: {
    now: 'Situação agora',
    level: { normal: 'Sem alerta', watch: 'Atenção', high: 'Inundação', critical: 'Inundação severa' },
    drought: { normal: 'Sem alerta', watch: 'Abaixo da média', high: 'Seca', critical: 'Seca extrema' },
    trend: { rising: 'subindo', falling: 'descendo', steady: 'estável' },
    reading: (v: string, trend: string) => `Rio Negro a ${v} m e ${trend}`,
    toFlood: (d: string, th: string) => `Faltam ${d} m para a cota de inundação (${th} m).`,
    aboveFlood: (d: string, th: string) => `${d} m acima da cota de inundação (${th} m).`,
    toDrought: (d: string, th: string) => `Faltam ${d} m para a cota de seca extrema (${th} m).`,
    belowDrought: (d: string, th: string) => `${d} m abaixo da cota de seca extrema (${th} m).`,
    droughtRef: 'Régua do Porto de Manaus, referência regional para os lagos de Manaquiri.',
    mining: { active: 'Garimpo ativo', quiet: 'Sem alertas recentes' },
    deter: (n: string) => `${n} alertas de desmatamento do DETER (INPE) na região nos últimos 12 meses.`,
    deterNone: 'Nenhum alerta de desmatamento do DETER (INPE) na região nos últimos 12 meses.',
    deterLoading: 'Consultando os alertas do DETER (INPE)…',
    deterError: 'O DETER (INPE) não respondeu agora. Tente de novo em instantes.',
    deterSource: 'INPE · TerraBrasilis (DETER)',
  },
  en: {
    now: 'Current situation',
    level: { normal: 'No alert', watch: 'Watch', high: 'Flooding', critical: 'Severe flooding' },
    drought: { normal: 'No alert', watch: 'Below average', high: 'Drought', critical: 'Extreme drought' },
    trend: { rising: 'rising', falling: 'falling', steady: 'steady' },
    reading: (v: string, trend: string) => `Rio Negro at ${v} m and ${trend}`,
    toFlood: (d: string, th: string) => `${d} m to go before flood stage (${th} m).`,
    aboveFlood: (d: string, th: string) => `${d} m above flood stage (${th} m).`,
    toDrought: (d: string, th: string) => `${d} m to go before the extreme drought stage (${th} m).`,
    belowDrought: (d: string, th: string) => `${d} m below the extreme drought stage (${th} m).`,
    droughtRef: 'Porto de Manaus gauge, the regional reference for the Manaquiri lakes.',
    mining: { active: 'Active mining', quiet: 'No recent alerts' },
    deter: (n: string) => `${n} DETER (INPE) deforestation alerts in the area over the last 12 months.`,
    deterNone: 'No DETER (INPE) deforestation alerts in the area over the last 12 months.',
    deterLoading: 'Querying DETER (INPE) alerts…',
    deterError: 'DETER (INPE) did not answer right now. Try again in a moment.',
    deterSource: 'INPE · TerraBrasilis (DETER)',
  },
}

type Copy = (typeof COPY)['pt']
type Status = RiskLevel | 'normal'

function fmt(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

/** Alert level read straight from the gauge against the SGB stages. */
function statusFor(value: number, stage: RiverStage): Status {
  const [alert, flood, severe] = stage.thresholds.map((t) => t.value)
  if (value >= severe) return 'critical'
  if (value >= flood) return 'high'
  if (value >= alert) return 'watch'
  return 'normal'
}

const STATUS_COLOR: Record<Status, string> = { normal: WATER, ...RISK_COLOR }

function useCopy(): Copy {
  const lang = useI18n((s) => s.lang)
  return COPY[lang] ?? COPY.pt
}

/** Alerts, kept to the essentials in every case: what is happening now and the predictive analysis. */
export function CaseLeanAlerts({ c }: { c: CaseStudy }) {
  const copy = useCopy()
  return (
    <>
      {c.id === 'ENCH' && c.riverStage?.latest && <FloodNow stage={c.riverStage} copy={copy} />}
      {c.id === 'SECA' && c.series.latest && <DroughtNow c={c} reading={c.series.latest} copy={copy} />}
      {c.id === 'YANO' && <MiningNow copy={copy} />}
      <div className="mx-5 border-t border-border" />
      <IaraForecastPanel c={c} />
    </>
  )
}

/** Kept under its old name for the flood case. */
export const CaseFloodAlerts = CaseLeanAlerts

function Source({ date, label, url }: { date?: string; label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-mono text-[10.5px] text-muted-foreground hover:text-foreground"
    >
      {date ? `${fmtDate(date)} · ` : ''}
      {label}
      <ExternalLink className="h-2.5 w-2.5" />
    </a>
  )
}

function Reading({ reading, copy }: { reading: StageReading; copy: Copy }) {
  const Trend = reading.trend === 'rising' ? ArrowUp : reading.trend === 'falling' ? ArrowDown : ArrowRight
  return (
    <div className="flex items-center gap-1.5 text-[13.5px] font-semibold">
      <Trend className="h-4 w-4" style={{ color: WATER }} />
      {copy.reading(fmt(reading.value), copy.trend[reading.trend])}
    </div>
  )
}

function FloodNow({ stage, copy }: { stage: RiverStage; copy: Copy }) {
  const latest = stage.latest!
  const status = statusFor(latest.value, stage)
  const flood = stage.thresholds[1].value
  const gap = flood - latest.value

  return (
    <section className="space-y-2 px-5 py-5">
      <SectionTitle>{copy.now}</SectionTitle>
      <div className="num-display text-[1.7rem] leading-none" style={{ color: STATUS_COLOR[status] }}>
        {copy.level[status]}
      </div>
      <Reading reading={latest} copy={copy} />
      <p className="text-[13px] leading-snug text-foreground/90">
        {gap > 0 ? copy.toFlood(fmt(gap), fmt(flood)) : copy.aboveFlood(fmt(-gap), fmt(flood))}
      </p>
      <Source date={latest.date} label={latest.source} url={latest.url} />
    </section>
  )
}

/** Drought: the same gauge read the other way, against the low-water references of the series. */
function DroughtNow({ c, reading, copy }: { c: CaseStudy; reading: StageReading; copy: Copy }) {
  const ths = c.series.thresholds
  const extreme = ths.find((t) => t.tone === 'danger')?.value ?? 13.64
  const below = ths.find((t) => t.tone === 'warn')?.value ?? 16.5
  const status: Status = reading.value <= extreme ? 'critical' : reading.value <= below ? 'watch' : 'normal'
  const gap = reading.value - extreme

  return (
    <section className="space-y-2 px-5 py-5">
      <SectionTitle>{copy.now}</SectionTitle>
      <div className="num-display text-[1.7rem] leading-none" style={{ color: STATUS_COLOR[status] }}>
        {copy.drought[status]}
      </div>
      <Reading reading={reading} copy={copy} />
      <p className="text-[13px] leading-snug text-foreground/90">
        {gap > 0 ? copy.toDrought(fmt(gap), fmt(extreme)) : copy.belowDrought(fmt(-gap), fmt(extreme))}{' '}
        <span className="text-muted-foreground">{copy.droughtRef}</span>
      </p>
      <Source date={reading.date} label={reading.source} url={reading.url} />
    </section>
  )
}

/** Mining: the live DETER count over the mining fronts is the "now". */
function MiningNow({ copy }: { copy: Copy }) {
  const deter = useDeterAlerts(YANO_DETER_BBOX)
  const active = !deter.loading && !deter.error && deter.count > 0

  return (
    <section className="space-y-2 px-5 py-5">
      <SectionTitle>{copy.now}</SectionTitle>
      <div
        className="num-display text-[1.7rem] leading-none"
        style={{ color: deter.loading || deter.error ? 'hsl(var(--muted-foreground))' : active ? RISK_COLOR.critical : WATER }}
      >
        {deter.loading ? <Loader2 className="h-6 w-6 animate-spin" /> : active ? copy.mining.active : copy.mining.quiet}
      </div>
      <p className="text-[13px] leading-snug text-foreground/90">
        {deter.loading
          ? copy.deterLoading
          : deter.error
            ? copy.deterError
            : deter.count
              ? copy.deter(deter.count.toLocaleString('pt-BR'))
              : copy.deterNone}
      </p>
      <Source label={copy.deterSource} url="https://terrabrasilis.dpi.inpe.br/" />
    </section>
  )
}
