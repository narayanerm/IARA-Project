import { Marker } from 'react-map-gl/maplibre'
import { Droplets, Pickaxe, Sun, type LucideIcon } from 'lucide-react'
import { REGIONS } from '@/lib/regions'
import type { Phenomenon, RegionId } from '@/lib/types'
import { useT } from '@/lib/i18n'
import { openCase } from '@/lib/story'
import { cn } from '@/lib/utils'

export const ICON_BY_PHENOMENON: Record<Phenomenon, LucideIcon> = {
  mining: Pickaxe,
  flood: Droplets,
  drought: Sun,
}

// Where each card sits relative to its point so the three never overlap at the overview zoom.
const ANCHOR: Record<RegionId, 'bottom' | 'left' | 'right'> = {
  YANO: 'bottom',
  ENCH: 'left',
  SECA: 'right',
}

/** The three cases on the overview map: the only prominent, clickable things on load. */
export function CaseMarkers() {
  return (
    <>
      {REGIONS.map((r) => {
        const anchor = ANCHOR[r.id]
        return (
          <Marker key={r.id} longitude={r.center[0]} latitude={r.center[1]} anchor={anchor}>
            <div
              className={cn(
                'hidden items-center gap-2 md:flex',
                anchor === 'bottom' && 'flex-col-reverse',
                anchor === 'right' && 'flex-row-reverse'
              )}
            >
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-foreground ring-4 ring-foreground/20" />
              <CaseCard id={r.id} className="w-[236px]" />
            </div>
          </Marker>
        )
      })}
    </>
  )
}

export function CaseCard({ id, className }: { id: RegionId; className?: string }) {
  const t = useT()
  const r = REGIONS.find((x) => x.id === id)!
  const Icon = ICON_BY_PHENOMENON[r.phenomenon]
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        openCase(id)
      }}
      className={cn(
        'group block rounded-md border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-raised',
        'animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none',
        className
      )}
    >
      <span className="flex items-center gap-1.5 text-[14px] font-semibold text-foreground">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" strokeWidth={1.8} />
        <span className="min-w-0 truncate">{t(`region.${id}.phen`)}</span>
      </span>
      <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
        {t(`region.${id}.name`)} · {t(`region.${id}.city`)}
      </span>
      <span className="mt-1.5 block text-[13px] leading-snug text-foreground/90">
        {t(`case.why.${id}`)}
      </span>
    </button>
  )
}
