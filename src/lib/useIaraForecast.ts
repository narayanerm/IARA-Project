import { useEffect, useState } from 'react'

import type { CaseStudy } from '@/data/cases'

type YanoHotspot = { lon: number; lat: number; risk: number }
export interface YanoForecast {
  kind: 'YANO'
  forecast_year: number
  generated_at: string
  target: string
  n_pixels: number
  thresholds: { p90: number; p95: number; p99: number }
  metrics: { test: { roc_auc: number; pr_auc: number; recall_at_top_5pct: number; precision_at_top_5pct: number } }
  hotspots: YanoHotspot[]
}

type DailyBand = { date: string; p10: number; p50: number; p90: number }
export interface EnchForecast {
  kind: 'ENCH'
  generated_at: string
  horizon_days: number
  p_exceed_29m: number
  p_exceed_30m: number
  metrics: {
    sarimax: { rmse: number; mae: number; nse: number; peak_rmse_p90: number }
    lstm: Record<string, { rmse: number; mae: number; nse: number; peak_rmse_p90: number }>
  }
  daily: DailyBand[]
}

type SecaDaily = { date: string; p10: number; p50: number; p90: number }
export interface SecaCommunity {
  id: string
  name: string
  pop: number
  threshold_m: number
  p_isolated_any_day: number
  p_isolated_30_days: number
  isolated_days: { p10: number; p50: number; p90: number; mean: number }
  daily_probability: SecaDaily[]
  metrics: { test?: { roc_auc?: number; brier?: number } }
}
export interface SecaForecast {
  kind: 'SECA'
  generated_at: string
  n_mc: number
  communities: SecaCommunity[]
}

export type IaraForecast = YanoForecast | EnchForecast | SecaForecast

const FILE: Record<CaseStudy['id'], string> = {
  YANO: '/analysis/data/yano-mining-risk.json',
  ENCH: '/analysis/data/ench-flood-forecast.json',
  SECA: '/analysis/data/seca-isolation-forecast.json',
}

const cache = new Map<string, IaraForecast>()

export function useIaraForecast(caseId: CaseStudy['id']): {
  data: IaraForecast | null
  loading: boolean
  error: Error | null
} {
  const [data, setData] = useState<IaraForecast | null>(() => cache.get(caseId) ?? null)
  const [loading, setLoading] = useState(!cache.has(caseId))
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (cache.has(caseId)) {
      setData(cache.get(caseId) ?? null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(FILE[caseId], { cache: 'force-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((json) => {
        if (cancelled) return
        const typed = { ...json, kind: caseId } as IaraForecast
        cache.set(caseId, typed)
        setData(typed)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [caseId])

  return { data, loading, error }
}
