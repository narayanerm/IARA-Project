import { ImageOff, Loader2, Radar } from 'lucide-react'
import type { Polygon } from 'geojson'
import type { CaseStudy, SeriesPoint } from '@/data/cases'
import { worldviewSnapshot } from '@/data/phenomena-briefing'
import { useApp } from '@/lib/store'
import { useAsfPair } from '@/lib/useAsfPair'
import { bandFor, type AsfGranule } from '@/lib/asf'
import { polygonBbox } from '@/lib/polygon-bbox'
import { useT } from '@/lib/i18n'
import { BeforeAfter } from '../Briefing/BeforeAfter'
import { RiverStageChart } from '../Briefing/RiverStageChart'
import { SarArchive } from '../Briefing/SarArchive'
import { SectionTitle, useTr } from './shared'

/** The point picked on the time series, defaulting to the latest year. */
export function useCasePoint(c: CaseStudy): SeriesPoint {
  const year = useApp((s) => s.caseYear)
  const pts = c.series.points
  return pts.find((p) => p.year === year) ?? pts[pts.length - 1]
}

// Kept to the date so both badges fit side by side on the narrow panel; the sensor goes in the caption.
function label(g: AsfGranule | null, fallback: string): string {
  return g ? g.startTime.slice(0, 10) : fallback
}

/** Radar before/after for the year picked on the time series. */
export function CaseSar({ c }: { c: CaseStudy }) {
  const t = useT()
  const tr = useTr()
  const point = useCasePoint(c)

  return (
    <div className="space-y-3 px-5 py-5">
      <div className="flex items-center gap-2">
        <Radar className="h-4 w-4" style={{ color: c.color }} />
        <SectionTitle>{t('case.sarTitle')}</SectionTitle>
        <span className="ml-auto text-[12px] font-semibold tabular-nums">{point.year}</span>
      </div>

      {point.sar ? (
        <Pair key={point.year} c={c} before={point.sar.before} after={point.sar.after} />
      ) : (
        <div className="grid aspect-[4/3] w-full place-items-center rounded-md border border-border/70 bg-background/40 p-4 text-center">
          <div className="text-[12.5px] text-muted-foreground">
            <ImageOff className="mx-auto mb-2 h-5 w-5" />
            {t('case.sarNoImage', { year: String(point.year) })}
          </div>
        </div>
      )}

      <div className="rounded-md border border-border/70 bg-background/40 p-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: c.color }}>
          {t('case.sarHow')}
        </div>
        <p className="mt-1 text-[12.5px] leading-snug text-foreground/90">{tr(c.sarReading)}</p>
      </div>

      {c.riverStage && <RiverStageChart stage={c.riverStage} activeYear={point.year} />}

      <SarArchive
        bbox={c.sarBbox}
        beforeDate={point.sar?.before ?? c.series.points[0].date ?? '2024-01-01'}
        afterDate={point.sar?.after ?? c.series.points[c.series.points.length - 1].date ?? '2026-11-01'}
      />
    </div>
  )
}

function Pair({ c, before, after }: { c: CaseStudy; before: string; after: string }) {
  const t = useT()
  const pair = useAsfPair(c.sarBbox, before, after, 45)
  const hasSar = !!pair.before?.browseUrl && !!pair.after?.browseUrl

  if (pair.loading) {
    return (
      <div className="grid aspect-[4/3] w-full place-items-center rounded-md border border-border/70 bg-background/40">
        <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('case.sarLoading')}
        </div>
      </div>
    )
  }

  return (
    <>
      <BeforeAfter
        beforeUrl={hasSar ? pair.before!.browseUrl! : worldviewSnapshot(before, c.sarBbox)}
        afterUrl={hasSar ? pair.after!.browseUrl! : worldviewSnapshot(after, c.sarBbox)}
        beforeLabel={label(hasSar ? pair.before : null, before)}
        afterLabel={label(hasSar ? pair.after : null, after)}
        beforeBbox={hasSar ? polygonBbox(pair.before!.footprint as Polygon) : c.sarBbox}
        afterBbox={hasSar ? polygonBbox(pair.after!.footprint as Polygon) : c.sarBbox}
      />
      <p className="text-[11.5px] leading-snug text-muted-foreground">
        {hasSar && pair.platform
          ? (pair.diagnostic ?? pair.platform).replace(
              pair.platform,
              `${pair.platform} (${t('case.band', { band: bandFor(pair.platform) })})`
            )
          : t('case.sarOptical')}
      </p>
    </>
  )
}
