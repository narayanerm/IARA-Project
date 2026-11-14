import { useEffect, useMemo, useRef, useState } from 'react'
import Map, {
  Layer,
  Marker,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from 'react-map-gl/maplibre'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { REGIONS } from '@/lib/regions'
import { YANO_MINING } from '@/data/mocks/yanomami-mining'
import { useApp } from '@/lib/store'
import { useDeterAlerts } from '@/lib/useDeterAlerts'
import { useIbgeMunicipios, UF_CODE_BY_REGION } from '@/lib/useIbgeMunicipios'
import { GIBS_BY_REGION } from '@/lib/gibs'
import { useI18n, useT } from '@/lib/i18n'
import { hasWebGL2 } from '@/lib/webgl-support'
import { AMAZON_WATER_BOUNDS, FLOOD_ATTRIBUTION, waterTileTemplate, isObservedFlood, isWaterOutlook, NASA_FLOOD_ATTRIBUTION, gwisMapUrl, GWIS_ATTRIBUTION, type WaterLayer, type ForecastMapProps } from '@/lib/predictive-models'
import { drawAmazonForecastTile } from '@/lib/amazon-forecast-tiles'
import { FloodProbability } from './FloodProbability'
import { inAmazon } from '@/lib/amazon'

import { CommunityAreas, CommunityPoints } from './CommunityLayers'
import { MapFallback } from './MapFallback'
import { NisarImagery } from './NisarImagery'

import { AMAZON_CENTER, AMAZON_ZOOM, BASEMAP_URL, BEARING, MAP_ATTRIBUTION, PITCH, TERRAIN } from './constants'
import { useBasemapAdapter } from './hooks/useBasemapAdapter'
import { useMapCamera } from './hooks/useMapCamera'
import { useFocusedTi } from './hooks/useFocusedTi'
maplibregl.addProtocol('amazon-forecast', async ({ url }, { signal }) => {
  const [kind, value, date, zoom, column, row] = url.slice('amazon-forecast://'.length).split('/')
  const tileUrl = kind === 'fire' ? gwisMapUrl(date, '{bbox}') : waterTileTemplate(value as WaterLayer, date)
  const canvas = document.createElement('canvas')
  const hideInsufficientData = kind === 'flood' && isObservedFlood(value as WaterLayer)
  await drawAmazonForecastTile(canvas, tileUrl, { z: Number(zoom), x: Number(column), y: Number(row) }, signal, hideInsufficientData)
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((image) => image ? resolve(image) : reject(new Error('Could not encode the fire tile'))))
  return { data: await blob.arrayBuffer() }
})


import { TerrainSource } from './layers/TerrainSource'
import { SatelliteLayer } from './layers/SatelliteLayer'
import { AmazonBiomeLayer } from './layers/AmazonBiomeLayer'
import { GibsTrueColorLayer, GibsOverlayLayer } from './layers/GibsLayers'
import { YanoChangeLayer } from './layers/YanoChangeLayer'
import { AffectedAreasLayer } from './layers/AffectedAreasLayer'
import { FocusedTiMask } from './layers/FocusedTiMask'
import { DeterLayer } from './layers/DeterLayer'
import { IbgeMunicipiosLayer } from './layers/IbgeMunicipiosLayer'

import { OverlayLegend } from './overlays/OverlayLegend'
import { FocusedTiBadge } from './overlays/FocusedTiBadge'

