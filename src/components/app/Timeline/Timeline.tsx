import { useMemo, useRef, useEffect, useState } from 'react'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { Area, AreaChart, ReferenceDot, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { useApp } from '@/lib/store'
import { YANO_MINING } from '@/data/mocks/yanomami-mining'
import { useT } from '@/lib/i18n'

// Displacement line: the palette's damage red; the current-date marker is water (data), not the action orange.
const LINE = 'hsl(var(--destructive))'
const MARK = 'hsl(var(--water))'

// Half the native range thumb, so the invisible slider's steps line up with the chart points.
const THUMB_HALF = 8

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
  const valueText = `${current.date}, ${current.displacementMm.toFixed(2)} mm`

  return (
    <div className="glass flex h-14 items-center gap-2 rounded-lg px-2 sm:gap-3 sm:px-3">
      <div className="flex shrink-0 items-center gap-0.5">
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
          variant="outline"
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

      <div className="hidden min-w-0 max-w-[200px] shrink flex-col leading-tight 2xl:flex">
        <span className="text-[12px] text-muted-foreground">{t('timeline.series')}</span>
        <span className="truncate text-[13px] font-medium text-foreground" title={seriesTitle}>
          {seriesTitle}
        </span>
      </div>

      <div className="relative h-10 min-w-[72px] flex-1 rounded-md has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 4, right: THUMB_HALF, bottom: 4, left: THUMB_HALF }}>
            <defs>
              <linearGradient id="timeline-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={LINE} stopOpacity={0.45} />
                <stop offset="100%" stopColor={LINE} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <YAxis hide domain={['dataMin', 'dataMax']} />
            <Area
              type="monotone"
              dataKey="displacementMm"
              stroke={LINE}
              strokeWidth={1.5}
              fill="url(#timeline-fill)"
              isAnimationActive={false}
            />
            <ReferenceLine x={current.date} stroke={MARK} strokeWidth={1.2} strokeDasharray="3 2" />
            <ReferenceDot
              x={current.date}
              y={current.displacementMm}
              r={3.5}
              fill={MARK}
              stroke="hsl(var(--background))"
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
        <input
          type="range"
          min={0}
          max={maxIndex}
          value={timeIndex}
          onChange={(e) => setTimeIndex(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
          aria-label={t('timeline.scrubber')}
          aria-valuetext={valueText}
        />
      </div>

      <div className="shrink-0 text-right leading-tight tabular-nums">
        <div className="text-[13px] text-foreground">{current.displacementMm.toFixed(2)} mm</div>
        <div className="text-[12px] text-muted-foreground">{current.date}</div>
      </div>
    </div>
  )
}
