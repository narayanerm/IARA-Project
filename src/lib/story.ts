import { useApp, useUi } from './store'
import type { ProductLayer, RegionId } from './types'
import type { FeatureCollection } from 'geojson'
import { AMAZON_BIOME } from '@/data/layers/indigenous-lands'

/** The SAR layer that tells each story best (drives the NISAR product shown on the map). */
export const TELLING_LAYER: Record<RegionId, ProductLayer> = {
  YANO: 'amplitude', // GCOV backscatter: cleared forest = sharp drop
  ENCH: 'interferogram', // GUNW phase: water level changing under the canopy
  SECA: 'amplitude', // GCOV backscatter: open water is dark, watch it shrink
}


function bboxOf(fc: FeatureCollection): [[number, number], [number, number]] {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === 'number') {
      const [x, y] = c as number[]
      w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y)
    } else if (Array.isArray(c)) c.forEach(walk)
  }
  for (const f of fc.features) if (f.geometry && 'coordinates' in f.geometry) walk(f.geometry.coordinates)
  return [[w, s], [e, n]]
}

/** Legal Amazon / biome bounds: the opening view fits these so the basin fills the map at any size. */
export const AMAZON_BOUNDS = bboxOf(AMAZON_BIOME)

/** overview → case: fly to the case and open "what happened". */
export function openCase(id: RegionId) {
  useApp.getState().setActiveRegion(id)
  const ui = useUi.getState()
  ui.setLeftOpen(false)
  ui.setBriefingOpen(true)
  ui.setStage('case')
}

/** case → radar: close the briefing, switch on the telling layer, show the caption. */
export function showRadar(opts: { keepLayer?: boolean } = {}) {
  const app = useApp.getState()
  const ui = useUi.getState()
  ui.setBriefingOpen(false)
  if (!opts.keepLayer) app.setActiveLayer(TELLING_LAYER[app.activeRegion])
  app.setNisarVisible(true)
  ui.setStage('radar')
  ui.flyToRegion()
}

/** Any use of a secondary tool (panel, layer tab, map click) moves radar → explore. */
export function markExplore() {
  const ui = useUi.getState()
  if (ui.stage === 'radar') ui.setStage('explore')
}

/** Clicking the case name in the top bar: back to the three cases. */
export function backToOverview() {
  const ui = useUi.getState()
  ui.setBriefingOpen(false)
  ui.setLeftOpen(false)
  ui.setRightOpen(false)
  ui.setStage('overview')
  ui.flyToRegion()
}
