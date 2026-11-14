import { Droplets, Pickaxe, Sun, type LucideIcon } from 'lucide-react'
import { REGIONS } from '@/lib/regions'
import type { Phenomenon } from '@/lib/types'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'

const ICON_BY_PHENOMENON: Record<Phenomenon, LucideIcon> = {
  mining: Pickaxe,
  flood: Droplets,
  drought: Sun,
}

export function AoiPills() {
  const activeRegion = useApp((s) => s.activeRegion)
  const aoiActive = useApp((s) => s.aoiActive)
  const setActiveRegion = useApp((s) => s.setActiveRegion)

  return (
    <div className="flex gap-1.5">
      {REGIONS.map((r) => {
        const Icon = ICON_BY_PHENOMENON[r.phenomenon]
        const isActive = aoiActive && r.id === activeRegion
        return (
          <button
            key={r.id}
            onClick={() => setActiveRegion(r.id)}
            title={`${r.phenomenonLabel} · ${r.anchorCity}`}
            className={cn(
              'flex-1 inline-flex flex-col items-center gap-1 rounded-md border px-2 py-2 transition-colors',
              isActive
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'bg-background/40 border-border/60 text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={1.8} />
            <span className="text-[11px] font-mono font-semibold leading-none">
              {r.phenomenonLabel}
            </span>
          </button>
        )
      })}
    </div>
  )
}
