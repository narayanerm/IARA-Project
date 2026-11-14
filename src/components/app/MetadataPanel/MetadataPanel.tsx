import { useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  Radio,
  Satellite,
  Compass,
  Clock,
  ScanLine,
  Layers,
  Hash,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { YANO_GRANULE, YANO_VALIDATION } from '@/data/mocks/yanomami-mining'
import { REGIONS } from '@/lib/regions'
import { useApp } from '@/lib/store'
import { cn, fmtNumber, fmtSigned } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { useAsfGranules } from '@/lib/useAsfGranules'
import { bandFor, type AsfGranule } from '@/lib/asf'

export function MetadataPanel() {
  const t = useT()
  const [open, setOpen] = useState(true)
  const selected = useApp((s) => s.selectedPolygon)
  const activeRegion = useApp((s) => s.activeRegion)
  const region = useMemo(() => REGIONS.find((r) => r.id === activeRegion)!, [activeRegion])
  const asf = useAsfGranules(region)
  const liveGranule = asf.data[0]

  return (
    <aside
      className={cn(
        'relative z-10 h-full border-l border-border/60 bg-card transition-[width] duration-300',
        open ? 'w-[360px]' : 'w-12'
      )}
    >
      <div className="flex h-12 items-center justify-between border-b border-border/60 px-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Collapse metadata' : 'Expand metadata'}
        >
          {open ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
        {open && (
          <div className="text-[13px] font-medium text-muted-foreground">
            {t('metadata.title')}
          </div>
        )}
      </div>

      {open && (
        <div className="flex h-[calc(100%-3rem)] flex-col gap-4 overflow-y-auto p-3">
          <SourceBadge asf={asf} />
          <GranuleBlock liveGranule={liveGranule} />
          {asf.data.length > 1 && <RecentPassesBlock granules={asf.data.slice(0, 5)} />}

          {activeRegion === 'YANO' ? (
            <>
              <Separator />
              {selected ? <SelectedPolygonBlock /> : <HintBlock />}
              <Separator />
              <ValidationBlock />
            </>
          ) : (
            <div className="rounded-lg border border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
              {t('metadata.onlyAnchor')}
            </div>
          )}
        </div>
      )}
    </aside>
  )
}

function SourceBadge({ asf }: { asf: ReturnType<typeof useAsfGranules> }) {
  const t = useT()
  if (asf.loading) {
    return (
      <Badge variant="outline" className="w-fit tabular-nums text-[12px]">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t('metadata.loadingLive')}
      </Badge>
    )
  }
  if (asf.data.length > 0 && asf.platform) {
    return (
      <Badge variant="success" className="w-fit tabular-nums text-[12px]">
        <span className="h-1.5 w-1.5 rounded-full bg-sar-jade" />
        {t('metadata.liveAsf')}, {asf.platform}
      </Badge>
    )
  }
  return (
    <Badge variant="warning" className="w-fit tabular-nums text-[12px]">
      {t('metadata.syntheticFallback')}
    </Badge>
  )
}

function GranuleBlock({ liveGranule }: { liveGranule: AsfGranule | undefined }) {
  const t = useT()
  if (liveGranule) {
    const band = inferBand(liveGranule)
    const level = liveGranule.productTypeDisplay ?? liveGranule.productType
    return (
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Satellite className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold">{t('metadata.granule')}</div>
          <Badge variant="outline" className="ml-auto tabular-nums text-[12px]">
            {level}
          </Badge>
        </div>

        <div className="space-y-2">
          <MetaRow icon={Fingerprint} label={t('metadata.id')} value={liveGranule.id} mono wrap />
          <div className="grid grid-cols-2 gap-2">
            <MetaRow icon={Radio} label={t('metadata.band')} value={`${band}-band`} />
            <MetaRow
              icon={Layers}
              label={t('metadata.pol')}
              value={liveGranule.polarization.join(', ') || '—'}
            />
            <MetaRow
              icon={Compass}
              label={t('metadata.orbit')}
              value={
                liveGranule.flightDirection
                  ? liveGranule.flightDirection[0] + liveGranule.flightDirection.slice(1).toLowerCase()
                  : '—'
              }
            />
            <MetaRow
              icon={ScanLine}
              label="Path/Frame"
              value={`${liveGranule.path ?? '—'} / ${liveGranule.frame ?? '—'}`}
            />
            <MetaRow
              icon={Clock}
              label={t('metadata.acq')}
              value={liveGranule.startTime.slice(0, 10)}
            />
            <MetaRow icon={Hash} label="Mode" value={liveGranule.beamMode ?? '—'} />
          </div>
        </div>

        <a
          href={liveGranule.vertexUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-between rounded-md bg-primary/10 hover:bg-primary/15 border border-primary/30 px-2.5 py-1.5 text-[13px] text-primary tabular-nums transition-colors"
        >
          <span>{t('metadata.viewOnAsf')}</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </section>
    )
  }

  const g = YANO_GRANULE
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Satellite className="h-4 w-4 text-primary" />
        <div className="text-sm font-semibold">{t('metadata.granule')}</div>
        <Badge variant="outline" className="ml-auto tabular-nums text-[12px]">
          {g.productLevel}
        </Badge>
      </div>

      <div className="space-y-2">
        <MetaRow icon={Fingerprint} label={t('metadata.id')} value={g.observationId} mono wrap />
        <div className="grid grid-cols-2 gap-2">
          <MetaRow icon={Radio} label={t('metadata.band')} value={`${g.band}-band`} />
          <MetaRow icon={Layers} label={t('metadata.pol')} value={g.polarizations.join(', ')} />
          <MetaRow icon={Compass} label={t('metadata.orbit')} value={g.orbitPass} />
          <MetaRow icon={ScanLine} label={t('metadata.inc')} value={`${g.incidenceAngleDeg}°`} />
          <MetaRow icon={Clock} label={t('metadata.acq')} value={g.acquisitionDate} />
          <MetaRow icon={Hash} label={t('metadata.ver')} value={g.processingVersion} />
        </div>
        {g.baselinePerpM !== undefined && (
          <div className="grid grid-cols-2 gap-2">
            <MetaRow label={t('metadata.baselinePerp')} value={`${g.baselinePerpM} m`} />
            <MetaRow label={t('metadata.baselineTemp')} value={`${g.temporalBaselineDays} d`} />
          </div>
        )}
      </div>

      <div className="mt-3 rounded-md bg-background/40 border border-border/60 px-2.5 py-1.5 text-[12px] text-muted-foreground tabular-nums">
        {g.attribution}
      </div>
      <div className="mt-2 text-[12px] text-muted-foreground leading-snug">
        {t('metadata.noLiveFooter')}
      </div>
    </section>
  )
}

function RecentPassesBlock({ granules }: { granules: AsfGranule[] }) {
  const t = useT()
  return (
    <section>
      <div className="text-[12px] font-medium text-muted-foreground mb-2">
        {t('metadata.recentPasses')}
      </div>
      <div className="space-y-1">
        {granules.map((g) => (
          <a
            key={g.id}
            href={g.vertexUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-[13px] hover:border-primary/40 hover:bg-background/60 transition-colors"
          >
            <span className="tabular-nums text-muted-foreground">{g.startTime.slice(0, 10)}</span>
            <span className="text-foreground truncate flex-1">{g.dataset}</span>
            <span className="tabular-nums text-muted-foreground">
              {g.flightDirection?.[0] ?? '?'}, {g.polarization.join('+') || '—'}
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}

function HintBlock() {
  const t = useT()
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-background/30 p-4 text-sm text-muted-foreground">
      {t('metadata.hint')}
    </div>
  )
}

function SelectedPolygonBlock() {
  const t = useT()
  const p = useApp((s) => s.selectedPolygon)!
  const trend = p.displacementMmPerYear
  const color = trend < -5 ? 'destructive' : trend > 2 ? 'success' : 'warning'

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-semibold">{p.name}</div>
          <div className="text-[13px] text-muted-foreground tabular-nums">{p.id.toUpperCase()}</div>
        </div>
        <Badge variant={color} className="tabular-nums">
          {fmtSigned(trend, 2, ' mm/' + t('legend.unit').replace('mm/', ''))}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label={t('metadata.coherence')} value={fmtNumber(p.coherence, 2)} />
        <Stat
          label={t('metadata.cumulative')}
          value={fmtSigned(p.cumulativeDisplacementMm, 1, ' mm')}
        />
      </div>

      <div className="mt-3 rounded-md bg-background/40 border border-border/60 p-2 text-[12px] text-muted-foreground tabular-nums leading-snug">
        {t('metadata.coherenceNote')}
      </div>
    </section>
  )
}

function ValidationBlock() {
  const t = useT()
  const v = YANO_VALIDATION
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="text-sm font-semibold">{t('metadata.validation')}</div>
        <Badge variant="success" className="ml-auto tabular-nums text-[12px]">
          κ = {v.cohensKappa.toFixed(2)}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label={t('metadata.precision')} value={v.precision.toFixed(2)} />
        <Stat label={t('metadata.recall')} value={v.recall.toFixed(2)} />
        <Stat label={t('metadata.f1')} value={v.f1.toFixed(2)} />
      </div>

      <div className="mt-3 text-[13px] text-muted-foreground leading-snug">
        {v.nSamples} {t('metadata.samples')}, {v.periodStart} → {v.periodEnd}
      </div>
      <div className="mt-1 text-[12px] text-muted-foreground tabular-nums">
        {t('metadata.gt')}: {v.groundTruthSource}
      </div>
    </section>
  )
}

function inferBand(g: AsfGranule): 'L' | 'S' | 'C' {
  const name = `${g.dataset ?? ''} ${g.instrument ?? ''}`.toLowerCase()
  if (name.includes('c-sar') || name.includes('sentinel-1')) return 'C'
  if (name.includes('alos') || name.includes('palsar')) return 'L'
  if (name.includes('nisar')) return 'L'
  return bandFor('Sentinel-1')
}

function MetaRow({
  icon: Icon,
  label,
  value,
  mono = false,
  wrap = false,
}: {
  icon?: React.ElementType
  label: string
  value: string
  mono?: boolean
  wrap?: boolean
}) {
  return (
    <div className="rounded-md bg-background/40 border border-border/60 px-2.5 py-1.5">
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div
        className={cn(
          'mt-0.5 text-xs text-foreground',
          mono && 'tabular-nums',
          wrap ? 'break-all' : 'truncate'
        )}
      >
        {value}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-background/40 border border-border/60 px-2.5 py-2">
      <div className="text-[12px] font-medium text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">{value}</div>
    </div>
  )
}
