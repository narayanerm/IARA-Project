import { useEffect, useState } from 'react'
import type { FeatureCollection, Point } from 'geojson'
import type { Bbox } from './polygon-bbox'

const API_URL = 'https://plataforma.alerta.mapbiomas.org/api/v2/alerts'

export interface AlertProps {
  alert_id: number | string
  area_ha: number
  detected_at: string
  classification: string | null
}

interface Result {
  features: FeatureCollection<Point, AlertProps>
  loading: boolean
  error: string | null
  count: number
}

const EMPTY: FeatureCollection<Point, AlertProps> = { type: 'FeatureCollection', features: [] }

// Approximate centroid of a MapBiomas alert as a GeoJSON Point feature.
// Returns up to `limit` most recent alerts intersecting the bbox since `since` (ISO date).
export function useMapBiomasAlerts(
  bbox: Bbox | null,
  sinceIso = new Date(Date.now() - 180 * 86400_000).toISOString().slice(0, 10),
  limit = 60
): Result {
  const [state, setState] = useState<Result>({
    features: EMPTY,
    loading: !!bbox,
    error: null,
    count: 0,
  })

  useEffect(() => {
    if (!bbox) {
      setState({ features: EMPTY, loading: false, error: null, count: 0 })
      return
    }
    const ctrl = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))

    const [minLon, minLat, maxLon, maxLat] = bbox
    const url = new URL(API_URL)
    url.searchParams.set('bbox', `${minLon},${minLat},${maxLon},${maxLat}`)
    url.searchParams.set('since', sinceIso)
    url.searchParams.set('limit', String(limit))

    fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`MapBiomas ${r.status}`))))
      .then((body: { alerts?: Array<{ id: number; lat: number; lng: number; area_ha: number; detected_at: string; classification?: string }> }) => {
        const alerts = body.alerts ?? []
        const fc: FeatureCollection<Point, AlertProps> = {
          type: 'FeatureCollection',
          features: alerts.map((a) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
            properties: {
              alert_id: a.id,
              area_ha: a.area_ha,
              detected_at: a.detected_at,
              classification: a.classification ?? null,
            },
          })),
        }
        setState({ features: fc, loading: false, error: null, count: alerts.length })
      })
      .catch((e: Error) => {
        if (ctrl.signal.aborted) return
        setState({ features: EMPTY, loading: false, error: e.message, count: 0 })
      })

    return () => ctrl.abort()
  }, [bbox?.[0], bbox?.[1], bbox?.[2], bbox?.[3], sinceIso, limit])

  return state
}
