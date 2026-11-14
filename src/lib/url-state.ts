import type { ProductLayer, RegionId } from './types'
import { STEPS, type Step } from './community'

export interface UrlState {
  aoi?: RegionId
  layer?: ProductLayer
  t?: number
  polygon?: string
  /** Focused community, e.g. `ti:12` or `rib:340` (see focusKey). */
  c?: string
  step?: Step
}

const VALID_AOIS: readonly RegionId[] = ['YANO', 'ENCH', 'SECA']
const VALID_LAYERS: readonly ProductLayer[] = [
  'amplitude',
  'coherence',
  'interferogram',
  'displacement',
  'change',
]

export function readUrlState(search = window.location.search): UrlState {
  const p = new URLSearchParams(search)
  const aoi = p.get('aoi') as RegionId | null
  const layer = p.get('layer') as ProductLayer | null
  const tRaw = p.get('t')
  const polygon = p.get('polygon')
  const c = p.get('c')
  const step = p.get('step') as Step | null
  return {
    aoi: aoi && VALID_AOIS.includes(aoi) ? aoi : undefined,
    layer: layer && VALID_LAYERS.includes(layer) ? layer : undefined,
    t: tRaw && !Number.isNaN(Number(tRaw)) ? Number(tRaw) : undefined,
    polygon: polygon || undefined,
    c: c && /^(ti|rib):\d+$/.test(c) ? c : undefined,
    step: step && STEPS.includes(step) ? step : undefined,
  }
}

export function buildPermalink(state: UrlState, base = window.location.origin + window.location.pathname): string {
  const p = new URLSearchParams()
  if (state.aoi) p.set('aoi', state.aoi)
  if (state.layer) p.set('layer', state.layer)
  if (state.t !== undefined) p.set('t', String(state.t))
  if (state.polygon) p.set('polygon', state.polygon)
  if (state.c) p.set('c', state.c)
  if (state.step) p.set('step', state.step)
  const qs = p.toString()
  return qs ? `${base}?${qs}` : base
}
