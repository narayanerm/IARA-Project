import { create } from 'zustand'
import type { ProductLayer, RegionId, SubsidencePolygon } from './types'
import type { NisarProduct } from './nisar'

interface AppState {
  activeRegion: RegionId
  activeLayer: ProductLayer
  timeIndex: number
  selectedPolygon: SubsidencePolygon | null
  nasaOverlay: boolean
  trueColorOverlay: boolean
  focusedTi: string | null
  flyTarget: { center: [number, number]; zoom?: number; ts: number } | null
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
  /** Year picked on the case time series; null = latest. */
  caseYear: number | null
  /** Risk hotspot highlighted on the map and in the alerts list. */
  hotspotId: string | null
  /** True once the camera has finished flying into the active case. */
  caseArrived: boolean
  /** Bumped by the home button to put the camera back on the case framing. */
  homeTs: number
  requestHome: () => void
  setCaseArrived: (v: boolean) => void
  setCaseYear: (y: number | null) => void
  setHotspot: (id: string | null) => void
  setActiveRegion: (id: RegionId) => void
  setActiveLayer: (l: ProductLayer) => void
  setTimeIndex: (i: number) => void
  selectPolygon: (p: SubsidencePolygon | null) => void
  toggleNasaOverlay: () => void
  toggleTrueColorOverlay: () => void
  setFocusedTi: (name: string | null) => void
  requestFlyTo: (center: [number, number], zoom?: number) => void
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
  nasaOverlay: false,
  trueColorOverlay: false,
  focusedTi: null,
  flyTarget: null,
  aoiActive: false,
  // SAR starts off; the SAR button turns the pre-built chunks on.
  nisarVisible: false,
  nisarTrack: null,
  nisarSceneId: null,
  nisarOpacity: 0.85,
  nisarPoint: null,
  nisarNotice: null,
  caseYear: null,
  hotspotId: null,
  caseArrived: false,
  homeTs: 0,
  requestHome: () => set({ homeTs: Date.now(), hotspotId: null }),
  setCaseArrived: (v) => set({ caseArrived: v }),
  setCaseYear: (y) => set({ caseYear: y }),
  setHotspot: (id) => set({ hotspotId: id }),
  setActiveRegion: (id) => {
    set({
      caseYear: null,
      hotspotId: null,
      caseArrived: false,
      activeRegion: id,
      aoiActive: true,
      focusedTi: null,
      nisarTrack: null,
      nisarSceneId: null,
      nisarPoint: null,
      nisarNotice: null,
    })
  },
  clearAoi: () => set({ aoiActive: false, focusedTi: null, caseYear: null, hotspotId: null, caseArrived: false }),
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
  setNisarVisible: (v) => set({ nisarVisible: v }),
  setNisarTrack: (k) => set({ nisarTrack: k, nisarSceneId: null }),
  setNisarScene: (id) => set({ nisarSceneId: id }),
  setNisarOpacity: (o) => set({ nisarOpacity: o }),
  setNisarProduct: (p) => get().setActiveLayer(p === 'GUNW' ? 'interferogram' : 'amplitude'),
  setNisarPoint: (pt) =>
    set({ nisarPoint: pt, nisarTrack: null, nisarSceneId: null, nisarNotice: null }),
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
  satelliteOn: boolean
  reliefOn: boolean
  toggleSatellite: () => void
  toggleRelief: () => void
  setRightOpen: (v: boolean) => void
  openRight: (tab?: RightTab) => void
  ask: (text: string) => void
  clearAsk: () => void
  setPopupOpen: (v: boolean) => void
}

export const useUi = create<UiState>((set, get) => ({
  rightOpen: false,
  rightTab: 'chat',
  askQueue: null,
  popupOpen: false,
  // Sentinel-2 mosaic is the default backdrop; the dark vector style stays one click away.
  satelliteOn: true,
  reliefOn: false,
  toggleSatellite: () => set({ satelliteOn: !get().satelliteOn }),
  toggleRelief: () => set({ reliefOn: !get().reliefOn }),
  setRightOpen: (v) => set({ rightOpen: v }),
  openRight: (tab) => set({ rightOpen: true, rightTab: tab ?? get().rightTab }),
  // The floating ask bar dock picks the question up; no side drawer opens.
  ask: (text) => set({ askQueue: { text, ts: Date.now() } }),
  clearAsk: () => set({ askQueue: null }),
  setPopupOpen: (v) => set({ popupOpen: v }),
}))
