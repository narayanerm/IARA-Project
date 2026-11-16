import { create } from 'zustand'
import type { ProductLayer, RegionId, SubsidencePolygon } from './types'
import type { NisarProduct } from './nisar'
import type { ArchiveScene, Bbox } from './sarArchive'

export type CaseTab = 'overview' | 'timeline' | 'forecast'

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
  /** Tab open in the case panel; lives here so the assistant can switch it. */
  caseTab: CaseTab
  setCaseTab: (t: CaseTab) => void
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
  nisarVisible: true,
  nisarTrack: null,
  nisarSceneId: null,
  nisarOpacity: 0.85,
  nisarPoint: null,
  nisarNotice: null,
  caseYear: null,
  hotspotId: null,
  caseTab: 'overview',
  caseArrived: false,
  homeTs: 0,
  setCaseTab: (t) => set({ caseTab: t }),
  requestHome: () => set({ homeTs: Date.now(), hotspotId: null }),
  setCaseArrived: (v) => set({ caseArrived: v }),
  setCaseYear: (y) => set({ caseYear: y }),
  setHotspot: (id) => set({ hotspotId: id }),
  setActiveRegion: (id) => {
    set({
      caseYear: null,
      caseTab: 'overview',
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
  satelliteOn: boolean
  reliefOn: boolean
  /** Archive scene id picked in the case panel to drive the SAR map overlay. */
  sarMapPickId: string | null
  /** Before/after scenes picked in the SAR comparator of the case panel, read by the export. */
  sarArchivePick: { bbox: Bbox; before: ArchiveScene | null; after: ArchiveScene | null } | null
  /** YANO case: active SAR band mosaic on the map (null = none). */
  yanomamiBand: 'nisar' | 'sband' | 's1c' | null
  /** YANO case: show RADD alerts as a map overlay (can stack with any SAR band). */
  yanomamiRaddOn: boolean
  /** YANO case: show DETER mineração polygons as a map overlay. */
  yanomamiDeterOn: boolean
  /** ENCH case: show NASA GIBS MODIS flood overlay. */
  enchFloodOn: boolean
  /** SECA case: show NASA GIBS SMAP soil moisture overlay. */
  secaDroughtOn: boolean
  /** Before/after scenes picked by hand in the SAR comparison (null = automatic pick). */
  sarPair: [string, string] | null
  setSarPair: (p: [string, string] | null) => void
  toggleSatellite: () => void
  toggleRelief: () => void
  setRightOpen: (v: boolean) => void
  openRight: (tab?: RightTab) => void
  ask: (text: string) => void
  clearAsk: () => void
  setPopupOpen: (v: boolean) => void
  setSarMapPickId: (id: string | null) => void
  setSarArchivePick: (pick: UiState['sarArchivePick']) => void
  setYanomamiBand: (b: 'nisar' | 'sband' | 's1c' | null) => void
  toggleYanomamiRadd: () => void
  toggleYanomamiDeter: () => void
  toggleEnchFlood: () => void
  toggleSecaDrought: () => void
  /** Turn every case overlay off at once (SAR band + RADD + DETER + GIBS flood/drought). */
  clearCaseOverlays: () => void
}

export const useUi = create<UiState>((set, get) => ({
  rightOpen: false,
  rightTab: 'chat',
  askQueue: null,
  popupOpen: false,
  // Sentinel-2 mosaic is the default backdrop; the dark vector style stays one click away.
  satelliteOn: true,
  reliefOn: false,
  sarMapPickId: null,
  sarArchivePick: null,
  yanomamiBand: null,
  yanomamiRaddOn: false,
  yanomamiDeterOn: false,
  enchFloodOn: false,
  secaDroughtOn: false,
  sarPair: null,
  setSarPair: (p) => set({ sarPair: p }),
  toggleSatellite: () => set({ satelliteOn: !get().satelliteOn }),
  toggleRelief: () => set({ reliefOn: !get().reliefOn }),
  setRightOpen: (v) => set({ rightOpen: v }),
  openRight: (tab) => set({ rightOpen: true, rightTab: tab ?? get().rightTab }),
  ask: (text) => set({ askQueue: { text, ts: Date.now() }, rightOpen: true, rightTab: 'chat' }),
  clearAsk: () => set({ askQueue: null }),
  setPopupOpen: (v) => set({ popupOpen: v }),
  setSarMapPickId: (id) => set({ sarMapPickId: id }),
  setSarArchivePick: (pick) => set({ sarArchivePick: pick }),
  setYanomamiBand: (b) => set({ yanomamiBand: b }),
  toggleYanomamiRadd: () => set({ yanomamiRaddOn: !get().yanomamiRaddOn }),
  toggleYanomamiDeter: () => set({ yanomamiDeterOn: !get().yanomamiDeterOn }),
  toggleEnchFlood: () => set({ enchFloodOn: !get().enchFloodOn }),
  toggleSecaDrought: () => set({ secaDroughtOn: !get().secaDroughtOn }),
  clearCaseOverlays: () =>
    set({
      yanomamiBand: null,
      yanomamiRaddOn: false,
      yanomamiDeterOn: false,
      enchFloodOn: false,
      secaDroughtOn: false,
    }),
}))

/* ------------------------------------------------------------------ */
/* Case videos: the voiced explainer of a case, full screen.            */
/* It plays by itself until the visitor has watched it once (to the end */
/* or skipped after it started); that is remembered per case in         */
/* localStorage. After that it only plays from the "Video explanation"  */
/* button. Mining also plays it when the guided tour closes, if unseen. */
/* ------------------------------------------------------------------ */

const VIDEO_SEEN_KEY = 'iara.caseVideoSeen.v1'

function readVideoSeen(): Partial<Record<RegionId, boolean>> {
  try {
    const raw = window.localStorage.getItem(VIDEO_SEEN_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as Partial<Record<RegionId, boolean>>) : {}
  } catch {
    return {}
  }
}

function writeVideoSeen(seen: Partial<Record<RegionId, boolean>>) {
  try {
    window.localStorage.setItem(VIDEO_SEEN_KEY, JSON.stringify(seen))
  } catch {
    /* private mode or storage blocked: the video may play again on the next visit */
  }
}

interface CaseVideoState {
  /** Watched at least once (persisted). */
  seen: Partial<Record<RegionId, boolean>>
  /** Closed in this page load without counting as watched (it failed, or was skipped before it started). */
  closed: Partial<Record<RegionId, boolean>>
  /** Video asked for explicitly (the "Video explanation" button, or Mining after the tour); null when none. */
  requested: RegionId | null
  /** The guided tour opens Mining on its own; the video waits for the end of the tour. */
  tourRunning: boolean
  setTourRunning: (on: boolean) => void
  playCaseVideo: (id: RegionId) => void
  /** Ends the video; `watched` marks it as seen for good. */
  closeCaseVideo: (id: RegionId, watched: boolean) => void
}

export const useCaseVideo = create<CaseVideoState>((set, get) => ({
  seen: typeof window !== 'undefined' ? readVideoSeen() : {},
  closed: {},
  requested: null,
  tourRunning: false,
  setTourRunning: (on) => set({ tourRunning: on }),
  playCaseVideo: (id) => set({ requested: id }),
  closeCaseVideo: (id, watched) => {
    const seen = watched ? { ...get().seen, [id]: true } : get().seen
    if (watched) writeVideoSeen(seen)
    set((s) => ({ seen, closed: { ...s.closed, [id]: true }, requested: s.requested === id ? null : s.requested }))
  },
}))

/** The case whose video owns the screen right now, or null. */
export function useCaseVideoActive(): RegionId | null {
  const requested = useCaseVideo((s) => s.requested)
  const region = useApp((s) => s.activeRegion)
  const arrived = useApp((s) => s.aoiActive && s.caseArrived)
  const seen = useCaseVideo((s) => !!s.seen[region])
  const closed = useCaseVideo((s) => !!s.closed[region])
  const tourRunning = useCaseVideo((s) => s.tourRunning)
  if (requested) return requested
  if (tourRunning) return null
  return arrived && !seen && !closed ? region : null
}
