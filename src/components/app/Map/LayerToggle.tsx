import { Activity, Layers, Waves, ArrowDownUp } from 'lucide-react'
import { useApp, useUi } from '@/lib/store'
import type { ProductLayer } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useT, type TKey } from '@/lib/i18n'
import { markExplore } from '@/lib/story'

const LAYERS: Array<{ id: ProductLayer; labelKey: TKey; icon: React.ElementType }> = [
  { id: 'amplitude', labelKey: 'layer.amplitude', icon: Layers },
  { id: 'coherence', labelKey: 'layer.coherence', icon: Activity },
  { id: 'interferogram', labelKey: 'layer.interferogram', icon: Waves },
  { id: 'displacement', labelKey: 'layer.displacement', icon: ArrowDownUp },
]

/**
 * Radar layer tabs. Quiet and locked until a case has been taken to the radar stage;
 * then the current layer is marked with an orange underline.
 * `variant="bar"` sits in the top bar, `variant="float"` is the compact phone version on the map.
 */
export function LayerToggle({ variant = 'bar' }: { variant?: 'bar' | 'float' }) {
  const t = useT()
  const active = useApp((s) => s.activeLayer)
  const setActive = useApp((s) => s.setActiveLayer)
  const stage = useUi((s) => s.stage)
  const locked = stage === 'overview' || stage === 'case'

  return (
    <div
      role="tablist"
      aria-label={t('layers.label')}
      title={locked ? t('layers.locked') : undefined}
      className={cn(
        'flex min-w-0 items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden transition-opacity duration-200',
        variant === 'bar' ? 'h-full gap-1' : 'rounded-md border border-border bg-card px-1 gap-0.5 max-w-[calc(100vw-2rem)]',
        locked && 'opacity-40'
      )}
    >
      {LAYERS.map((l) => {
        const Icon = l.icon
        const isActive = !locked && active === l.id
        return (
          <button
            key={l.id}
            role="tab"
            aria-selected={isActive}
            aria-disabled={locked}
            tabIndex={locked ? -1 : 0}
            onClick={() => {
              if (locked) return
              setActive(l.id)
              markExplore()
            }}
            className={cn(
              'relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 font-condensed text-[13px] font-medium transition-colors',
              variant === 'bar' ? 'h-full' : 'h-9',
              locked ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer',
              isActive ? 'text-foreground' : !locked && 'text-muted-foreground hover:text-foreground',
              // 2px orange underline for the current tab
              'after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors',
              isActive ? 'after:bg-primary' : 'after:bg-transparent'
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {t(l.labelKey)}
          </button>
        )
      })}
    </div>
  )
}
