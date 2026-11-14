import { useEffect, useState } from 'react'
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import type { Bbox } from './polygon-bbox'

const WFS_URL = 'https://terrabrasilis.dpi.inpe.br/geoserver/deter-amz/ows'
const TYPE = 'deter-amz:deter_amz'

export interface DeterProps {
  gid: string
  classname: string | null
  view_date: string | null
  areamunkm: number | null
  municipality: string | null
  uf: string | null
  sensor: string | null
}

export type DeterFeature = Feature<MultiPolygon | Polygon, DeterProps>

interface Result {
  features: FeatureCollection<MultiPolygon | Polygon, DeterProps>
  loading: boolean
  error: string | null
  count: number
}

const EMPTY: FeatureCollection<MultiPolygon | Polygon, DeterProps> = {
  type: 'FeatureCollection',
  features: [],
}

const cache = new Map<string, FeatureCollection<MultiPolygon | Polygon, DeterProps>>()

function keyFor(bbox: Bbox, since: string, classes: string[]): string {
  return `${bbox.join(',')}|${since}|${classes.join(',')}`
}

// Returns DETER-Amz polygons intersecting the bbox since `sinceIso`.
// Optional filter by DETER class (e.g. 'MINERACAO', 'DESMATAMENTO_CR').
export function useDeterAlerts(
  bbox: Bbox | null,
  sinceIso = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10),
  classes: string[] = []
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
    const key = keyFor(bbox, sinceIso, classes)
    const cached = cache.get(key)
    if (cached) {
      setState({ features: cached, loading: false, error: null, count: cached.features.length })
      return
    }

    const ctrl = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))

    const [minLon, minLat, maxLon, maxLat] = bbox
    const filters = [`view_date >= '${sinceIso}'`, `BBOX(geom, ${minLon},${minLat},${maxLon},${maxLat})`]
    if (classes.length) {
      const q = classes.map((c) => `'${c}'`).join(',')
      filters.push(`classname IN (${q})`)
    }

    const url = new URL(WFS_URL)
    url.searchParams.set('service', 'WFS')
    url.searchParams.set('version', '2.0.0')
    url.searchParams.set('request', 'GetFeature')
    url.searchParams.set('typeName', TYPE)
    url.searchParams.set('outputFormat', 'application/json')
    url.searchParams.set('count', '500')
    url.searchParams.set('CQL_FILTER', filters.join(' AND '))

    fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`DETER WFS ${r.status}`))))
      .then((fc: FeatureCollection<MultiPolygon | Polygon, DeterProps>) => {
        cache.set(key, fc)
        setState({ features: fc, loading: false, error: null, count: fc.features.length })
      })
      .catch((e: Error) => {
        if (ctrl.signal.aborted) return
        setState({ features: EMPTY, loading: false, error: e.message, count: 0 })
      })

    return () => ctrl.abort()
  }, [bbox?.[0], bbox?.[1], bbox?.[2], bbox?.[3], sinceIso, classes.join(',')])

  return state
}

export function deterColor(classname: string | null): string {
  const c = (classname ?? '').toUpperCase()
  if (c.includes('MINERACAO') || c.includes('GARIMPO')) return 'hsl(0 90% 60%)'
  if (c.includes('DESMATAMENTO')) return 'hsl(28 95% 60%)'
  if (c.includes('DEGRADACAO')) return 'hsl(48 85% 55%)'
  if (c.includes('CICATRIZ') || c.includes('FOGO')) return 'hsl(348 85% 58%)'
  return 'hsl(190 85% 60%)'
}
