import { useEffect, useRef, type RefObject } from 'react'
import type { MapRef } from 'react-map-gl/maplibre'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { INDIGENOUS_LANDS, polygonCentroid } from '@/data/layers/indigenous-lands'
import { CASES } from '@/data/cases'
import { useApp } from '@/lib/store'
import type { Region } from '@/lib/types'
import { BEARING, PITCH } from '../constants'

// Far view that holds the three cases (Roraima down to the Manaus lakes) behind the picker.
export const OVERVIEW_CENTER: [number, number] = [-61.9, -0.3]
export const OVERVIEW_ZOOM = 5
// How far the user may zoom out of a case, in zoom levels below the case framing.
const ZOOM_OUT = 1.3
const FLY_MS = 3400
// Entering from the picker: the camera waits behind the chosen picture while it opens to full
// screen, then pulls back and tilts as the picture dissolves. The picker reads the same delay.
export const CASE_REVEAL_MS = 850
const REVEAL_MS = 2600
// How much closer than the case framing the camera starts, so the first frame of the map matches
// the close satellite picture that was just on screen.
const REVEAL_ZOOM_IN = 1.4
const easeOutQuint = (t: number) => 1 - (1 - t) ** 5
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/** Width of the case panel, shared with the panel's CSS so the map frames the free area. */
export function casePanelWidth(w: number): number {
  return Math.round(Math.min(420, Math.max(340, w * 0.3)))
}

// Keeps the region centred in the part of the map the case panel leaves free.
export function casePadding(el: HTMLElement) {
  const { clientWidth: w, clientHeight: h } = el
  if (w < 768) return { top: 16, right: 0, bottom: Math.round(h * 0.5), left: 0 }
  return { top: 24, right: 24, bottom: 24, left: casePanelWidth(w) + 24 }
}

// Frames the case: its usual zoom on roomy screens, zoomed out just enough on small ones so
// every watch zone stays in the free part of the map.
function caseCamera(m: MapLibreMap, region: Region) {
  const padding = casePadding(m.getContainer())
  const pts = CASES[region.id].hotspots.map((h) => h.center)
  const lons = pts.map((p) => p[0])
  const lats = pts.map((p) => p[1])
  const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI)
  // Watch-zone extent plus a margin, measured in world units (0..1).
  const w = ((Math.max(...lons) - Math.min(...lons)) / 360) * 1.5 + 0.0002
  const h = (merc(Math.max(...lats)) - merc(Math.min(...lats))) * 1.5 + 0.0002
  const { clientWidth, clientHeight } = m.getContainer()
  // Room for the marker labels, which sit to the side of each dot.
  const availW = clientWidth - padding.left - padding.right - 120
  const availH = clientHeight - padding.top - padding.bottom
  const fitZoom = Math.log2(Math.min(availW / (w * 512), availH / (h * 512)))
  if (fitZoom >= region.zoom) return { center: region.center, zoom: region.zoom, padding }
  const center: [number, number] = [
    (Math.max(...lons) + Math.min(...lons)) / 2,
    (Math.max(...lats) + Math.min(...lats)) / 2,
  ]
  return { center, zoom: fitZoom, padding }
}

function unlock(m: MapLibreMap) {
  m.setMaxBounds(null)
  m.setMinZoom(0)
}

// Bounds wide enough to hold the viewport at the lowest allowed zoom, so the user can look
// around the region a little but never wander off to the rest of the basin.
function lock(m: MapLibreMap, zoom: number) {
  const minZoom = zoom - ZOOM_OUT
  const { clientWidth: w, clientHeight: h } = m.getContainer()
  const lonSpan = (w * 360) / (512 * 2 ** minZoom)
  const latSpan = (h * 360) / (512 * 2 ** minZoom)
  const c = m.getCenter()
  m.setMinZoom(minZoom)
  m.setMaxBounds([
    [c.lng - lonSpan * 0.62, c.lat - latSpan * 0.62],
    [c.lng + lonSpan * 0.62, c.lat + latSpan * 0.62],
  ])
}

