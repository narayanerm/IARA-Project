import { useState, useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Droplets,
  ExternalLink,
  MapPin,
  Pickaxe,
  Sun,
  Trees,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { REGIONS } from '@/lib/regions'
import type { Phenomenon } from '@/lib/types'
import { useApp, useAoiPopup } from '@/lib/store'
import { INDIGENOUS_LANDS, polygonCentroid } from '@/data/layers/indigenous-lands'
import { AFFECTED_AREAS } from '@/data/layers/affected-areas'

const ICON_BY_PHENOMENON: Record<Phenomenon, LucideIcon> = {
  mining: Pickaxe,
  flood: Droplets,
  drought: Sun,
}

export function Sidebar() {
  const [open, setOpen] = useState(true)
  const activeRegion = useApp((s) => s.activeRegion)
  const setActiveRegion = useApp((s) => s.setActiveRegion)
  const focusedTi = useApp((s) => s.focusedTi)
  const setFocusedTi = useApp((s) => s.setFocusedTi)
  const openPopup = useAoiPopup((s) => s.openPopup)

  const panorama = useMemo(() => {
    const tiCount = INDIGENOUS_LANDS.features.length
    const tiAreaKm2 = INDIGENOUS_LANDS.features.reduce(
      (s, f) => s + (f.properties.area_km2 ?? 0),
      0
    )
    const tiPopulation = INDIGENOUS_LANDS.features.reduce(
      (s, f) => s + (f.properties.population ?? 0),
      0
    )
    const miningKm2 = AFFECTED_AREAS.YANO.features
      .filter((f) => f.properties.kind === 'mining')
      .reduce((s, f) => s + f.properties.area_km2, 0)
    return { tiCount, tiAreaKm2, tiPopulation, miningKm2 }
  }, [])

  const tis = useMemo(
    () =>
      INDIGENOUS_LANDS.features
        .map((f) => ({ ...f.properties, centroid: polygonCentroid(f.geometry) }))
        .sort((a, b) => b.area_km2 - a.area_km2),
    []
  )

  return (
    <aside
      className={cn(
        'relative z-10 h-full border-r border-border/60 bg-card/40 backdrop-blur-xl transition-[width] duration-300',
        open ? 'w-[300px]' : 'w-10'
      )}
    >
      <div className="flex h-12 items-center justify-between border-b border-border/60 px-2">
        {open && (
          <div className="text-[13px] font-medium text-muted-foreground px-1">
            Panorama Amazônia
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Colapsar' : 'Expandir'}
        >
          {open ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>

      {open && (
        <div className="flex h-[calc(100%-3rem)] flex-col gap-3 overflow-y-auto p-3">
          <div className="flex gap-1.5">
            {REGIONS.map((r) => {
              const Icon = ICON_BY_PHENOMENON[r.phenomenon]
              const isActive = r.id === activeRegion
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    setActiveRegion(r.id)
                    openPopup()
                  }}
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

          <div className="grid grid-cols-2 gap-1.5">
            <StatBox
              icon={Trees}
              value={`${panorama.tiCount}`}
              label="Terras Indígenas"
            />
            <StatBox
              icon={MapPin}
              value={`${(panorama.tiAreaKm2 / 1000).toFixed(0)}k`}
              label="km² protegidos"
            />
            <StatBox
              icon={Users}
              value={`${(panorama.tiPopulation / 1000).toFixed(0)}k`}
              label="habitantes"
            />
            <StatBox
              icon={Pickaxe}
              value={`${panorama.miningKm2}`}
              label="km² garimpo em Yanomami"
            />
          </div>

          <div className="flex items-center justify-between px-1 pt-1">
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Terras Indígenas (FUNAI)
            </div>
            <div className="text-[11px] font-mono text-muted-foreground">
              {tis.length}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            {tis.map((ti) => {
              const focused = focusedTi === ti.name
              return (
                <button
                  key={ti.name}
                  onClick={() => setFocusedTi(focused ? null : ti.name)}
                  className={cn(
                    'w-full rounded-md border p-2 text-left transition-colors',
                    focused
                      ? 'bg-sar-amber/15 border-sar-amber/50 shadow-[0_0_14px_-6px_hsl(28,95%,55%)]'
                      : 'bg-background/40 border-border/60 hover:border-sar-amber/40 hover:bg-background/60'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-foreground truncate">
                        {ti.name}
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground truncate">
                        {ti.state} · {ti.year}
                      </div>
                    </div>
                    {focused && (
                      <Badge variant="outline" className="shrink-0 text-[10px] font-mono px-1.5 py-0 h-4">
                        focused
                      </Badge>
                    )}
                  </div>

                  <div className="mt-1.5 flex items-center justify-between">
                    <div className="text-[11px] font-mono text-muted-foreground">
                      {ti.area_km2.toLocaleString('pt-BR')} km²
                      {ti.population && (
                        <> · {(ti.population / 1000).toFixed(0)}k hab</>
                      )}
                    </div>
                    <a
                      href={buildAsfVertexUrl(ti.centroid)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded-sm border border-sar-cyan/40 bg-sar-cyan/10 px-1.5 py-0.5 text-[10px] font-mono text-sar-cyan hover:bg-sar-cyan/20 transition-colors"
                      title="Abrir catálogo SAR da ASF para esta TI"
                    >
                      SAR ↗
                    </a>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-auto pt-2 border-t border-border/40 text-[10px] font-mono text-muted-foreground leading-relaxed">
            Contornos TI simplificados · fonte oficial{' '}
            <a
              href="https://sistemas.funai.gov.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              FUNAI SIG
              <ExternalLink className="inline h-2.5 w-2.5 ml-0.5" />
            </a>
          </div>
        </div>
      )}
    </aside>
  )
}

function StatBox({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon
  value: string
  label: string
}) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-2">
      <div className="flex items-center gap-1 text-primary">
        <Icon className="h-3 w-3" strokeWidth={2} />
        <span className="text-base font-semibold leading-none">{value}</span>
      </div>
      <div className="text-[10px] font-mono text-muted-foreground mt-1 leading-tight">
        {label}
      </div>
    </div>
  )
}

function buildAsfVertexUrl([lon, lat]: [number, number]): string {
  const params = new URLSearchParams({
    zoom: '8',
    center: `${lon.toFixed(3)},${lat.toFixed(3)}`,
    dataset: 'SENTINEL-1',
    start: '2023-01-01T00:00:00Z',
    productTypes: 'GRD_HD',
  })
  return `https://search.asf.alaska.edu/#/?${params}`
}
