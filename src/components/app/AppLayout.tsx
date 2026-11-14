import { useMemo } from 'react'
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
      <div className="flex h-14 items-center justify-between border-b border-border/60 bg-card px-4">
        <div className="flex items-center gap-3">
          <img
            src="/marca/iara-horizontal-sem-subtitulo-escuro.svg"
            alt={t('app.name')}
            className="hidden sm:block h-6 w-auto"
          />
          <img src="/marca/iara-simbolo-escuro.svg" alt={t('app.name')} className="sm:hidden h-7 w-7" />
          <div className="hidden sm:block leading-tight border-l border-border/60 pl-3 min-w-0 whitespace-nowrap">
            <div className="text-sm font-medium">{t(`region.${region.id}.phen`)}</div>
            <div className="text-[13px] text-muted-foreground">{t(`region.${region.id}.city`)}</div>
          </div>
        </div>

        <div className="hidden md:block">
          <LayerToggle />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleNasaOverlay}
            className={cn(
              'hidden sm:inline-flex items-center gap-1.5 rounded-md border px-2.5 h-8 text-[13px] transition-colors',
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
              'hidden lg:inline-flex items-center gap-1.5 rounded-md border px-2.5 h-8 text-[13px] transition-colors',
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
          <Badge variant="outline" className="hidden xl:flex">
            NISAR L-band, HH + HV
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
