import { useEffect, useState } from 'react'
import type { FeatureCollection } from 'geojson'
import type { RegionId } from './types'

const BASE = 'https://servicodados.ibge.gov.br/api/v3/malhas/estados'

// IBGE state code per Amazon region of interest.
export const UF_CODE_BY_REGION: Record<RegionId, number> = {
  YANO: 14,  // Roraima
  ENCH: 13,  // Amazonas
  SECA: 13,  // Amazonas
}

interface Result {
  data: FeatureCollection | null
  loading: boolean
  error: string | null
}

const cache = new Map<number, FeatureCollection>()

export function useIbgeMunicipios(ufId: number | null, enabled = true): Result {
  const [state, setState] = useState<Result>({ data: null, loading: !!(ufId && enabled), error: null })

  useEffect(() => {
    if (!enabled || !ufId) {
      setState({ data: null, loading: false, error: null })
      return
    }
    const cached = cache.get(ufId)
    if (cached) {
      setState({ data: cached, loading: false, error: null })
      return
    }
    const ctrl = new AbortController()
    setState({ data: null, loading: true, error: null })

    const url = new URL(`${BASE}/${ufId}`)
    url.searchParams.set('formato', 'application/vnd.geo+json')
    url.searchParams.set('qualidade', 'minima')
    url.searchParams.set('intrarregiao', 'municipio')

    fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`IBGE ${r.status}`))))
      .then((fc: FeatureCollection) => {
        cache.set(ufId, fc)
        setState({ data: fc, loading: false, error: null })
      })
      .catch((e: Error) => {
        if (ctrl.signal.aborted) return
        setState({ data: null, loading: false, error: e.message })
      })

    return () => ctrl.abort()
  }, [ufId, enabled])

  return state
}
