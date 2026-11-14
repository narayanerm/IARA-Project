import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FunaiTiProps } from '@/lib/useFunaiTi'
import type { TiProps } from '@/data/layers/indigenous-lands'
import {
  TERRABRASILIS_FUNAI_URL,
  DETER_WFS_URL,
  ISA_TI_PORTAL,
  funaiSiciUrl,
  tiProfileUrl,
} from '@/lib/links'

export interface FocusedTiBadgeProps {
  tiName: string
  funaiProps: FunaiTiProps | null
  localProps: TiProps | null
  sourceLabel: string
  loading: boolean
  error: string | null
  deterCount: number
  deterLoading: boolean
}

export function FocusedTiBadge({
  tiName,
  funaiProps,
  localProps,
  sourceLabel,
  loading,
  error,
  deterCount,
  deterLoading,
}: FocusedTiBadgeProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="pointer-events-auto absolute left-4 bottom-24 max-w-[320px] rounded-lg border border-sar-cyan/40 bg-card/95 backdrop-blur-md shadow-xl">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-sar-cyan animate-pulse-soft" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-sar-cyan truncate">
            {tiName}
          </div>
          <div className="text-[11px] font-mono text-muted-foreground truncate">
            {loading ? 'FUNAI…' : sourceLabel.replace('FUNAI oficial · ', '')}
          </div>
        </div>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>
      {open && (
        <div className="border-t border-border/50 px-3 py-2">
          {funaiProps && (
            <div className="grid gap-0.5 text-[12px] text-foreground/90 leading-snug">
              <div>
                <span className="text-muted-foreground">Nome FUNAI:</span> {funaiProps.terrai_nom}
              </div>
              {funaiProps.etnia_nome && (
                <div>
                  <span className="text-muted-foreground">Etnia:</span> {funaiProps.etnia_nome}
                </div>
              )}
              {funaiProps.fase_ti && (
                <div>
                  <span className="text-muted-foreground">Fase:</span> {funaiProps.fase_ti}
                </div>
              )}
              <div className="text-[11px] text-muted-foreground/80">
                CÓD FUNAI {funaiProps.terrai_cod}
              </div>
            </div>
          )}
          {localProps && (
            <div className="mt-1.5 grid gap-0.5 text-[12px] text-foreground/90 leading-snug border-t border-border/50 pt-1.5">
              <div>
                <span className="text-muted-foreground">Área ISA:</span>{' '}
                {localProps.area_km2.toLocaleString('pt-BR')} km²
              </div>
              {localProps.population && (
                <div>
                  <span className="text-muted-foreground">População ISA:</span>{' '}
                  {localProps.population.toLocaleString('pt-BR')}
                </div>
              )}
            </div>
          )}
          <div className="mt-1.5 flex items-center justify-between text-[12px] border-t border-border/50 pt-1.5">
            <span className="text-muted-foreground">DETER-Amz (1 ano):</span>
            <span className="font-mono font-semibold text-foreground">
              {deterLoading ? '…' : `${deterCount} alertas`}
            </span>
          </div>
          {error && <div className="mt-1 text-[11px] text-destructive">{error}</div>}

          <div className="mt-1.5 flex flex-wrap gap-1 border-t border-border/50 pt-1.5">
            <SourceLink href={funaiSiciUrl(tiName)}>
              FUNAI · {tiName.replace(/^TI\s+/, '')}
            </SourceLink>
            {funaiProps && <SourceLink href={TERRABRASILIS_FUNAI_URL}>TerraBrasilis WFS</SourceLink>}
            {deterCount > 0 && <SourceLink href={DETER_WFS_URL}>DETER-Amz</SourceLink>}
            {localProps && <SourceLink href={tiProfileUrl(0)}>ISA · Terras Indígenas</SourceLink>}
          </div>

          <div className="mt-1 text-[10px] font-mono text-muted-foreground/70 leading-relaxed">
            Geometria:{' '}
            <a
              href={TERRABRASILIS_FUNAI_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              FUNAI via TerraBrasilis/INPE WFS
            </a>{' '}
            · Alertas:{' '}
            <a
              href={DETER_WFS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              DETER/INPE WFS
            </a>{' '}
            · Metadata:{' '}
            <a
              href={ISA_TI_PORTAL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              ISA
            </a>{' '}
            (snapshot local)
          </div>
        </div>
      )}
    </div>
  )
}

function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-full border border-sar-cyan/30 bg-sar-cyan/10 px-2 py-0.5 text-[11px] font-mono text-sar-cyan hover:bg-sar-cyan/20 transition-colors"
    >
      {children}
      <span aria-hidden="true">↗</span>
    </a>
  )
}
