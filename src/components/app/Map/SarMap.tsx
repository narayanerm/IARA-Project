import { useEffect, useMemo, useRef, useState } from 'react'
import Map, {
  Layer,
  Marker,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from 'react-map-gl/maplibre'
import * as maplibregl from 'maplibre-gl'
import { ChevronDown, Mountain, Satellite, type LucideIcon } from 'lucide-react'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection } from 'geojson'
import { REGIONS } from '@/lib/regions'
import { YANO_MINING } from '@/data/mocks/yanomami-mining'
import { INDIGENOUS_LANDS, AMAZON_BIOME, polygonCentroid } from '@/data/layers/indigenous-lands'
import { AFFECTED_AREAS } from '@/data/layers/affected-areas'
import { worldWithHoleFC } from '@/lib/polygon-bbox'
import { useFunaiTi } from '@/lib/useFunaiTi'
import { useDeterAlerts } from '@/lib/useDeterAlerts'
import { useIbgeMunicipios, UF_CODE_BY_REGION } from '@/lib/useIbgeMunicipios'
import { polygonBbox } from '@/lib/polygon-bbox'
import {
  TERRABRASILIS_FUNAI_URL,
  DETER_WFS_URL,
  IBGE_MALHAS_URL,
  ISA_TI_PORTAL,
  funaiSiciUrl,
  tiProfileUrl,
} from '@/lib/links'
import { useApp } from '@/lib/store'
import { useAsfGranules } from '@/lib/useAsfGranules'
import { useBrazilCoverage } from '@/lib/useBrazilCoverage'
import { GIBS_BY_REGION, TRUE_COLOR_LAYER, gibsMaxZoom, gibsTileUrl, type GibsLayer } from '@/lib/gibs'
import { useI18n, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { hasWebGL2 } from '@/lib/webgl-support'
import { AoiLayersPopup } from './AoiLayersPopup'
import { CommunityAreas, CommunityPoints } from './CommunityLayers'
import { CommunityPin } from './CommunityPin'
import { SarPreview } from './SarPreview'
import { MapFallback } from './MapFallback'
import { AMAZON_WATER_BOUNDS, FLOOD_ATTRIBUTION, waterTileTemplate, isObservedFlood, isWaterOutlook, NASA_FLOOD_ATTRIBUTION, gwisMapUrl, GWIS_ATTRIBUTION, type WaterLayer, type ForecastMapProps } from '@/lib/predictive-models'
import { drawAmazonForecastTile } from '@/lib/amazon-forecast-tiles'
import { FloodProbability } from './FloodProbability'
import { NisarImagery } from './NisarImagery'
import { inAmazon } from '@/lib/amazon'

const BASEMAP_URL = 'https://tiles.openfreemap.org/styles/dark'

maplibregl.addProtocol('amazon-forecast', async ({ url }, { signal }) => {
  const [kind, value, date, zoom, column, row] = url.slice('amazon-forecast://'.length).split('/')
  const tileUrl = kind === 'fire' ? gwisMapUrl(date, '{bbox}') : waterTileTemplate(value as WaterLayer, date)
  const canvas = document.createElement('canvas')
  await drawAmazonForecastTile(canvas, tileUrl, { z: Number(zoom), x: Number(column), y: Number(row) }, signal)
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((image) => image ? resolve(image) : reject(new Error('Could not encode the fire tile'))))
  return { data: await blob.arrayBuffer() }
})

// Basemap style already credits OpenFreeMap, OpenMapTiles and OpenStreetMap; this adds the community data
// sources (full list in ATTRIBUTIONS.md). Kept short so the expanded credit stays on one line above the timeline.
const MAP_ATTRIBUTION = 'Comunidades: IBGE, FUNAI, MMA via INPE TerraBrasilis'

// Moderate tilt keeps the 3D feel without loading low-detail tiles across a long horizon.
const PITCH = 40
const BEARING = -12
const TERRAIN: maplibregl.TerrainSpecification = { source: 'terrain-dem', exaggeration: 1.4 }

// Cloud-free Sentinel-2 mosaic at 10 m: stays sharp at the zooms where the NASA rasters run out.
// EOX publishes it under CC BY-NC-SA 4.0 (non-commercial use with credit).
const SATELLITE_TILES =
  'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg'
const SATELLITE_ATTRIBUTION =
  'Sentinel-2 cloudless 2025 by <a href="https://cloudless.eox.at" target="_blank" rel="noopener">EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data 2025), CC BY-NC-SA 4.0'