// Orchestrates the camera: the long flight into a case, the flight back out, and hotspot jumps.
export function useMapCamera(mapRef: RefObject<MapRef | null>, region: Region, mapLoaded: boolean) {
  const aoiActive = useApp((s) => s.aoiActive)
  const focusedTi = useApp((s) => s.focusedTi)
  const flyTarget = useApp((s) => s.flyTarget)
  const homeTs = useApp((s) => s.homeTs)
  const wasActive = useRef(aoiActive)

  useEffect(() => {
    const m = mapRef.current?.getMap()
    if (!m || !mapLoaded) return
    unlock(m)
    const fromPicker = aoiActive && !wasActive.current
    wasActive.current = aoiActive
    if (!aoiActive) {
      m.flyTo({
        center: OVERVIEW_CENTER,
        zoom: OVERVIEW_ZOOM,
        pitch: 0,
        bearing: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        duration: 2200,
        essential: true,
      })
      return
    }
    const id = region.id
    const cam = caseCamera(m, region)
    const onEnd = () => {
      const st = useApp.getState()
      if (!st.aoiActive || st.activeRegion !== id) return
      lock(m, cam.zoom)
      st.setCaseArrived(true)
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let wait: number | undefined
    if (fromPicker && !reduce) {
      // Match cut: jump close and flat behind the picture, then pull back once it starts to fade.
      m.jumpTo({ center: cam.center, zoom: cam.zoom + REVEAL_ZOOM_IN, pitch: 0, bearing: 0, padding: cam.padding })
      wait = window.setTimeout(() => {
        m.easeTo({ ...cam, pitch: PITCH, bearing: BEARING, duration: REVEAL_MS, easing: easeOutQuint, essential: true })
        m.once('moveend', onEnd)
      }, CASE_REVEAL_MS)
    } else {
      m.flyTo({
        ...cam,
        pitch: PITCH,
        bearing: BEARING,
        duration: reduce ? 0 : FLY_MS,
        curve: 1.6,
        essential: true,
      })
      m.once('moveend', onEnd)
    }

    // Re-fit the lock when the window changes size (rotating a phone, resizing a laptop window).
    const onResize = () => {
      if (!useApp.getState().caseArrived) return
      unlock(m)
      const next = caseCamera(m, region)
      m.jumpTo(next)
      lock(m, next.zoom)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.clearTimeout(wait)
      m.off('moveend', onEnd)
      window.removeEventListener('resize', onResize)
    }
  }, [region, mapLoaded, aoiActive, mapRef])

  // Home button: back to the case framing after wandering around.
  useEffect(() => {
    if (!homeTs) return
    const m = mapRef.current?.getMap()
    const st = useApp.getState()
    if (!m || !st.aoiActive || !st.caseArrived) return
    unlock(m)
    const cam = caseCamera(m, region)
    m.easeTo({ ...cam, pitch: PITCH, bearing: BEARING, duration: 1400, easing: easeInOutCubic, essential: true })
    const onEnd = () => lock(m, cam.zoom)
    m.once('moveend', onEnd)
    return () => {
      m.off('moveend', onEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeTs])

  useEffect(() => {
    if (!focusedTi) return
    const m = mapRef.current
    if (!m) return
    const feature = INDIGENOUS_LANDS.features.find((f) => f.properties.name === focusedTi)
    if (!feature) return
    const [lon, lat] = polygonCentroid(feature.geometry)
    m.flyTo({ center: [lon, lat], zoom: 7.5, pitch: 40, bearing: 0, duration: 1400, essential: true })
  }, [focusedTi, mapRef])

  useEffect(() => {
    if (!flyTarget) return
    const m = mapRef.current
    if (!m) return
    m.flyTo({
      center: flyTarget.center,
      zoom: flyTarget.zoom ?? 8,
      duration: 1200,
      essential: true,
    })
  }, [flyTarget, mapRef])
}
