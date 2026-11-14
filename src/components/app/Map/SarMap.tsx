import { useMemo, useRef, useState } from 'react'
import Map, { Layer, type MapLayerMouseEvent, type MapRef } from 'react-map-gl/maplibre'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { REGIONS } from '@/lib/regions'
import { YANO_MINING } from '@/data/mocks/yanomami-mining'
import { useApp } from '@/lib/store'
import { useDeterAlerts } from '@/lib/useDeterAlerts'
import { useIbgeMunicipios, UF_CODE_BY_REGION } from '@/lib/useIbgeMunicipios'
import { GIBS_BY_REGION } from '@/lib/gibs'
import { useT } from '@/lib/i18n'
import { hasWebGL2 } from '@/lib/webgl-support'
import { inAmazon } from '@/lib/amazon'

import { CommunityAreas, CommunityPoints } from './CommunityLayers'
import { MapFallback } from './MapFallback'
import { NisarImagery } from './NisarImagery'

import { AMAZON_CENTER, AMAZON_ZOOM, BASEMAP_URL, BEARING, MAP_ATTRIBUTION, PITCH } from './constants'
import { useBasemapAdapter } from './hooks/useBasemapAdapter'
import { useMapCamera } from './hooks/useMapCamera'
import { useFocusedTi } from './hooks/useFocusedTi'

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
  const gibs = GIBS_BY_REGION[activeRegion]

  const focused = useFocusedTi()
  const deter = useDeterAlerts(focused.bbox)

  const [municipiosOn, setMunicipiosOn] = useState(false)
  const ibge = useIbgeMunicipios(UF_CODE_BY_REGION[activeRegion] ?? null, municipiosOn)

  const [mapLoaded, setMapLoaded] = useState(false)
  const [reliefOn, setReliefOn] = useState(false)
  const [satelliteOn, setSatelliteOn] = useState(false)
  // First label layer of the basemap: imagery goes under it so place and river names stay readable.
  const [labelLayerId, setLabelLayerId] = useState<string>()
  useMapCamera(mapRef, region, mapLoaded)
  useBasemapAdapter(() => mapRef.current?.getMap(), satelliteOn, mapLoaded)

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

        <CommunityAreas />
        {/* Invisible anchor: async overlays insert below it so community pins stay on top. */}
        <Layer id="community-points-anchor" type="background" paint={{ 'background-opacity': 0 }} />

        <GibsTrueColorLayer on={trueColorOverlay} />
        <GibsOverlayLayer on={nasaOverlay} gibs={gibs} />

        <NisarImagery />
        <YanoChangeLayer activeRegion={activeRegion} />
        <AffectedAreasLayer activeRegion={activeRegion} />
        <FocusedTiMask focused={focused} />
        <IbgeMunicipiosLayer on={municipiosOn} data={ibge.data} />
        <DeterLayer focusedTi={focused.name} deter={deter} />

        <CommunityPoints />
      </Map>

      <OverlayLegend
        reliefOn={reliefOn}
        onToggleRelief={() => setReliefOn((v) => !v)}
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
