import { useEffect, useMemo, useState } from 'react'
import { BookOpen, ChevronDown, ChevronUp, ExternalLink, Info, Loader2, Radar, Satellite, X } from 'lucide-react'
import { useApp } from '@/lib/store'
import { REGIONS } from '@/lib/regions'
import { BRIEFINGS, worldviewSnapshot } from '@/data/phenomena-briefing'
import { AFFECTED_AREAS } from '@/data/layers/affected-areas'
import { HISTORICAL_EVENTS, peakEvent } from '@/data/historical-events'
import { useAsfPair } from '@/lib/useAsfPair'
import { bandFor, type AsfGranule, type AsfPlatform } from '@/lib/asf'
import { BeforeAfter } from './BeforeAfter'
import { EventTimeline } from './EventTimeline'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { Polygon } from 'geojson'

type Source = 'modis' | 'sar'

function polygonBbox(poly: Polygon): [number, number, number, number] {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const ring of poly.coordinates) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return [minX, minY, maxX, maxY]
}

const STORAGE_KEY = 'iara.briefing-dismissed'

type DismissedMap = Partial<Record<string, boolean>>

function readDismissed(): DismissedMap {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeDismissed(d: DismissedMap) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(d))
  } catch {}
}

export function PhenomenonBriefing() {
  const t = useT()
  const aoiActive = useApp((s) => s.aoiActive)
  const activeRegion = useApp((s) => s.activeRegion)
  const region = useMemo(() => REGIONS.find((r) => r.id === activeRegion)!, [activeRegion])
  const briefing = BRIEFINGS[activeRegion]

  const [open, setOpen] = useState(false)
  const [source, setSource] = useState<Source>('sar')
  const [opticalLayerKey, setOpticalLayerKey] = useState<string>(
    briefing.opticalLayers[0]?.key ?? 'modis-terra'
  )
  const [selectedEventId, setSelectedEventId] = useState<string>(peakEvent(activeRegion).id)

  useEffect(() => {
    // Only auto-open the drawer when the user explicitly activates an AOI,
    // never on page load (even when tutorial was seen before).
    if (aoiActive) setOpen(true)
    setSource('sar')
    setOpticalLayerKey(BRIEFINGS[activeRegion].opticalLayers[0]?.key ?? 'modis-terra')
    setSelectedEventId(peakEvent(activeRegion).id)
  }, [activeRegion, aoiActive])

  const events = HISTORICAL_EVENTS[activeRegion]
  const selectedEvent =
    events.find((e) => e.id === selectedEventId) ?? peakEvent(activeRegion)

  const activeOptical =
    briefing.opticalLayers.find((o) => o.key === opticalLayerKey) ?? briefing.opticalLayers[0]

  const close = () => {
    setOpen(false)
    const d = readDismissed()
    d[activeRegion] = true
    writeDismissed(d)
  }

  const reopen = () => setOpen(true)

  const pair = useAsfPair(
    briefing.snapshotBbox,
    selectedEvent.beforeDate,
    selectedEvent.afterDate,
    120
  )

  const modisBeforeUrl = worldviewSnapshot(selectedEvent.beforeDate, briefing.snapshotBbox, activeOptical.layer)
  const modisAfterUrl = worldviewSnapshot(selectedEvent.afterDate, briefing.snapshotBbox, activeOptical.layer)

  const showSar = source === 'sar'
  const sarAvailable = !!pair.before?.browseUrl && !!pair.after?.browseUrl

  const beforeUrl = showSar && pair.before?.browseUrl ? pair.before.browseUrl : modisBeforeUrl
  const afterUrl = showSar && pair.after?.browseUrl ? pair.after.browseUrl : modisAfterUrl

  const beforeBbox = showSar && pair.before ? polygonBbox(pair.before.footprint) : briefing.snapshotBbox
  const afterBbox = showSar && pair.after ? polygonBbox(pair.after.footprint) : briefing.snapshotBbox

  const beforeBadge = showSar
    ? sarGranuleLabel(pair.before, pair.platform, selectedEvent.beforeDate, t)
    : `${activeOptical.label} · ${selectedEvent.beforeDate}`
  const afterBadge = showSar
    ? sarGranuleLabel(pair.after, pair.platform, selectedEvent.afterDate, t)
    : `${activeOptical.label} · ${selectedEvent.afterDate}`

  if (!aoiActive) return null

  if (!open) {
    return (
      <button
        onClick={reopen}
        className="absolute left-1/2 -translate-x-1/2 bottom-24 z-30 pointer-events-auto inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary/15 backdrop-blur-sm px-4 py-2 text-[13px] font-semibold text-primary hover:bg-primary/25 transition-all shadow-lg"
      >
        <BookOpen className="h-4 w-4" />
        {t('briefing.understand', { phen: region.phenomenonLabel.toLowerCase() })}
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
    )
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 pointer-events-auto">
      <div className="mx-auto max-w-5xl rounded-t-2xl border border-b-0 border-primary/30 bg-card/95 backdrop-blur-xl shadow-2xl animate-in slide-in-from-bottom duration-300">
        <header className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 border-b border-border/60">
          <div className="flex items-center gap-2 min-w-0">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 ring-1 ring-primary/40 shrink-0">
              <Radar className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{briefing.title}</div>
              <div className="text-[12px] font-mono text-muted-foreground truncate">
                {briefing.period} · {region.anchorCity}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label={t('briefing.minimize')}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              onClick={close}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label={t('briefing.close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[55vh] overflow-y-auto">
          <section className="space-y-3">
            {showSar && pair.loading ? (
              <div className="w-full aspect-[4/3] rounded-lg border border-border/60 bg-background/40 grid place-items-center">
                <div className="flex items-center gap-2 text-[13px] font-mono text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('briefing.loadingSar')}
                </div>
              </div>
            ) : (
              <BeforeAfter
                beforeUrl={beforeUrl}
                afterUrl={afterUrl}
                beforeLabel={beforeBadge}
                afterLabel={afterBadge}
                beforeBbox={beforeBbox}
                afterBbox={afterBbox}
                affected={AFFECTED_AREAS[activeRegion]}
              />
            )}

            <div className="flex items-center gap-1.5 flex-wrap">
              <SourceTab
                active={source === 'sar'}
                onClick={() => setSource('sar')}
                icon={<Radar className="h-3 w-3" />}
                disabled={!sarAvailable && !pair.loading}
              >
                {t('briefing.tab.sar')}
              </SourceTab>
              <SourceTab
                active={source === 'modis'}
                onClick={() => setSource('modis')}
                icon={<Satellite className="h-3 w-3" />}
              >
                {t('briefing.tab.optical')}
              </SourceTab>
              <a
                href={briefing.externalViewer.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 rounded-full border border-sar-amber/40 bg-sar-amber/10 px-2.5 py-1 text-[11px] font-mono text-sar-amber hover:bg-sar-amber/20 transition-colors"
              >
                {briefing.externalViewer.label}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {!showSar && briefing.opticalLayers.length > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mr-1">
                  {t('briefing.layer')}
                </span>
                {briefing.opticalLayers.map((o) => (
                  <button
                    key={o.key}
                    onClick={() => setOpticalLayerKey(o.key)}
                    title={o.note}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[11px] font-mono transition-colors',
                      opticalLayerKey === o.key
                        ? 'border-primary/50 bg-primary/15 text-primary'
                        : 'border-border/60 bg-background/40 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}

            <p className="text-[12px] text-muted-foreground leading-snug flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/80" />
              {showSar
                ? pair.diagnostic
                  ? t('briefing.sarWithDiag', { diag: pair.diagnostic })
                  : t('briefing.sarEmpty')
                : t('briefing.opticalNote', { note: activeOptical.note ?? '' })}
            </p>
          </section>

          <section className="space-y-3">
            <EventTimeline
              events={events}
              activeId={selectedEvent.id}
              onSelect={setSelectedEventId}
            />

            <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2">
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-semibold text-primary leading-none">
                  {selectedEvent.magnitude.value}
                </div>
                <div className="text-[13px] font-mono text-primary/80">
                  {selectedEvent.magnitude.unit}
                </div>
                <div className="ml-auto text-[11px] font-mono text-muted-foreground">
                  {selectedEvent.year}
                </div>
              </div>
              <div className="text-[12px] text-foreground/85 leading-snug mt-1">
                {selectedEvent.note}
              </div>
            </div>

            <p className="text-sm text-foreground font-medium leading-snug text-balance">
              {briefing.tagline}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {selectedEvent.stats.map((s, i) => (
                <StatCard key={i} value={s.value} label={s.label} source={s.source} />
              ))}
            </div>

            <div className="space-y-2 text-[13px] text-foreground/90 leading-relaxed">
              {briefing.narrative.map((p, i) => (
                <p key={i} dangerouslySetInnerHTML={{ __html: boldifyMarkdown(p) }} />
              ))}
            </div>

            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="text-[11px] font-mono uppercase tracking-wider text-primary mb-1">
                {t('briefing.howRadarReads')}
              </div>
              <div className="text-[13px] text-foreground/90 leading-snug">
                {briefing.sarReading}
              </div>
            </div>

            <div className="pt-1">
              <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                {t('briefing.sources')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {briefing.sources.map((src, i) => (
                  <a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] font-mono text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  >
                    {src.label}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function SourceTab({
  active,
  onClick,
  icon,
  children,
  disabled,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-mono transition-colors',
        disabled && 'opacity-40 cursor-not-allowed',
        active
          ? 'border-primary/50 bg-primary/15 text-primary'
          : 'border-border/60 bg-background/40 text-muted-foreground hover:text-foreground'
      )}
    >
      {icon}
      {children}
    </button>
  )
}

function StatCard({ value, label, source }: { value: string; label: string; source: string }) {
  return (
    <div className={cn(
      'rounded-lg border border-border/60 bg-background/40 p-2.5'
    )}>
      <div className="text-xl font-semibold text-primary leading-tight">{value}</div>
      <div className="text-[12px] text-foreground/85 leading-snug mt-0.5">{label}</div>
      <div className="text-[10px] font-mono text-muted-foreground/80 mt-1 uppercase tracking-wider">
        {source}
      </div>
    </div>
  )
}

function sarGranuleLabel(
  g: AsfGranule | null,
  platform: AsfPlatform | null,
  fallbackDate: string,
  t: ReturnType<typeof useT>
): string {
  if (g && platform) {
    const band = bandFor(platform)
    const d = g.startTime.slice(0, 10)
    const pol = g.polarization.join('+') || '—'
    return `${platform} ${band}-band · ${pol} · ${d}`
  }
  return t('briefing.opticalFallback', { date: fallbackDate })
}

function boldifyMarkdown(text: string): string {
  const safe = text.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return safe.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-primary">$1</strong>')
}
