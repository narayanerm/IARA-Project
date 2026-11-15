import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { AttributionControl, Layer, Marker, Source, type MapLayerMouseEvent, type MapRef } from 'react-map-gl/maplibre'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { REGIONS } from '@/lib/regions'
import { useApp, useUi } from '@/lib/store'
import { useDeterAlerts } from '@/lib/useDeterAlerts'
import { GIBS_BY_REGION } from '@/lib/gibs'
import { useI18n } from '@/lib/i18n'
import { hasWebGL2 } from '@/lib/webgl-support'
import { FLOOD_ATTRIBUTION, waterTileTemplate, isObservedFlood, SEASONAL_BASINS, NASA_FLOOD_ATTRIBUTION, gwisMapUrl, GWIS_ATTRIBUTION, type WaterLayer, type ForecastMapProps } from '@/lib/predictive-models'
import { drawAmazonForecastTile } from '@/lib/amazon-forecast-tiles'
import { FloodProbability } from './FloodProbability'

import { MapFallback } from './MapFallback'
import { NisarImagery } from './NisarImagery'

import { BASEMAP_URL, BEARING, MAP_ATTRIBUTION, PITCH, TERRAIN, TERRAIN_MIN_ZOOM } from './constants'
import { useBasemapAdapter } from './hooks/useBasemapAdapter'
import { OVERVIEW_CENTER, OVERVIEW_ZOOM, useMapCamera } from './hooks/useMapCamera'
import { useFocusedTi } from './hooks/useFocusedTi'
import { HomeButton } from './overlays/HomeButton'

import { TerrainSource } from './layers/TerrainSource'
import { SatelliteLayer } from './layers/SatelliteLayer'
import { CaseImageryLayer } from './layers/CaseImageryLayer'
import { YanomamiCaseLayers } from './layers/YanomamiCaseLayers'
import { YanomamiCaseControls } from './overlays/YanomamiCaseControls'
import { AmazonBiomeLayer } from './layers/AmazonBiomeLayer'
import { GibsTrueColorLayer, GibsOverlayLayer } from './layers/GibsLayers'
import { FocusedTiMask } from './layers/FocusedTiMask'
import { DeterLayer } from './layers/DeterLayer'

import { CaseMarkers } from './layers/CaseMarkers'
import { CaseOutlineLayer } from './layers/CaseOutlineLayer'
import { YANO_DETER_BBOX } from '../Cases/CaseAlerts'

// Bundling drops MapLibre's sibling worker file, so point it at the emitted asset.
maplibregl.setWorkerUrl(maplibreWorkerUrl)

maplibregl.addProtocol('amazon-forecast', async ({ url }, { signal }) => {
  const [kind, value, date, zoom, column, row] = url.slice('amazon-forecast://'.length).split('/')
  const tileUrl = kind === 'fire' ? gwisMapUrl(date, '{bbox}') : waterTileTemplate(value as WaterLayer, date)
  const canvas = document.createElement('canvas')
  const hideInsufficientData = kind === 'flood' && isObservedFlood(value as WaterLayer)
  await drawAmazonForecastTile(canvas, tileUrl, { z: Number(zoom), x: Number(column), y: Number(row) }, signal, hideInsufficientData)
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((image) => image ? resolve(image) : reject(new Error('Could not encode the forecast tile'))))
  return { data: await blob.arrayBuffer() }
})


const EMPTY_FORECAST: ForecastMapProps = {
  fireDate: null, floodLayer: null, observedDate: '', floodFocus: null, floodSignals: [],
  riverPoint: null, riverChance: null, onFireTileError: () => {}, onFloodTileError: () => {},
}

