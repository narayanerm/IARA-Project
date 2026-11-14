import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useI18n, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { FunaiTiProps } from '@/lib/useFunaiTi'
import type { TiProps } from '@/data/layers/indigenous-lands'
import {
  TERRABRASILIS_FUNAI_URL,
  DETER_WFS_URL,
  ISA_TI_PORTAL,
  tiProfileUrl,
} from '@/lib/links'
import {
  FUNAI_OFFICES_URL,
  formatOfficialDate,
  landRecord,
  useOfficialRecords,
} from '@/lib/officialRecords'

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
  const t = useT()
  const locale = useI18n((s) => (s.lang === 'en' ? 'en-US' : 'pt-BR'))
  const [open, setOpen] = useState(false)
  const official = landRecord(useOfficialRecords(), tiName)
  const homologated = formatOfficialDate(official?.funai?.homologated)
  const office = official?.office
  const isaId = official?.isaId ?? null
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
            {loading ? t('focusedTi.funaiLoading') : sourceLabel.replace('FUNAI oficial · ', '')}
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
                <span className="text-muted-foreground">{t('focusedTi.funaiName')}:</span> {funaiProps.terrai_nom}
              </div>
              {funaiProps.etnia_nome && (
                <div>
                  <span className="text-muted-foreground">{t('focusedTi.ethnicity')}:</span> {funaiProps.etnia_nome}
                </div>
              )}
              {funaiProps.fase_ti && (
                <div>
                  <span className="text-muted-foreground">{t('focusedTi.phase')}:</span> {funaiProps.fase_ti}
                </div>
              )}
              <div className="text-[11px] text-muted-foreground/80">
                {t('focusedTi.funaiCode')} {funaiProps.terrai_cod}
              </div>
            </div>
          )}
          {official && (
            <div className="mt-1.5 grid gap-0.5 text-[12px] text-foreground/90 leading-snug border-t border-border/50 pt-1.5">
              {official.funai?.areaKm2 != null && (
                <div>
                  <span className="text-muted-foreground">{t('focusedTi.officialArea')}:</span>{' '}
                  {official.funai.areaKm2.toLocaleString(locale)} km²
                </div>
              )}
              {homologated && (
                <div>
                  <span className="text-muted-foreground">{t('focusedTi.ratifiedOn')}:</span> {homologated}
                </div>
              )}
              {official.census2022?.residents != null && (
                <div>
                  <span className="text-muted-foreground">{t('focusedTi.residentsCensus')}:</span>{' '}
                  {official.census2022.residents.toLocaleString(locale)}
                </div>
              )}
            </div>
          )}
          {!official && localProps && (
            <div className="mt-1.5 grid gap-0.5 text-[12px] text-foreground/90 leading-snug border-t border-border/50 pt-1.5">
              <div>
                <span className="text-muted-foreground">{t('focusedTi.isaArea')}:</span>{' '}
                {localProps.area_km2.toLocaleString(locale)} km²
              </div>
              {localProps.population && (
                <div>
                  <span className="text-muted-foreground">{t('focusedTi.isaPopulation')}:</span>{' '}
                  {localProps.population.toLocaleString(locale)}
                </div>
              )}
            </div>
          )}
          <div className="mt-1.5 flex items-center justify-between text-[12px] border-t border-border/50 pt-1.5">
            <span className="text-muted-foreground">{t('focusedTi.deter')}:</span>
            <span className="font-mono font-semibold text-foreground">
              {deterLoading ? '…' : t('focusedTi.alerts', { n: String(deterCount) })}
            </span>
          </div>
          {error && <div className="mt-1 text-[11px] text-destructive">{error}</div>}

          <div className="mt-1.5 flex flex-wrap gap-1 border-t border-border/50 pt-1.5">
            <SourceLink href={office?.url ?? FUNAI_OFFICES_URL}>
              {office?.name ? t('focusedTi.funaiOfficeCr', { name: office.name }) : t('focusedTi.funaiOfficesShort')}
            </SourceLink>
            {funaiProps && <SourceLink href={TERRABRASILIS_FUNAI_URL}>TerraBrasilis WFS</SourceLink>}
            {deterCount > 0 && <SourceLink href={DETER_WFS_URL}>DETER-Amz</SourceLink>}
            {isaId != null && <SourceLink href={tiProfileUrl(isaId)}>{t('focusedTi.isaLands')}</SourceLink>}
          </div>

          <div className="mt-1 text-[10px] font-mono text-muted-foreground/70 leading-relaxed">
            {t('focusedTi.geometry')}:{' '}
            <a
              href={TERRABRASILIS_FUNAI_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              FUNAI via TerraBrasilis/INPE WFS
            </a>{' '}
            · {t('focusedTi.alertsLabel')}:{' '}
            <a
              href={DETER_WFS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              DETER/INPE WFS
            </a>{' '}
            · {t('focusedTi.metadataLabel')}:{' '}
            <a
              href={ISA_TI_PORTAL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              ISA
            </a>{' '}
            {t('focusedTi.snapshot')}
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