// Basemap (OpenMapTiles schema) geometry that would cover the imagery; names and borders stay on top.
const HIDDEN_UNDER_SATELLITE = new Set(['transportation', 'building', 'aeroway', 'park', 'landuse', 'landcover', 'water'])

const isBasemapLayer = (map: maplibregl.Map, layer: maplibregl.LayerSpecification) =>
  'source' in layer &&
  typeof layer.source === 'string' &&
  !layer.source.startsWith('gibs') &&
  map.getSource(layer.source)?.type === 'vector'

// Restyles the basemap for imagery and returns a function that undoes it. The dark style interleaves
// labels with roads and buildings, so no single insertion point keeps those under the satellite layer:
// they are hidden instead. Its labels are dark-on-dark, so they switch to light text with a dark halo.
function adaptBasemapToImagery(map: maplibregl.Map): () => void {
  const undo: Array<() => void> = []
  for (const layer of map.getStyle().layers) {
    if (!isBasemapLayer(map, layer)) continue
    if (layer.type === 'symbol') {
      const color = map.getPaintProperty(layer.id, 'text-color')
      const halo = map.getPaintProperty(layer.id, 'text-halo-color')
      const width = map.getPaintProperty(layer.id, 'text-halo-width')
      map.setPaintProperty(layer.id, 'text-color', 'hsl(0 0% 94%)')
      map.setPaintProperty(layer.id, 'text-halo-color', 'hsl(222 47% 6% / 0.85)')
      map.setPaintProperty(layer.id, 'text-halo-width', 1.4)
      undo.push(() => {
        map.setPaintProperty(layer.id, 'text-color', color)
        map.setPaintProperty(layer.id, 'text-halo-color', halo)
        map.setPaintProperty(layer.id, 'text-halo-width', width)
      })
      continue
    }
    if (!('source-layer' in layer) || !HIDDEN_UNDER_SATELLITE.has(layer['source-layer'] ?? '')) continue
    if (map.getLayoutProperty(layer.id, 'visibility') === 'none') continue
    map.setLayoutProperty(layer.id, 'visibility', 'none')
    undo.push(() => map.setLayoutProperty(layer.id, 'visibility', 'visible'))
  }
  return () => {
    for (const fn of undo) fn()
  }
}

