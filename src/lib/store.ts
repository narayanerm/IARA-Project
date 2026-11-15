import { create } from 'zustand'
import type { ProductLayer, RegionId, SubsidencePolygon } from './types'
import type { NisarProduct } from './nisar'
import { FEATURES } from './features'

interface AppState {
  activeRegion: RegionId
  activeLayer: ProductLayer
  timeIndex: number
  selectedPolygon: SubsidencePolygon | null
  nasaOverlay: boolean
  trueColorOverlay: boolean
  focusedTi: string | null
  flyTarget: { center: [number, number]; zoom?: number; ts: number } | null
  /** Bumped to fly the camera back to the active case area. */
  recenterTick: number
  aoiActive: boolean
  // Live NISAR imagery (browse images from the ASF/Vertex API, no download)
  nisarVisible: boolean
  nisarTrack: string | null
  nisarSceneId: string | null
  nisarOpacity: number
  /** Point clicked on the map (Amazon only); null = use the active region. */
  nisarPoint: [number, number] | null
  /** Short message for the NISAR control (e.g. click outside the Amazon). */
  nisarNotice: string | null
  setActiveRegion: (id: RegionId) => void
  setActiveLayer: (l: ProductLayer) => void
  setTimeIndex: (i: number) => void
  selectPolygon: (p: SubsidencePolygon | null) => void
  toggleNasaOverlay: () => void
  toggleTrueColorOverlay: () => void
  setFocusedTi: (name: string | null) => void
  requestFlyTo: (center: [number, number], zoom?: number) => void
  recenter: () => void
  clearAoi: () => void
  setNisarVisible: (v: boolean) => void
  setNisarTrack: (k: string | null) => void
  setNisarScene: (id: string | null) => void
  setNisarOpacity: (o: number) => void
  setNisarProduct: (p: NisarProduct) => void
  setNisarPoint: (p: [number, number] | null) => void
  setNisarNotice: (n: string | null) => void
}

/** NISAR product shown on the map follows the layer toggle: Interferogram → GUNW, anything else → GCOV. */
export function nisarProductFor(layer: ProductLayer): NisarProduct {
  return layer === 'interferogram' ? 'GUNW' : 'GCOV'
}

export const useApp = create<AppState>((set, get) => ({
  activeRegion: 'YANO',
  activeLayer: 'change',
  timeIndex: 23,
  selectedPolygon: null,
  nasaOverlay: FEATURES.nasaOverlay,
  trueColorOverlay: false,
  focusedTi: null,
  flyTarget: null,
  recenterTick: 0,
  aoiActive: false,
  nisarVisible: true,
  nisarTrack: null,
  nisarSceneId: null,
  nisarOpacity: 0.85,
  nisarPoint: null,
  nisarNotice: null,
  setActiveRegion: (id) => {
    set({
      activeRegion: id,
      aoiActive: true,
      focusedTi: null,
      nisarTrack: null,
      nisarSceneId: null,
      nisarPoint: null,
      nisarNotice: null,
    })
  },
  clearAoi: () => set({ aoiActive: false, focusedTi: null }),
  setActiveLayer: (l) => {
    const changed = nisarProductFor(l) !== nisarProductFor(get().activeLayer)
    set(changed ? { activeLayer: l, nisarTrack: null, nisarSceneId: null } : { activeLayer: l })
  },
  setTimeIndex: (i) => set({ timeIndex: i }),
  selectPolygon: (p) => set({ selectedPolygon: p }),
  toggleNasaOverlay: () => set({ nasaOverlay: !get().nasaOverlay }),
  toggleTrueColorOverlay: () => set({ trueColorOverlay: !get().trueColorOverlay }),
  setFocusedTi: (name) => set({ focusedTi: name }),
  requestFlyTo: (center, zoom) => set({ flyTarget: { center, zoom, ts: Date.now() } }),
  recenter: () => set({ recenterTick: get().recenterTick + 1 }),
  setNisarVisible: (v) => set({ nisarVisible: v }),
  setNisarTrack: (k) => set({ nisarTrack: k, nisarSceneId: null }),
  setNisarScene: (id) => set({ nisarSceneId: id }),
  setNisarOpacity: (o) => set({ nisarOpacity: o }),
  setNisarProduct: (p) => get().setActiveLayer(p === 'GUNW' ? 'interferogram' : 'amplitude'),
  setNisarPoint: (pt) =>
    set({ nisarPoint: pt, nisarTrack: null, nisarSceneId: null, nisarNotice: null, nisarVisible: true }),
  setNisarNotice: (n) => set({ nisarNotice: n }),
}))

interface PopupState {
  open: boolean
  openPopup: () => void
  closePopup: () => void
}

export const useAoiPopup = create<PopupState>((set) => ({
  open: true,
  openPopup: () => set({ open: true }),
  closePopup: () => set({ open: false }),
}))

/* ------------------------------------------------------------------ */
/* Right panel and floating ask bar                                     */
/* ------------------------------------------------------------------ */

export type RightTab = 'nisar' | 'chat' | 'meta'

interface UiState {
  rightOpen: boolean
  rightTab: RightTab
  askQueue: { text: string; ts: number } | null
  popupOpen: boolean
  /** Start screen where the user picks a case study (mining, flood, drought). */
  caseSelectOpen: boolean
  /** What the background map shows inside the case area: recent optical mosaic or a radar scene. */
  caseImagery: 'satellite' | 'sar'
  /** Radar image the map shows in SAR mode (cropped to the case area). */
  sarMapScene: { url: string; date: string; mission: string } | null
  /** Sentinel-2 image closest in time to the radar image (satellite mode). Null = yearly mosaic. */
  opticalMapScene: { url: string; date: string; cloud: number } | null
  /** Scene picked as "after" in the case panel; the map follows it. Null = latest NISAR scene. */
  sarMapPickId: string | null
  setRightOpen: (v: boolean) => void
  openRight: (tab?: RightTab) => void
  ask: (text: string) => void
  clearAsk: () => void
  setPopupOpen: (v: boolean) => void
  setCaseSelectOpen: (v: boolean) => void
  setCaseImagery: (v: 'satellite' | 'sar') => void
  setSarMapScene: (s: { url: string; date: string; mission: string } | null) => void
  setSarMapPickId: (id: string | null) => void
  setOpticalMapScene: (s: { url: string; date: string; cloud: number } | null) => void
}

export const useUi = create<UiState>((set, get) => ({
  rightOpen: false,
  rightTab: 'chat',
  askQueue: null,
  popupOpen: false,
  caseSelectOpen: false,
  caseImagery: 'satellite',
  sarMapScene: null,
  sarMapPickId: null,
  opticalMapScene: null,
  setRightOpen: (v) => set({ rightOpen: v }),
  openRight: (tab) => set({ rightOpen: true, rightTab: tab ?? get().rightTab }),
  ask: (text) => set({ askQueue: { text, ts: Date.now() }, rightOpen: true, rightTab: 'chat' }),
  clearAsk: () => set({ askQueue: null }),
  setPopupOpen: (v) => set({ popupOpen: v }),
  setCaseSelectOpen: (v) => set({ caseSelectOpen: v }),
  setCaseImagery: (v) => set({ caseImagery: v }),
  setSarMapPickId: (id) => set({ sarMapPickId: id }),
  setOpticalMapScene: (s) => set({ opticalMapScene: s }),
  setSarMapScene: (s) =>
    set((cur) => (cur.sarMapScene?.url === s?.url ? cur : { sarMapScene: s })),
}))
