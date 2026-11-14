import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ChevronDown, ExternalLink, Info, Loader2, Radar, Satellite, X } from 'lucide-react'
import { useApp, useUi } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { showRadar } from '@/lib/story'
import { REGIONS } from '@/lib/regions'
import { BRIEFINGS, worldviewSnapshot } from '@/data/phenomena-briefing'
import { AFFECTED_AREAS } from '@/data/layers/affected-areas'
import { HISTORICAL_EVENTS, peakEvent } from '@/data/historical-events'
import { useAsfPair } from '@/lib/useAsfPair'
import { bandFor, type AsfGranule, type AsfPlatform } from '@/lib/asf'
import { BeforeAfter } from './BeforeAfter'
import { EventTimeline } from './EventTimeline'
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

const STORAGE_KEY = 'curupira.briefing-dismissed'

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
  const activeRegion = useApp((s) => s.activeRegion)
  const region = useMemo(() => REGIONS.find((r) => r.id === activeRegion)!, [activeRegion])
  const briefing = BRIEFINGS[activeRegion]

  const t = useT()
  const open = useUi((s) => s.briefingOpen)
  const setOpen = useUi((s) => s.setBriefingOpen)
  const stage = useUi((s) => s.stage)
  const [source, setSource] = useState<Source>('sar')
  const [opticalLayerKey, setOpticalLayerKey] = useState<string>(
    briefing.opticalLayers[0]?.key ?? 'modis-terra'
  )
  const [selectedEventId, setSelectedEventId] = useState<string>(peakEvent(activeRegion).id)

  useEffect(() => {
    setSource('sar')
    setOpticalLayerKey(BRIEFINGS[activeRegion].opticalLayers[0]?.key ?? 'modis-terra')
    setSelectedEventId(peakEvent(activeRegion).id)
  }, [activeRegion])

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
    ? sarGranuleLabel(pair.before, pair.platform, selectedEvent.beforeDate, t('briefing.opticalShort'))
    : `${activeOptical.label}, ${selectedEvent.beforeDate}`
  const afterBadge = showSar
    ? sarGranuleLabel(pair.after, pair.platform, selectedEvent.afterDate, t('briefing.opticalShort'))
    : `${activeOptical.label}, ${selectedEvent.afterDate}`

  if (!open) return null

  return (
    <div className="pointer-events-auto w-full max-w-5xl" role="region" aria-label={briefing.title}>
      <div className="rounded-lg border border-border bg-card animate-in fade-in slide-in-from-bottom-2 duration-200 motion-reduce:animate-none">
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2.5 border-b border-border">
          <div className="flex min-w-0 flex-1 basis-[200px] items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-raised shrink-0">
              <Radar className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold truncate" title={briefing.title}>{briefing.title}</h2>
              <div className="text-[12px] tabular-nums text-muted-foreground truncate" title={`${briefing.period}, ${region.anchorCity}`}>
                {briefing.period}, {region.anchorCity}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {stage === 'case' && (
              <button
                onClick={() => showRadar()}
                className="mr-1 inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Radar className="h-4 w-4" />
                {t('briefing.toRadar')}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label={t('briefing.minimize')}
              title={t('briefing.minimize')}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              onClick={close}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label={t('briefing.close')}
              title={t('briefing.close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[55vh] overflow-y-auto">
          <section className="space-y-3">
            {showSar && pair.loading ? (
              <div className="w-full aspect-[4/3] rounded-lg border border-border bg-transparent grid place-items-center">
                <div className="flex items-center gap-2 text-[13px] tabular-nums text-muted-foreground">
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
                {t('briefing.sarReal')}
              </SourceTab>
              <SourceTab
                active={source === 'modis'}
                onClick={() => setSource('modis')}
                icon={<Satellite className="h-3 w-3" />}
              >
                {t('briefing.optical')}
              </SourceTab>
              <a
                href={briefing.externalViewer.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[12px] tabular-nums text-foreground hover:bg-raised transition-colors"
              >
                {briefing.externalViewer.label}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {!showSar && briefing.opticalLayers.length > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[12px] text-muted-foreground mr-1">
                  {t('briefing.layer')}:
                </span>
                {briefing.opticalLayers.map((o) => (
                  <button
                    key={o.key}
                    onClick={() => setOpticalLayerKey(o.key)}
                    title={o.note}
                    className={cn(
                      'rounded-sm border px-2 py-0.5 text-[12px] transition-colors',
                      opticalLayerKey === o.key
                        ? 'border-transparent bg-raised text-foreground'
                        : 'border-border bg-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}

            <p className="text-[12px] text-muted-foreground leading-snug flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
              {showSar
                ? pair.diagnostic
                  ? `${pair.diagnostic}. ${t('briefing.redPolys')}`
                  : t('briefing.noPair')
                : `${activeOptical.note ? activeOptical.note + '. ' : ''}${t('briefing.opticalNote')}`}
            </p>
          </section>

          <section className="space-y-3">
            <EventTimeline
              events={events}
              activeId={selectedEvent.id}
              onSelect={setSelectedEventId}
            />

            <div className="border-t border-border pt-3">
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-semibold text-foreground tabular-nums leading-none">
                  {selectedEvent.magnitude.value}
                </div>
                <div className="text-[13px] tabular-nums text-muted-foreground">
                  {selectedEvent.magnitude.unit}
                </div>
                <div className="ml-auto text-[12px] tabular-nums text-muted-foreground">
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

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3">
              {selectedEvent.stats.map((s, i) => (
                <StatCard key={i} value={s.value} label={s.label} source={s.source} />
              ))}
            </dl>

            <div className="space-y-2 text-[13px] text-foreground/90 leading-relaxed">
              {briefing.narrative.map((p, i) => (
                <p key={i} dangerouslySetInnerHTML={{ __html: boldifyMarkdown(p) }} />
              ))}
            </div>

            <div className="border-t border-border pt-3">
              <div className="text-[12px] font-medium text-muted-foreground mb-1">
                {t('briefing.howRadar')}
              </div>
              <div className="text-[13px] text-foreground/90 leading-snug">
                {briefing.sarReading}
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <div className="text-[12px] font-medium text-muted-foreground mb-1">
                {t('briefing.sources')}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {briefing.sources.map((src, i) => (
                  <a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-w-0 items-center gap-1 text-[12px] text-water hover:underline"
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
        'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors',
        disabled && 'opacity-40 cursor-not-allowed',
        active
          ? 'border-transparent bg-raised text-foreground'
          : 'border-border bg-transparent text-muted-foreground hover:text-foreground'
      )}
    >
      {icon}
      {children}
    </button>
  )
}

function StatCard({ value, label, source }: { value: string; label: string; source: string }) {
  return (
    <div className="flex min-w-0 flex-col-reverse">
      <dt className="text-[12px] leading-snug text-foreground/85">
        {label}
        <span className="block text-muted-foreground">{source}</span>
      </dt>
      <dd className="text-xl font-semibold leading-tight tabular-nums text-foreground">{value}</dd>
    </div>
  )
}

function sarGranuleLabel(
  g: AsfGranule | null,
  platform: AsfPlatform | null,
  fallbackDate: string,
  opticalWord: string
): string {
  if (g && platform) {
    const band = bandFor(platform)
    const d = g.startTime.slice(0, 10)
    const pol = g.polarization.join('+') || '—'
    return `${platform} ${band}-band, ${pol}, ${d}`
  }
  return `${opticalWord}, ${fallbackDate}`
}

function boldifyMarkdown(text: string): string {
  const safe = text.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return safe.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
}