// Coarse NASA rasters (km-scale pixels) fade out past their native zoom instead of smearing over the map.
function rasterFade(layer: GibsLayer, opacity: number) {
  const z = gibsMaxZoom(layer)
  return ['interpolate', ['linear'], ['zoom'], z, opacity, z + 1.5, opacity * 0.4, z + 3, 0] as [
    'interpolate',
    ['linear'],
    ['zoom'],
    number,
    number,
    number,
    number,
    number,
    number,
  ]
}

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
  const nasaOverlay = useApp((s) => s.nasaOverlay)
  const trueColorOverlay = useApp((s) => s.trueColorOverlay)
  const selectPolygon = useApp((s) => s.selectPolygon)
  const setNisarPoint = useApp((s) => s.setNisarPoint)
  const setNisarNotice = useApp((s) => s.setNisarNotice)
  const t = useT()

  const region = useMemo(() => REGIONS.find((r) => r.id === activeRegion)!, [activeRegion])
  const gibs = GIBS_BY_REGION[activeRegion]

  const focusedTi = useApp((s) => s.focusedTi)
  const localTiFeature = useMemo(
    () => INDIGENOUS_LANDS.features.find((f) => f.properties.name === focusedTi) ?? null,
    [focusedTi]
  )
  // Real FUNAI boundary via TerraBrasilis WFS (falls back to local simplified polygon while loading or on error).
  const funai = useFunaiTi(focusedTi)
  const focusedTiFeature = funai.feature ?? localTiFeature
  const focusedSourceLabel = funai.feature
    ? 'FUNAI oficial · TerraBrasilis/INPE'
    : funai.loading
    ? 'carregando FUNAI…'
    : 'contorno simplificado (FUNAI indisp.)'

  const focusedBbox = useMemo(() => {
    if (!focusedTiFeature) return null
    if (focusedTiFeature.geometry.type === 'MultiPolygon') {
      let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity
      for (const poly of focusedTiFeature.geometry.coordinates) {
        for (const ring of poly) {
          for (const [lon, lat] of ring) {
            if (lon < minLon) minLon = lon
            if (lat < minLat) minLat = lat
            if (lon > maxLon) maxLon = lon
            if (lat > maxLat) maxLat = lat
          }
        }
      }
      return [minLon, minLat, maxLon, maxLat] as [number, number, number, number]
    }
    return polygonBbox(focusedTiFeature.geometry as import('geojson').Polygon)
  }, [focusedTiFeature])

  const deter = useDeterAlerts(focusedBbox)

  const [municipiosOn, setMunicipiosOn] = useState(false)
  const ibge = useIbgeMunicipios(UF_CODE_BY_REGION[activeRegion] ?? null, municipiosOn)

  const [mapLoaded, setMapLoaded] = useState(false)
  const [terrainOn, setTerrainOn] = useState(false)
  const [satelliteOn, setSatelliteOn] = useState(false)
  // First label layer of the basemap: imagery goes under it so place and river names stay readable.
  const [labelLayerId, setLabelLayerId] = useState<string>()
  const [zoom, setZoom] = useState(region.zoom)

  const asf = useAsfGranules(region)
  const coverage = useBrazilCoverage()

  const coverageFC: FeatureCollection = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: coverage.data.map((g, i) => ({
        type: 'Feature',
        geometry: g.footprint,
        properties: {
          id: g.id,
          dataset: g.dataset,
          startTime: g.startTime,
          polarization: g.polarization.join('+'),
          ageIdx: Math.min(i, 100),
        },
      })),
    }),
    [coverage.data]
  )

  const footprintsFC: FeatureCollection = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: asf.data.slice(0, 8).map((g, i) => ({
        type: 'Feature',
        geometry: g.footprint,
        properties: {
          id: g.id,
          dataset: g.dataset,
          startTime: g.startTime,
          polarization: g.polarization.join('+'),
          flightDirection: g.flightDirection,
          age: i,
        },
      })),
    }),
    [asf.data]
  )

  useEffect(() => {
    const m = mapRef.current
    if (!m || !mapLoaded) return
    // The region's layer balloon opens above its centre, so park the centre low enough for it to fit.
    m.flyTo({
      center: region.center,
      zoom: region.zoom,
      pitch: PITCH,
      bearing: BEARING,
      offset: [0, Math.round(m.getContainer().clientHeight * 0.18)],
      duration: 1600,
      essential: true,
    })
  }, [region, mapLoaded])

  // Terrain is opt-in: draping the map over the DEM renders through an offscreen texture,
  // which costs frames and softens every layer on top of it.
  useEffect(() => {
    const m = mapRef.current?.getMap()
    if (!m || !mapLoaded) return
    if (terrainOn && !m.getSource(TERRAIN.source)) return
    m.setTerrain(terrainOn ? TERRAIN : null)
  }, [terrainOn, mapLoaded])

  useEffect(() => {
    const m = mapRef.current?.getMap()
    if (!m || !mapLoaded || !satelliteOn) return
    return adaptBasemapToImagery(m)
  }, [satelliteOn, mapLoaded])

  useEffect(() => {
    if (!focusedTi) return
    const m = mapRef.current
    if (!m) return
    const feature = INDIGENOUS_LANDS.features.find((f) => f.properties.name === focusedTi)
    if (!feature) return
    const [lon, lat] = polygonCentroid(feature.geometry)
    m.flyTo({ center: [lon, lat], zoom: 7.5, pitch: 40, bearing: 0, duration: 1400, essential: true })
  }, [focusedTi])

  const flyTarget = useApp((s) => s.flyTarget)
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
  }, [flyTarget])

  const changeFC: FeatureCollection = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: YANO_MINING.map((p) => ({
        type: 'Feature',
        geometry: p.geometry,
        properties: {
          id: p.id,
          name: p.name,
          displacement: p.displacementMmPerYear,
          coherence: p.coherence,
        },
      })),
    }),
    []
  )

  const onClick = (e: MapLayerMouseEvent) => {
    if (onRiverSelect) {
      onRiverSelect([e.lngLat.lng, e.lngLat.lat])
      return
    }
    const f = e.features?.[0]
    if (!f) {
      selectPolygon(null)
      // Click on the map → every NISAR image of that spot (Amazon biome only).
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

  const counts = {
    asfCount: asf.data.length,
    coverageCount: coverage.data.length,
    coverageLoading: coverage.loading,
  }

  if (!hasWebGL2()) {
    return (
      <div className="relative h-full w-full">
        <MapFallback region={region} fireDate={fireDate} floodLayer={floodLayer} observedDate={observedDate} floodFocus={floodFocus} floodSignals={floodSignals} riverPoint={riverPoint} riverChance={riverChance} onRiverSelect={onRiverSelect} onFireTileError={onFireTileError} onFloodTileError={onFloodTileError} />
        <OverlayLegend {...counts} />
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
          longitude: region.center[0],
          latitude: region.center[1],
          zoom: region.zoom,
          pitch: PITCH,
          bearing: BEARING,
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
        onZoomEnd={(e) => setZoom(e.viewState.zoom)}
        onLoad={(e) => {
          setLabelLayerId(e.target.getStyle().layers.find((l) => l.type === 'symbol')?.id ?? 'amazon-biome-fill')
          setMapLoaded(true)
        }}
        attributionControl={{ compact: true, customAttribution: MAP_ATTRIBUTION }}
      >
        <Source
          id="terrain-dem"
          type="raster-dem"
          tiles={['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png']}
          tileSize={256}
          encoding="terrarium"
          maxzoom={15}
          attribution="AWS Terrain Tiles"
        />

        {satelliteOn && labelLayerId && (
          <Source
            id="satellite"
            type="raster"
            tiles={[SATELLITE_TILES]}
            tileSize={256}
            maxzoom={14}
            attribution={SATELLITE_ATTRIBUTION}
          >
            <Layer
              id="satellite-layer"
              type="raster"
              beforeId={labelLayerId}
              paint={{ 'raster-brightness-max': 0.88, 'raster-saturation': -0.05 }}
            />
          </Source>
        )}

        <Source id="amazon-biome" type="geojson" data={AMAZON_BIOME}>
          <Layer
            id="amazon-biome-fill"
            type="fill"
            paint={{
              'fill-color': 'hsl(145 65% 35%)',
              'fill-opacity': 0.08,
            }}
          />
          <Layer
            id="amazon-biome-line"
            type="line"
            paint={{
              'line-color': 'hsl(145 70% 55%)',
              'line-opacity': 0.45,
              'line-width': 1.3,
              'line-dasharray': [3, 2],
            }}
          />
        </Source>

        <CommunityAreas />
        {/* Invisible anchor: async overlays insert below it so community pins stay on top. */}
        <Layer id="community-points-anchor" type="background" paint={{ 'background-opacity': 0 }} />
        {coverage.data.length > 0 && (
          <Source id="br-coverage" type="geojson" data={coverageFC}>
            <Layer
              id="br-coverage-fill" beforeId="reserves-fill"
              type="fill"
              paint={{
                'fill-color': 'hsl(190 95% 55%)',
                // Swath fills read as a wash once zoomed in; keep them for the national overview only.
                'fill-opacity': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  4,
                  ['interpolate', ['linear'], ['get', 'ageIdx'], 0, 0.2, 100, 0.05],
                  7,
                  0,
                ],
              }}
            />
            <Layer
              id="br-coverage-outline" beforeId="reserves-fill"
              type="line"
              paint={{
                'line-color': 'hsl(190 100% 75%)',
                'line-opacity': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  4,
                  ['interpolate', ['linear'], ['get', 'ageIdx'], 0, 0.7, 100, 0.15],
                  9,
                  ['interpolate', ['linear'], ['get', 'ageIdx'], 0, 0.35, 100, 0.08],
                ],
                'line-width': 1.0,
              }}
            />
          </Source>
        )}

        {trueColorOverlay && (
          <Source
            id="gibs-truecolor"
            type="raster"
            tiles={[gibsTileUrl(TRUE_COLOR_LAYER)]}
            tileSize={256}
            maxzoom={gibsMaxZoom(TRUE_COLOR_LAYER)}
            attribution="NASA GIBS · MODIS"
          >
            <Layer
              id="gibs-truecolor-layer"
              beforeId="reserves-fill"
              type="raster"
              maxzoom={gibsMaxZoom(TRUE_COLOR_LAYER) + 3}
              paint={{ 'raster-opacity': rasterFade(TRUE_COLOR_LAYER, 0.55), 'raster-saturation': -0.1 }}
            />
          </Source>
        )}

        {nasaOverlay && gibs?.kind === 'raster' && (
          <Source
            id="gibs-raster"
            key={`gibs-${gibs.identifier}`}
            type="raster"
            tiles={[gibsTileUrl(gibs)]}
            tileSize={256}
            maxzoom={gibsMaxZoom(gibs)}
            attribution={`NASA GIBS · ${gibs.sensor}`}
          >
            <Layer
              id="gibs-raster-layer"
              beforeId="reserves-fill"
              type="raster"
              maxzoom={gibsMaxZoom(gibs) + 3}
              paint={{ 'raster-opacity': rasterFade(gibs, 0.6) }}
            />
          </Source>
        )}

        {nasaOverlay && gibs?.kind === 'vector' && (
          <Source
            id="gibs-vector"
            key={`gibs-${gibs.identifier}`}
            type="vector"
            tiles={[gibsTileUrl(gibs)]}
            minzoom={0}
            maxzoom={7}
            attribution={`NASA GIBS · ${gibs.sensor}`}
          >
            <Layer
              id="gibs-vector-glow" beforeId="community-points-anchor"
              type="circle"
              source-layer={gibs.identifier}
              paint={{
                'circle-radius': 10,
                'circle-color': gibs.paintColor,
                'circle-opacity': 0.25,
                'circle-blur': 1,
              }}
            />
            <Layer
              id="gibs-vector-dot" beforeId="community-points-anchor"
              type="circle"
              source-layer={gibs.identifier}
              paint={{
                'circle-radius': 3.2,
                'circle-color': gibs.paintColor,
                'circle-stroke-color': '#fff',
                'circle-stroke-width': 0.6,
                'circle-opacity': 0.95,
              }}
            />
          </Source>
        )}

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
        {asf.data.length > 0 && (
          <Source id="asf-footprints" type="geojson" data={footprintsFC}>
            <Layer
              id="asf-footprints-fill" beforeId="community-points-anchor"
              type="fill"
              paint={{
                'fill-color': 'hsl(190 95% 60%)',
                // Swaths are ~250 km wide: zoomed in, the whole view sits inside several and the fills stack into a wash.
                'fill-opacity': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  6,
                  ['interpolate', ['linear'], ['get', 'age'], 0, 0.16, 8, 0.03],
                  8.5,
                  0,
                ],
              }}
            />
            <Layer
              id="asf-footprints-line" beforeId="community-points-anchor"
              type="line"
              paint={{
                'line-color': 'hsl(190 95% 70%)',
                'line-opacity': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  6,
                  ['interpolate', ['linear'], ['get', 'age'], 0, 0.95, 8, 0.2],
                  11,
                  ['interpolate', ['linear'], ['get', 'age'], 0, 0.45, 8, 0.1],
                ],
                'line-width': 1.2,
                'line-dasharray': [2, 1.5],
              }}
            />
          </Source>
        )}

        {activeRegion === 'YANO' && (
          <Source id="yano-change" type="geojson" data={changeFC}>
            <Layer
              id="yano-change-fill" beforeId="community-points-anchor"
              type="fill"
              paint={{
                'fill-color': [
                  'interpolate',
                  ['linear'],
                  ['get', 'displacement'],
                  -12,
                  'hsl(10, 85%, 40%)',
                  -8,
                  'hsl(20, 85%, 50%)',
                  -4,
                  'hsl(38, 85%, 58%)',
                  0,
                  'hsl(140, 30%, 45%)',
                  2,
                  'hsl(150, 60%, 45%)',
                ],
                'fill-opacity': 0.72,
              }}
            />
            <Layer
              id="yano-change-outline" beforeId="community-points-anchor"
              type="line"
              paint={{ 'line-color': 'hsl(0 0% 100% / 0.4)', 'line-width': 0.8 }}
            />
          </Source>
        )}

        <Source
          id="affected-areas"
          key={`affected-${activeRegion}`}
          type="geojson"
          data={AFFECTED_AREAS[activeRegion]}
        >
          <Layer
            id="affected-fill"
            type="fill"
            paint={{
              'fill-color': [
                'match',
                ['get', 'kind'],
                'mining', 'hsl(0, 95%, 55%)',
                'flood', 'hsl(210, 95%, 62%)',
                'drought-shrink', 'hsl(38, 95%, 60%)',
                'drought-original', 'hsl(200, 60%, 50%)',
                'hsl(0, 0%, 60%)',
              ],
              'fill-opacity': [
                'match',
                ['get', 'kind'],
                'drought-original', 0.08,
                0.45,
              ],
            }}
          />
          <Layer
            id="affected-outline"
            type="line"
            paint={{
              'line-color': [
                'match',
                ['get', 'kind'],
                'mining', 'hsl(0, 100%, 75%)',
                'flood', 'hsl(210, 95%, 80%)',
                'drought-shrink', 'hsl(38, 95%, 80%)',
                'drought-original', 'hsl(200, 60%, 75%)',
                'hsl(0, 0%, 80%)',
              ],
              'line-width': 2.2,
              'line-opacity': 1,
            }}
          />
          <Layer
            id="affected-label"
            type="symbol"
            layout={{
              'text-field': ['concat', ['to-string', ['get', 'area_km2']], ' km²'],
              'text-size': 13,
              'text-font': ['Noto Sans Regular'],
              'text-letter-spacing': 0.02,
            }}
            paint={{
              'text-color': '#fff',
              'text-halo-color': '#000',
              'text-halo-width': 2,
            }}
          />
        </Source>
        {focusedTi && focusedTiFeature && (
          <>
            <Source
              id="focused-ti-mask"
              key={`mask-${focusedTi}-${funai.feature ? 'f' : 'l'}`}
              type="geojson"
              data={worldWithHoleFC(
                focusedTiFeature.geometry.type === 'MultiPolygon'
                  ? focusedTiFeature.geometry.coordinates[0][0]
                  : (focusedTiFeature.geometry.coordinates[0] as number[][])
              )}
            >
              <Layer
                id="focused-ti-mask-fill"
                type="fill"
                paint={{ 'fill-color': 'hsl(222 47% 5%)', 'fill-opacity': 0.75 }}
              />
            </Source>
            <Source
              id="focused-ti-outline-src"
              key={`outline-${focusedTi}`}
              type="geojson"
              data={focusedTiFeature}
            >
              <Layer
                id="focused-ti-outline"
                type="line"
                paint={{
                  'line-color': 'hsl(190 95% 70%)',
                  'line-width': 2.5,
                  'line-opacity': 1,
                }}
              />
            </Source>
          </>
        )}
        {municipiosOn && ibge.data && (
          <Source id="ibge-municipios" type="geojson" data={ibge.data}>
            <Layer
              id="ibge-municipios-line"
              type="line"
              paint={{
                'line-color': 'hsl(0 0% 100% / 0.4)',
                'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.3, 10, 1.1],
                'line-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0, 8, 0.6, 11, 0.9],
              }}
            />
          </Source>
        )}
        {focusedTi && deter.features.features.length > 0 && (
          <Source
            id="deter-alerts"
            key={`deter-${focusedTi}`}
            type="geojson"
            data={deter.features}
          >
            <Layer
              id="deter-alerts-fill"
              type="fill"
              paint={{
                'fill-color': [
                  'case',
                  ['boolean', ['in', 'MINERACAO', ['upcase', ['coalesce', ['get', 'classname'], '']]], false], 'hsl(0 90% 60%)',
                  ['boolean', ['in', 'GARIMPO', ['upcase', ['coalesce', ['get', 'classname'], '']]], false], 'hsl(0 90% 60%)',
                  ['boolean', ['in', 'DESMATAMENTO', ['upcase', ['coalesce', ['get', 'classname'], '']]], false], 'hsl(28 95% 60%)',
                  ['boolean', ['in', 'DEGRADACAO', ['upcase', ['coalesce', ['get', 'classname'], '']]], false], 'hsl(48 85% 55%)',
                  'hsl(190 85% 60%)',
                ],
                'fill-opacity': 0.55,
              }}
            />
            <Layer
              id="deter-alerts-line"
              type="line"
              paint={{ 'line-color': '#fff', 'line-opacity': 0.75, 'line-width': 0.7 }}
            />
          </Source>
        )}
        <CommunityPoints />
        <AoiLayersPopup />
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
        {...counts}
        zoom={zoom}
        onZoomToData={(z) => mapRef.current?.getMap().easeTo({ zoom: z, duration: 900, essential: true })}
        terrainOn={terrainOn}
        onToggleTerrain={() => setTerrainOn((v) => !v)}
        satelliteOn={satelliteOn}
        onToggleSatellite={() => setSatelliteOn((v) => !v)}
        municipiosOn={municipiosOn}
        onToggleMunicipios={() => setMunicipiosOn((v) => !v)}
        municipiosLoading={ibge.loading}
      />
      {focusedTi && (
        <FocusedTiSourceBadge
          tiName={focusedTi}
          funaiProps={funai.feature?.properties ?? null}
          localProps={localTiFeature?.properties ?? null}
          sourceLabel={focusedSourceLabel}
          loading={funai.loading}
          error={funai.error}
          deterCount={deter.count}
          deterLoading={deter.loading}
        />
      )}
    </div>
  )
}

