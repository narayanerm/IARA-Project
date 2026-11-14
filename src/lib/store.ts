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
  nisarVisible: true,
  nisarTrack: null,
  nisarSceneId: null,
  nisarOpacity: 0.85,
  nisarPoint: null,
  nisarNotice: null,
  setActiveRegion: (id) => {
    set({
      activeRegion: id,
      focusedTi: null,
      nisarTrack: null,
      nisarSceneId: null,
      nisarPoint: null,
      nisarNotice: null,
    })
    // The AOI popup no longer opens on its own: the sidebar and the guide open it when asked.
    useUi.getState().flyToRegion()
  },
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
    set({ nisarPoint: pt, nisarTrack: null, nisarSceneId: null, nisarNotice: null, nisarVisible: true }),
  setNisarNotice: (n) => set({ nisarNotice: n }),
}))

interface PopupState {
  open: boolean
  openPopup: () => void
  closePopup: () => void
}

export const useAoiPopup = create<PopupState>((set) => ({
  open: false,
  openPopup: () => set({ open: true }),
  closePopup: () => set({ open: false }),
}))

/* ------------------------------------------------------------------ */
/* Dashboard chrome: side panels, briefing card and the story stage.   */
/* Everything starts closed so the first view is the map + one prompt. */
/* ------------------------------------------------------------------ */

export type LeftSection = 'cases' | 'communities'
export type RightTab = 'nisar' | 'chat' | 'meta'
/**
 * Story stage, revealed one click at a time:
 * overview = Amazon with the three cases · case = what happened (briefing) ·
 * radar = the telling SAR layer + caption · explore = secondary tools in use.
 */
export type Stage = 'overview' | 'case' | 'radar' | 'explore'

interface UiState {
  leftOpen: boolean
  leftSection: LeftSection
  rightOpen: boolean
  rightTab: RightTab
  briefingOpen: boolean
  stage: Stage
  /** bumps whenever the map should fly back to the active region */
  flyNonce: number
  setLeftOpen: (v: boolean) => void
  openLeft: (section?: LeftSection) => void
  setRightOpen: (v: boolean) => void
  openRight: (tab?: RightTab) => void
  setBriefingOpen: (v: boolean) => void
  setStage: (s: Stage) => void
  flyToRegion: () => void
}

export const useUi = create<UiState>((set, get) => ({
  leftOpen: false,
  leftSection: 'cases',
  rightOpen: false,
  rightTab: 'chat',
  briefingOpen: false,
  stage: 'overview',
  flyNonce: 0,
  setLeftOpen: (v) => set({ leftOpen: v }),
  openLeft: (section) => set({ leftOpen: true, leftSection: section ?? get().leftSection }),
  setRightOpen: (v) => set({ rightOpen: v }),
  openRight: (tab) => set({ rightOpen: true, rightTab: tab ?? get().rightTab }),
  setBriefingOpen: (v) => set({ briefingOpen: v }),
  setStage: (stage) => set({ stage }),
  flyToRegion: () => set({ flyNonce: get().flyNonce + 1 }),
}))

/* ------------------------------------------------------------------ */
/* Map view options and live counts. SarMap writes them; the legend   */
/* and the "Map options" control outside the map read and toggle them. */
/* ------------------------------------------------------------------ */

export interface FocusedTiInfo {
  funaiProps: import('./useFunaiTi').FunaiTiProps | null
  localProps: import('@/data/layers/indigenous-lands').TiProps | null
  /** true once the official FUNAI boundary replaced the simplified local outline */
  official: boolean
  loading: boolean
  error: string | null
  deterCount: number
  deterLoading: boolean
}

interface MapViewState {
  terrainOn: boolean
  satelliteOn: boolean
  municipiosOn: boolean
  municipiosLoading: boolean
  zoom: number
  asfCount: number
  coverageCount: number
  coverageLoading: boolean
  /** bumps when something outside the map asks it to ease to a zoom level */
  zoomRequest: { zoom: number; ts: number } | null
  focusedInfo: FocusedTiInfo | null
  toggleTerrain: () => void
  toggleSatellite: () => void
  toggleMunicipios: () => void
  requestZoom: (zoom: number) => void
  patch: (p: Partial<MapViewState>) => void
}

export const useMapView = create<MapViewState>((set, get) => ({
  terrainOn: false,
  satelliteOn: false,
  municipiosOn: false,
  municipiosLoading: false,
  zoom: 6,
  asfCount: 0,
  coverageCount: 0,
  coverageLoading: false,
  zoomRequest: null,
  focusedInfo: null,
  toggleTerrain: () => set({ terrainOn: !get().terrainOn }),
  toggleSatellite: () => set({ satelliteOn: !get().satelliteOn }),
  toggleMunicipios: () => set({ municipiosOn: !get().municipiosOn }),
  requestZoom: (zoom) => set({ zoomRequest: { zoom, ts: Date.now() } }),
  patch: (p) => set(p),
}))
