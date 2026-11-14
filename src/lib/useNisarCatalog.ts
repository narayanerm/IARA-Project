import { useEffect, useMemo, useState } from 'react'
import { searchNisar, trackKey, bboxOverlap, type NisarProduct, type NisarScene } from './nisar'
import type { Region } from './types'
import { nisarProductFor, useApp } from './store'

interface CatalogState {
  scenes: NisarScene[]
  loading: boolean
  error: string | null
}

/** All public NISAR GCOV + GUNW products over a region since the PROVISIONAL release (one request, cached). */
export function useNisarCatalog(region: Region): CatalogState {
  const [state, setState] = useState<CatalogState>({ scenes: [], loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    searchNisar({ bbox: region.bbox, products: ['GCOV', 'GUNW'], maxResults: 2000 })
      .then((scenes) => {
        if (!cancelled) setState({ scenes, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({ scenes: [], loading: false, error: err instanceof Error ? err.message : String(err) })
      })
    return () => {
      cancelled = true
    }
  }, [region])

  return state
}

export interface TrackGroup {
  key: string
  scenes: NisarScene[]
  /** Share of the region bbox covered by this track's footprint (0–1). */
  coverage: number
  dualPol: boolean
  /** Share of scenes acquired in dual-pol (HH+HV). */
  dualPolShare: number
}

// Coverage of the region matters most, then dual-pol (HV helps separate flooded forest), then number of dates.
function score(t: { coverage: number; dualPolShare: number; scenes: unknown[] }): number {
  return t.coverage + 0.15 * t.dualPolShare + 0.005 * t.scenes.length
}

export interface NisarSelection extends CatalogState {
  product: NisarProduct
  tracks: TrackGroup[]
  track: TrackGroup | null
  scene: NisarScene | null
  index: number
}

/**
 * Scenes of the active product grouped by track (same geometry, so they can be animated),
 * plus the currently selected track and scene from the store.
 * Default track = best coverage of the region, then most dates.
 */
export function useNisarSelection(region: Region): NisarSelection {
  const catalog = useNisarCatalog(region)
  const activeLayer = useApp((s) => s.activeLayer)
  const nisarTrack = useApp((s) => s.nisarTrack)
  const nisarSceneId = useApp((s) => s.nisarSceneId)
  const product = nisarProductFor(activeLayer)

  const tracks = useMemo<TrackGroup[]>(() => {
    const byKey = new Map<string, NisarScene[]>()
    for (const s of catalog.scenes) {
      if (s.product !== product) continue
      const k = trackKey(s)
      byKey.set(k, [...(byKey.get(k) ?? []), s])
    }
    return [...byKey.entries()]
      .map(([key, scenes]) => {
        const dual = scenes.filter((s) => s.polarizations.length > 1).length
        return {
          key,
          scenes,
          coverage: Math.max(...scenes.map((s) => bboxOverlap(s, region.bbox))),
          dualPol: dual > 0,
          dualPolShare: dual / scenes.length,
        }
      })
      .sort((a, b) => score(b) - score(a))
  }, [catalog.scenes, product, region.bbox])

  const track = tracks.find((t) => t.key === nisarTrack) ?? tracks[0] ?? null
  let index = track ? track.scenes.findIndex((s) => s.id === nisarSceneId) : -1
  if (track && index < 0) index = track.scenes.length - 1
  const scene = track && index >= 0 ? track.scenes[index] : null

  return { ...catalog, product, tracks, track, scene, index }
}
