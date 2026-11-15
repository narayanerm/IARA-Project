import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import type { RiverStage } from '@/data/cases'
import { useI18n } from '@/lib/i18n'

const WATER = '#5AA7C9'
const FLOOD = '#F59E42'
const SEVERE = '#F0524F'

// Horizontal scale of the bars, in metres at the gauge.
const X_MIN = 26.5
const X_MAX = 30.4

function fmt(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return d ? `${d}.${m}.${y}` : m ? `${m}.${y}` : y
}

interface Props {
  stage: RiverStage
  /** Year selected on the timeline; its row is highlighted. */
  activeYear?: number
  /** Years whose row can be clicked (they have imagery), and what a click does. */
  selectableYears?: number[]
  onSelectYear?: (year: number) => void
}

const COPY = {
  pt: {
    titlePrefix: 'Cotas máximas anuais ·',
    partial: 'leitura parcial (ano em curso)',
    pick: 'Clique num ano para ver as imagens daquela cheia.',
    flood: 'inundação',
    severe: 'severa',
    gap: '1954–2008',
  },
  en: {
    titlePrefix: 'Annual peaks ·',
    partial: 'partial reading (ongoing year)',
    pick: 'Click a year to see the images of that flood.',
    flood: 'flood',
    severe: 'severe',
    gap: '1954–2008',
  },
}

const pct = (v: number) => `${((Math.min(Math.max(v, X_MIN), X_MAX) - X_MIN) / (X_MAX - X_MIN)) * 100}%`

/**
 * Annual flood peaks at the Porto de Manaus gauge, one row per year, against the SGB flood stages.
 * The bar ends in a dot coloured by how far the river went: below flood stage, flooding, severe.
 */
export function RiverStageChart({ stage, activeYear, selectableYears, onSelectYear }: Props) {
  const lang = useI18n((s) => s.lang)
  const copy = COPY[lang] ?? COPY.pt
  // A click only flashes the row: the images below can change on their own, so no year stays marked.
  const [flash, setFlash] = useState<number | null>(null)
  useEffect(() => {
    if (flash === null) return
    const id = window.setTimeout(() => setFlash(null), 650)
    return () => window.clearTimeout(id)
  }, [flash])

  const flood = stage.thresholds.find((t) => t.value === 27.5)?.value ?? 27.5
  const severe = stage.thresholds[stage.thresholds.length - 1]?.value ?? 29
  const record = stage.peaks.reduce((a, b) => (b.value > a.value ? b : a))
  const title = `${copy.titlePrefix} ${stage.station}`
  const tone = (v: number) => (v >= severe ? SEVERE : v >= flood ? FLOOD : WATER)

  return (
    <div className="space-y-2.5 rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{title}</div>

      <div className="relative" aria-label={title}>
        {/* Flood-stage bands behind the bars, labelled once at the top. */}
        <div className="pointer-events-none absolute inset-y-0 left-10 right-12">
          <div
            className="absolute inset-y-0"
            style={{ left: pct(flood), width: `calc(${pct(severe)} - ${pct(flood)})`, background: `${FLOOD}14` }}
          />
          <div className="absolute inset-y-0 right-0" style={{ left: pct(severe), background: `${SEVERE}1A` }} />
          {[
            { v: flood, c: FLOOD, l: copy.flood },
            { v: severe, c: SEVERE, l: copy.severe },
          ].map((b) => (
            <div key={b.v} className="absolute inset-y-0 border-l border-dashed" style={{ left: pct(b.v), borderColor: `${b.c}99` }}>
              <span
                className="absolute -top-0.5 left-1 whitespace-nowrap font-mono text-[9.5px] font-semibold"
                style={{ color: b.c }}
              >
                {fmt(b.v)} {b.l}
              </span>
            </div>
          ))}
        </div>

        <div className="relative pt-4">
          {stage.peaks.map((p, i) => {
            const pickable = !!onSelectYear && (selectableYears?.includes(p.year) ?? true)
            const lit = p.year === activeYear || p.year === flash
            const gap = i > 0 && p.year - stage.peaks[i - 1].year > 5
            const color = tone(p.value)
            return (
              <div key={p.year}>
                {gap && (
                  <div className="flex h-3 items-center pl-1 font-mono text-[9px] text-muted-foreground/60">⋯ {copy.gap}</div>
                )}
                <button
                  type="button"
                  disabled={!pickable}
                  onClick={() => {
                    setFlash(p.year)
                    onSelectYear?.(p.year)
                  }}
                  title={`${p.year}: ${fmt(p.value)} m · ${fmtDate(p.date)}${p.approx ? ` (${copy.partial})` : ''}`}
                  className="group flex h-[17px] w-full items-center rounded-sm text-left transition-colors enabled:hover:bg-white/[0.04] disabled:cursor-default"
                  style={{ opacity: onSelectYear && !pickable ? 0.5 : 1 }}
                >
                  <span
                    className="w-10 shrink-0 font-mono text-[11px] tabular-nums transition-colors"
                    style={{ color: lit ? '#fff' : undefined, fontWeight: lit ? 700 : 400 }}
                  >
                    <span className={lit ? '' : 'text-muted-foreground group-hover:text-foreground'}>{p.year}</span>
                  </span>
                  <span className="relative h-full flex-1">
                    <span
                      className="absolute left-0 h-[5px] rounded-full transition-all duration-300"
                      style={{
                        top: 'calc(50% - 2.5px)',
                        width: pct(p.value),
                        background: p.approx
                          ? `repeating-linear-gradient(135deg, ${WATER}, ${WATER} 3px, ${WATER}55 3px, ${WATER}55 6px)`
                          : WATER,
                        opacity: lit ? 1 : 0.55,
                        transformOrigin: 'left',
                        transform: p.year === flash ? 'scaleY(1.8)' : 'scaleY(1)',
                      }}
                    />
                    <span
                      className="absolute top-1/2 h-[9px] w-[9px] rounded-full transition-transform duration-300"
                      style={{
                        left: pct(p.value),
                        background: color,
                        boxShadow: p.year === record.year ? `0 0 0 2px ${color}55` : undefined,
                        transform: `translate(-50%, -50%) scale(${p.year === flash ? 1.6 : 1})`,
                      }}
                    />
                  </span>
                  <span
                    className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums"
                    style={{ color: lit ? '#fff' : color, fontWeight: lit ? 700 : 500 }}
                  >
                    {fmt(p.value)}
                    {p.approx ? '*' : ''}
                  </span>
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {onSelectYear && <p className="text-[11.5px] leading-snug text-muted-foreground">{copy.pick}</p>}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground/80">
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
