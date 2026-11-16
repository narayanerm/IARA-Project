import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import type { CaseStudy, SeriesThreshold } from '@/data/cases'
import { useI18n } from '@/lib/i18n'
import { useTr } from './shared'

const BAR = '#5AA7C9'
const TONE: Record<SeriesThreshold['tone'], string> = {
  danger: '#F0524F',
  warn: '#F59E42',
  muted: 'hsl(215 20% 65%)',
}

const COPY = {
  pt: { pick: 'Clique num ano para ver as imagens daquele momento.', source: 'Fonte' },
  en: { pick: 'Click a year to see the images of that moment.', source: 'Source' },
}

/**
 * The case series drawn like the flood gauge chart: one row per year, a thin bar and a dot coloured by the
 * worst threshold the value crossed. Clicking a row picks the year and only flashes it, nothing stays marked.
 */
export function SeriesRows({ c, selectableYears, onSelectYear }: {
  c: CaseStudy
  selectableYears?: number[]
  onSelectYear?: (year: number) => void
}) {
  const tr = useTr()
  const lang = useI18n((s) => s.lang)
  const copy = COPY[lang] ?? COPY.pt
  const locale = lang === 'en' ? 'en-US' : 'pt-BR'
  const s = c.series
  const [flash, setFlash] = useState<number | null>(null)
  useEffect(() => {
    if (flash === null) return
    const id = window.setTimeout(() => setFlash(null), 650)
    return () => window.clearTimeout(id)
  }, [flash])

  const [lo, hi] = s.domain
  const pct = (v: number) => `${((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * 100}%`
  const fmt = (v: number) => v.toLocaleString(locale, { minimumFractionDigits: s.digits, maximumFractionDigits: s.digits })
  const crossed = (v: number, th: SeriesThreshold) => (s.worse === 'high' ? v >= th.value : v <= th.value)
  const tone = (v: number) => {
    const hit = s.thresholds.filter((th) => th.tone !== 'muted' && crossed(v, th))
    if (hit.some((th) => th.tone === 'danger')) return TONE.danger
    if (hit.some((th) => th.tone === 'warn')) return TONE.warn
    return BAR
  }
  const extreme = s.points.reduce((a, b) => ((s.worse === 'high' ? b.value > a.value : b.value < a.value) ? b : a))

  return (
    <div className="space-y-2.5 rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        {tr(s.title)} · {s.unit}
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-10 right-14">
          {s.thresholds.map((th) => (
            <div
              key={th.value}
              className="absolute inset-y-0 border-l border-dashed"
              style={{ left: pct(th.value), borderColor: `color-mix(in srgb, ${TONE[th.tone]} 60%, transparent)` }}
            />
          ))}
        </div>

        <div className="relative">
          {s.points.map((p, i) => {
            const pickable = !!onSelectYear && (selectableYears?.includes(p.year) ?? true)
            const lit = p.year === flash
            const gap = i > 0 && p.year - s.points[i - 1].year > 5
            const color = tone(p.value)
            return (
              <div key={p.year}>
                {gap && (
                  <div className="flex h-3 items-center pl-1 font-mono text-[9px] text-muted-foreground/60">
                    ⋯ {s.points[i - 1].year + 1}–{p.year - 1}
                  </div>
                )}
                <button
                  type="button"
                  disabled={!pickable}
                  onClick={() => {
                    setFlash(p.year)
                    onSelectYear?.(p.year)
                  }}
                  title={`${p.year}: ${fmt(p.value)} ${s.unit} · ${tr(p.note)}`}
                  className="group flex h-[19px] w-full items-center rounded-sm text-left transition-colors enabled:hover:bg-white/[0.04] disabled:cursor-default"
                  style={{ opacity: onSelectYear && !pickable ? 0.5 : 1 }}
                >
                  <span
                    className="w-10 shrink-0 font-mono text-[11px] tabular-nums"
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
                        background: BAR,
                        opacity: lit ? 1 : 0.55,
                        transformOrigin: 'left',
                        transform: lit ? 'scaleY(1.8)' : 'scaleY(1)',
                      }}
                    />
                    <span
                      className="absolute top-1/2 h-[9px] w-[9px] rounded-full transition-transform duration-300"
                      style={{
                        left: pct(p.value),
                        background: color,
                        boxShadow: p.year === extreme.year ? `0 0 0 2px color-mix(in srgb, ${color} 35%, transparent)` : undefined,
                        transform: `translate(-50%, -50%) scale(${lit ? 1.6 : 1})`,
                      }}
                    />
                  </span>
                  <span
                    className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums"
                    style={{ color: lit ? '#fff' : color, fontWeight: lit ? 700 : 500 }}
                  >
                    {fmt(p.value)}
                  </span>
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {s.thresholds.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {s.thresholds.map((th) => (
            <li key={th.value} className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
              <span className="inline-block w-3 border-t border-dashed" style={{ borderColor: TONE[th.tone] }} />
              {tr(th.label)} · <span className="tabular-nums text-foreground/85">{fmt(th.value)} {s.unit}</span>
            </li>
          ))}
        </ul>
      )}

      {onSelectYear && <p className="text-[11.5px] leading-snug text-muted-foreground">{copy.pick}</p>}

      <p className="font-mono text-[10px] leading-snug text-muted-foreground/80">
        {tr(s.footnote)}{' '}
        <a href={s.source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-foreground">
          {copy.source}: {s.source.label}
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </p>
    </div>
  )
}
