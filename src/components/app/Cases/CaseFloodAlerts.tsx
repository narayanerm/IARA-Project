import { ArrowDown, ArrowRight, ArrowUp, ExternalLink } from 'lucide-react'
import { RISK_COLOR, type CaseStudy, type RiskLevel, type RiverStage } from '@/data/cases'
import { useI18n } from '@/lib/i18n'
import { SectionTitle } from './shared'

const WATER = '#5AA7C9'

const COPY = {
  pt: {
    now: 'Situação agora',
    level: { normal: 'Sem alerta', watch: 'Atenção', high: 'Inundação', critical: 'Inundação severa' },
    trend: { rising: 'subindo', falling: 'descendo', steady: 'estável' },
    reading: (v: string, trend: string) => `Rio Negro a ${v} m e ${trend}`,
    toFlood: (d: string, th: string) => `Faltam ${d} m para a cota de inundação (${th} m).`,
    aboveFlood: (d: string, th: string) => `${d} m acima da cota de inundação (${th} m).`,
    forecast: 'Análise preditiva',
    model: 'Modelo IARA · em desenvolvimento',
    modelText: 'Chance de o rio passar de cada cota de inundação, semanas antes do pico.',
    soon: 'em breve',
  },
  en: {
    now: 'Current situation',
    level: { normal: 'No alert', watch: 'Watch', high: 'Flooding', critical: 'Severe flooding' },
    trend: { rising: 'rising', falling: 'falling', steady: 'steady' },
    reading: (v: string, trend: string) => `Rio Negro at ${v} m and ${trend}`,
    toFlood: (d: string, th: string) => `${d} m to go before flood stage (${th} m).`,
    aboveFlood: (d: string, th: string) => `${d} m above flood stage (${th} m).`,
    forecast: 'Predictive analysis',
    model: 'IARA model · in development',
    modelText: 'Chance of the river passing each flood stage, weeks before the peak.',
    soon: 'coming soon',
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

/** Flood alerts, kept to the essentials: where the river is now and the predictive analysis. */
export function CaseFloodAlerts({ c }: { c: CaseStudy }) {
  const lang = useI18n((s) => s.lang)
  const copy = COPY[lang] ?? COPY.pt
  const stage = c.riverStage!

  return (
    <>
      {stage.latest && <Now stage={stage} copy={copy} />}
      <div className="mx-5 border-t border-border" />
      <section className="space-y-3 px-5 py-5">
        <SectionTitle>{copy.forecast}</SectionTitle>
        <div className="rounded-md border border-dashed border-border px-3 py-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: c.color }}>
            {copy.model}
          </div>
          <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{copy.modelText}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {stage.thresholds.slice(1).map((th) => (
              <span key={th.value} className="rounded-full border border-border px-2 py-0.5 text-[11.5px] tabular-nums">
                ≥ {fmt(th.value)} m · <span className="text-muted-foreground">{copy.soon}</span>
              </span>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

function Now({ stage, copy }: { stage: RiverStage; copy: Copy }) {
  const latest = stage.latest!
  const status = statusFor(latest.value, stage)
  const flood = stage.thresholds[1].value
  const gap = flood - latest.value
  const Trend = latest.trend === 'rising' ? ArrowUp : latest.trend === 'falling' ? ArrowDown : ArrowRight

  return (
    <section className="space-y-2 px-5 py-5">
      <SectionTitle>{copy.now}</SectionTitle>
      <div className="num-display text-[1.7rem] leading-none" style={{ color: STATUS_COLOR[status] }}>
        {copy.level[status]}
      </div>
      <div className="flex items-center gap-1.5 text-[13.5px] font-semibold">
        <Trend className="h-4 w-4" style={{ color: WATER }} />
        {copy.reading(fmt(latest.value), copy.trend[latest.trend])}
      </div>
      <p className="text-[13px] leading-snug text-foreground/90">
        {gap > 0 ? copy.toFlood(fmt(gap), fmt(flood)) : copy.aboveFlood(fmt(-gap), fmt(flood))}
      </p>
      <a
        href={latest.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-mono text-[10.5px] text-muted-foreground hover:text-foreground"
      >
        {fmtDate(latest.date)} · {latest.source}
        <ExternalLink className="h-2.5 w-2.5" />
      </a>
    </section>
  )
}