export function SarMap({ fireDate, floodLayer, observedDate, floodFocus, floodSignals, riverPoint, riverChance, onRiverSelect, onFireTileError, onFloodTileError }: ForecastMapProps) {
  const signalLabel = useI18n((s) => s.lang === 'pt' ? 'Ver previsão de vazão neste ponto' : 'View river forecast at this point')
  const selectedForecastPoint = riverPoint ?? floodFocus
  const mapRef = useRef<MapRef | null>(null)
  const observedFlood = floodLayer !== null && isObservedFlood(floodLayer)
  const waterSourceId = observedFlood ? 'nasa-observed-flood' : 'glofas-flood'
  useEffect(() => {
    if (isWaterOutlook(floodLayer)) mapRef.current?.fitBounds(AMAZON_WATER_BOUNDS, { padding: 36, pitch: 0, bearing: 0 })
  }, [floodLayer])
  useEffect(() => {
    if (floodFocus) mapRef.current?.flyTo({ center: floodFocus, zoom: 7, pitch: 0, bearing: 0 })
  }, [floodFocus])
  const activeRegion = useApp((s) => s.activeRegion)
  const aoiActive = useApp((s) => s.aoiActive)
  const nasaOverlay = useApp((s) => s.nasaOverlay)
  const trueColorOverlay = useApp((s) => s.trueColorOverlay)
  const selectPolygon = useApp((s) => s.selectPolygon)
  const setNisarPoint = useApp((s) => s.setNisarPoint)
  const setNisarNotice = useApp((s) => s.setNisarNotice)
  const t = useT()

  const region = useMemo(() => REGIONS.find((r) => r.id === activeRegion)!, [activeRegion])
  const gibs = GIBS_BY_REGION[activeRegion]

  const focused = useFocusedTi()
  const deter = useDeterAlerts(focused.bbox)

  const [municipiosOn, setMunicipiosOn] = useState(false)
  const ibge = useIbgeMunicipios(UF_CODE_BY_REGION[activeRegion] ?? null, municipiosOn)

  const [mapLoaded, setMapLoaded] = useState(false)
  const [terrainOn, setTerrainOn] = useState(false)
  const [satelliteOn, setSatelliteOn] = useState(false)
  // First label layer of the basemap: imagery goes under it so place and river names stay readable.
  const [labelLayerId, setLabelLayerId] = useState<string>()
  useMapCamera(mapRef, region, mapLoaded)
  useBasemapAdapter(() => mapRef.current?.getMap(), satelliteOn, mapLoaded)

  // Terrain is opt-in: draping the map over the DEM renders through an offscreen texture,
  // which costs frames and softens every layer on top of it.
  useEffect(() => {
    const m = mapRef.current?.getMap()
    if (!m || !mapLoaded) return
    if (terrainOn && !m.getSource(TERRAIN.source)) return
    m.setTerrain(terrainOn ? TERRAIN : null)
  }, [terrainOn, mapLoaded])

  const onClick = (e: MapLayerMouseEvent) => {
    if (onRiverSelect) {
      onRiverSelect([e.lngLat.lng, e.lngLat.lat])
      return
    }
    const f = e.features?.[0]
    if (!f) {
      selectPolygon(null)
      const { lng, lat } = e.lngLat
      if (inAmazon(lng, lat)) setNisarPoint([lng, lat])
      else setNisarNotice(t('nisar.outsideAmazon'))
      return
    }
    const id = (f.properties as { id?: string })?.id
    if (!id) return
    const found = YANO_MINING.find((p) => p.id === id) ?? null
    selectPolygon(found)
  }

  if (!hasWebGL2()) {
    return (
      <div className="relative h-full w-full">
        <MapFallback region={region} fireDate={fireDate} floodLayer={floodLayer} observedDate={observedDate} floodFocus={floodFocus} floodSignals={floodSignals} riverPoint={riverPoint} riverChance={riverChance} onRiverSelect={onRiverSelect} onFireTileError={onFireTileError} onFloodTileError={onFloodTileError} />
        <OverlayLegend />
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
          longitude: aoiActive ? region.center[0] : AMAZON_CENTER[0],
          latitude: aoiActive ? region.center[1] : AMAZON_CENTER[1],
          zoom: aoiActive ? region.zoom : AMAZON_ZOOM,
          pitch: aoiActive ? PITCH : 0,
          bearing: aoiActive ? BEARING : 0,
        }}
        maxPitch={60}
        mapStyle={BASEMAP_URL}
        interactiveLayerIds={activeRegion === 'YANO' ? ['yano-change-fill'] : []}
        onClick={onClick}
        onError={(e) => {
          if ('sourceId' in e && e.sourceId === 'gwis-fire') onFireTileError()
          else if ('sourceId' in e && e.sourceId === waterSourceId) onFloodTileError()
          else console.error(e.error)
        }}
        onLoad={(e) => {
          setLabelLayerId(
            e.target.getStyle().layers.find((l) => l.type === 'symbol')?.id ?? 'amazon-biome-fill'
          )
          setMapLoaded(true)
        }}
        attributionControl={{ compact: true, customAttribution: MAP_ATTRIBUTION }}
      >
        <TerrainSource />
        <SatelliteLayer on={satelliteOn} beforeId={labelLayerId} />

        <AmazonBiomeLayer />

        <CommunityAreas />
        {/* Invisible anchor: async overlays insert below it so community pins stay on top. */}
        <Layer id="community-points-anchor" type="background" paint={{ 'background-opacity': 0 }} />

        <GibsTrueColorLayer on={trueColorOverlay} />
        <GibsOverlayLayer on={nasaOverlay} gibs={gibs} />

        <NisarImagery />
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
        <YanoChangeLayer activeRegion={activeRegion} />
        <AffectedAreasLayer activeRegion={activeRegion} />
        <FocusedTiMask focused={focused} />
        <IbgeMunicipiosLayer on={municipiosOn} data={ibge.data} />
        <DeterLayer focusedTi={focused.name} deter={deter} />

        <CommunityPoints />
        {floodLayer && (
          <Source key={waterSourceId} id={waterSourceId} type="raster" tiles={[`amazon-forecast://flood/${floodLayer}/${observedDate}/{z}/{x}/{y}`]} tileSize={256}
            maxzoom={observedFlood ? 9 : 11} attribution={observedFlood ? NASA_FLOOD_ATTRIBUTION : FLOOD_ATTRIBUTION}>
            <Layer id={`${waterSourceId}-overlay`} type="raster" paint={{ 'raster-fade-duration': 0 }} />
          </Source>
        )}
        {floodLayer && floodSignals.map(({ point, color }) => (
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
        {floodLayer && selectedForecastPoint && (
          <Marker longitude={selectedForecastPoint[0]} latitude={selectedForecastPoint[1]} className="pointer-events-none z-10">
            <FloodProbability chance={riverChance} />
          </Marker>
        )}
      </Map>

      <OverlayLegend
        terrainOn={terrainOn}
        onToggleTerrain={() => setTerrainOn((v) => !v)}
        satelliteOn={satelliteOn}
        onToggleSatellite={() => setSatelliteOn((v) => !v)}
        municipiosOn={municipiosOn}
        onToggleMunicipios={() => setMunicipiosOn((v) => !v)}
        municipiosLoading={ibge.loading}
      />
      {focused.name && (
        <FocusedTiBadge
          tiName={focused.name}
          funaiProps={focused.funaiProps}
          localProps={focused.localProps}
          sourceLabel={focused.sourceLabel}
          loading={focused.funaiLoading}
          error={focused.funaiError}
          deterCount={deter.count}
          deterLoading={deter.loading}
        />
      )}
    </div>
  )
}
