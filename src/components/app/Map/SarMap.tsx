import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { Layer, type MapLayerMouseEvent, type MapRef } from 'react-map-gl/maplibre'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { REGIONS } from '@/lib/regions'
import { YANO_MINING } from '@/data/mocks/yanomami-mining'
import { useApp } from '@/lib/store'
import { useDeterAlerts } from '@/lib/useDeterAlerts'
import { useIbgeMunicipios, UF_CODE_BY_REGION } from '@/lib/useIbgeMunicipios'
import { GIBS_BY_REGION } from '@/lib/gibs'
import { useT } from '@/lib/i18n'
import { hasWebGL2 } from '@/lib/webgl-support'
import { inAmazon } from '@/lib/amazon'
import { FEATURES } from '@/lib/features'
import { CASES } from '@/data/cases'

import { CommunityAreas, CommunityPoints } from './CommunityLayers'
import { MapFallback } from './MapFallback'
import { NisarImagery } from './NisarImagery'

import { AMAZON_CENTER, AMAZON_ZOOM, BASEMAP_URL, BEARING, MAP_ATTRIBUTION, PITCH, TERRAIN } from './constants'
import { useBasemapAdapter } from './hooks/useBasemapAdapter'
import { useMapCamera } from './hooks/useMapCamera'
import { useFocusedTi } from './hooks/useFocusedTi'

import { TerrainSource } from './layers/TerrainSource'
import { SatelliteLayer } from './layers/SatelliteLayer'
import { AmazonBiomeLayer } from './layers/AmazonBiomeLayer'
import { GibsTrueColorLayer, GibsOverlayLayer } from './layers/GibsLayers'
import { YanoChangeLayer } from './layers/YanoChangeLayer'
import { AffectedAreasLayer } from './layers/AffectedAreasLayer'
import { CaseSitesLayer } from './layers/CaseSitesLayer'
import { CaseImageryLayer } from './layers/CaseImageryLayer'
import { FocusedTiMask } from './layers/FocusedTiMask'
import { DeterLayer } from './layers/DeterLayer'
import { IbgeMunicipiosLayer } from './layers/IbgeMunicipiosLayer'

import { OverlayLegend } from './overlays/OverlayLegend'
import { FocusedTiBadge } from './overlays/FocusedTiBadge'

// Bundling drops MapLibre's sibling worker file, so point it at the emitted asset.
maplibregl.setWorkerUrl(maplibreWorkerUrl)

export function SarMap() {
  const mapRef = useRef<MapRef | null>(null)
  const activeRegion = useApp((s) => s.activeRegion)
  const aoiActive = useApp((s) => s.aoiActive)
  const nasaOverlay = useApp((s) => s.nasaOverlay)
  const trueColorOverlay = useApp((s) => s.trueColorOverlay)
  const selectPolygon = useApp((s) => s.selectPolygon)
  const setNisarPoint = useApp((s) => s.setNisarPoint)
  const setNisarNotice = useApp((s) => s.setNisarNotice)
  const t = useT()

  const region = useMemo(() => REGIONS.find((r) => r.id === activeRegion)!, [activeRegion])
  // Inside a case the camera cannot leave the case area (plus a margin), so the user does not get lost.
  const maxBounds = useMemo<[number, number, number, number] | undefined>(() => {
    if (!aoiActive) return undefined
    const [w, s, e, n] = CASES[activeRegion].sarCrop ?? region.bbox
    const mx = Math.max(0.15, (e - w) * 0.6)
    const my = Math.max(0.1, (n - s) * 0.6)
    return [w - mx, s - my, e + mx, n + my]
  }, [aoiActive, activeRegion, region])
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
  const [imageryBeforeId, setImageryBeforeId] = useState<string>()
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
        <MapFallback region={region} />
        {FEATURES.communityLayers && <OverlayLegend />}
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
        maxBounds={maxBounds}
        mapStyle={BASEMAP_URL}
        interactiveLayerIds={activeRegion === 'YANO' ? ['yano-change-fill'] : []}
        onClick={onClick}
        onLoad={(e) => {
          const layers = e.target.getStyle().layers
          setLabelLayerId(layers.find((l) => l.type === 'symbol')?.id ?? 'amazon-biome-fill')
          // Case imagery covers streets and buildings, so it goes above the last road/rail line
          // and below the street and place names that follow it.
          let lastLine = -1
          layers.forEach((l, i) => {
            if (l.type === 'line' && !l.id.startsWith('boundary')) lastLine = i
          })
          setImageryBeforeId(layers.slice(lastLine + 1).find((l) => l.type === 'symbol')?.id)
          setMapLoaded(true)
        }}
        attributionControl={{ compact: true, customAttribution: MAP_ATTRIBUTION }}
      >
        <TerrainSource />
        <SatelliteLayer on={satelliteOn} beforeId={labelLayerId} />
        <CaseImageryLayer activeRegion={activeRegion} visible={aoiActive} beforeId={imageryBeforeId ?? labelLayerId} />

        <AmazonBiomeLayer />

        {FEATURES.communityLayers && <CommunityAreas />}
        {/* Invisible anchor: async overlays insert below it so community pins stay on top. */}
        <Layer id="community-points-anchor" type="background" paint={{ 'background-opacity': 0 }} />

        <GibsTrueColorLayer on={trueColorOverlay} />
        <GibsOverlayLayer on={FEATURES.nasaOverlay && nasaOverlay} gibs={gibs} />

        {FEATURES.nisarLive && <NisarImagery />}
        <YanoChangeLayer activeRegion={activeRegion} />
        <AffectedAreasLayer activeRegion={activeRegion} />
        <CaseSitesLayer activeRegion={activeRegion} visible={aoiActive} />
        <FocusedTiMask focused={focused} />
        <IbgeMunicipiosLayer on={municipiosOn} data={ibge.data} />
        <DeterLayer focusedTi={focused.name} deter={deter} />

        {FEATURES.communityLayers && <CommunityPoints />}
      </Map>

      {FEATURES.communityLayers && (
      <OverlayLegend
        terrainOn={terrainOn}
        onToggleTerrain={() => setTerrainOn((v) => !v)}
        satelliteOn={satelliteOn}
        onToggleSatellite={() => setSatelliteOn((v) => !v)}
        municipiosOn={municipiosOn}
        onToggleMunicipios={() => setMunicipiosOn((v) => !v)}
        municipiosLoading={ibge.loading}
      />
      )}
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
