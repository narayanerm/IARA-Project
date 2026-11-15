import { ExternalLink, LineChart } from 'lucide-react'
import type { CaseForecast as CaseForecastData } from '@/data/cases'
import { useT } from '@/lib/i18n'

/**
 * Slot for the predictive model. While the model is not wired in, it states
 * what the model will read and which official forecast it will be measured against.
 */
export function CaseForecast({ forecast }: { forecast: CaseForecastData }) {
  const t = useT()
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-primary">
          <LineChart className="h-4 w-4" />
          {t('case.forecast.pending')}
        </div>
        <p className="mt-1 text-[12px] text-foreground/80 leading-snug">{t('case.forecast.pendingNote')}</p>
      </div>

      {forecast.inputs.length > 0 && (
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
            {t('case.forecast.inputs')}
          </div>
          <ul className="space-y-1 text-[13px] text-foreground/90">
            {forecast.inputs.map((i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                {i}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
          {t('case.forecast.benchmark')}
        </div>
        <a
          href={forecast.benchmark.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[13px] text-foreground/90 hover:text-primary"
        >
          {forecast.benchmark.label}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {forecast.lastSeason && (
        <div className="rounded-lg border border-border/60 bg-background/40 p-3">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            {t('case.forecast.lastSeason')}
          </div>
          <div className="mt-1 flex items-baseline gap-4">
            <div>
              <div className="text-lg font-semibold leading-none">{forecast.lastSeason.forecast}</div>
              <div className="text-[11px] text-muted-foreground">{t('case.forecast.forecast')}</div>
            </div>
            <div>
              <div className="text-lg font-semibold leading-none text-primary">{forecast.lastSeason.observed}</div>
              <div className="text-[11px] text-muted-foreground">{t('case.forecast.observed')}</div>
            </div>
          </div>
          <div className="mt-1.5 text-[12px] text-foreground/80 leading-snug">{forecast.lastSeason.note}</div>
        </div>
      )}
    </div>
  )
}
