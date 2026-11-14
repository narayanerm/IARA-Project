import { Badge } from '@/components/ui/badge'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { Entry } from './types'
import { buildAsfVertexUrl, compact } from './utils'

export function CommunityList({
  shown,
  totalFiltered,
  onShowAll,
}: {
  shown: Entry[]
  totalFiltered: number
  onShowAll: () => void
}) {
  const focusedTi = useApp((s) => s.focusedTi)
  const setFocusedTi = useApp((s) => s.setFocusedTi)
  const requestFlyTo = useApp((s) => s.requestFlyTo)

  return (
    <div className="flex flex-col gap-1.5">
      {shown.map((e) => {
        const isTi = e.kind === 'ti'
        const focused = isTi && focusedTi === e.focusKey
        return (
          <CommunityCard
            key={`${e.kind}-${e.name}-${e.centroid[0]}`}
            entry={e}
            focused={focused}
            onSelect={() => {
              if (isTi) setFocusedTi(focused ? null : e.focusKey)
              requestFlyTo(e.centroid, isTi ? 7.5 : 9.5)
            }}
          />
        )
      })}
      {totalFiltered > shown.length && (
        <button
          onClick={onShowAll}
          className="rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-[12px] font-mono text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors"
        >
          Mostrar todas ({totalFiltered - shown.length} restantes)
        </button>
      )}
    </div>
  )
}

function CommunityCard({
  entry,
  focused,
  onSelect,
}: {
  entry: Entry
  focused: boolean
  onSelect: () => void
}) {
  const isTi = entry.kind === 'ti'
  const kindColor = isTi ? 'sar-amber' : 'sar-cyan'
  const ribAccent = isTi ? 'hover:border-sar-amber/40' : 'hover:border-sar-cyan/40'
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full rounded-md border p-2 text-left transition-colors',
        focused
          ? 'bg-sar-amber/15 border-sar-amber/50 shadow-[0_0_14px_-6px_hsl(28,95%,55%)]'
          : cn('bg-background/40 border-border/60 hover:bg-background/60', ribAccent)
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
            <span className={cn('inline-block h-1.5 w-1.5 rounded-full shrink-0', `bg-${kindColor}`)} />
            <span className="truncate">{entry.name}</span>
          </div>
          <div className="text-[11px] font-mono text-muted-foreground truncate">{entry.subtitle}</div>
        </div>
        {focused && (
          <Badge variant="outline" className="shrink-0 text-[10px] font-mono px-1.5 py-0 h-4">
            focused
          </Badge>
        )}
      </div>

      <div className="mt-1.5 grid grid-cols-3 gap-1 text-[11px] font-mono text-muted-foreground">
        <MiniStat label="área" value={entry.area_km2 != null ? `${compact(entry.area_km2)} km²` : '—'} />
        <MiniStat label="hab" value={entry.population != null ? compact(entry.population) : '—'} />
        <MiniStat label="ano" value={entry.year != null ? String(entry.year) : '—'} />
      </div>

      {isTi && (
        <div className="mt-1.5 flex items-center justify-end">
          <a
            href={buildAsfVertexUrl(entry.centroid)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(ev) => ev.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-sm border border-sar-cyan/40 bg-sar-cyan/10 px-1.5 py-0.5 text-[10px] font-mono text-sar-cyan hover:bg-sar-cyan/20 transition-colors"
            title="Abrir catálogo SAR da ASF"
          >
            SAR ↗
          </a>
        </div>
      )}
    </button>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-start rounded border border-border/50 bg-background/60 px-1.5 py-0.5">
      <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/70">
        {label}
      </span>
      <span className="text-[11px] font-mono text-foreground truncate max-w-full">{value}</span>
    </div>
  )
}
