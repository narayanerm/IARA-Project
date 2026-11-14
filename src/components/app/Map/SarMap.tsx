import { useEffect, useMemo, useRef } from 'react'
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
import { useApp } from '@/lib/store'
import { GIBS_BY_REGION, TRUE_COLOR_LAYER, gibsTileUrl } from '@/lib/gibs'
import { useT } from '@/lib/i18n'
import { hasWebGL2 } from '@/lib/webgl-support'
import { AoiLayersPopup } from './AoiLayersPopup'
import { TiTargets } from './TiTargets'
import { MapFallback } from './MapFallback'
import { NisarImagery } from './NisarImagery'
import { inAmazon } from '@/lib/amazon'

const BASEMAP_URL = 'https://tiles.openfreemap.org/styles/dark'

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
  const focusedTiFeature = useMemo(
    () => INDIGENOUS_LANDS.features.find((f) => f.properties.name === focusedTi) ?? null,
    [focusedTi]
  )

  useEffect(() => {
    const m = mapRef.current
    if (!m) return
    m.flyTo({
      center: region.center,
      zoom: region.zoom,
      pitch: 55,
      bearing: -18,
      duration: 1600,
      essential: true,
    })
  }, [region])

  useEffect(() => {
    if (!focusedTi) return
    const m = mapRef.current
    if (!m) return
    const feature = INDIGENOUS_LANDS.features.find((f) => f.properties.name === focusedTi)
    if (!feature) return
    const [lon, lat] = polygonCentroid(feature.geometry)
    m.flyTo({ center: [lon, lat], zoom: 7.5, pitch: 40, bearing: 0, duration: 1400, essential: true })
  }, [focusedTi])

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

  if (!hasWebGL2()) {
    return (
      <div className="relative h-full w-full">
        <MapFallback region={region} />
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
          longitude: region.center[0],
          latitude: region.center[1],
          zoom: region.zoom,
          pitch: 55,
          bearing: -18,
        }}
        maxPitch={75}
        mapStyle={BASEMAP_URL}
        terrain={{ source: 'terrain-dem', exaggeration: 1.6 }}
        interactiveLayerIds={activeRegion === 'YANO' ? ['yano-change-fill'] : []}
        onClick={onClick}
        attributionControl={false}
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

        <Source id="amazon-biome" type="geojson" data={AMAZON_BIOME}>
          <Layer
            id="amazon-biome-fill"
            type="fill"
            paint={{
              'fill-color': 'hsl(142 29% 24%)',
              'fill-opacity': 0.08,
            }}
          />
          <Layer
            id="amazon-biome-line"
            type="line"
            paint={{
              'line-color': 'hsl(142 32% 46%)',
              'line-opacity': 0.45,
              'line-width': 1.3,
              'line-dasharray': [3, 2],
            }}
          />
        </Source>

        <Source id="indigenous-lands" type="geojson" data={INDIGENOUS_LANDS}>
          <Layer
            id="ti-fill"
            type="fill"
            paint={{
              'fill-color': 'hsl(19 85% 61%)',
              'fill-opacity': 0.14,
            }}
          />
          <Layer
            id="ti-line"
            type="line"
            paint={{
              'line-color': 'hsl(19 90% 68%)',
              'line-opacity': 0.75,
              'line-width': 1.2,
            }}
          />
          <Layer
            id="ti-label"
            type="symbol"
            layout={{
              'text-field': ['get', 'name'],
              'text-size': 10,
              'text-font': ['Noto Sans Regular'],
              'text-letter-spacing': 0.04,
              'text-max-width': 8,
            }}
            paint={{
              'text-color': 'hsl(19 90% 82%)',
              'text-halo-color': 'hsla(222, 47%, 5%, 0.9)',
              'text-halo-width': 1.4,
            }}
          />
        </Source>
        {trueColorOverlay && (
          <Source
            id="gibs-truecolor"
            type="raster"
            tiles={[gibsTileUrl(TRUE_COLOR_LAYER)]}
            tileSize={256}
            attribution="NASA GIBS, MODIS"
          >
            <Layer
              id="gibs-truecolor-layer"
              type="raster"
              paint={{ 'raster-opacity': 0.55, 'raster-saturation': -0.1 }}
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
            attribution={`NASA GIBS, ${gibs.sensor}`}
          >
            <Layer id="gibs-raster-layer" type="raster" paint={{ 'raster-opacity': 0.72 }} />
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
              id="gibs-vector-dot"
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

        {activeRegion === 'YANO' && (
          <Source id="yano-change" type="geojson" data={changeFC}>
            <Layer
              id="yano-change-fill"
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
              id="yano-change-outline"
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
              key={`mask-${focusedTi}`}
              type="geojson"
              data={worldWithHoleFC(focusedTiFeature.geometry.coordinates[0])}
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
        <TiTargets />
        <AoiLayersPopup />
      </Map>

      <OverlayLegend />
    </div>
  )
}

function OverlayLegend() {
  const t = useT()
  const activeRegion = useApp((s) => s.activeRegion)
  const nasaOverlay = useApp((s) => s.nasaOverlay)
  const gibs = GIBS_BY_REGION[activeRegion]

  return (
    <div className="pointer-events-none absolute top-4 right-4 flex flex-col items-end gap-2">
      {nasaOverlay && gibs && (
        <div className="glass rounded-md px-2.5 py-1.5 text-[12px] tabular-nums text-muted-foreground max-w-[260px] text-right">
          <span
            className="inline-block h-2 w-2 rounded-full mr-1 align-middle"
            style={{ background: gibs.paintColor }}
          />
          {gibs.legendLabel}
          <div className="text-[13px] opacity-70 mt-0.5 leading-tight">{gibs.explanation}</div>
        </div>
      )}
      {activeRegion === 'YANO' && nasaOverlay && !gibs && (
        <div className="glass rounded-md px-2.5 py-1.5 text-[12px] tabular-nums text-muted-foreground max-w-[260px] text-right">
          {t('overlay.none')}
        </div>
      )}
    </div>
  )
}
