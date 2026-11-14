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

/**
 * The three cases on the overview map: small pins with a short label, the only prominent,
 * clickable things on load. Clicking one opens the case briefing.
 */
// Label side per case so Tefé and Manaus (close at the basin zoom) never overlap.
const SIDE: Record<RegionId, 'top' | 'left' | 'right'> = { YANO: 'top', SECA: 'left', ENCH: 'right' }
const ANCHOR = { top: 'bottom', left: 'right', right: 'left' } as const

export function CaseMarkers() {
  const t = useT()
  return (
    <>
      {REGIONS.map((r) => {
        const Icon = ICON_BY_PHENOMENON[r.phenomenon]
        const side = SIDE[r.id]
        return (
          <Marker key={r.id} longitude={r.center[0]} latitude={r.center[1]} anchor={ANCHOR[side]}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                openCase(r.id)
              }}
              title={t(`case.why.${r.id}`)}
              aria-label={`${t(`region.${r.id}.phen`)}, ${t(`region.${r.id}.name`)}. ${t('case.open')}`}
              className={cn(
                'group flex items-center focus-visible:outline-none',
                side === 'top' && 'flex-col',
                side === 'right' && 'flex-row-reverse'
              )}
            >
              <span className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-[13px] font-medium text-foreground transition-colors group-hover:bg-raised group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" strokeWidth={1.8} />
                {t(`region.${r.id}.phen`)}
                <span className="hidden text-muted-foreground sm:inline">{t(`region.${r.id}.city`)}</span>
              </span>
              <span aria-hidden className={cn('bg-foreground/70', side === 'top' ? 'h-3 w-px' : 'h-px w-3')} />
              <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-foreground ring-4 ring-foreground/20" />
            </button>
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
