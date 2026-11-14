import { useEffect, useMemo, useRef, useState } from 'react'
import Map, {
  Layer,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from 'react-map-gl/maplibre'
import * as maplibregl from 'maplibre-gl'
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
import { useApp, useMapView, useUi } from '@/lib/store'
import { useAsfGranules } from '@/lib/useAsfGranules'
import { useBrazilCoverage } from '@/lib/useBrazilCoverage'
import { GIBS_BY_REGION, TRUE_COLOR_LAYER, gibsMaxZoom, gibsTileUrl, type GibsLayer } from '@/lib/gibs'
import { useT } from '@/lib/i18n'
import { hasWebGL2 } from '@/lib/webgl-support'
import { AoiLayersPopup } from './AoiLayersPopup'
import { CommunityAreas, CommunityPoints } from './CommunityLayers'
import { MapFallback } from './MapFallback'
import { NisarImagery } from './NisarImagery'
import { inAmazon } from '@/lib/amazon'
import { AMAZON_BOUNDS, markExplore } from '@/lib/story'
import { CaseMarkers } from './CaseMarkers'

const BASEMAP_URL = 'https://tiles.openfreemap.org/styles/dark'

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

// Room around the basin for the rails, the header and the floating ask bar.
function overviewPadding() {
  const small = typeof window !== 'undefined' && window.innerWidth < 640
  return small ? { top: 24, bottom: 120, left: 16, right: 16 } : { top: 40, bottom: 130, left: 60, right: 60 }
}

export function SarMap() {
  const mapRef = useRef<MapRef | null>(null)
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
  const flyNonce = useUi((s) => s.flyNonce)
  const overview = useUi((s) => s.stage === 'overview')
  const localTiFeature = useMemo(
    () => INDIGENOUS_LANDS.features.find((f) => f.properties.name === focusedTi) ?? null,
    [focusedTi]
  )
  // Real FUNAI boundary via TerraBrasilis WFS (falls back to local simplified polygon while loading or on error).
  const funai = useFunaiTi(focusedTi)
  const focusedTiFeature = funai.feature ?? localTiFeature

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

  const terrainOn = useMapView((s) => s.terrainOn)
  const satelliteOn = useMapView((s) => s.satelliteOn)
  const municipiosOn = useMapView((s) => s.municipiosOn)
  const zoomRequest = useMapView((s) => s.zoomRequest)
  const patchMapView = useMapView((s) => s.patch)
  const ibge = useIbgeMunicipios(UF_CODE_BY_REGION[activeRegion] ?? null, municipiosOn)

  const [mapLoaded, setMapLoaded] = useState(false)
  // First label layer of the basemap: imagery goes under it so place and river names stay readable.
  const [labelLayerId, setLabelLayerId] = useState<string>()

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
    if (overview) {
      m.fitBounds(AMAZON_BOUNDS, { padding: overviewPadding(), pitch: 0, bearing: 0, duration: 1400, essential: true })
      return
    }
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
  }, [region, mapLoaded, flyNonce, overview])

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
    const f = e.features?.[0]
    if (!f) {
      markExplore()
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

  // Publish what the legend outside the map needs to show.
  useEffect(() => {
    patchMapView({ asfCount: asf.data.length, coverageCount: coverage.data.length, coverageLoading: coverage.loading })
  }, [asf.data.length, coverage.data.length, coverage.loading, patchMapView])
  useEffect(() => {
    patchMapView({ municipiosLoading: ibge.loading })
  }, [ibge.loading, patchMapView])
  useEffect(() => {
    patchMapView({
      focusedInfo: focusedTi
        ? {
            funaiProps: funai.feature?.properties ?? null,
            localProps: localTiFeature?.properties ?? null,
            official: !!funai.feature,
            loading: funai.loading,
            error: funai.error,
            deterCount: deter.count,
            deterLoading: deter.loading,
          }
        : null,
    })
  }, [focusedTi, funai.feature, funai.loading, funai.error, localTiFeature, deter.count, deter.loading, patchMapView])
  useEffect(() => {
    if (!zoomRequest) return
    mapRef.current?.getMap().easeTo({ zoom: zoomRequest.zoom, duration: 900, essential: true })
  }, [zoomRequest])

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
        initialViewState={
          useUi.getState().stage === 'overview'
            ? { bounds: AMAZON_BOUNDS, fitBoundsOptions: { padding: overviewPadding() }, pitch: 0, bearing: 0 }
            : { longitude: region.center[0], latitude: region.center[1], zoom: region.zoom, pitch: PITCH, bearing: BEARING }
        }
        maxPitch={60}
        mapStyle={BASEMAP_URL}
        interactiveLayerIds={activeRegion === 'YANO' ? ['yano-change-fill'] : []}
        onClick={onClick}
        onZoomEnd={(e) => patchMapView({ zoom: e.viewState.zoom })}
        onLoad={(e) => {
          setLabelLayerId(e.target.getStyle().layers.find((l) => l.type === 'symbol')?.id ?? 'amazon-biome-fill')
          setMapLoaded(true)
          // Phones: start with the credits folded behind the (i) button so they do not cover the ask bar.
          if (e.target.getContainer().clientWidth < 640) {
            const attrib = e.target.getContainer().querySelector('.maplibregl-ctrl-attrib')
            attrib?.classList.remove('maplibregl-compact-show')
            attrib?.removeAttribute('open')
          }
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
            attribution="NASA GIBS, MODIS"
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
            attribution={`NASA GIBS, ${gibs.sensor}`}
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
            attribution={`NASA GIBS, ${gibs.sensor}`}
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
        {overview && <CaseMarkers />}
      </Map>
    </div>
  )
}
