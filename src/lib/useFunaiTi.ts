import { useEffect, useState } from 'react'
import type { Feature, MultiPolygon, Polygon } from 'geojson'

const WFS_URL = 'https://terrabrasilis.dpi.inpe.br/geoserver/prodes-legal-amz/ows'
const TYPE = 'prodes-legal-amz:indigenous_area_legal_amazon'

export interface FunaiTiProps {
  terrai_cod: number
  terrai_nom: string
  etnia_nome: string | null
  fase_ti: string | null
}

export type FunaiTiFeature = Feature<MultiPolygon | Polygon, FunaiTiProps>

interface Result {
  feature: FunaiTiFeature | null
  loading: boolean
  error: string | null
}

const cache = new Map<string, FunaiTiFeature>()

function cqlName(name: string): string {
  // Normalize common prefixes/variants so "TI Yanomami" matches "Yanomami" in FUNAI data.
  const clean = name
    .replace(/^TI\s+/i, '')
    .replace(/^Parque Indígena do\s+/i, '')
    .replace(/'/g, "''")
  return `terrai_nom ILIKE '${clean}%'`
}

async function fetchTiByName(name: string, signal?: AbortSignal): Promise<FunaiTiFeature | null> {
  const cached = cache.get(name)
  if (cached) return cached
  const url = new URL(WFS_URL)
  url.searchParams.set('service', 'WFS')
  url.searchParams.set('version', '2.0.0')
  url.searchParams.set('request', 'GetFeature')
  url.searchParams.set('typeName', TYPE)
  url.searchParams.set('outputFormat', 'application/json')
  url.searchParams.set('CQL_FILTER', cqlName(name))
  url.searchParams.set('count', '1')
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`TerraBrasilis WFS ${res.status}`)
  const body = (await res.json()) as { features?: FunaiTiFeature[] }
  const feat = body.features?.[0] ?? null
  if (feat) cache.set(name, feat)
  return feat
}

export function useFunaiTi(name: string | null): Result {
  const [state, setState] = useState<Result>({
    feature: null,
    loading: !!name,
    error: null,
  })

  useEffect(() => {
    if (!name) {
      setState({ feature: null, loading: false, error: null })
      return
    }
    const ctrl = new AbortController()
    setState({ feature: null, loading: true, error: null })
    fetchTiByName(name, ctrl.signal)
      .then((f) => setState({ feature: f, loading: false, error: null }))
      .catch((e: Error) => {
        if (ctrl.signal.aborted) return
        setState({ feature: null, loading: false, error: e.message })
      })
    return () => ctrl.abort()
  }, [name])

  return state
}
