import { useMemo } from 'react'
import { Radar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Sidebar } from './Sidebar/Sidebar'
import { SarMap } from './Map/SarMap'
import { Legend } from './Map/Legend'
import { LayerToggle } from './Map/LayerToggle'
import { RightPanel } from './RightPanel/RightPanel'
import { Timeline } from './Timeline/Timeline'
import { ExportMenu } from './Export/ExportMenu'
import { ShareDialog } from './PublicShare/ShareDialog'
import { SarPreview } from './Map/SarPreview'
import { Layers3, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { REGIONS } from '@/lib/regions'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { LanguageToggle } from '@/components/common/LanguageToggle'

export function AppLayout() {
  const t = useT()
  const activeRegion = useApp((s) => s.activeRegion)
  const nasaOverlay = useApp((s) => s.nasaOverlay)
  const trueColorOverlay = useApp((s) => s.trueColorOverlay)
  const toggleNasaOverlay = useApp((s) => s.toggleNasaOverlay)
  const toggleTrueColorOverlay = useApp((s) => s.toggleTrueColorOverlay)
  const region = useMemo(() => REGIONS.find((r) => r.id === activeRegion)!, [activeRegion])

  return (
    <section id="app" className="h-[100svh] w-full flex flex-col bg-background">
      <div className="flex h-12 items-center justify-between border-b border-border/60 bg-card/40 backdrop-blur-xl px-4">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 ring-1 ring-primary/30">
            <Radar className="h-4 w-4 text-primary" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">
              {t('app.name')} · {t(`region.${region.id}.phen`)}
            </div>
            <div className="text-[13px] text-muted-foreground font-mono">
              {t(`region.${region.id}.city`)}
            </div>
          </div>
        </div>

        <div className="hidden md:block">
          <LayerToggle />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleNasaOverlay}
            className={cn(
              'hidden sm:inline-flex items-center gap-1.5 rounded-md border px-2.5 h-8 text-[13px] font-mono transition-colors',
              nasaOverlay
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'bg-background/40 border-border text-muted-foreground hover:text-foreground'
            )}
            aria-pressed={nasaOverlay}
          >
            <Layers3 className="h-3.5 w-3.5" />
            {t('overlay.nasa')}
          </button>
          <button
            onClick={toggleTrueColorOverlay}
            className={cn(
              'hidden lg:inline-flex items-center gap-1.5 rounded-md border px-2.5 h-8 text-[13px] font-mono transition-colors',
              trueColorOverlay
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'bg-background/40 border-border text-muted-foreground hover:text-foreground'
            )}
            aria-pressed={trueColorOverlay}
          >
            <Sun className="h-3.5 w-3.5" />
            {t('overlay.trueColor')}
          </button>
          <LanguageToggle compact />
          <Badge variant="outline" className="font-mono hidden sm:flex">
            NISAR · L-band · HH + HV
          </Badge>
          <ShareDialog />
          <ExportMenu />
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <div className="relative flex-1 min-w-0">
          <SarMap />
          <div className="absolute left-4 top-4 md:hidden">
            <LayerToggle />
          </div>
          <div className="absolute left-4 bottom-4">
            <Legend />
          </div>
          <div className="absolute left-4 right-4 bottom-4 md:left-[280px] md:right-[380px]">
            <Timeline />
          </div>
          <div className="absolute right-4 top-20 hidden md:block">
            <SarPreview />
          </div>
        </div>
        <RightPanel />
      </div>
    </section>
  )
}
