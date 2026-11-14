import { useMemo } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import type { Focus } from '@/lib/community'
import { useDeterAlerts, deterColor } from '@/lib/useDeterAlerts'
import { useNisarSelection } from '@/lib/useNisarCatalog'
import { useApp } from '@/lib/store'
import { REGIONS } from '@/lib/regions'
import { DETER_URL } from '@/lib/links'
import { brandDate } from '@/lib/nisar'
import { useT, type TKey } from '@/lib/i18n'
import { NisarControl } from '../Map/NisarControl'

type AlertGroup = 'mining' | 'deforestation' | 'degradation' | 'fire' | 'other'

const GROUP_ORDER: AlertGroup[] = ['mining', 'deforestation', 'degradation', 'fire', 'other']

// Same class buckets and colours as the alert layer on the map (deterColor).
const GROUP_SAMPLE: Record<AlertGroup, string> = {
  mining: 'MINERACAO',
  deforestation: 'DESMATAMENTO',
  degradation: 'DEGRADACAO',
  fire: 'CICATRIZ_DE_QUEIMADA',
  other: '',
}

function groupOf(classname: string | null): AlertGroup {
  const c = (classname ?? '').toUpperCase()
  if (c.includes('MINERACAO') || c.includes('GARIMPO')) return 'mining'
  if (c.includes('DESMATAMENTO')) return 'deforestation'
  if (c.includes('DEGRADACAO')) return 'degradation'
  if (c.includes('CICATRIZ') || c.includes('FOGO')) return 'fire'
  return 'other'
}

/** Vigiar: what is pressing on the area now (DETER alerts) and the radar that sees through the clouds. */
export function StepWatch({ focus }: { focus: Focus }) {
  const t = useT()
  const deter = useDeterAlerts(focus.bbox)
  const activeRegion = useApp((s) => s.activeRegion)
  const region = useMemo(() => REGIONS.find((r) => r.id === activeRegion)!, [activeRegion])
  const { scene } = useNisarSelection(region)

  const groups = useMemo(() => {
    const counts = new Map<AlertGroup, number>()
    for (const f of deter.features.features) {
      const g = groupOf(f.properties.classname)
      counts.set(g, (counts.get(g) ?? 0) + 1)
    }
    return GROUP_ORDER.filter((g) => counts.has(g)).map((g) => ({ group: g, count: counts.get(g)! }))
  }, [deter.features])

  return (
    <div className="space-y-3">
      <section aria-labelledby="watch-alerts" className="rounded-lg border border-border/60 bg-background/40 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 id="watch-alerts" className="text-[14px] font-semibold text-foreground">
            {t('community.alerts')}
          </h3>
          {!deter.loading && !deter.error && (
            <span className="font-mono text-[13px] text-foreground">{deter.count.toLocaleString('pt-BR')}</span>
          )}
        </div>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{t('community.alertsScope')}</p>

        <div className="mt-2" aria-live="polite">
          {deter.loading ? (
            <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t('community.alertsLoading')}
            </p>
          ) : deter.error ? (
            <p className="text-[13px] text-sar-amber">{t('community.alertsError')}</p>
          ) : groups.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">{t('community.alertsNone')}</p>
          ) : (
            <ul className="grid gap-1">
              {groups.map(({ group, count }) => (
                <li key={group} className="flex items-center gap-2 text-[13px]">
                  <span
                    aria-hidden
                    className="h-3 w-3 shrink-0 rounded-sm"
                    style={{ background: deterColor(GROUP_SAMPLE[group]) }}
                  />
                  <span className="flex-1 text-foreground/85">{t(`community.alerts.${group}` as TKey)}</span>
                  <span className="font-mono text-foreground">{count.toLocaleString('pt-BR')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {scene?.date && deter.count > 0 && (
          <p className="mt-2 text-[12px] leading-snug text-muted-foreground">
            {t('community.alertsUntil', { date: brandDate(scene.date) })}
          </p>
        )}
        <a
          href={DETER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[12px] text-sar-cyan underline-offset-2 hover:underline"
        >
          {t('community.openDeter')}
          <ExternalLink className="h-3 w-3" />
        </a>
      </section>

      <section aria-label={t('community.radar')} className="rounded-lg border border-border/60 bg-background/40 p-3">
        <NisarControl embedded areaLabel={focus.name} />
      </section>
    </div>
  )
}
