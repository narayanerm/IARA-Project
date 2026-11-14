import { useEffect, useMemo, useRef, useState } from 'react'
import Map, {
  Layer,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from 'react-map-gl/maplibre'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import { REGIONS } from '@/lib/regions'
import { YANO_MINING } from '@/data/mocks/yanomami-mining'
import { AMAZON_BIOME } from '@/data/layers/indigenous-lands'
import { useApp } from '@/lib/store'
import { useAsfGranules } from '@/lib/useAsfGranules'
import { useBrazilCoverage } from '@/lib/useBrazilCoverage'
import { GIBS_BY_REGION, TRUE_COLOR_LAYER, gibsTileUrl } from '@/lib/gibs'
import { useT } from '@/lib/i18n'
import { hasWebGL2 } from '@/lib/webgl-support'
import { AoiLayersPopup } from './AoiLayersPopup'
import { CommunityAreas, CommunityPoints } from './CommunityLayers'
import { CommunityPin } from './CommunityPin'
import { SarPreview } from './SarPreview'
import { MapFallback } from './MapFallback'

const BASEMAP_URL = 'https://tiles.openfreemap.org/styles/dark'

// Basemap style already credits OpenFreeMap, OpenMapTiles and OpenStreetMap; this adds the community data sources.
const MAP_ATTRIBUTION = 'Comunidades: IBGE BC250 · TIs FUNAI e RESEX/RDS MMA via INPE TerraBrasilis'

export function SarMap() {
  const mapRef = useRef<MapRef | null>(null)
  const activeRegion = useApp((s) => s.activeRegion)
  const nasaOverlay = useApp((s) => s.nasaOverlay)
  const trueColorOverlay = useApp((s) => s.trueColorOverlay)
  const selectPolygon = useApp((s) => s.selectPolygon)

  const region = useMemo(() => REGIONS.find((r) => r.id === activeRegion)!, [activeRegion])
  const asf = useAsfGranules(region)
  const coverage = useBrazilCoverage()
  const gibs = GIBS_BY_REGION[activeRegion]

  const [mapLoaded, setMapLoaded] = useState(false)

  useEffect(() => {
    const m = mapRef.current
    if (!m || !mapLoaded) return
    m.flyTo({
      center: region.center,
      zoom: region.zoom,
      pitch: 55,
      bearing: -18,
      duration: 1600,
      essential: true,
    })
  }, [region, mapLoaded])

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

  const coverageFC: FeatureCollection = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: coverage.data.map<Feature<Polygon>>((g, i) => ({
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
      features: asf.data.slice(0, 8).map<Feature<Polygon>>((g, i) => ({
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

  const onClick = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0]
    if (!f) {
      selectPolygon(null)
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
        onLoad={() => setMapLoaded(true)}
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
                'fill-opacity': [
                  'interpolate',
                  ['linear'],
                  ['get', 'ageIdx'],
                  0,
                  0.32,
                  100,
                  0.08,
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
                  ['get', 'ageIdx'],
                  0,
                  0.85,
                  100,
                  0.18,
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
            attribution="NASA GIBS · MODIS"
          >
            <Layer
              id="gibs-truecolor-layer" beforeId="reserves-fill"
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
            attribution={`NASA GIBS · ${gibs.sensor}`}
          >
            <Layer id="gibs-raster-layer" beforeId="reserves-fill" type="raster" paint={{ 'raster-opacity': 0.72 }} />
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

        {asf.data.length > 0 && (
          <Source id="asf-footprints" type="geojson" data={footprintsFC}>
            <Layer
              id="asf-footprints-fill" beforeId="community-points-anchor"
              type="fill"
              paint={{
                'fill-color': 'hsl(190 95% 60%)',
                'fill-opacity': ['interpolate', ['linear'], ['get', 'age'], 0, 0.18, 8, 0.04],
              }}
            />
            <Layer
              id="asf-footprints-line" beforeId="community-points-anchor"
              type="line"
              paint={{
                'line-color': 'hsl(190 95% 70%)',
                'line-opacity': ['interpolate', ['linear'], ['get', 'age'], 0, 0.95, 8, 0.2],
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

        <CommunityPoints />
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
  const asfCount = useAsfGranules(REGIONS.find((r) => r.id === activeRegion)!).data.length
  const coverage = useBrazilCoverage()
  const gibs = GIBS_BY_REGION[activeRegion]

  return (
    <div className="pointer-events-none absolute right-3 top-3 bottom-32 flex w-[min(272px,calc(100%-24px))] flex-col items-stretch gap-2 overflow-y-auto overscroll-contain [scrollbar-width:none]">
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
              {coverage.loading ? t('coverage.loading') : `(${coverage.data.length})`}
            </span>
          </div>
          {asfCount > 0 && (
            <div>
              <span className="text-sar-cyan">▭</span> {asfCount} on AOI · ASF
            </div>
          )}
          {nasaOverlay && gibs && (
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: gibs.paintColor }} />
              <span className="truncate" title={gibs.explanation}>
                {gibs.legendLabel}
              </span>
            </div>
          )}
          {activeRegion === 'YANO' && nasaOverlay && !gibs && <div>{t('overlay.none')}</div>}
        </div>
      </div>

      <div className="pointer-events-auto hidden md:block">
        <SarPreview />
      </div>
    </div>
  )
}
