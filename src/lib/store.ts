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
  nasaOverlay: true,
  trueColorOverlay: false,
  focusedTi: null,
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
    useAoiPopup.setState({ open: true })
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
