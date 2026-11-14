import { Mountain, Satellite } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { IBGE_MALHAS_URL } from '@/lib/links'
import { CommunityPin } from '../CommunityPin'
import { SarPreview } from '../SarPreview'
import { MapToggle } from './MapToggle'

export interface OverlayLegendProps {
  terrainOn?: boolean
  onToggleTerrain?: () => void
  satelliteOn?: boolean
  onToggleSatellite?: () => void
  municipiosOn?: boolean
  onToggleMunicipios?: () => void
  municipiosLoading?: boolean
}

export function OverlayLegend({
  terrainOn,
  onToggleTerrain,
  satelliteOn,
  onToggleSatellite,
  municipiosOn,
  onToggleMunicipios,
  municipiosLoading,
}: OverlayLegendProps) {
  const t = useT()

  return (
    <div className="pointer-events-none absolute right-3 top-3 bottom-24 hidden w-[min(272px,calc(100%-24px))] sm:flex flex-col items-stretch gap-2 overflow-y-auto overscroll-contain [scrollbar-width:none]">
      <div className="pointer-events-auto glass rounded-xl px-3 py-2.5 text-[13px] text-foreground/85">
        <div className="text-[13px] font-semibold text-foreground mb-1.5">{t('community.legend')}</div>
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <CommunityPin kind="indigenous" size={22} />
            {t('community.indigenous')}
          </div>
          <div className="flex items-center gap-2">
            <CommunityPin kind="riverside" size={22} />
            {t('community.riverside')}
          </div>
          <div className="flex items-center gap-2">
            <span className="mx-[3px] inline-block h-0 w-4 border-t-2 border-dashed border-[hsl(174_72%_52%)]" />
            {t('community.reserves')}
          </div>
        </div>

        {(onToggleSatellite || onToggleTerrain) && (
          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            {onToggleSatellite && (
              <MapToggle
                icon={Satellite}
                label={t('map.satellite')}
                hint={t('map.satelliteHint')}
                on={!!satelliteOn}
                onToggle={onToggleSatellite}
              />
            )}
            {onToggleTerrain && (
              <MapToggle icon={Mountain} label={t('map.terrain')} on={!!terrainOn} onToggle={onToggleTerrain} />
            )}
          </div>
        )}
        {onToggleMunicipios && (
          <div className="mt-1.5 flex items-stretch gap-1">
            <button
              onClick={onToggleMunicipios}
              className={cn(
                'flex flex-1 items-center justify-between rounded-md border px-2 py-1 text-[12px] transition-colors',
                municipiosOn
                  ? 'border-primary/40 bg-primary/10 text-foreground'
                  : 'border-border/60 bg-background/40 text-muted-foreground hover:text-foreground'
              )}
              title="Limites municipais (IBGE Malhas, visível ao aproximar)"
            >
              <span>Municípios (IBGE)</span>
              <span className="font-mono text-[11px] text-muted-foreground/70">
                {municipiosLoading ? '…' : municipiosOn ? 'on' : 'off'}
              </span>
            </button>
            <a
              href={IBGE_MALHAS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-md border border-border/60 bg-background/40 px-2 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
              title="Documentação IBGE Malhas API"
            >
              ↗
            </a>
          </div>
        )}
      </div>

      <div className="pointer-events-auto hidden md:block">
        <SarPreview />
      </div>
    </div>
  )
}
