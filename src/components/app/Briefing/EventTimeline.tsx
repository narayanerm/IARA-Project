import { cn } from '@/lib/utils'
import type { HistoricalEvent } from '@/data/historical-events'

interface Props {
  events: HistoricalEvent[]
  activeId: string
  onSelect: (id: string) => void
}

export function EventTimeline({ events, activeId, onSelect }: Props) {
  const years = events.map((e) => e.year)
  const minY = Math.min(...years)
  const maxY = Math.max(...years)
  const span = Math.max(1, maxY - minY)

  const pct = (year: number) => ((year - minY) / span) * 100

  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] tabular-nums text-muted-foreground">
          Histórico, clique num ano
        </div>
        <div className="text-[11px] tabular-nums text-muted-foreground">
          {events.length} eventos, {minY}–{maxY}
        </div>
      </div>

      <div className="relative h-16 mt-1">
        <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />

        {events.map((e) => {
          const active = e.id === activeId
          const size = 8 + Math.round(e.severity * 16)
          const color =
            e.severity >= 0.9
              ? 'hsl(0 95% 60%)'
              : e.severity >= 0.6
              ? 'hsl(28 95% 60%)'
              : 'hsl(48 95% 60%)'
          return (
            <button
              key={e.id}
              onClick={() => onSelect(e.id)}
              title={`${e.label}: ${e.magnitude.value} ${e.magnitude.unit}`}
              className={cn(
                'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full transition-colors',
                active
                  ? 'ring-2 ring-white'
                  : ' opacity-85'
              )}
              style={{
                left: `${pct(e.year)}%`,
                width: size,
                height: size,
                background: color,
                ['--marker-color' as string]: color,
              }}
              aria-label={e.label}
            />
          )
        })}

        {events.map((e) => (
          <div
            key={`label-${e.id}`}
            className={cn(
              'absolute top-full mt-1 text-[10px] tabular-nums -translate-x-1/2 whitespace-nowrap transition-colors',
              e.id === activeId ? 'text-foreground font-semibold' : 'text-muted-foreground'
            )}
            style={{ left: `${pct(e.year)}%` }}
          >
            {e.shortLabel}
          </div>
        ))}
      </div>
    </div>
  )
}
