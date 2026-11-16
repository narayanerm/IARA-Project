import { useEffect, useState } from 'react'
import { searchGranules, type AsfGranule, type AsfPlatform } from './asf'

export interface PairResult {
  before: AsfGranule | null
  after: AsfGranule | null
  platform: AsfPlatform | null
  loading: boolean
  error: string | null
  diagnostic: string | null
}

// Prefer platforms with longest Amazon history: Sentinel-1 is daily since 2014.
const PAIR_CHAIN: Array<{ platform: AsfPlatform; processingLevel?: string }> = [
  { platform: 'Sentinel-1', processingLevel: 'GRD_HD' },
  { platform: 'ALOS-2' },
  { platform: 'NISAR' },
  { platform: 'ALOS', processingLevel: 'L1.5' },
]

function windowFor(centerIso: string, days: number) {
  const center = new Date(centerIso).getTime()
  const start = new Date(center - days * 86400_000).toISOString()
  const end = new Date(center + days * 86400_000).toISOString()
  return { start, end }
}

function closestTo(date: string, list: AsfGranule[]): AsfGranule | null {
  if (!list.length) return null
  const target = new Date(date).getTime()
  return list.reduce((best, g) => {
    const dg = Math.abs(new Date(g.startTime).getTime() - target)
    const db = Math.abs(new Date(best.startTime).getTime() - target)
    return dg < db ? g : best
  })
}

// Scene footprint is a SAR parallelogram; just testing the axis-aligned bbox of its
// outer ring is enough for the slider's purpose (if the ring's lon/lat spread
// contains the sarBbox, every pixel of the sarBbox falls inside the acquisition).
function footprintContains(g: AsfGranule, bbox: [number, number, number, number]): boolean {
  const ring = g.footprint?.coordinates?.[0] as number[][] | undefined
  if (!ring || ring.length < 3) return false
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  for (const [lon, lat] of ring) {
    if (lon < w) w = lon
    if (lon > e) e = lon
    if (lat < s) s = lat
    if (lat > n) n = lat
  }
  const pad = 0.01
  return w - pad <= bbox[0] && s - pad <= bbox[1] && e + pad >= bbox[2] && n + pad >= bbox[3]
}

// Returns a matched before/after pair that share the SAME relativeOrbit (path) and frame,
// so the geographic footprint is identical. Falls back to unconstrained match if no overlap.
export function useAsfPair(
  bbox: [number, number, number, number],
  beforeDate: string,
  afterDate: string,
  windowDays = 120
): PairResult {
  const [state, setState] = useState<PairResult>({
    before: null,
    after: null,
    platform: null,
    loading: true,
    error: null,
    diagnostic: null,
  })

  useEffect(() => {
    const ctrl = new AbortController()
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null, diagnostic: null }))

    const run = async () => {
      const bw = windowFor(beforeDate, windowDays)
      const aw = windowFor(afterDate, windowDays)

      for (const { platform, processingLevel } of PAIR_CHAIN) {
        try {
          const [rawBefore, rawAfter] = await Promise.all([
            searchGranules(
              { platform, processingLevel, bbox, start: bw.start, end: bw.end, maxResults: 40 },
              { signal: ctrl.signal }
            ),
            searchGranules(
              { platform, processingLevel, bbox, start: aw.start, end: aw.end, maxResults: 40 },
              { signal: ctrl.signal }
            ),
          ])
          if (cancelled) return
          // Filter to scenes whose footprint FULLY contains the sarBbox.  ASF's
          // search is "intersects"; a scene grazing the bbox corner passes the
          // query but shows a truncated image in the slider.  Fall back to the
          // raw list only if nothing in the band fully covers the bbox (next
          // platform in the chain gets a chance).
          const beforeFull = rawBefore.filter((g) => footprintContains(g, bbox))
          const afterFull = rawAfter.filter((g) => footprintContains(g, bbox))
          const beforeList = beforeFull.length ? beforeFull : rawBefore
          const afterList = afterFull.length ? afterFull : rawAfter
          if (!beforeList.length || !afterList.length) continue

          const afterByFrame = new Map<string, AsfGranule[]>()
          for (const g of afterList) {
            if (g.path == null || g.frame == null || !g.browseUrl) continue
            const k = `${g.path}:${g.frame}`
            const arr = afterByFrame.get(k) ?? []
            arr.push(g)
            afterByFrame.set(k, arr)
          }

          let bestBefore: AsfGranule | null = null
          let bestAfter: AsfGranule | null = null
          for (const g of beforeList) {
            if (g.path == null || g.frame == null || !g.browseUrl) continue
            const k = `${g.path}:${g.frame}`
            const matches = afterByFrame.get(k)
            if (matches && matches.length) {
              bestBefore = g
              bestAfter = closestTo(afterDate, matches)
              break
            }
          }

          if (bestBefore && bestAfter) {
            setState({
              before: bestBefore,
              after: bestAfter,
              platform,
              loading: false,
              error: null,
              diagnostic: `${platform} · path ${bestBefore.path} · frame ${bestBefore.frame} (same orbit)`,
            })
            return
          }

          // Fallback: no shared frame. Use closest-by-date on each side.
          const fbBefore = beforeList.find((g) => !!g.browseUrl) ?? null
          const fbAfter = afterList.find((g) => !!g.browseUrl) ?? null
          if (fbBefore && fbAfter) {
            setState({
              before: fbBefore,
              after: fbAfter,
              platform,
              loading: false,
              error: null,
              diagnostic: `${platform} · orbits distintas (geografia pode variar)`,
            })
            return
          }
        } catch (err) {
          if (ctrl.signal.aborted) return
          if (platform === PAIR_CHAIN[PAIR_CHAIN.length - 1].platform) {
            setState({
              before: null,
              after: null,
              platform: null,
              loading: false,
              error: (err as Error).message,
              diagnostic: null,
            })
            return
          }
        }
      }
      if (!cancelled) {
        setState({
          before: null,
          after: null,
          platform: null,
          loading: false,
          error: null,
          diagnostic: 'Sem cobertura SAR nessa janela.',
        })
      }
    }

    run()
    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [bbox[0], bbox[1], bbox[2], bbox[3], beforeDate, afterDate, windowDays])

  return state
}
