import { useEffect, useMemo, useRef, useState } from 'react'
import Map, {
  Layer,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from 'react-map-gl/maplibre'
import * as maplibregl from 'maplibre-gl'
import { Mountain, Satellite, type LucideIcon } from 'lucide-react'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import { REGIONS } from '@/lib/regions'
import { YANO_MINING } from '@/data/mocks/yanomami-mining'
import { AMAZON_BIOME } from '@/data/layers/indigenous-lands'
import { useApp } from '@/lib/store'
import { useAsfGranules } from '@/lib/useAsfGranules'
import { useBrazilCoverage } from '@/lib/useBrazilCoverage'
import { GIBS_BY_REGION, TRUE_COLOR_LAYER, gibsMaxZoom, gibsTileUrl, type GibsLayer } from '@/lib/gibs'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { hasWebGL2 } from '@/lib/webgl-support'
import { AoiLayersPopup } from './AoiLayersPopup'
import { CommunityAreas, CommunityPoints } from './CommunityLayers'
import { CommunityPin } from './CommunityPin'
import { SarPreview } from './SarPreview'
import { MapFallback } from './MapFallback'

const BASEMAP_URL = 'https://tiles.openfreemap.org/styles/dark'

// Basemap style already credits OpenFreeMap, OpenMapTiles and OpenStreetMap; this adds the community data
// sources (full list in ATTRIBUTIONS.md). Kept short so the expanded credit stays on one line above the timeline.
const MAP_ATTRIBUTION = 'Comunidades: IBGE, FUNAI, MMA via INPE TerraBrasilis'

// Moderate tilt keeps the 3D feel without loading low-detail tiles across a long horizon.
const PITCH = 40
const BEARING = -12

// Most of the basin sits below 200 m, where a 3D mesh shows no visible change; shading the
// slopes marks river valleys, terraces and the highlands, and costs one raster layer.
const RELIEF_LAYER = 'relief-hillshade'
const RELIEF_PAINT: maplibregl.HillshadeLayerSpecification['paint'] = {
  'hillshade-method': 'multidirectional',
  'hillshade-exaggeration': 0.75,
  'hillshade-shadow-color': 'hsl(222 60% 2%)',
  'hillshade-highlight-color': 'hsl(40 40% 88% / 0.45)',
  'hillshade-accent-color': 'hsl(222 40% 8%)',
}

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

const halfStep = (zoom: number) => Math.floor(zoom * 2) / 2

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
  const [reliefOn, setReliefOn] = useState(false)
  const [satelliteOn, setSatelliteOn] = useState(false)
  // First label layer of the basemap: imagery goes under it so place and river names stay readable.
  const [labelLayerId, setLabelLayerId] = useState<string>()
  // Half-level steps are all the legend needs; re-rendering the map tree on every zoom gesture is wasted work.
  const [zoom, setZoom] = useState(halfStep(region.zoom))

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

  useEffect(() => {
    const m = mapRef.current?.getMap()
    if (!m || !mapLoaded || !satelliteOn) return
    return adaptBasemapToImagery(m)
  }, [satelliteOn, mapLoaded])

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

  const counts = {
    asfCount: asf.data.length,
    coverageCount: coverage.data.length,
    coverageLoading: coverage.loading,
  }

  if (!hasWebGL2()) {
    return (
      <div className="relative h-full w-full">
        <MapFallback region={region} />
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
        onZoomEnd={(e) => setZoom(halfStep(e.viewState.zoom))}
        onLoad={(e) => {
          setLabelLayerId(e.target.getStyle().layers.find((l) => l.type === 'symbol')?.id ?? 'amazon-biome-fill')
          setMapLoaded(true)
        }}
        attributionControl={{ compact: true, customAttribution: MAP_ATTRIBUTION }}
      >
        {labelLayerId && (
          <Source
            id="terrain-dem"
            type="raster-dem"
            tiles={['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png']}
            tileSize={256}
            encoding="terrarium"
            maxzoom={13}
            attribution="AWS Terrain Tiles"
          >
            {/* Always in the style (hidden while off, so no DEM tiles load): it marks where imagery ends
                and labels begin, so the satellite stays under the shading whichever is switched on first. */}
            <Layer
              id={RELIEF_LAYER}
              type="hillshade"
              beforeId={labelLayerId}
              layout={{ visibility: reliefOn ? 'visible' : 'none' }}
              paint={RELIEF_PAINT}
            />
          </Source>
        )}

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
              beforeId={RELIEF_LAYER}
              // No cross-fade: each arriving tile would otherwise keep the map repainting for 300 ms mid-zoom.
              paint={{ 'raster-brightness-max': 0.88, 'raster-saturation': -0.05, 'raster-fade-duration': 0 }}
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

        <CommunityPoints />
        <AoiLayersPopup />
      </Map>

      <OverlayLegend
        {...counts}
        zoom={zoom}
        onZoomToData={(z) => mapRef.current?.getMap().easeTo({ zoom: z, duration: 900, essential: true })}
        reliefOn={reliefOn}
        onToggleRelief={() => setReliefOn((v) => !v)}
        satelliteOn={satelliteOn}
        onToggleSatellite={() => setSatelliteOn((v) => !v)}
      />
    </div>
  )
}

function OverlayLegend({
  asfCount,
  coverageCount,
  coverageLoading,
  zoom,
  onZoomToData,
  reliefOn,
  onToggleRelief,
  satelliteOn,
  onToggleSatellite,
}: {
  asfCount: number
  coverageCount: number
  coverageLoading: boolean
  zoom?: number
  onZoomToData?: (zoom: number) => void
  reliefOn?: boolean
  onToggleRelief?: () => void
  satelliteOn?: boolean
  onToggleSatellite?: () => void
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

        {(onToggleSatellite || onToggleRelief) && (
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
            {onToggleRelief && (
              <MapToggle
                icon={Mountain}
                label={t('map.relief')}
                hint={t('map.reliefHint')}
                on={!!reliefOn}
                onToggle={onToggleRelief}
              />
            )}
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
