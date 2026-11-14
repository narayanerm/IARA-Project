import { useState } from 'react'
import { ChevronDown, ExternalLink, Map as MapIcon, Mountain, Satellite, SquareDashed, type LucideIcon } from 'lucide-react'
import { useApp, useMapView } from '@/lib/store'
import { GIBS_BY_REGION, gibsMaxZoom } from '@/lib/gibs'
import { IBGE_MALHAS_URL, TERRABRASILIS_FUNAI_URL, DETER_WFS_URL, ISA_TI_PORTAL, funaiSiciUrl, tiProfileUrl } from '@/lib/links'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CommunityPin } from './CommunityPin'

/**
 * Right-column map legend: communities, SAR coverage, the NASA layer, and the
 * "Map options" toggles (satellite, terrain, municipalities), collapsed by default.
 * State lives in useMapView so this sits outside the map.
 */
export function OverlayLegend() {
  const t = useT()
  const activeRegion = useApp((s) => s.activeRegion)
  const nasaOverlay = useApp((s) => s.nasaOverlay)
  const { zoom, asfCount, coverageCount, coverageLoading, requestZoom } = useMapView()
  const gibs = GIBS_BY_REGION[activeRegion]
  const coarse = !!gibs && gibs.kind === 'raster' && zoom > gibsMaxZoom(gibs) + 1

  return (
    <div className="pointer-events-auto flex w-[280px] flex-col gap-2">
      <section className="glass rounded-lg px-3 py-2.5 text-[13px] text-foreground">
        <div className="mb-1.5 font-semibold">{t('community.legend')}</div>
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <CommunityPin kind="indigenous" size={20} />
            {t('community.indigenous')}
          </div>
          <div className="flex items-center gap-2">
            <CommunityPin kind="riverside" size={20} />
            {t('community.riverside')}
          </div>
          <div className="flex items-center gap-2">
            <span className="mx-[2px] inline-block h-0 w-4 border-t-2 border-dashed border-water" />
            {t('community.reserves')}
          </div>
        </div>

        <div className="mt-2.5 grid gap-1 border-t border-border pt-2 text-[12px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <SquareDashed className="h-3.5 w-3.5 shrink-0 text-water" aria-hidden />
            <span className="min-w-0 truncate">{t('coverage.title')}</span>
            <span className="ml-auto shrink-0 tabular-nums">{coverageLoading ? t('coverage.loading') : coverageCount}</span>
          </div>
          {asfCount > 0 && (
            <div className="flex items-center gap-1.5">
              <SquareDashed className="h-3.5 w-3.5 shrink-0 text-water" aria-hidden />
              <span className="min-w-0 truncate">{t('legend.onAoi')}</span>
              <span className="ml-auto shrink-0 tabular-nums">{asfCount}</span>
            </div>
          )}
          {nasaOverlay && gibs && (
            <div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: gibs.paintColor }} />
                <span className="min-w-0 truncate text-foreground" title={gibs.explanation}>
                  {gibs.legendLabel}
                </span>
              </div>
              <div className="mt-0.5 pl-3.5 leading-snug">{gibs.explanation}</div>
              {coarse && (
                <div className="mt-0.5 pl-3.5 leading-snug">
                  {t('overlay.coarse')}{' '}
                  <button
                    type="button"
                    onClick={() => requestZoom(gibsMaxZoom(gibs) + 0.5)}
                    className="rounded-sm font-medium text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t('overlay.zoomOut')}
                  </button>
                </div>
              )}
            </div>
          )}
          {activeRegion === 'YANO' && nasaOverlay && !gibs && <div>{t('overlay.none')}</div>}
        </div>
      </section>

      <MapOptions />
    </div>
  )
}

