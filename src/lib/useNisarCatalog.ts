import { useEffect, useMemo, useState } from 'react'
import { ALL_TRACKS, searchNisar, trackKey, bboxOverlap, type NisarProduct, type NisarScene } from './nisar'
import type { Region } from './types'
import { footprintInAmazon } from './amazon'
import { nisarProductFor, useApp } from './store'

type Bbox = [number, number, number, number]

interface CatalogState {
  scenes: NisarScene[]
  loading: boolean
  error: string | null
}

/** All public NISAR GCOV + GUNW products over a bbox, BETA (Oct 2025) to today. One request, cached. */
export function useNisarCatalog(bbox: Bbox): CatalogState {
  const [state, setState] = useState<CatalogState>({ scenes: [], loading: true, error: null })
  const key = bbox.join(',')

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    searchNisar({ bbox: key.split(',').map(Number) as Bbox, products: ['GCOV', 'GUNW'], maxResults: 2000 })
      .then((scenes) => {
        // The app covers the Amazon biome only.
        if (!cancelled) setState({ scenes: scenes.filter((s) => footprintInAmazon(s.footprint)), loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({ scenes: [], loading: false, error: err instanceof Error ? err.message : String(err) })
      })
    return () => {
      cancelled = true
    }
  }, [key])

  return state
}

export interface TrackGroup {
  key: string
  scenes: NisarScene[]
  /** Share of the search area covered by this track's footprint (0–1). */
  coverage: number
  dualPol: boolean
  /** Share of scenes acquired in dual-pol (HH+HV). */
  dualPolShare: number
}

export interface NisarSelection extends CatalogState {
  product: NisarProduct
  /** Area being searched: around the clicked point if set, otherwise the active region. */
  bbox: Bbox
  /** Point clicked on the map, if any. */
  point: [number, number] | null
  /** First entry is the merged series (every track, by date); then one entry per track. */
  tracks: TrackGroup[]
  track: TrackGroup | null
  scene: NisarScene | null
  index: number
}

// Coverage of the area matters most, then dual-pol (HV helps separate flooded forest), then number of dates.
function score(t: { coverage: number; dualPolShare: number; scenes: unknown[] }): number {
  return t.coverage + 0.15 * t.dualPolShare + 0.005 * t.scenes.length
}

function group(key: string, scenes: NisarScene[], bbox: Bbox): TrackGroup {
  const dual = scenes.filter((s) => s.polarizations.length > 1).length
  return {
    key,
    scenes,
    coverage: scenes.length ? Math.max(...scenes.map((s) => bboxOverlap(s, bbox))) : 0,
    dualPol: dual > 0,
    dualPolShare: scenes.length ? dual / scenes.length : 0,
  }
}

/**
 * Scenes of the active product for the active region (or the map-view area), as:
 * - "all tracks": every image in date order — the full time series (default);
 * - one group per track (same geometry, smoother animation).
 */
export function useNisarSelection(region: Region): NisarSelection {
  const point = useApp((s) => s.nisarPoint)
  const focusBbox = useApp((s) => s.focus?.bbox ?? null)
  // A clicked point is searched as a ~2 km box, so every image covering that spot is returned.
  const bbox: Bbox = point
    ? [point[0] - 0.01, point[1] - 0.01, point[0] + 0.01, point[1] + 0.01]
    : focusBbox ?? region.bbox
  const catalog = useNisarCatalog(bbox)
  const activeLayer = useApp((s) => s.activeLayer)
  const nisarTrack = useApp((s) => s.nisarTrack)
  const nisarSceneId = useApp((s) => s.nisarSceneId)
  const product = nisarProductFor(activeLayer)
  const bboxKey = bbox.join(',')

  const tracks = useMemo<TrackGroup[]>(() => {
    const b = bboxKey.split(',').map(Number) as Bbox
    const ofProduct = catalog.scenes.filter((s) => s.product === product && s.browsePng)
    if (!ofProduct.length) return []
    const byKey = new Map<string, NisarScene[]>()
    for (const s of ofProduct) {
      const k = trackKey(s)
      byKey.set(k, [...(byKey.get(k) ?? []), s])
    }
    const perTrack = [...byKey.entries()]
      .map(([k, scenes]) => group(k, scenes, b))
      .sort((x, y) => score(y) - score(x))
    // Merged series: images that actually cover the area (≥30%, else everything),
    // one per track per acquisition (drop duplicate modes of the same pass).
    const covering = new Set(perTrack.filter((t) => t.coverage >= 0.3).map((t) => t.key))
    const seen = new Set<string>()
    const merged = ofProduct
      .filter((s) => covering.size === 0 || covering.has(trackKey(s)))
      .filter((s) => {
        const k = `${trackKey(s)}|${s.date}|${s.date2 ?? ''}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      .sort((x, y) => x.startTime.localeCompare(y.startTime))
    return [group(ALL_TRACKS, merged, b), ...perTrack]
  }, [catalog.scenes, product, bboxKey])

  const track = tracks.find((t) => t.key === (nisarTrack ?? ALL_TRACKS)) ?? tracks[0] ?? null
  let index = track ? track.scenes.findIndex((s) => s.id === nisarSceneId) : -1
  if (track && index < 0) index = track.scenes.length - 1
  const scene = track && index >= 0 ? track.scenes[index] : null

  return { ...catalog, product, bbox, point, tracks, track, scene, index }
}
