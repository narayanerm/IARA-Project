import { useEffect, useState } from 'react'
import type { FeatureCollection, Geometry } from 'geojson'

import type { CaseStudy } from '@/data/cases'

/** Per-case predicted extent GeoJSON (polygon overlays), with model metadata. */
export interface YanoExtentMeta {
  kind: 'YANO'
  total_area_km2: number
  total_hotspot_pixels: number
  buckets: { bucket: string; n_pixels: number; area_km2: number; color: string }[]
  forecast_year: number
}

export interface EnchExtentMeta {
  kind: 'ENCH'
  peak_p90_m: number
  peak_date: string
  flood_stage_m: number
  delta_over_flood_m: number
  channel_area_km2: number
  max_flood_area_km2: number
  flood_extent_km2: number
}

export interface SecaExtentMeta {
  kind: 'SECA'
  permanent_area_km2: number
  retraction_area_km2: number
  wet_threshold_db: number
  dry_threshold_db: number
}

export type ExtentMeta = YanoExtentMeta | EnchExtentMeta | SecaExtentMeta

export interface IaraExtent {
  geojson: FeatureCollection<Geometry>
  meta: ExtentMeta
}

const FILE: Record<CaseStudy['id'], string> = {
  YANO: '/analysis/data/yano-deforestation-extent.geojson',
  ENCH: '/analysis/data/ench-flood-extent.geojson',
  SECA: '/analysis/data/seca-drought-extent.geojson',
}

const cache = new Map<string, IaraExtent>()

export function useIaraExtent(caseId: CaseStudy['id']): {
  data: IaraExtent | null
  loading: boolean
  error: Error | null
} {
  const [data, setData] = useState<IaraExtent | null>(() => cache.get(caseId) ?? null)
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
      .then((json: FeatureCollection<Geometry> & { metadata?: Record<string, unknown> }) => {
        if (cancelled) return
        const meta = { kind: caseId, ...(json.metadata ?? {}) } as ExtentMeta
        const typed: IaraExtent = {
          geojson: { type: 'FeatureCollection', features: json.features ?? [] } as FeatureCollection<Geometry>,
          meta,
        }
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