function MapOptions() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const v = useMapView()
  const active = [v.satelliteOn, v.terrainOn, v.municipiosOn].filter(Boolean).length
  return (
    <section className="glass rounded-lg text-[13px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MapIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
        {t('map.options')}
        {active > 0 && <span className="text-[12px] tabular-nums text-muted-foreground">({active})</span>}
        <ChevronDown className={cn('ml-auto h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="grid gap-1 border-t border-border p-2">
          <OptionRow icon={Satellite} label={t('map.satellite')} hint={t('map.satelliteHint')} on={v.satelliteOn} onToggle={v.toggleSatellite} />
          <OptionRow icon={Mountain} label={t('map.terrain')} on={v.terrainOn} onToggle={v.toggleTerrain} />
          <div className="flex items-stretch gap-1">
            <OptionRow
              icon={MapIcon}
              label={t('map.municipios')}
              hint={t('map.municipiosHint')}
              on={v.municipiosOn}
              busy={v.municipiosLoading}
              onToggle={v.toggleMunicipios}
            />
            <a
              href={IBGE_MALHAS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center rounded-md px-2 text-muted-foreground transition-colors hover:bg-raised hover:text-foreground"
              aria-label={t('map.ibgeDocs')}
              title={t('map.ibgeDocs')}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}
    </section>
  )
}

function OptionRow({
  icon: Icon,
  label,
  hint,
  on,
  busy,
  onToggle,
}: {
  icon: LucideIcon
  label: string
  hint?: string
  on: boolean
  busy?: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      title={hint}
      className={cn(
        'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        on ? 'bg-raised text-foreground' : 'text-muted-foreground hover:bg-raised hover:text-foreground'
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{label}</span>
      <span
        className={cn(
          'ml-auto h-3.5 w-6 shrink-0 rounded-full border border-border p-px transition-colors',
          on ? 'bg-water' : 'bg-transparent',
          busy && 'animate-pulse-soft'
        )}
        aria-hidden
      >
        <span className={cn('block h-2.5 w-2.5 rounded-full bg-foreground transition-transform', on && 'translate-x-2.5')} />
      </span>
    </button>
  )
}

/** Official-record card for the Indigenous Land in focus (FUNAI boundary, ISA facts, DETER alerts). */
export function FocusedTiBadge() {
  const t = useT()
  const focusedTi = useApp((s) => s.focusedTi)
  const info = useMapView((s) => s.focusedInfo)
  const [open, setOpen] = useState(false)
  if (!focusedTi || !info) return null
  const { funaiProps, localProps } = info
  const fmt = (n: number) => n.toLocaleString('en-US')
  const status = info.official ? t('ti.official') : info.loading ? t('ti.loading') : t('ti.simplified')
  return (
    <section className="pointer-events-auto glass w-[280px] rounded-lg text-[13px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
      >
        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-water" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-foreground">{focusedTi}</div>
          <div className="truncate text-[12px] text-muted-foreground">{status}</div>
        </div>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="grid gap-2 border-t border-border px-3 py-2 text-[12px] leading-snug">
          {funaiProps && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
              <dt className="text-muted-foreground">{t('ti.funaiName')}</dt>
              <dd className="min-w-0 break-words text-foreground">{funaiProps.terrai_nom}</dd>
              {funaiProps.etnia_nome && (
                <>
                  <dt className="text-muted-foreground">{t('ti.ethnicity')}</dt>
                  <dd className="min-w-0 break-words text-foreground">{funaiProps.etnia_nome}</dd>
                </>
              )}
              {funaiProps.fase_ti && (
                <>
                  <dt className="text-muted-foreground">{t('ti.phase')}</dt>
                  <dd className="min-w-0 break-words text-foreground">{funaiProps.fase_ti}</dd>
                </>
              )}
              <dt className="text-muted-foreground">{t('ti.code')}</dt>
              <dd className="tabular-nums text-foreground">{funaiProps.terrai_cod}</dd>
            </dl>
          )}
          {localProps && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 border-t border-border pt-2">
              <dt className="text-muted-foreground">{t('ti.isaArea')}</dt>
              <dd className="tabular-nums text-foreground">{fmt(localProps.area_km2)} km²</dd>
              {localProps.population && (
                <>
                  <dt className="text-muted-foreground">{t('ti.isaPop')}</dt>
                  <dd className="tabular-nums text-foreground">{fmt(localProps.population)}</dd>
                </>
              )}
            </dl>
          )}
          <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
            <span className="text-muted-foreground">{t('ti.deter')}</span>
            <span className="tabular-nums font-medium text-foreground">
              {info.deterLoading ? '…' : t('ti.alerts', { n: String(info.deterCount) })}
            </span>
          </div>
          {info.error && <div className="text-destructive">{info.error}</div>}
          <div className="grid gap-1 border-t border-border pt-2">
            <SourceRow href={funaiSiciUrl(focusedTi)} label={`FUNAI, ${focusedTi.replace(/^TI\s+/, '')}`} />
            {funaiProps && <SourceRow href={TERRABRASILIS_FUNAI_URL} label="TerraBrasilis WFS" />}
            {info.deterCount > 0 && <SourceRow href={DETER_WFS_URL} label="DETER-Amz" />}
            {localProps && <SourceRow href={tiProfileUrl(0)} label={t('ti.isaLands')} />}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {t('ti.sources')}{' '}
            <a href={ISA_TI_PORTAL} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              ISA
            </a>
          </div>
        </div>
      )}
    </section>
  )
}

function SourceRow({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 text-foreground transition-colors hover:bg-raised"
    >
      <span className="min-w-0 truncate">{label}</span>
      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
    </a>
  )
}
