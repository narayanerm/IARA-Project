import { useEffect, useState } from 'react'
import { searchGranules, type AsfGranule } from './asf'

const BRAZIL_BBOX: [number, number, number, number] = [-74, -34, -34, 6]
const DAYS_WINDOW = 10
const MAX_RESULTS = 400

const CACHE_KEY = 'sarbrasil.coverage.v2'
const CACHE_TTL_MS = 30 * 60 * 1000

interface CacheEntry {
  at: number
  data: AsfGranule[]
}

function readCache(): AsfGranule[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry
    if (Date.now() - entry.at > CACHE_TTL_MS) return null
    return entry.data
  } catch {
    return null
  }
}

function writeCache(data: AsfGranule[]) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }))
  } catch {
    /* quota exceeded */
  }
}

interface Result {
  data: AsfGranule[]
  loading: boolean
  error: string | null
}

export function useBrazilCoverage(): Result {
  const [state, setState] = useState<Result>(() => {
    const cached = typeof window !== 'undefined' ? readCache() : null
    return {
      data: cached ?? [],
      loading: !cached,
      error: null,
    }
  })

  useEffect(() => {
    if (state.data.length > 0 && !state.loading) return
    const ctrl = new AbortController()
    let cancelled = false
    const end = new Date()
    const start = new Date(end.getTime() - DAYS_WINDOW * 86400_000)

    searchGranules(
      {
        platform: 'Sentinel-1',
        processingLevel: 'GRD_HD',
        bbox: BRAZIL_BBOX,
        start: start.toISOString(),
        end: end.toISOString(),
        maxResults: MAX_RESULTS,
      },
      { signal: ctrl.signal }
    )
      .then((data) => {
        if (cancelled) return
        writeCache(data)
        setState({ data, loading: false, error: null })
      })
      .catch((err) => {
        if (ctrl.signal.aborted || cancelled) return
        setState({ data: [], loading: false, error: (err as Error).message })
      })

    return () => {
      cancelled = true
      ctrl.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return state
}
