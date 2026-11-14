import { useEffect, useState } from 'react'
import { searchGranules, type AsfGranule, type AsfPlatform } from './asf'

export interface SnapshotResult {
  granule: AsfGranule | null
  platform: AsfPlatform | null
  loading: boolean
  error: string | null
}

// Try platforms from most-preferred (NISAR L-band) to most-available (Sentinel-1 C-band).
const PLATFORM_CHAIN: Array<{ platform: AsfPlatform; processingLevel?: string }> = [
  { platform: 'NISAR' },
  { platform: 'ALOS-2' },
  { platform: 'Sentinel-1', processingLevel: 'GRD_HD' },
  { platform: 'ALOS', processingLevel: 'L1.5' },
]

function windowFor(centerIso: string, days: number) {
  const center = new Date(centerIso).getTime()
  const start = new Date(center - days * 86400_000).toISOString()
  const end = new Date(center + days * 86400_000).toISOString()
  return { start, end }
}

export function useAsfSnapshot(
  bbox: [number, number, number, number],
  centerDate: string,
  windowDays = 60
): SnapshotResult {
  const [state, setState] = useState<SnapshotResult>({
    granule: null,
    platform: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    const ctrl = new AbortController()
    let cancelled = false
    setState({ granule: null, platform: null, loading: true, error: null })

    const run = async () => {
      const { start, end } = windowFor(centerDate, windowDays)
      for (const { platform, processingLevel } of PLATFORM_CHAIN) {
        try {
          const data = await searchGranules(
            { platform, processingLevel, bbox, start, end, maxResults: 6 },
            { signal: ctrl.signal }
          )
          if (cancelled) return
          const withBrowse = data.find((g) => !!g.browseUrl) ?? data[0]
          if (withBrowse) {
            setState({ granule: withBrowse, platform, loading: false, error: null })
            return
          }
        } catch (err) {
          if (ctrl.signal.aborted) return
          if (platform === PLATFORM_CHAIN[PLATFORM_CHAIN.length - 1].platform) {
            setState({
              granule: null,
              platform: null,
              loading: false,
              error: (err as Error).message,
            })
            return
          }
        }
      }
      if (!cancelled) {
        setState({ granule: null, platform: null, loading: false, error: null })
      }
    }

    run()
    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [bbox[0], bbox[1], bbox[2], bbox[3], centerDate, windowDays])

  return state
}
