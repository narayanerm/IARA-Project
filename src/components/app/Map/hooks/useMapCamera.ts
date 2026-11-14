import { useEffect, type RefObject } from 'react'
import type { MapRef } from 'react-map-gl/maplibre'
import { INDIGENOUS_LANDS, polygonCentroid } from '@/data/layers/indigenous-lands'
import { useApp } from '@/lib/store'
import type { Region } from '@/lib/types'
import { AMAZON_CENTER, AMAZON_ZOOM, BEARING, PITCH } from '../constants'

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
        duration: 1600,
        essential: true,
      })
      return
    }
    m.flyTo({
      center: region.center,
      zoom: region.zoom,
      pitch: PITCH,
      bearing: BEARING,
      offset: [0, Math.round(m.getContainer().clientHeight * 0.18)],
      duration: 1600,
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
