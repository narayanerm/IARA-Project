import { useEffect, useMemo } from 'react'
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Popup,
  ImageOverlay,
  LayersControl,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { AlertTriangle, MapPin } from 'lucide-react'
import {
  AMAZON_BIOME,
  INDIGENOUS_LANDS,
  polygonCentroid,
  type TiProps,
} from '@/data/layers/indigenous-lands'
import {
  AFFECTED_AREAS,
  affectedAreaColor,
  type AffectedAreaProps,
} from '@/data/layers/affected-areas'
import type { Region } from '@/lib/types'
import { REGIONS } from '@/lib/regions'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { useAsfGranules } from '@/lib/useAsfGranules'
import { worldWithHoleFC } from '@/lib/polygon-bbox'
import { useFunaiTi } from '@/lib/useFunaiTi'
import {
  FUNAI_TI_URL,
  tiProfileUrl,
  funaiSiciUrl,
  TERRABRASILIS_FUNAI_URL,
  DETER_WFS_URL,
  ISA_TI_PORTAL,
} from '@/lib/links'

export function MapFallback({ region }: { region: Region }) {
  const t = useT()
  const setActiveRegion = useApp((s) => s.setActiveRegion)
  const focusedTi = useApp((s) => s.focusedTi)
  const localTiFeature = useMemo(
    () => INDIGENOUS_LANDS.features.find((f) => f.properties.name === focusedTi) ?? null,
    [focusedTi]
  )
  const funai = useFunaiTi(focusedTi)
  const focusedTiFeature = funai.feature ?? localTiFeature
  const asf = useAsfGranules(region)
  const browse = asf.data.find((g) => !!g.browseUrl)

  const [w, s, e, n] = region.bbox
  const sarBounds: [[number, number], [number, number]] = [
    [s, w],
    [n, e],
  ]


  const biomeStyle = useMemo(
    () => ({
      color: 'hsl(145 70% 55%)',
      weight: 1.2,
      opacity: 0.55,
      fillColor: 'hsl(145 65% 35%)',
      fillOpacity: 0.06,
      dashArray: '4 3',
    }),
    []
  )

  const tiStyle = (feature: { properties: TiProps } | undefined) => ({
    color: 'hsl(28 95% 65%)',
    weight: 1.1,
    opacity: 0.85,
    fillColor: 'hsl(28 85% 55%)',
    fillOpacity: feature?.properties.name === 'TI Yanomami' ? 0.28 : 0.14,
  })

  return (
    <div className="absolute inset-0">
      <MapContainer
        center={[-6, -58]}
        zoom={4}
        minZoom={3}
        maxZoom={11}
        className="h-full w-full"
        style={{ background: 'hsl(154 26% 5%)' }}
        attributionControl
      >
        <TiFocusController />
        <LayersControl position="bottomright">
          <LayersControl.BaseLayer checked name="NASA GIBS satellite (MODIS)">
            <TileLayer
              url="https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2026-11-13/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg"
              attribution="NASA GIBS, MODIS Terra true color"
              maxZoom={9}
              tileSize={256}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="OpenStreetMap">
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="OSM Humanitarian">
            <TileLayer
              url="https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap, HOT'
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="NASA GIBS NDVI (vegetation)">
            <TileLayer
              url="https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/2026-11-12/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png"
              attribution="NASA GIBS, MODIS NDVI 8-day"
              maxZoom={9}
              tileSize={256}
            />
          </LayersControl.BaseLayer>

          <LayersControl.Overlay checked name="Amazon biome (IBGE)">
            <GeoJSON data={AMAZON_BIOME} style={biomeStyle} />
          </LayersControl.Overlay>

          <LayersControl.Overlay checked name="Indigenous Lands (FUNAI)">
            <GeoJSON
              data={INDIGENOUS_LANDS}
              style={tiStyle as never}
              onEachFeature={(feature, layer) => {
                const p = feature.properties as TiProps
                layer.bindTooltip(p.name, { sticky: true, direction: 'top' })
                layer.bindPopup(buildTiPopupHtml(p))
              }}
            />
          </LayersControl.Overlay>

          {browse?.browseUrl && (
            <LayersControl.Overlay checked name="SAR browse (ASF DAAC)">
              <ImageOverlay
                url={browse.browseUrl}
                bounds={sarBounds}
                opacity={0.72}
                attribution={`ASF DAAC, ${browse.dataset}`}
              />
            </LayersControl.Overlay>
          )}


          <LayersControl.Overlay checked name={`Área afetada, ${region.phenomenonLabel}`}>
            <GeoJSON
              key={region.id}
              data={AFFECTED_AREAS[region.id]}
              style={(f) => {
                const p = (f?.properties as AffectedAreaProps) ?? { kind: 'mining' }
                const c = affectedAreaColor(p.kind)
                const isOriginal = p.kind === 'drought-original'
                return {
                  color: c,
                  weight: isOriginal ? 1.5 : 2,
                  fillColor: c,
                  fillOpacity: isOriginal ? 0.06 : 0.42,
                  dashArray: isOriginal ? '4 3' : undefined,
                }
              }}
              onEachFeature={(f, layer) => {
                const p = f.properties as AffectedAreaProps
                layer.bindTooltip(
                  `${p.label}, ${p.area_km2.toLocaleString('pt-BR')} km²`,
                  { sticky: true, direction: 'top' }
                )
                layer.bindPopup(buildAffectedPopupHtml(p))
              }}
            />
          </LayersControl.Overlay>
        </LayersControl>

        {focusedTi && focusedTiFeature && (
          <>
            <GeoJSON
              key={`focus-mask-${focusedTi}-${funai.feature ? 'f' : 'l'}`}
              data={worldWithHoleFC(
                focusedTiFeature.geometry.type === 'MultiPolygon'
                  ? focusedTiFeature.geometry.coordinates[0][0]
                  : (focusedTiFeature.geometry.coordinates[0] as number[][])
              )}
              style={{
                color: 'transparent',
                weight: 0,
                fillColor: 'hsl(222 47% 5%)',
                fillOpacity: 0.75,
              }}
            />
            <GeoJSON
              key={`focus-outline-${focusedTi}-${funai.feature ? 'f' : 'l'}`}
              data={focusedTiFeature}
              style={{
                color: 'hsl(190 95% 70%)',
                weight: 2.5,
                opacity: 1,
                fillOpacity: 0,
              }}
            />
          </>
        )}

        {REGIONS.map((r) => (
          <CircleMarker
            key={r.id}
            center={[r.center[1], r.center[0]]}
            radius={r.id === region.id ? 14 : 9}
            pathOptions={{
              color: r.id === region.id ? 'hsl(190 95% 70%)' : 'hsl(190 95% 60%)',
              weight: r.id === region.id ? 3 : 1.5,
              fillColor: 'hsl(190 95% 60%)',
              fillOpacity: r.id === region.id ? 0.55 : 0.2,
            }}
            eventHandlers={{ click: () => setActiveRegion(r.id) }}
          >
            <Popup>
              <div style={{ minWidth: 180 }}>
                <strong>{r.phenomenonLabel}</strong>
                <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                  {r.name}, {r.anchorCity}
                </div>
                <div style={{ fontSize: 12, marginTop: 6 }}>{r.tagline}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {focusedTi && (
        <div className="absolute left-4 top-20 z-[600] max-w-[300px] rounded-lg border border-border bg-card px-3 py-2 pointer-events-auto">
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-water" />
            <span className="truncate">{focusedTi}</span>
          </div>
          <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
            {funai.loading ? t('ti.loading') : funai.feature ? t('ti.official') : t('ti.simplified')}
            {funai.error && <span className="text-destructive">, {funai.error}</span>}
          </div>
          {funai.feature && (
            <div className="mt-1.5 grid gap-0.5 text-[12px] leading-snug text-foreground">
              <div>
                <span className="text-muted-foreground">{t('ti.ethnicity')}:</span> {funai.feature.properties.etnia_nome ?? '—'}
              </div>
              <div>
                <span className="text-muted-foreground">{t('ti.phase')}:</span> {funai.feature.properties.fase_ti ?? '—'}
              </div>
              <div className="tabular-nums text-muted-foreground">
                {t('ti.code')} {funai.feature.properties.terrai_cod}
              </div>
            </div>
          )}
          {localTiFeature && (
            <div className="mt-1.5 grid gap-0.5 border-t border-border pt-1.5 text-[12px] leading-snug text-foreground">
              <div>
                <span className="text-muted-foreground">{t('ti.isaArea')}:</span>{' '}
                {localTiFeature.properties.area_km2.toLocaleString('en-US')} km²
              </div>
              {localTiFeature.properties.population && (
                <div>
                  <span className="text-muted-foreground">{t('ti.isaPop')}:</span>{' '}
                  {localTiFeature.properties.population.toLocaleString('en-US')}
                </div>
              )}
            </div>
          )}
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-1.5 text-[12px]">
            <a href={funaiSiciUrl(focusedTi)} target="_blank" rel="noopener noreferrer" className="text-foreground underline hover:text-water">
              FUNAI, {focusedTi.replace(/^TI\s+/, '')}
            </a>
            {funai.feature && (
              <a href={TERRABRASILIS_FUNAI_URL} target="_blank" rel="noopener noreferrer" className="text-foreground underline hover:text-water">
                TerraBrasilis WFS
              </a>
            )}
            <a href={DETER_WFS_URL} target="_blank" rel="noopener noreferrer" className="text-foreground underline hover:text-water">
              DETER/INPE
            </a>
            <a href={ISA_TI_PORTAL} target="_blank" rel="noopener noreferrer" className="text-foreground underline hover:text-water">
              ISA
            </a>
          </div>
        </div>
      )}

      <div className="absolute top-4 left-1/2 -translate-x-1/2 max-w-md rounded-lg border border-border bg-card px-4 py-2.5 text-[12px] text-foreground leading-snug z-[500] pointer-events-auto">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-sar-amber shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">2D map mode (WebGL2 unavailable)</div>
            <div className="opacity-80 mt-0.5">
              Running Leaflet with NASA GIBS and SAR from ASF DAAC. Turn on hardware
              acceleration in your browser for the 3D mode.
            </div>
          </div>
        </div>
      </div>

      <div className="absolute left-4 top-4 rounded-lg border border-border bg-card p-3 text-[12px] text-muted-foreground max-w-[220px] leading-snug z-[500] pointer-events-auto">
        <div className="text-foreground font-semibold mb-1 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" />
          IARA 2D map
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-sar-amber" />
          Indigenous Lands (FUNAI)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-primary" />
          Monitored AOIs
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-sar-jade" />
          Amazon biome
        </div>
        {browse?.browseUrl && (
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-fuchsia-400" />
            SAR real (ASF DAAC)
          </div>
        )}
      </div>
    </div>
  )
}

function buildAffectedPopupHtml(p: AffectedAreaProps): string {
  const kindLabel = {
    mining: 'Garimpo',
    flood: 'Cheia',
    'drought-shrink': 'Retração da seca',
    'drought-original': 'Espelho original',
  }[p.kind]
  return `
    <div style="min-width:200px; font-family:'IBM Plex Sans',sans-serif;">
      <div style="font-weight:600; margin-bottom:4px;">${p.label}</div>
      <div style="font-size:11px; color:#888; font-family:monospace;">${kindLabel}, ${p.year}</div>
      <div style="font-size:16px; font-weight:600; margin-top:6px; color:${affectedAreaColor(p.kind)};">
        ${p.area_km2.toLocaleString('pt-BR')} km²
      </div>
      <div style="font-size:11px; color:#666; margin-top:4px;">Fonte: ${p.source}</div>
    </div>
  `
}

function TiFocusController() {
  const map = useMap()
  const focusedTi = useApp((s) => s.focusedTi)
  const flyTarget = useApp((s) => s.flyTarget)
  useEffect(() => {
    if (!focusedTi) return
    const f = INDIGENOUS_LANDS.features.find((x) => x.properties.name === focusedTi)
    if (!f) return
    const [lon, lat] = polygonCentroid(f.geometry)
    map.flyTo([lat, lon], 7, { duration: 1.4 })
  }, [focusedTi, map])
  useEffect(() => {
    if (!flyTarget) return
    const [lon, lat] = flyTarget.center
    map.flyTo([lat, lon], flyTarget.zoom ?? 8, { duration: 1.4 })
  }, [flyTarget, map])
  return null
}

function buildTiPopupHtml(p: TiProps): string {
  const ethn = p.ethnicities?.slice(0, 5).join(', ') ?? ''
  return `
    <div style="min-width:220px; font-family:'IBM Plex Sans',sans-serif;">
      <div style="font-weight:600; margin-bottom:4px;">${p.name}</div>
      <div style="font-size:12px; color:#666;">${p.state}, ${p.year}, ${p.status}</div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-top:6px; font-size:12px;">
        <div><strong>Area:</strong><br/>${p.area_km2.toLocaleString('en-US')} km²</div>
        ${p.population ? `<div><strong>Population:</strong><br/>${p.population.toLocaleString('en-US')}</div>` : ''}
      </div>
      ${ethn ? `<div style="font-size:11px; margin-top:6px;"><strong>Ethnic groups:</strong> ${ethn}</div>` : ''}
      <a href="${tiProfileUrl(p.isaId)}" target="_blank" rel="noopener noreferrer" style="display:block; margin-top:8px; font-size:12px; color:hsl(19, 75%, 45%);">Land profile (ISA) →</a>
      <a href="${FUNAI_TI_URL}" target="_blank" rel="noopener noreferrer" style="display:block; margin-top:4px; font-size:12px; color:hsl(19, 75%, 45%);">FUNAI official data →</a>
    </div>
  `
}
