import { useEffect, useMemo, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import type { CaseStudy, SeriesThreshold } from '@/data/cases'
import { useApp } from '@/lib/store'
import { useI18n, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useCasePoint } from './CaseSar'
import { useTr } from './shared'

const PLAY_MS = 1900
const TONE: Record<SeriesThreshold['tone'], string> = {
  danger: '#F0524F',
  warn: '#F2C14E',
  muted: 'hsl(215 20% 65%)',
}

interface Row {
  key: string
  year: number | null
  value: number
  ghost: boolean
}

interface ShapeProps {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: Row
}

/** Time series of the case: measured years as bars, plus the slot reserved for the forecast. */
export function CaseSeries({ c, className }: { c: CaseStudy; className?: string }) {
  const t = useT()
  const tr = useTr()
  const locale = useI18n((s) => (s.lang === 'en' ? 'en-US' : 'pt-BR'))
  const setCaseYear = useApp((s) => s.setCaseYear)
  const point = useCasePoint(c)
  const [playing, setPlaying] = useState(false)
  const s = c.series

  const fmt = (v: number) =>
    v.toLocaleString(locale, { minimumFractionDigits: s.digits, maximumFractionDigits: s.digits })

  const rows = useMemo<Row[]>(() => {
    return [
      ...s.points.map((p) => ({ key: String(p.year), year: p.year, value: p.value, ghost: false })),
      { key: 'next', year: null, value: (s.domain[0] + s.domain[1]) / 2, ghost: true },
    ]
  }, [s])
  // Headroom above the tallest bar so its value label stays inside the plot area.
  const domain: [number, number] = [s.domain[0], s.domain[1] + (s.domain[1] - s.domain[0]) * 0.2]

  useEffect(() => {
    if (!playing) return
    const years = s.points.map((p) => p.year)
    const id = window.setInterval(() => {
      const cur = years.indexOf(useApp.getState().caseYear ?? years[years.length - 1])
      useApp.getState().setCaseYear(years[(cur + 1) % years.length])
    }, PLAY_MS)
    return () => window.clearInterval(id)
  }, [playing, s])

  const shape = (props: unknown) => {
    const { x = 0, y = 0, width = 0, height = 0, payload } = props as ShapeProps
    if (!payload) return <g />
    const w = Math.min(width, 46)
    const bx = x + (width - w) / 2
    if (payload.ghost) {
      return (
        <g>
          <rect x={bx} y={y} width={w} height={height} rx={5} fill="none" stroke={c.color} strokeOpacity={0.7} strokeDasharray="4 4" />
          <text x={bx + w / 2} y={y + height / 2 + 6} textAnchor="middle" fontSize={17} fontWeight={600} fill={c.color}>
            ?
          </text>
        </g>
      )
    }
    const selected = payload.year === point.year
    return (
      <g style={{ cursor: 'pointer' }} onClick={() => setCaseYear(payload.year)}>
        {/* Full-height hit area so short bars are still easy to pick. */}
        <rect x={x} y={0} width={width} height={y + height} fill="transparent" />
        <rect x={bx} y={y} width={w} height={height} rx={5} fill={c.color} fillOpacity={selected ? 1 : 0.38} />
        <text
          x={bx + w / 2}
          y={y - 5}
          textAnchor="middle"
          fontSize={11}
          fontWeight={selected ? 700 : 500}
          fill={selected ? '#fff' : 'hsl(215 20% 72%)'}
        >
          {fmt(payload.value)}
        </text>
      </g>
    )
  }

  const dateLabel = point.date
    ? new Date(`${point.date}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    : String(point.year)

  return (
    <section className={cn('glass !bg-card rounded-xl p-3', className)} data-tour="series" aria-label={tr(s.title)}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPlaying((v) => !v)}
          aria-label={playing ? t('case.pause') : t('case.play')}
          title={playing ? t('case.pause') : t('case.play')}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#10160f] transition-opacity hover:opacity-90"
          style={{ background: c.color }}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <div className="min-w-0">
          <h3 className="truncate text-[13.5px] font-semibold leading-tight">
            {tr(s.title)} <span className="font-normal text-muted-foreground">({s.unit})</span>
          </h3>
          <a
            href={s.source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-[11px] text-muted-foreground hover:text-foreground"
          >
            {t('case.source')}: {s.source.label}
          </a>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-stretch gap-x-3 gap-y-2">
        <div className="h-[132px] min-w-[min(100%,360px)] flex-[3_1_0%]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 4, right: s.thresholds.length ? 138 : 8, bottom: 0, left: 8 }} barCategoryGap="18%">
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
              <XAxis
                dataKey="key"
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tick={{ fontSize: 11.5, fill: 'hsl(215 20% 72%)' }}
                tickFormatter={(k: string) => (k === 'next' ? t('case.forecastTick') : k)}
                interval={0}
              />
              <YAxis hide domain={domain} allowDataOverflow />
              {s.thresholds.map((th) => (
                <ReferenceLine
                  key={th.value}
                  y={th.value}
                  stroke={TONE[th.tone]}
                  strokeDasharray="5 4"
                  strokeOpacity={0.9}
                  label={{
                    value: `${tr(th.label)} · ${fmt(th.value)}`,
                    position: 'right',
                    fontSize: 10.5,
                    fill: TONE[th.tone],
                  }}
                />
              ))}
              <Bar dataKey="value" shape={shape} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div
          className="min-w-[180px] flex-1 rounded-lg border p-2.5"
          style={{ borderColor: `color-mix(in srgb, ${c.color} 40%, transparent)` }}
          aria-live="polite"
        >
          <div className="text-[11px] text-muted-foreground">{dateLabel}</div>
          <div className="mt-0.5 text-[1.45rem] font-semibold leading-none tabular-nums" style={{ color: c.color }}>
            {fmt(point.value)} <span className="text-[13px] font-medium">{s.unit}</span>
          </div>
          <p className="mt-1.5 text-[12px] leading-snug text-foreground/90">{tr(point.note)}</p>
        </div>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{tr(s.footnote)}</p>
    </section>
  )
}