function FocusedTiSourceBadge({
  tiName,
  funaiProps,
  localProps,
  sourceLabel,
  loading,
  error,
  deterCount,
  deterLoading,
}: {
  tiName: string
  funaiProps: import('@/lib/useFunaiTi').FunaiTiProps | null
  localProps: import('@/data/layers/indigenous-lands').TiProps | null
  sourceLabel: string
  loading: boolean
  error: string | null
  deterCount: number
  deterLoading: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="pointer-events-auto absolute left-4 bottom-24 max-w-[320px] rounded-lg border border-sar-cyan/40 bg-card/95 backdrop-blur-md shadow-xl">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-sar-cyan animate-pulse-soft" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-sar-cyan truncate">
            {tiName}
          </div>
          <div className="text-[11px] font-mono text-muted-foreground truncate">
            {loading ? 'FUNAI…' : sourceLabel.replace('FUNAI oficial · ', '')}
          </div>
        </div>
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="border-t border-border/50 px-3 py-2">
          {funaiProps && (
            <div className="grid gap-0.5 text-[12px] text-foreground/90 leading-snug">
              <div>
                <span className="text-muted-foreground">Nome FUNAI:</span> {funaiProps.terrai_nom}
              </div>
              {funaiProps.etnia_nome && (
                <div>
                  <span className="text-muted-foreground">Etnia:</span> {funaiProps.etnia_nome}
                </div>
              )}
              {funaiProps.fase_ti && (
                <div>
                  <span className="text-muted-foreground">Fase:</span> {funaiProps.fase_ti}
                </div>
              )}
              <div className="text-[11px] text-muted-foreground/80">CÓD FUNAI {funaiProps.terrai_cod}</div>
            </div>
          )}
          {localProps && (
            <div className="mt-1.5 grid gap-0.5 text-[12px] text-foreground/90 leading-snug border-t border-border/50 pt-1.5">
              <div>
                <span className="text-muted-foreground">Área ISA:</span>{' '}
                {localProps.area_km2.toLocaleString('pt-BR')} km²
              </div>
              {localProps.population && (
                <div>
                  <span className="text-muted-foreground">População ISA:</span>{' '}
                  {localProps.population.toLocaleString('pt-BR')}
                </div>
              )}
            </div>
          )}
          <div className="mt-1.5 flex items-center justify-between text-[12px] border-t border-border/50 pt-1.5">
            <span className="text-muted-foreground">DETER-Amz (1 ano):</span>
            <span className="font-mono font-semibold text-foreground">
              {deterLoading ? '…' : `${deterCount} alertas`}
            </span>
          </div>
          {error && <div className="mt-1 text-[11px] text-destructive">{error}</div>}

          <div className="mt-1.5 flex flex-wrap gap-1 border-t border-border/50 pt-1.5">
            <SourceLink href={funaiSiciUrl(tiName)}>FUNAI · {tiName.replace(/^TI\s+/, '')}</SourceLink>
            {funaiProps && <SourceLink href={TERRABRASILIS_FUNAI_URL}>TerraBrasilis WFS</SourceLink>}
            {deterCount > 0 && <SourceLink href={DETER_WFS_URL}>DETER-Amz</SourceLink>}
            {localProps && <SourceLink href={tiProfileUrl(0)}>ISA · Terras Indígenas</SourceLink>}
          </div>

          <div className="mt-1 text-[10px] font-mono text-muted-foreground/70 leading-relaxed">
            Geometria:{' '}
            <a
              href={TERRABRASILIS_FUNAI_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              FUNAI via TerraBrasilis/INPE WFS
            </a>{' '}
            · Alertas:{' '}
            <a
              href={DETER_WFS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              DETER/INPE WFS
            </a>{' '}
            · Metadata:{' '}
            <a
              href={ISA_TI_PORTAL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              ISA
            </a>{' '}
            (snapshot local)
          </div>
        </div>
      )}
    </div>
  )
}

function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-full border border-sar-cyan/30 bg-sar-cyan/10 px-2 py-0.5 text-[11px] font-mono text-sar-cyan hover:bg-sar-cyan/20 transition-colors"
    >
      {children}
      <span aria-hidden="true">↗</span>
    </a>
  )
}

