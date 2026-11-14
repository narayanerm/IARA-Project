import { useEffect, type RefObject } from 'react'
import type { MapRef } from 'react-map-gl/maplibre'
import { INDIGENOUS_LANDS, polygonCentroid } from '@/data/layers/indigenous-lands'
import { useApp } from '@/lib/store'
import type { Region } from '@/lib/types'
import { AMAZON_CENTER, AMAZON_ZOOM, BEARING, PITCH } from '../constants'

// Keeps the region centred in the part of the map the case panels leave free.
function casePadding(el: HTMLElement) {
  const { clientWidth: w, clientHeight: h } = el
  if (w < 768) return { top: 56, right: 0, bottom: Math.round(h * 0.48), left: 0 }
  return { top: 60, right: w >= 1232 ? 348 : 12, bottom: 250, left: 384 }
}

// Orchestrates all camera flyTo behavior: region change, focused TI, and external flyTarget events.
export function useMapCamera(mapRef: RefObject<MapRef | null>, region: Region, mapLoaded: boolean) {
  const aoiActive = useApp((s) => s.aoiActive)
  const focusedTi = useApp((s) => s.focusedTi)
  const flyTarget = useApp((s) => s.flyTarget)

  useEffect(() => {
    const m = mapRef.current
    if (!m || !mapLoaded) return
    if (!aoiActive) {
      m.flyTo({
        center: AMAZON_CENTER,
        zoom: AMAZON_ZOOM,
        pitch: 0,
        bearing: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        duration: 1800,
        essential: true,
      })
      return
    }
    m.flyTo({
      center: region.center,
      zoom: region.zoom,
      pitch: PITCH,
      bearing: BEARING,
      padding: casePadding(m.getContainer()),
      duration: 2600,
      curve: 1.5,
      essential: true,
    })
  }, [region, mapLoaded, aoiActive, mapRef])

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
      pitch: 40,
      bearing: 0,
      duration: 1400,
      essential: true,
    })
  }, [flyTarget, mapRef])
}
