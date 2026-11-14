import { useMemo } from 'react'
import { Download, ExternalLink, FileText, Loader2, Satellite } from 'lucide-react'
import { REGIONS } from '@/lib/regions'
import { useApp } from '@/lib/store'
import { useNisarSelection } from '@/lib/useNisarCatalog'
import { ALL_TRACKS, formatBytes, trackKey, trackLabel } from '@/lib/nisar'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

// Right-panel tab: live NISAR catalog for the active region (ASF Search API).
export function NisarPanel() {
  const t = useT()
  const activeRegion = useApp((s) => s.activeRegion)
  const setScene = useApp((s) => s.setNisarScene)
  const region = useMemo(() => REGIONS.find((r) => r.id === activeRegion)!, [activeRegion])
  const sel = useNisarSelection(region)

  const stats = useMemo(() => {
    const gcov = sel.scenes.filter((s) => s.product === 'GCOV')
    const gunw = sel.scenes.filter((s) => s.product === 'GUNW')
    const tracks = new Set(sel.scenes.map((s) => `${s.track}-${s.frame}-${s.direction}`))
    const dates = sel.scenes.map((s) => s.date).sort()
    return {
      gcov: gcov.length,
      gunw: gunw.length,
      tracks: tracks.size,
      first: dates[0] ?? '—',
      last: dates[dates.length - 1] ?? '—',
    }
  }, [sel.scenes])

  const scenes = sel.track ? [...sel.track.scenes].reverse() : []

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 text-[13px]">
      <div className="flex items-center gap-2">
        <Satellite className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-[20px] leading-none">{t('nisar.title')}</h2>
        {sel.loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      <div className="text-[12px] text-muted-foreground leading-snug">{t('nisar.source')}</div>

      {sel.error && (
        <div className="rounded-md border border-destructive/50 p-2 text-destructive">
          {t('nisar.error')}: {sel.error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Stat value={stats.gcov} label="GCOV" />
        <Stat value={stats.gunw} label="GUNW" />
        <Stat value={stats.tracks} label={t('nisar.tracks')} />
      </div>
      <div className="tabular-nums text-[12px] text-muted-foreground">
        {stats.first} → {stats.last} ·{' '}
        {sel.point
          ? `${t('nisar.pointMode')} ${sel.point[1].toFixed(2)}, ${sel.point[0].toFixed(2)}`
          : t(`region.${region.id}.name`)}
      </div>

      {sel.track && (
        <div className="rounded-md border border-border bg-transparent p-2 tabular-nums text-[12px]">
          <div className="text-foreground">
            {sel.product} ·{' '}
            {sel.track.key === ALL_TRACKS ? t('nisar.allTracks') : trackLabel(sel.track.key)}
          </div>
          <div className="text-muted-foreground">
            {sel.track.scenes.length} {t('nisar.dates')} ·{' '}
            {t('nisar.coverageShare', { pct: String(Math.round(sel.track.coverage * 100)) })}
          </div>
        </div>
      )}

      <div className="text-[12px] font-medium text-muted-foreground">
        {t('nisar.list')}
      </div>
      <div className="flex flex-col gap-1.5">
        {scenes.map((s) => {
          const active = sel.scene?.id === s.id
          return (
            <div
              key={s.id}
              className={cn(
                'flex gap-2 rounded-md border p-1.5 transition-colors',
                active ? 'border-transparent bg-raised' : 'border-transparent'
              )}
            >
              <button
                onClick={() => setScene(s.id)}
                className="h-14 w-14 shrink-0 overflow-hidden rounded bg-black"
                aria-label={s.id}
              >
                {s.browseThumb && (
                  <img
                    src={s.browseThumb}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <button onClick={() => setScene(s.id)} className="text-left">
                  <div className="tabular-nums text-foreground">
                    {s.product === 'GUNW' ? `${s.date} → ${s.date2}` : s.date}
                    <span className="ml-1.5 text-[12px] text-muted-foreground">
                      {trackLabel(trackKey(s))}
                      {s.beta ? ' · BETA' : ''}
                    </span>
                  </div>
                  <div className="tabular-nums text-[12px] text-muted-foreground">
                    {s.polMode ?? '—'} · {s.polarizations.join('+') || '—'} · {formatBytes(s.sizeBytes)} ·{' '}
                    {s.crid ?? ''}
                  </div>
                </button>
                <div className="mt-1 flex flex-wrap gap-2 text-[12px]">
                  <a
                    href={s.vertexUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-water hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {t('nisar.vertex')}
                  </a>
                  {s.qaReportUrl && (
                    <a
                      href={s.qaReportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-water hover:underline"
                    >
                      <FileText className="h-3 w-3" />
                      {t('nisar.qa')}
                    </a>
                  )}
                  {s.downloadUrl && (
                    <a
                      href={s.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
                    >
                      <Download className="h-3 w-3" />
                      {t('nisar.download')}
                    </a>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {!sel.loading && scenes.length === 0 && (
          <div className="text-muted-foreground">{t('nisar.empty')}</div>
        )}
      </div>

      <div className="mt-auto text-[12px] leading-snug text-muted-foreground">{t('nisar.note')}</div>
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-md border border-border bg-transparent p-2 text-center">
      <div className="text-lg font-semibold text-foreground">{value}</div>
      <div className="text-[12px] font-medium text-muted-foreground">{label}</div>
    </div>
  )
}