function OverlayLegend({
  asfCount,
  coverageCount,
  coverageLoading,
  zoom,
  onZoomToData,
  terrainOn,
  onToggleTerrain,
  satelliteOn,
  onToggleSatellite,
  municipiosOn,
  onToggleMunicipios,
  municipiosLoading,
}: {
  asfCount: number
  coverageCount: number
  coverageLoading: boolean
  zoom?: number
  onZoomToData?: (zoom: number) => void
  terrainOn?: boolean
  onToggleTerrain?: () => void
  satelliteOn?: boolean
  onToggleSatellite?: () => void
  municipiosOn?: boolean
  onToggleMunicipios?: () => void
  municipiosLoading?: boolean
}) {
  const t = useT()
  const activeRegion = useApp((s) => s.activeRegion)
  const nasaOverlay = useApp((s) => s.nasaOverlay)
  const gibs = GIBS_BY_REGION[activeRegion]
  const coarse = !!gibs && gibs.kind === 'raster' && zoom !== undefined && zoom > gibsMaxZoom(gibs) + 1

  return (
    <div className="pointer-events-none absolute right-3 top-3 bottom-24 hidden w-[min(272px,calc(100%-24px))] sm:flex flex-col items-stretch gap-2 overflow-y-auto overscroll-contain [scrollbar-width:none]">
      <div className="pointer-events-auto glass rounded-xl px-3 py-2.5 text-[13px] text-foreground/85">
        <div className="text-[13px] font-semibold text-foreground mb-1.5">{t('community.legend')}</div>
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <CommunityPin kind="indigenous" size={22} />
            {t('community.indigenous')}
          </div>
          <div className="flex items-center gap-2">
            <CommunityPin kind="riverside" size={22} />
            {t('community.riverside')}
          </div>
          <div className="flex items-center gap-2">
            <span className="mx-[3px] inline-block h-0 w-4 border-t-2 border-dashed border-[hsl(174_72%_52%)]" />
            {t('community.reserves')}
          </div>
        </div>

        <div className="mt-2.5 grid gap-1 border-t border-border/60 pt-2 text-[12px] text-foreground/70">
          <div>
            <span className="text-sar-cyan">▭</span> {t('coverage.title')}{' '}
            <span className="text-foreground/50">
              {coverageLoading ? t('coverage.loading') : `(${coverageCount})`}
            </span>
          </div>
          {asfCount > 0 && (
            <div>
              <span className="text-sar-cyan">▭</span> {asfCount} on AOI · ASF
            </div>
          )}
          {nasaOverlay && gibs && (
            <div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: gibs.paintColor }} />
                <span className="truncate" title={gibs.explanation}>
                  {gibs.legendLabel}
                </span>
              </div>
              {coarse && (
                <div className="pl-3.5 text-[11px] leading-snug text-foreground/50">
                  {t('overlay.coarse')}
                  {onZoomToData && (
                    <button
                      type="button"
                      onClick={() => onZoomToData(gibsMaxZoom(gibs) + 0.5)}
                      className="ml-1 rounded-sm font-medium text-sar-cyan underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {t('overlay.zoomOut')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {activeRegion === 'YANO' && nasaOverlay && !gibs && <div>{t('overlay.none')}</div>}
        </div>

        {(onToggleSatellite || onToggleTerrain) && (
          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            {onToggleSatellite && (
              <MapToggle
                icon={Satellite}
                label={t('map.satellite')}
                hint={t('map.satelliteHint')}
                on={!!satelliteOn}
                onToggle={onToggleSatellite}
              />
            )}
            {onToggleTerrain && (
              <MapToggle icon={Mountain} label={t('map.terrain')} on={!!terrainOn} onToggle={onToggleTerrain} />
            )}
          </div>
        )}
        {onToggleMunicipios && (
          <div className="mt-1.5 flex items-stretch gap-1">
            <button
              onClick={onToggleMunicipios}
              className={cn(
                'flex flex-1 items-center justify-between rounded-md border px-2 py-1 text-[12px] transition-colors',
                municipiosOn
                  ? 'border-primary/40 bg-primary/10 text-foreground'
                  : 'border-border/60 bg-background/40 text-muted-foreground hover:text-foreground'
              )}
              title="Limites municipais (IBGE Malhas, visível ao aproximar)"
            >
              <span>Municípios (IBGE)</span>
              <span className="font-mono text-[11px] text-muted-foreground/70">
                {municipiosLoading ? '…' : municipiosOn ? 'on' : 'off'}
              </span>
            </button>
            <a
              href={IBGE_MALHAS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-md border border-border/60 bg-background/40 px-2 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
              title="Documentação IBGE Malhas API"
            >
              ↗
            </a>
          </div>
        )}
      </div>

      <div className="pointer-events-auto hidden md:block">
        <SarPreview />
      </div>
    </div>
  )
}

function MapToggle({
  icon: Icon,
  label,
  hint,
  on,
  onToggle,
}: {
  icon: LucideIcon
  label: string
  hint?: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      title={hint}
      className={cn(
        'flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[12px] font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        on
          ? 'border-sar-cyan/60 bg-sar-cyan/15 text-foreground'
          : 'border-border/70 text-foreground/70 hover:bg-muted/60 hover:text-foreground'
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
      <span className={cn('ml-auto h-1.5 w-1.5 shrink-0 rounded-full', on ? 'bg-sar-cyan' : 'bg-foreground/25')} />
    </button>
  )
}
