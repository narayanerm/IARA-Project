import { ExternalLink } from 'lucide-react'
import type { RiverStage } from '@/data/cases'
import { useI18n } from '@/lib/i18n'

const WATER = '#5AA7C9'
const FLOOD = '#F07A45'

const W = 340
const H = 168
const PAD = { top: 10, right: 6, bottom: 22, left: 30 }

function fmt(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return d ? `${d}.${m}.${y}` : m ? `${m}.${y}` : y
}

interface Props {
  stage: RiverStage
  /** Year selected on the timeline; its bar is highlighted. */
  activeYear?: number
}

const COPY = {
  pt: {
    titlePrefix: 'Cotas máximas anuais ·',
    partial: 'leitura parcial (ano em curso)',
    oddsLabel: (th: string) => `Cheias ≥ ${th} m no período`,
    range: 'Amplitude recente (cheia – vazante)',
    recordLow: (v: string, d: string) => `vazante recorde ${v} m em ${d}`,
  },
  en: {
    titlePrefix: 'Annual peaks ·',
    partial: 'partial reading (ongoing year)',
    oddsLabel: (th: string) => `Floods ≥ ${th} m in the period`,
    range: 'Recent range (flood – low water)',
    recordLow: (v: string, d: string) => `record low ${v} m on ${d}`,
  },
}

/**
 * Annual flood peaks at the Porto de Manaus gauge against the SGB alert levels.
 * Only consolidated readings get a solid bar; partial (current-year) values are hatched.
 */
export function RiverStageChart({ stage, activeYear }: Props) {
  const lang = useI18n((s) => s.lang)
  const copy = COPY[lang] ?? COPY.pt
  const yMin = 26.8
  const yMax = 30.3
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const y = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH
  const slot = innerW / stage.peaks.length
  const barW = Math.min(26, slot * 0.62)
  const ticks = [27, 28, 29, 30]
  const odds = stage.extremeCount
  const recordHigh = Math.max(...stage.peaks.map((p) => p.value))
  const title = `${copy.titlePrefix} ${stage.station}`

  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3 space-y-2">
      <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        {title}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={title}>
        <defs>
          <pattern id="stage-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="5" height="5" fill={WATER} fillOpacity={0.25} />
            <line x1="0" y1="0" x2="0" y2="5" stroke={WATER} strokeWidth="2" />
          </pattern>
        </defs>

        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.08} />
            <text
              x={PAD.left - 5}
              y={y(v)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="9"
              fill="currentColor"
              fillOpacity={0.55}
            >
              {v}
            </text>
          </g>
        ))}
        <text x={4} y={PAD.top - 2} fontSize="8" fill="currentColor" fillOpacity={0.5} dominantBaseline="hanging">
          m
        </text>

        {stage.peaks.map((p, i) => {
          const cx = PAD.left + slot * i + slot / 2
          const top = y(p.value)
          const active = p.year === activeYear
          return (
            <g key={p.year}>
              <title>
                {`${p.year}: ${fmt(p.value)} m · ${fmtDate(p.date)}${p.approx ? ` (${copy.partial})` : ''}`}
              </title>
              <rect
                x={cx - barW / 2}
                y={top}
                width={barW}
                height={y(yMin) - top}
                rx={2}
                fill={p.approx ? 'url(#stage-hatch)' : WATER}
                fillOpacity={active ? 1 : 0.7}
                stroke={active ? '#E6EEE8' : 'none'}
                strokeWidth={active ? 1.5 : 0}
              />
              <text x={cx} y={top - 3} textAnchor="middle" fontSize="8.5" fontWeight={active ? 700 : 500} fill="currentColor">
                {fmt(p.value)}
                {p.approx ? '*' : ''}
              </text>
              <text
                x={cx}
                y={H - PAD.bottom + 12}
                textAnchor="middle"
                fontSize="9"
                fontWeight={active ? 700 : 400}
                fill="currentColor"
                fillOpacity={active ? 1 : 0.65}
              >
                {p.year}
              </text>
            </g>
          )
        })}
        {stage.thresholds.map((th, i) => (
          <g key={th.value}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(th.value)}
              y2={y(th.value)}
              stroke={i === stage.thresholds.length - 1 ? FLOOD : WATER}
              strokeOpacity={0.85}
              strokeDasharray="4 3"
            />
            <text
              x={W - PAD.right - 2}
              y={y(th.value) - 3}
              textAnchor="end"
              fontSize="8.5"
              fill={i === stage.thresholds.length - 1 ? FLOOD : WATER}
              stroke="#0A110E"
              strokeWidth={3}
              paintOrder="stroke"
              fontWeight={600}
            >
              {fmt(th.value)} · {th.label}
            </text>
          </g>
        ))}
      </svg>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-2">
          <div className="text-[11px] text-muted-foreground leading-snug">
            {copy.oddsLabel(fmt(odds.threshold))}
          </div>
          <div className="mt-0.5 text-[15px] font-semibold leading-tight">
            {odds.beforeCount}{' '}
            <span className="text-muted-foreground font-normal">→</span>{' '}
            <span style={{ color: FLOOD }}>{odds.afterCount}</span>
          </div>
          <div className="text-[10px] font-mono text-muted-foreground/80 mt-0.5">
            {odds.before} → {odds.after}
          </div>
        </div>
        <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-2">
          <div className="text-[11px] text-muted-foreground leading-snug">{copy.range}</div>
          <div className="mt-0.5 text-[15px] font-semibold leading-tight">
            {fmt(recordHigh - stage.recordLow.value)} m
          </div>
          <div className="text-[10px] font-mono text-muted-foreground/80 mt-0.5">
            {copy.recordLow(fmt(stage.recordLow.value), fmtDate(stage.recordLow.date))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-muted-foreground/80">
        <span>* {copy.partial}</span>
        {stage.sources.map((s) => (
          <a
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 hover:text-foreground"
          >
            {s.label}
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        ))}
      </div>
    </div>
  )
}
