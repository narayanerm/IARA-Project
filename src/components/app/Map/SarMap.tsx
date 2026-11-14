import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { Layer, type MapLayerMouseEvent, type MapRef } from 'react-map-gl/maplibre'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { REGIONS } from '@/lib/regions'
import { useApp, useUi } from '@/lib/store'
import { useDeterAlerts } from '@/lib/useDeterAlerts'
import { GIBS_BY_REGION } from '@/lib/gibs'
import { useT } from '@/lib/i18n'
import { hasWebGL2 } from '@/lib/webgl-support'
import { inAmazon } from '@/lib/amazon'

import { MapFallback } from './MapFallback'
import { NisarImagery } from './NisarImagery'

import { BASEMAP_URL, BEARING, MAP_ATTRIBUTION, PITCH, TERRAIN, TERRAIN_MIN_ZOOM } from './constants'
import { useBasemapAdapter } from './hooks/useBasemapAdapter'
import { OVERVIEW_CENTER, OVERVIEW_ZOOM, useMapCamera } from './hooks/useMapCamera'
import { useFocusedTi } from './hooks/useFocusedTi'

import { TerrainSource } from './layers/TerrainSource'
import { SatelliteLayer } from './layers/SatelliteLayer'
import { AmazonBiomeLayer } from './layers/AmazonBiomeLayer'
import { GibsTrueColorLayer, GibsOverlayLayer } from './layers/GibsLayers'
import { FocusedTiMask } from './layers/FocusedTiMask'
import { DeterLayer } from './layers/DeterLayer'

import { CaseMarkers } from './layers/CaseMarkers'
import { CaseOutlineLayer } from './layers/CaseOutlineLayer'
import { YANO_DETER_BBOX } from '../Cases/CaseAlerts'

export function SarMap() {
  const mapRef = useRef<MapRef | null>(null)
  const activeRegion = useApp((s) => s.activeRegion)
  const aoiActive = useApp((s) => s.aoiActive)
  const nasaOverlay = useApp((s) => s.nasaOverlay)
  const trueColorOverlay = useApp((s) => s.trueColorOverlay)
  const setNisarPoint = useApp((s) => s.setNisarPoint)
  const setNisarNotice = useApp((s) => s.setNisarNotice)
  const t = useT()

  const region = useMemo(() => REGIONS.find((r) => r.id === activeRegion)!, [activeRegion])
  const gibs = GIBS_BY_REGION[activeRegion]

  const focused = useFocusedTi()
  // Near-real-time DETER alerts follow the Yanomami case; a focused TI still takes precedence.
  const yanoCase = aoiActive && activeRegion === 'YANO'
  const deter = useDeterAlerts(focused.bbox ?? (yanoCase ? YANO_DETER_BBOX : null))

  const [mapLoaded, setMapLoaded] = useState(false)
  const reliefOn = useUi((s) => s.reliefOn)
  const satelliteOn = useUi((s) => s.satelliteOn)
  // First label layer of the basemap: imagery goes under it so place and river names stay readable.
  const [labelLayerId, setLabelLayerId] = useState<string>()
  useMapCamera(mapRef, region, mapLoaded)
  useBasemapAdapter(() => mapRef.current?.getMap(), satelliteOn, mapLoaded)

  // 3D relief: drape the map over the DEM only when zoomed in enough for it to show.
  useEffect(() => {
    const m = mapRef.current?.getMap()
    if (!m || !mapLoaded) return
    const sync = () => {
      const want = reliefOn && m.getZoom() >= TERRAIN_MIN_ZOOM && !!m.getSource(TERRAIN.source)
      if (want !== !!m.getTerrain()) m.setTerrain(want ? TERRAIN : null)
    }
    sync()
    m.on('zoomend', sync)
    m.on('sourcedata', sync)
    // Tilt once so the relief is visible right away; a flat camera hides the mesh.
    if (reliefOn && m.getPitch() < 20) m.easeTo({ pitch: PITCH, duration: 800, essential: true })
    return () => {
      m.off('zoomend', sync)
      m.off('sourcedata', sync)
      if (m.getTerrain()) m.setTerrain(null)
    }
  }, [reliefOn, mapLoaded])

  // A click on the map points the live NISAR catalogue at that spot.
  const onClick = (e: MapLayerMouseEvent) => {
    const { lng, lat } = e.lngLat
    if (inAmazon(lng, lat)) setNisarPoint([lng, lat])
    else setNisarNotice(t('nisar.outsideAmazon'))
  }

  if (!hasWebGL2()) {
    return (
      <div className="relative h-full w-full">
        <MapFallback region={region} />
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      <Map
        ref={(r) => {
          mapRef.current = r
        }}
        mapLib={maplibregl}
        initialViewState={{
          longitude: aoiActive ? region.center[0] : OVERVIEW_CENTER[0],
          latitude: aoiActive ? region.center[1] : OVERVIEW_CENTER[1],
          zoom: aoiActive ? region.zoom : OVERVIEW_ZOOM,
          pitch: aoiActive ? PITCH : 0,
          bearing: aoiActive ? BEARING : 0,
        }}
        maxPitch={60}
        mapStyle={BASEMAP_URL}
                onClick={onClick}
        onLoad={(e) => {
          setLabelLayerId(
            e.target.getStyle().layers.find((l) => l.type === 'symbol')?.id ?? 'amazon-biome-fill'
          )
          setMapLoaded(true)
        }}
        attributionControl={{ compact: true, customAttribution: MAP_ATTRIBUTION }}
      >
        <TerrainSource on={reliefOn} beforeId={labelLayerId} />
        <SatelliteLayer on={satelliteOn} beforeId={labelLayerId} />

        <AmazonBiomeLayer />

        <CaseOutlineLayer />
        {/* Invisible anchor: async overlays insert below it so community pins stay on top. */}
        <Layer id="community-points-anchor" type="background" paint={{ 'background-opacity': 0 }} />

        <GibsTrueColorLayer on={trueColorOverlay} />
        <GibsOverlayLayer on={nasaOverlay} gibs={gibs} />

        <NisarImagery />
        <FocusedTiMask focused={focused} />
        <DeterLayer focusedTi={focused.name ?? (yanoCase ? 'TI Yanomami' : null)} deter={deter} />

        <CaseMarkers />
      </Map>

    </div>
  )
}
