import { useEffect, useState } from 'react'
import { searchGranules, type AsfGranule, type AsfPlatform } from './asf'
import type { Bbox } from './polygon-bbox'

export interface MosaicResult {
  granules: AsfGranule[]
  platform: AsfPlatform | null
  loading: boolean
  error: string | null
}

const CHAIN: Array<{ platform: AsfPlatform; processingLevel?: string; days: number }> = [
  { platform: 'NISAR', days: 365 },
  { platform: 'ALOS-2', days: 540 },
  { platform: 'Sentinel-1', processingLevel: 'GRD_HD', days: 180 },
  { platform: 'ALOS', processingLevel: 'L1.5', days: 1000 },
]

function dedupeByFrame(list: AsfGranule[]): AsfGranule[] {
  const seen = new Map<string, AsfGranule>()
  for (const g of list) {
    if (!g.browseUrl) continue
    const k = g.path != null && g.frame != null ? `${g.path}:${g.frame}` : g.id
    const prev = seen.get(k)
    if (!prev || g.startTime > prev.startTime) seen.set(k, g)
  }
  return Array.from(seen.values())
}

// Returns a mosaic of browse-eligible granules intersecting the bbox.
// Picks the best platform in the fallback chain, limited to recent coverage.
export function useAsfMosaic(bbox: Bbox | null, maxTiles = 6): MosaicResult {
  const [state, setState] = useState<MosaicResult>({
    granules: [],
    platform: null,
    loading: !!bbox,
    error: null,
  })

  useEffect(() => {
    if (!bbox) {
      setState({ granules: [], platform: null, loading: false, error: null })
      return
    }
    const ctrl = new AbortController()
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))

    const run = async () => {
      const end = new Date().toISOString()
      for (const { platform, processingLevel, days } of CHAIN) {
        try {
          const start = new Date(Date.now() - days * 86400_000).toISOString()
          const data = await searchGranules(
            {
              platform,
              processingLevel,
              bbox,
              start,
              end,
              maxResults: 60,
            },
            { signal: ctrl.signal }
          )
          if (cancelled) return
          const mosaic = dedupeByFrame(data).slice(0, maxTiles)
          if (mosaic.length > 0) {
            setState({ granules: mosaic, platform, loading: false, error: null })
            return
          }
        } catch (err) {
          if (ctrl.signal.aborted) return
          if (platform === CHAIN[CHAIN.length - 1].platform) {
            setState({
              granules: [],
              platform: null,
              loading: false,
              error: (err as Error).message,
            })
            return
          }
        }
      }
      if (!cancelled) {
        setState({ granules: [], platform: null, loading: false, error: null })
      }
    }

    run()
    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [bbox?.[0], bbox?.[1], bbox?.[2], bbox?.[3], maxTiles])

  return state
}
