import { useEffect, useMemo, useState } from 'react'
import { searchGranules, type AsfGranule, type AsfPlatform } from './asf'
import type { Region } from './types'

interface Result {
  data: AsfGranule[]
  platform: AsfPlatform | null
  loading: boolean
  error: string | null
}

type Outcome = Omit<Result, 'loading'>

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

async function searchRegion(region: Region): Promise<Outcome> {
  const { start, end } = windowDates()
  let error: string | null = null
  for (const { platform, processingLevel } of FALLBACK_CHAIN) {
    try {
      const data = await searchGranules({
        platform,
        processingLevel,
        bbox: region.bbox,
        start,
        end,
        maxResults: MAX_RESULTS,
      })
      if (data.length > 0) return { data, platform, error: null }
      error = null
    } catch (err) {
      error = (err as Error).message
    }
  }
  return { data: [], platform: null, error }
}

// Map, preview, popup and metadata panel all ask for the same region at once; share one search per region.
const searches = new Map<Region['id'], Promise<Outcome>>()

function granulesFor(region: Region): Promise<Outcome> {
  let search = searches.get(region.id)
  if (!search) {
    search = searchRegion(region)
    searches.set(region.id, search)
    search.then((r) => {
      if (r.error) searches.delete(region.id)
    })
  }
  return search
}

const LOADING: Result = { data: [], platform: null, loading: true, error: null }

export function useAsfGranules(region: Region): Result {
  const [settled, setSettled] = useState<{ regionId: Region['id']; outcome: Outcome } | null>(null)

  useEffect(() => {
    let cancelled = false
    granulesFor(region).then((outcome) => {
      if (!cancelled) setSettled({ regionId: region.id, outcome })
    })
    return () => {
      cancelled = true
    }
  }, [region])

  return useMemo(
    () => (settled?.regionId === region.id ? { ...settled.outcome, loading: false } : LOADING),
    [settled, region.id]
  )
}
