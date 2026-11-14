import { useMemo, useRef, useEffect, useState } from 'react'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { useApp } from '@/lib/store'
import { YANO_MINING } from '@/data/mocks/yanomami-mining'
import { useT } from '@/lib/i18n'

export function Timeline() {
  const t = useT()
  const selected = useApp((s) => s.selectedPolygon)
  const timeIndex = useApp((s) => s.timeIndex)
  const setTimeIndex = useApp((s) => s.setTimeIndex)
  const [playing, setPlaying] = useState(false)
  const rafRef = useRef<number | null>(null)

  const series = useMemo(() => {
    const src = selected ?? YANO_MINING[0]
    return src.series
  }, [selected])

  const maxIndex = series.length - 1

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }
    let last = performance.now()
    const tick = (now: number) => {
      if (now - last > 220) {
        last = now
        setTimeIndex(Math.min(maxIndex, (useApp.getState().timeIndex + 1) % (maxIndex + 1)))
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [playing, maxIndex, setTimeIndex])

  const current = series[Math.min(timeIndex, maxIndex)]
  const seriesTitle = selected ? selected.name : t('timeline.example')

  return (
    <div className="glass rounded-lg px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setTimeIndex(0)}
            aria-label={t('timeline.back')}
          >
            <SkipBack className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="default"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPlaying((v) => !v)}
            aria-label={playing ? t('timeline.pause') : t('timeline.play')}
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setTimeIndex(maxIndex)}
            aria-label={t('timeline.end')}
          >
            <SkipForward className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex-1">
          <div className="flex items-baseline justify-between mb-1">
            <div className="text-[13px] font-medium text-muted-foreground">
              {t('timeline.series')}, {seriesTitle}
            </div>
            <div className="text-xs tabular-nums text-foreground">
              {current.date}, {current.displacementMm.toFixed(2)} mm
            </div>
          </div>

          <div className="h-16 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(348 85% 58%)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(348 85% 58%)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border) / 0.4)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  tickFormatter={(d: string) => d.slice(2, 7)}
                  tickLine={false}
                  axisLine={false}
                  interval={3}
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                  domain={['auto', 'auto']}
                />
                <RTooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 6,
                    fontSize: 11,
                  }}
                  formatter={(value) => {
                    const n = typeof value === 'number' ? value : Number(value)
                    return [`${n.toFixed(2)} mm`, 'desloc.']
                  }}
                />
                <ReferenceLine
                  x={current.date}
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.2}
                  strokeDasharray="3 2"
                />
                <Area
                  type="monotone"
                  dataKey="displacementMm"
                  stroke="hsl(348 85% 58%)"
                  strokeWidth={1.5}
                  fill="url(#g1)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={maxIndex}
        value={timeIndex}
        onChange={(e) => setTimeIndex(Number(e.target.value))}
        className="mt-2 w-full accent-primary"
        aria-label={t('timeline.scrubber')}
      />
    </div>
  )
}
