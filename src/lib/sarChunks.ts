import { useEffect, useState } from 'react'
import type { ImageCorners } from './nisar'
import type { RegionId } from './types'

// Pre-built NISAR SAR chunks (scripts/build_sar_tiles.py): the latest GCOV browse image of every
// track/frame over each case region, shrunk to WebP and served from public/sar/<region>/.
// Loading them at case open lets the SAR button show every chunk at once, with no wait.

export interface SarChunk {
  id: string
  url: string
  date: string
  track: number
  frame: number
  direction: string
  corners: ImageCorners
  coverage: number
}

interface Manifest {
  chunks: Array<Omit<SarChunk, 'url'> & { file: string }>
}

const manifests = new Map<RegionId, Promise<SarChunk[]>>()

export function loadSarChunks(region: RegionId): Promise<SarChunk[]> {
  let p = manifests.get(region)
  if (!p) {
    const base = `${import.meta.env.BASE_URL}sar/${region}/`
    p = fetch(`${base}manifest.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : { chunks: [] }))
      .then((m) => m.chunks.map(({ file, ...c }) => ({ ...c, url: base + file })))
      .catch(() => [])
    manifests.set(region, p)
  }
  return p
}

const decoded = new Map<string, Promise<void>>()

/** Fetch and decode every image of a region so switching the layer on is instant. */
export function preloadSarChunks(region: RegionId): Promise<SarChunk[]> {
  return loadSarChunks(region).then(async (chunks) => {
    await Promise.all(
      chunks.map((c) => {
        let d = decoded.get(c.url)
        if (!d) {
          const img = new Image()
          img.src = c.url
          d = img.decode().catch(() => undefined)
          decoded.set(c.url, d)
        }
        return d
      })
    )
    return chunks
  })
}

/** Chunks of a region, preloaded as soon as the region is known. */
export function useSarChunks(region: RegionId | null): { chunks: SarChunk[]; ready: boolean } {
  const [state, setState] = useState<{ region: RegionId | null; chunks: SarChunk[]; ready: boolean }>({
    region: null,
    chunks: [],
    ready: false,
  })
  useEffect(() => {
    if (!region) return
    let cancelled = false
    void loadSarChunks(region).then((chunks) => {
      if (!cancelled) setState({ region, chunks, ready: false })
    })
    void preloadSarChunks(region).then((chunks) => {
      if (!cancelled) setState({ region, chunks, ready: true })
    })
    return () => {
      cancelled = true
    }
  }, [region])
  return state.region === region ? state : { chunks: [], ready: false }
}
