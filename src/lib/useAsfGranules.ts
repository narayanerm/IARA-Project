import { useEffect, useState } from 'react'
import { searchGranules, type AsfGranule, type AsfPlatform } from './asf'
import type { Region } from './types'

interface Result {
  data: AsfGranule[]
  platform: AsfPlatform | null
  loading: boolean
  error: string | null
}

const FALLBACK_CHAIN: Array<{ platform: AsfPlatform; processingLevel?: string }> = [
  { platform: 'NISAR', processingLevel: 'GCOV' },
  { platform: 'Sentinel-1', processingLevel: 'GRD_HD' },
  { platform: 'ALOS-2' },
  { platform: 'ALOS', processingLevel: 'L1.5' },
]

const DAYS_WINDOW = 180
const MAX_RESULTS = 100

function windowDates() {
  const end = new Date(Math.ceil(Date.now() / 3600_000) * 3600_000)
  const start = new Date(end.getTime() - DAYS_WINDOW * 86400_000)
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

export function useAsfGranules(region: Region): Result {
  const [state, setState] = useState<Result>({
    data: [],
    platform: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    const ctrl = new AbortController()
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))

    const run = async () => {
      const { start, end } = windowDates()
      for (let i = 0; i < FALLBACK_CHAIN.length; i++) {
        const { platform, processingLevel } = FALLBACK_CHAIN[i]
        try {
          const data = await searchGranules(
            {
              platform,
              processingLevel,
              bbox: region.bbox,
              start,
              end,
              maxResults: MAX_RESULTS,
            },
            { signal: ctrl.signal }
          )
          if (cancelled) return
          if (data.length > 0) {
            setState({ data, platform, loading: false, error: null })
            return
          }
        } catch (err) {
          if (ctrl.signal.aborted) return
          if (i === FALLBACK_CHAIN.length - 1) {
            setState({
              data: [],
              platform: null,
              loading: false,
              error: (err as Error).message,
            })
            return
          }
        }
      }
      if (!cancelled) {
        setState({ data: [], platform: null, loading: false, error: null })
      }
    }

    run()
    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [region])

  return state
}
