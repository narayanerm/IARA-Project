import { Popup } from 'react-map-gl/maplibre'
import { useMemo } from 'react'
import { Activity, Layers, Waves, ArrowDownUp, X, type LucideIcon } from 'lucide-react'
import { REGIONS } from '@/lib/regions'
import { useApp, useAoiPopup } from '@/lib/store'
import { useT, type TKey } from '@/lib/i18n'
import type { ProductLayer } from '@/lib/types'
import { GIBS_BY_REGION } from '@/lib/gibs'
import { cn } from '@/lib/utils'

const SAR_LAYERS: Array<{ id: ProductLayer; labelKey: TKey; icon: LucideIcon; color: string }> = [
  { id: 'amplitude', labelKey: 'layer.amplitude', icon: Layers, color: 'hsl(210 90% 60%)' },
  { id: 'coherence', labelKey: 'layer.coherence', icon: Activity, color: 'hsl(140 70% 55%)' },
  { id: 'interferogram', labelKey: 'layer.interferogram', icon: Waves, color: 'hsl(270 80% 65%)' },
  { id: 'displacement', labelKey: 'layer.displacement', icon: ArrowDownUp, color: 'hsl(348 85% 58%)' },
]

export function AoiLayersPopup() {
  const t = useT()
  const open = useAoiPopup((s) => s.open)
  const closePopup = useAoiPopup((s) => s.closePopup)
  const activeRegion = useApp((s) => s.activeRegion)
  const activeLayer = useApp((s) => s.activeLayer)
  const setActiveLayer = useApp((s) => s.setActiveLayer)
  const region = useMemo(() => REGIONS.find((r) => r.id === activeRegion)!, [activeRegion])
  const gibs = GIBS_BY_REGION[activeRegion]

  if (!open) return null

  return (
    <Popup
      longitude={region.center[0]}
      latitude={region.center[1]}
      anchor="bottom"
      offset={18}
      closeButton={false}
      closeOnClick={false}
      closeOnMove={false}
      maxWidth="340px"
      className="aoi-popup"
    >
      <div className="relative w-[320px]">
        <button
          onClick={closePopup}
          className="absolute top-2 right-2 rounded-md p-1 text-muted-foreground hover:bg-secondary/80 hover:text-foreground transition-colors"
          aria-label="close"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="pr-6">
          <div className="text-[12px] font-medium text-muted-foreground">
            {t(`region.${region.id}.name`)}, {t(`region.${region.id}.city`)}
          </div>
          <div className="text-sm font-semibold text-foreground mt-0.5">
            {t(`region.${region.id}.phen`)}
          </div>
          <div className="text-[13px] text-muted-foreground mt-1 leading-snug">
            {t(`region.${region.id}.tagline`)}
          </div>
        </div>

        <div className="mt-3">
          <div className="text-[12px] font-medium text-muted-foreground mb-1.5">
            {t('popup.layers')}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {SAR_LAYERS.map(({ id, labelKey, icon: Icon, color }) => {
              const isActive = activeLayer === id
              return (
                <button
                  key={id}
                  onClick={() => setActiveLayer(id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[13px] font-medium transition-colors text-left',
                    isActive
                      ? 'border-primary/50 bg-primary/10 text-foreground'
                      : 'border-border/60 bg-background/40 text-muted-foreground hover:text-foreground hover:bg-background/60'
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                  <span className="truncate">{t(labelKey)}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-3">
          <div className="text-[12px] font-medium text-muted-foreground mb-1.5">
            {t('popup.aux')}
          </div>
          <div className="space-y-1">
            {gibs && (
              <div className="flex items-center gap-2 rounded-md bg-background/40 border border-border/60 px-2 py-1 text-[13px]">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: gibs.paintColor }}
                />
                <span className="text-foreground">{gibs.legendLabel}</span>
                <span className="ml-auto text-[13px] tabular-nums text-muted-foreground">{gibs.sensor}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .aoi-popup .maplibregl-popup-content {
          background: hsl(var(--popover));
          color: hsl(var(--popover-foreground));
          border: 1px solid hsl(var(--border));
          border-radius: 0.65rem;
          padding: 14px 14px;
          box-shadow: 0 20px 40px -12px rgb(0 0 0 / 0.6);
          backdrop-filter: blur(16px);
        }
        .aoi-popup .maplibregl-popup-tip {
          border-top-color: hsl(var(--border)) !important;
        }
      `}</style>
    </Popup>
  )
}
