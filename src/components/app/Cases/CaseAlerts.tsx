import { Loader2, Siren, Sparkles } from 'lucide-react'
import { RISK_COLOR, type CaseStudy, type RiskLevel } from '@/data/cases'
import { useApp } from '@/lib/store'
import { useDeterAlerts } from '@/lib/useDeterAlerts'
import { useT, type TKey } from '@/lib/i18n'
import type { Bbox } from '@/lib/polygon-bbox'
import { cn } from '@/lib/utils'
import { SectionTitle, useTr } from './shared'

const LEVELS: RiskLevel[] = ['watch', 'high', 'critical']
const LEVEL_KEY: Record<RiskLevel, TKey> = {
  watch: 'case.level.watch',
  high: 'case.level.high',
  critical: 'case.level.critical',
}

// DETER window for the Yanomami case; shared with the map layer so both hit the same cached request.
export const YANO_DETER_BBOX: Bbox = [-64.2, 2.1, -62.6, 3.7]

/** Current risk, the watch zones on the map and the slot reserved for the forecast model. */
export function CaseAlerts({ c }: { c: CaseStudy }) {
  return (
    <>
      <CaseRisk c={c} />
      <CaseHotspots c={c} />
    </>
  )
}

export function CaseRisk({ c }: { c: CaseStudy }) {
  const t = useT()
  const tr = useTr()
  const deter = useDeterAlerts(c.id === 'YANO' ? YANO_DETER_BBOX : null)
  const rank = LEVELS.indexOf(c.risk.level)

  return (
    <div className="space-y-4 px-5 py-5">
      <section>
        <SectionTitle>{t('case.risk')}</SectionTitle>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="num-display text-[1.7rem] leading-none" style={{ color: RISK_COLOR[c.risk.level] }}>
            {t(LEVEL_KEY[c.risk.level])}
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-1" role="img" aria-label={`${t('case.risk')}: ${t(LEVEL_KEY[c.risk.level])}`}>
          {LEVELS.map((lv, i) => (
            <div key={lv}>
              <div
                className="h-2 rounded-full"
                style={{ background: i <= rank ? RISK_COLOR[lv] : 'hsl(var(--border))' }}
              />
              <div className={cn('mt-1 text-[10.5px]', i === rank ? 'text-foreground' : 'text-muted-foreground/70')}>
                {t(LEVEL_KEY[lv])}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2.5 text-[13px] leading-snug text-foreground/90">{tr(c.risk.summary)}</p>
      </section>

      {c.id === 'YANO' && (
        <div className="flex items-center gap-2.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12.5px]">
          {deter.loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Siren className="h-4 w-4 shrink-0 text-destructive" />
          )}
          <span className="leading-snug">
            {deter.loading
              ? t('case.deterLoading')
              : deter.error
                ? t('case.deterError')
                : deter.count
                  ? t('case.deter', { n: String(deter.count) })
                  : t('case.deterNone')}
          </span>
        </div>
      )}
    </div>
  )
}

export function CaseHotspots({ c }: { c: CaseStudy }) {
  const t = useT()
  const tr = useTr()
  const hotspotId = useApp((s) => s.hotspotId)
  const setHotspot = useApp((s) => s.setHotspot)
  const requestFlyTo = useApp((s) => s.requestFlyTo)

  return (
    <div className="space-y-5 px-5 py-5">
      <section className="space-y-2">
        <SectionTitle>{t('case.hotspots')}</SectionTitle>
        <ul className="-mx-2.5 grid divide-y divide-border/70">
          {c.hotspots.map((h) => {
            const active = hotspotId === h.id
            return (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => {
                    setHotspot(h.id)
                    requestFlyTo(h.center, Math.min(13, c.camera.zoom + 1.6))
                  }}
                  aria-pressed={active}
                  className={cn(
                    'flex w-full items-start gap-2.5 rounded-md border px-2.5 py-3 text-left transition-colors',
                    active ? 'border-border bg-secondary' : 'border-transparent hover:bg-secondary/60'
                  )}
                >
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: RISK_COLOR[h.level] }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[13.5px] font-semibold">{h.name}</span>
                      <span
                        className="ml-auto shrink-0 rounded-full px-1.5 py-px text-[10.5px] font-semibold"
                        style={{
                          color: RISK_COLOR[h.level],
                          background: `color-mix(in srgb, ${RISK_COLOR[h.level]} 16%, transparent)`,
                        }}
                      >
                        {t(LEVEL_KEY[h.level])}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">
                      {tr(h.note)}
                      {h.approx && <span className="text-muted-foreground/70"> ({t('case.approx')})</span>}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="text-[11.5px] leading-snug text-muted-foreground">{tr(c.hotspotsNote)}</p>
      </section>

      <section className="rounded-md border border-dashed border-border p-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: c.color }} />
          <span className="text-[13.5px] font-semibold">{t('case.forecast')}</span>
          <span className="ml-auto rounded-full border border-border px-2 py-px text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('case.forecastSoon')}
          </span>
        </div>
        <p className="mt-1.5 text-[12.5px] leading-snug text-muted-foreground">
          {t('case.forecastBody', { what: tr(c.series.forecast).toLowerCase() })}
        </p>
      </section>
    </div>
  )
}
