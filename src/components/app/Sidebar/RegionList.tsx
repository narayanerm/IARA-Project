import { Droplets, Pickaxe, Sun, type LucideIcon } from 'lucide-react'
import { REGIONS } from '@/lib/regions'
import type { Phenomenon, Region } from '@/lib/types'
import { useApp, useAoiPopup } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { useT } from '@/lib/i18n'

const ICON_BY_PHENOMENON: Record<Phenomenon, LucideIcon> = {
  mining: Pickaxe,
  flood: Droplets,
  drought: Sun,
}

export function RegionList() {
  const t = useT()
  const activeRegion = useApp((s) => s.activeRegion)
  const setActiveRegion = useApp((s) => s.setActiveRegion)
  const openPopup = useAoiPopup((s) => s.openPopup)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {t('sidebar.heading')}
        </div>
        <div className="text-[12px] font-mono text-muted-foreground">{REGIONS.length}</div>
      </div>

      <div className="flex flex-col gap-2">
        {REGIONS.map((region) => (
          <RegionCard
            key={region.id}
            region={region}
            isActive={activeRegion === region.id}
            onClick={() => {
              setActiveRegion(region.id)
              openPopup()
            }}
          />
        ))}
      </div>
    </div>
  )
}

function RegionCard({
  region,
  isActive,
  onClick,
}: {
  region: Region
  isActive: boolean
  onClick: () => void
}) {
  const t = useT()
  const Icon = ICON_BY_PHENOMENON[region.phenomenon]
  return (
    <button
      onClick={onClick}
      className={cn(
        'group w-full rounded-lg border border-border/60 bg-card/60 p-3 text-left transition-all',
        'hover:border-primary/50 hover:bg-card',
        isActive && 'border-primary/70 bg-primary/5 shadow-[0_0_24px_-10px_hsl(var(--primary)/0.6)]'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'grid h-9 w-9 shrink-0 place-items-center rounded-md ring-1 transition-colors',
            isActive
              ? 'bg-primary/15 ring-primary/40 text-primary'
              : 'bg-secondary ring-border text-muted-foreground group-hover:text-foreground'
          )}
        >
          <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-semibold text-sm truncate">
              {t(`region.${region.id}.phen`)}
            </div>
            {region.isAnchor && (
              <Badge variant="default" className="text-[13px] px-1.5 py-0 h-4 font-mono">
                {t('status.anchor')}
              </Badge>
            )}
          </div>
          <div className="text-[13px] text-muted-foreground truncate font-mono mt-0.5">
            {t(`region.${region.id}.name`)} · {t(`region.${region.id}.city`)}
          </div>
          <div className="text-xs text-muted-foreground/90 mt-1.5 line-clamp-2 leading-snug">
            {t(`region.${region.id}.tagline`)}
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between pl-12">
        <StatusPill status={region.status} />
        {isActive && (
          <span className="text-[12px] font-mono text-primary">
            {t('sidebar.selected')}
          </span>
        )}
      </div>
    </button>
  )
}

function StatusPill({ status }: { status: Region['status'] }) {
  const t = useT()
  const classes: Record<Region['status'], string> = {
    ready: 'bg-sar-jade/20 text-sar-jade',
    preview: 'bg-sar-amber/20 text-sar-amber',
    planned: 'bg-muted text-muted-foreground',
  }
  const labelKey = {
    ready: 'status.ready',
    preview: 'status.preview',
    planned: 'status.planned',
  } as const
  return (
    <span
      className={cn(
        'rounded-full px-1.5 py-0.5 text-[13px] font-mono tracking-wide',
        classes[status]
      )}
    >
      {t(labelKey[status])}
    </span>
  )
}
