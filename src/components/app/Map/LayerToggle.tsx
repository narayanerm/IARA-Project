import { Activity, Layers, Waves, ArrowDownUp } from 'lucide-react'
import { useApp } from '@/lib/store'
import type { ProductLayer } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useT, type TKey } from '@/lib/i18n'

const LAYERS: Array<{ id: ProductLayer; labelKey: TKey; icon: React.ElementType }> = [
  { id: 'amplitude', labelKey: 'layer.amplitude', icon: Layers },
  { id: 'coherence', labelKey: 'layer.coherence', icon: Activity },
  { id: 'interferogram', labelKey: 'layer.interferogram', icon: Waves },
  { id: 'displacement', labelKey: 'layer.displacement', icon: ArrowDownUp },
]

export function LayerToggle() {
  const t = useT()
  const active = useApp((s) => s.activeLayer)
  const setActive = useApp((s) => s.setActiveLayer)

  return (
    <div className="glass rounded-lg p-1 flex gap-0.5">
      {LAYERS.map((l) => {
        const Icon = l.icon
        const isActive = active === l.id
        return (
          <button
            key={l.id}
            onClick={() => setActive(l.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
              isActive
                ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {t(l.labelKey)}
          </button>
        )
      })}
    </div>
  )
}