export function SarMap({ forecast }: { forecast: ForecastMapProps | null }) {
  const config = forecast ?? EMPTY_FORECAST
  const { fireDate, floodLayer, observedDate, outlookRunDate, floodFocus, floodSignals, riverPoint, riverChance, onRiverSelect, onFireTileError, onFloodTileError } = config
  const lang = useI18n((s) => s.lang)
  const signalLabel = useI18n((s) => s.lang === 'pt' ? 'Ver previsão de vazão neste ponto' : 'View river forecast at this point')
  const observedFlood = floodLayer !== null && isObservedFlood(floodLayer)
  const waterSourceId = observedFlood ? 'nasa-observed-flood' : 'glofas-flood'
  const mapRef = useRef<MapRef | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (floodFocus && map) map.easeTo({ center: floodFocus, duration: 600 })
  }, [floodFocus])
  const activeRegion = useApp((s) => s.activeRegion)
  const aoiActive = useApp((s) => s.aoiActive)
  const nasaOverlay = useApp((s) => s.nasaOverlay)
  const trueColorOverlay = useApp((s) => s.trueColorOverlay)

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

  // A click on the map forwards to the river-select mode when active. The live
  // NISAR "click-to-fetch scene" behaviour was removed per user request.
  const onClick = (e: MapLayerMouseEvent) => {
    if (!onRiverSelect) return
    const { lng, lat } = e.lngLat
    onRiverSelect([lng, lat])
  }

  if (!hasWebGL2()) {
    return (
      <div className="relative h-full w-full">
        <MapFallback region={region} {...config} />
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
        onError={(event) => {
          if ('sourceId' in event && event.sourceId === 'gwis-fire') onFireTileError()
          else if ('sourceId' in event && event.sourceId === waterSourceId) onFloodTileError()
          else console.error(event.error)
        }}
        onLoad={(e) => {
          setLabelLayerId(
            e.target.getStyle().layers.find((l) => l.type === 'symbol')?.id ?? 'amazon-biome-fill'
          )
          setMapLoaded(true)
        }}
        attributionControl={false}
      >
        <AttributionControl key={lang} compact customAttribution={MAP_ATTRIBUTION[lang]} />
        <TerrainSource on={reliefOn} beforeId={labelLayerId} />
        <SatelliteLayer on={satelliteOn} beforeId={labelLayerId} />
        {/* High-res EOX Sentinel-2 2025 mosaic focused on the active case (ported from manaus-flood-case). */}
        <CaseImageryLayer
          activeRegion={activeRegion}
          visible={satelliteOn && aoiActive}
          beforeId={labelLayerId}
        />
        {/* YANO case: NISAR mosaic + DETER mineração overlays (ported from yanomami-deforestation). */}
        <YanomamiCaseLayers beforeId={labelLayerId} />

        <AmazonBiomeLayer />

        <CaseOutlineLayer />
        {/* Invisible anchor: async overlays insert below it so community pins stay on top. */}
        <Layer id="community-points-anchor" type="background" paint={{ 'background-opacity': 0 }} />

        <GibsTrueColorLayer on={trueColorOverlay} />
        <GibsOverlayLayer on={nasaOverlay} gibs={gibs} />

        <NisarImagery />
        <FocusedTiMask focused={focused} />
        <DeterLayer focusedTi={focused.name ?? (yanoCase ? 'TI Yanomami' : null)} deter={deter} />

        {fireDate && (
          <Source
            id="gwis-fire"
            type="raster"
            tiles={[`amazon-forecast://fire/fwi/${fireDate}/{z}/{x}/{y}`]}
            tileSize={256}
            maxzoom={8}
            attribution={GWIS_ATTRIBUTION}
          >
            <Layer id="gwis-fire-overlay" type="raster" paint={{ 'raster-opacity': 0.7 }} />
          </Source>
        )}
        {floodLayer && (
          <Source key={waterSourceId} id={waterSourceId} type="raster" tiles={[`amazon-forecast://flood/${floodLayer}/${observedFlood ? observedDate : outlookRunDate ?? observedDate}/{z}/{x}/{y}`]} tileSize={256}
            maxzoom={observedFlood ? 9 : 11} attribution={observedFlood ? NASA_FLOOD_ATTRIBUTION : FLOOD_ATTRIBUTION}>
            <Layer id={`${waterSourceId}-overlay`} type="raster" paint={{ 'raster-fade-duration': 0, 'raster-opacity': floodLayer === SEASONAL_BASINS ? 0.65 : 1 }} />
          </Source>
        )}
        {floodSignals.map(({ point, color }) => (
          <Marker key={point.join(',')} longitude={point[0]} latitude={point[1]}>
            <button
              type="button"
              aria-label={signalLabel}
              title={signalLabel}
              onClick={(event) => { event.stopPropagation(); onRiverSelect?.(point) }}
              className="grid size-6 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-white"
            >
              <span className="size-3.5 rounded-full border-2 border-white shadow-[0_0_0_2px_#172033]" style={{ backgroundColor: color }} />
            </button>
          </Marker>
        ))}
        {riverPoint && (
          <Marker longitude={riverPoint[0]} latitude={riverPoint[1]} className="pointer-events-none z-10">
            <FloodProbability chance={riverChance} />
          </Marker>
        )}
        <CaseMarkers />
      </Map>
      <HomeButton />
      <YanomamiCaseControls />
    </div>
  )
}
