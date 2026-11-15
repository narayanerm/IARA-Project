import { useEffect, useMemo, useState } from 'react'
import Map, { Layer, Marker, Source } from 'react-map-gl/maplibre'
import * as maplibregl from 'maplibre-gl'
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import { ArrowLeft, ExternalLink, Globe2, MapPin } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { SATELLITE_ATTRIBUTION, SATELLITE_TILES } from '../Map/constants'
import {
  STREET_VIEW_NOTE,
  YANOMAMI_TERRITORY,
  type PlaceEvent,
  type SourceLink,
  type YanomamiPlace,
} from '@/data/yanomamiPlaces'

type View = 'satellite' | 'nisar' | 'sband' | 's1c'

// Same pre-built mosaics as the case layers (YanomamiCaseLayers), reused for the zoomed map.
const MOSAIC: Record<Exclude<View, 'satellite'>, { url: string; bbox: [number, number, number, number] }> = {
  nisar: { url: '/analysis/data/yanomami-nisar-mosaic.png', bbox: [-66.6269, -0.4732, -61.1829, 4.4272] },
  sband: { url: '/analysis/data/yanomami-nisar-sband-mosaic.png', bbox: [-66.6269, -0.4732, -61.1829, 4.4272] },
  s1c: { url: '/analysis/data/sentinel1-yanomami-mosaic.png', bbox: [-66.5, -0.5, -61.0, 4.5] },
}
const RADD_TILE =
  'https://tiles.globalforestwatch.org/wur_radd_alerts/v20261108/dynamic/{z}/{x}/{y}.png?start_date=2020-01-01&end_date=2026-11-15'
const DETER_URL = '/analysis/data/deter-mineracao-regional-2019-2026.geojson'
const DETER_SOURCE: SourceLink = { label: 'INPE · DETER (mineração, 2019–2026)', url: 'https://terrabrasilis.dpi.inpe.br/' }
const RADIUS_KM = 25

const T = {
  back: { pt: 'Voltar ao mapa', en: 'Back to the map' },
  approx: { pt: 'posição aproximada', en: 'approximate position' },
  gallery: { pt: 'Imagens da região', en: 'Images of the region' },
  noImage: { pt: 'Sem foto com licença livre desta região. Veja a vista 3D em "Conhecer mais".', en: 'No freely licensed photo of this area. See the 3D view under "Explore more".' },
  map: { pt: 'Mapa da região', en: 'Map of the region' },
  satellite: { pt: 'Satélite', en: 'Satellite' },
  opacity: { pt: 'Opacidade do radar', en: 'Radar opacity' },
  data: { pt: 'Dados locais', en: 'Local data' },
  mining: { pt: `Garimpo num raio de ${RADIUS_KM} km`, en: `Mining within ${RADIUS_KM} km` },
  alerts: { pt: 'polígonos DETER', en: 'DETER polygons' },
  area: { pt: 'área mapeada', en: 'mapped area' },
  noMining: { pt: 'Nenhum polígono DETER de mineração neste raio.', en: 'No DETER mining polygon in this radius.' },
  territory: { pt: 'Terra Indígena Yanomami', en: 'Yanomami Indigenous Territory' },
  economy: { pt: 'Atividade econômica', en: 'Economic activity' },
  legal: { pt: 'Tradicional e legal', en: 'Traditional and legal' },
  illegal: { pt: 'Ilegal', en: 'Illegal' },
  health: { pt: 'Saúde', en: 'Health' },
  history: { pt: 'História', en: 'History' },
  explore: { pt: 'Conhecer mais', en: 'Explore more' },
  credits: { pt: 'Créditos das imagens', en: 'Image credits' },
  sources: { pt: 'Fontes da posição', en: 'Position sources' },
  loading: { pt: 'Calculando…', en: 'Computing…' },
}

function Sources({ list }: { list: SourceLink[] }) {
  return (
    <span className="place-sources">
      {list.map((s) => (
        <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">
          {s.label}
        </a>
      ))}
    </span>
  )
}

function distanceKm(a: [number, number], b: [number, number]) {
  const R = 6371
  const dLat = ((b[1] - a[1]) * Math.PI) / 180
  const dLon = ((b[0] - a[0]) * Math.PI) / 180
  const la1 = (a[1] * Math.PI) / 180
  const la2 = (b[1] * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function firstPoint(g: Polygon | MultiPolygon): [number, number] {
  const ring = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]
  return [ring[0][0], ring[0][1]]
}

let deterCache: Promise<FeatureCollection> | null = null
const loadDeter = () => (deterCache ??= fetch(DETER_URL).then((r) => r.json() as Promise<FeatureCollection>))

export function PlaceDetail({
  place,
  origin,
  closing,
  onClose,
}: {
  place: YanomamiPlace
  origin: { x: number; y: number } | null
  closing: boolean
  onClose: () => void
}) {
  const lang = useI18n((s) => s.lang)
  const t = (k: keyof typeof T) => T[k][lang]
  const [view, setView] = useState<View>('satellite')
  const [opacity, setOpacity] = useState(0.8)
  const [raddOn, setRaddOn] = useState(false)
  const [deterOn, setDeterOn] = useState(true)
  const [imgIndex, setImgIndex] = useState(0)
  const [deter, setDeter] = useState<FeatureCollection | null>(null)

  useEffect(() => {
    let cancelled = false
    loadDeter().then((d) => !cancelled && setDeter(d))
    return () => {
      cancelled = true
    }
  }, [])

  const mining = useMemo(() => {
    if (!deter) return null
    let count = 0
    let area = 0
    for (const f of deter.features) {
      const g = f.geometry as Polygon | MultiPolygon
      if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) continue
      if (distanceKm([place.lon, place.lat], firstPoint(g)) <= RADIUS_KM) {
        count++
        area += Number((f.properties as { areamunkm?: number })?.areamunkm ?? 0)
      }
    }
    return { count, area }
  }, [deter, place])

  const events: PlaceEvent[] = useMemo(() => {
    const all = [...YANOMAMI_TERRITORY.events, ...place.events]
    const seen = new Set<string>()
    return all
      .filter((e) => {
        const k = e.year + e.text.pt
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      .sort((a, b) => parseInt(a.year) - parseInt(b.year))
  }, [place])

  const img = place.images[imgIndex]
  const style = {
    '--ox': origin ? `${origin.x}px` : '50%',
    '--oy': origin ? `${origin.y}px` : '50%',
  } as React.CSSProperties

  return (
    <div className={cn('place-detail', closing && 'is-closing')} style={style} role="dialog" aria-label={place.name[lang]}>
      <div className="place-detail-scroll">
        <header className="place-head">
          <button type="button" className="place-back" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" /> {t('back')}
          </button>
          <h2 className="place-title">{place.name[lang]}</h2>
          <p className="place-sub">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {place.river[lang]} · {place.lat.toFixed(3)}°, {place.lon.toFixed(3)}°
            {place.approx && <span className="place-badge">{t('approx')}</span>}
          </p>
          <p className="place-summary">{place.summary[lang]}</p>
          {place.approx && place.approxNote && <p className="place-note">{place.approxNote[lang]}</p>}
          <p className="place-note">
            {t('sources')}: <Sources list={place.coordSources} />
          </p>
        </header>

        <section className="place-grid">
          <div className="place-card place-map-card">
            <div className="place-card-title">{t('map')}</div>
            <div className="place-map">
              <Map
                mapLib={maplibregl}
                initialViewState={{ longitude: place.lon, latitude: place.lat, zoom: place.approx ? 10 : 11.5 }}
                mapStyle={{
                  version: 8,
                  sources: { sat: { type: 'raster', tiles: [SATELLITE_TILES], tileSize: 256, attribution: SATELLITE_ATTRIBUTION } },
                  layers: [{ id: 'sat', type: 'raster', source: 'sat' }],
                }}
                attributionControl={{ compact: true }}
              >
                {view !== 'satellite' && (
                  <Source
                    key={view}
                    id="place-sar"
                    type="image"
                    url={MOSAIC[view].url}
                    coordinates={[
                      [MOSAIC[view].bbox[0], MOSAIC[view].bbox[3]],
                      [MOSAIC[view].bbox[2], MOSAIC[view].bbox[3]],
                      [MOSAIC[view].bbox[2], MOSAIC[view].bbox[1]],
                      [MOSAIC[view].bbox[0], MOSAIC[view].bbox[1]],
                    ]}
                  >
                    <Layer id="place-sar-layer" type="raster" paint={{ 'raster-opacity': opacity, 'raster-fade-duration': 0 }} />
                  </Source>
                )}
                {raddOn && (
                  <Source id="place-radd" type="raster" tiles={[RADD_TILE]} tileSize={256} maxzoom={14}>
                    <Layer id="place-radd-layer" type="raster" paint={{ 'raster-opacity': 0.9 }} />
                  </Source>
                )}
                {deterOn && deter && (
                  <Source id="place-deter" type="geojson" data={deter}>
                    <Layer id="place-deter-fill" type="fill" paint={{ 'fill-color': '#ffffff', 'fill-opacity': 0.12 }} />
                    <Layer id="place-deter-line" type="line" paint={{ 'line-color': '#ffffff', 'line-width': 1.2 }} />
                  </Source>
                )}
                <Marker longitude={place.lon} latitude={place.lat} anchor="center">
                  <span className="place-map-dot" aria-hidden="true" />
                </Marker>
              </Map>
            </div>
            <div className="place-map-tools">
              {(['satellite', 'nisar', 'sband', 's1c'] as View[]).map((v) => (
                <button key={v} type="button" aria-pressed={view === v} className={cn('place-chip', view === v && 'is-on')} onClick={() => setView(v)}>
                  {v === 'satellite' ? t('satellite') : v === 'nisar' ? 'NISAR L' : v === 'sband' ? 'NISAR S' : 'Sentinel-1'}
                </button>
              ))}
              <span className="place-tools-sep" />
              <button type="button" aria-pressed={raddOn} className={cn('place-chip', raddOn && 'is-on')} onClick={() => setRaddOn(!raddOn)}>
                RADD
              </button>
              <button type="button" aria-pressed={deterOn} className={cn('place-chip', deterOn && 'is-on')} onClick={() => setDeterOn(!deterOn)}>
                DETER
              </button>
              {view !== 'satellite' && (
                <label className="place-slider">
                  {t('opacity')}
                  <input type="range" min={0.1} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} />
                </label>
              )}
            </div>
          </div>

          <div className="place-card">
            <div className="place-card-title">{t('gallery')}</div>
            {img ? (
              <>
                <figure className="place-figure">
                  <img src={img.src} alt={img.alt[lang]} loading="lazy" />
                  <figcaption>
                    {img.alt[lang]}
                    <span className="place-credit">
                      {img.author} ·{' '}
                      <a href={img.page} target="_blank" rel="noopener noreferrer">
                        {img.license} · Wikimedia Commons
                      </a>
                    </span>
                  </figcaption>
                </figure>
                {place.images.length > 1 && (
                  <div className="place-thumbs">
                    {place.images.map((im, i) => (
                      <button key={im.src} type="button" className={cn('place-thumb', i === imgIndex && 'is-on')} onClick={() => setImgIndex(i)} aria-label={im.alt[lang]}>
                        <img src={im.src} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="place-empty">{t('noImage')}</p>
            )}
          </div>
        </section>

        <section>
          <h3 className="place-h3">{t('data')}</h3>
          <div className="place-stats">
            <div className="place-stat">
              <div className="place-stat-label">{t('mining')}</div>
              {mining == null ? (
                <div className="place-stat-value">{t('loading')}</div>
              ) : mining.count === 0 ? (
                <div className="place-stat-text">{t('noMining')}</div>
              ) : (
                <>
                  <div className="place-stat-value">{mining.count}</div>
                  <div className="place-stat-text">
                    {t('alerts')} · {mining.area.toFixed(2).replace('.', lang === 'pt' ? ',' : '.')} km² {t('area')}
                  </div>
                </>
              )}
              <Sources list={[DETER_SOURCE]} />
            </div>
            {place.stats.map((s) => (
              <div key={s.label.pt} className="place-stat">
                <div className="place-stat-label">{s.label[lang]}</div>
                <div className="place-stat-value">{s.value}</div>
                <Sources list={s.sources} />
              </div>
            ))}
            {YANOMAMI_TERRITORY.stats.map((s) => (
              <div key={s.label.pt} className="place-stat is-territory">
                <div className="place-stat-label">
                  {t('territory')} · {s.label[lang]}
                </div>
                <div className="place-stat-value">{s.value}</div>
                <Sources list={s.sources} />
              </div>
            ))}
          </div>
          <div className="place-econ">
            <div className="place-card">
              <div className="place-card-title">{t('economy')}</div>
              <p>
                <strong>{t('legal')}:</strong> {YANOMAMI_TERRITORY.economy.legal[lang]}
              </p>
              <p>
                <strong className="text-[#ff8a6b]">{t('illegal')}:</strong> {YANOMAMI_TERRITORY.economy.illegal[lang]}
              </p>
              <Sources list={YANOMAMI_TERRITORY.economy.sources} />
            </div>
          </div>
        </section>

        <section>
          <h3 className="place-h3">{t('history')}</h3>
          <ol className="place-timeline">
            {events.map((e) => (
              <li key={e.year + e.text.pt}>
                <span className="place-year">{e.year}</span>
                <span>
                  {e.text[lang]} <Sources list={e.sources} />
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h3 className="place-h3">{t('explore')}</h3>
          <p className="place-note">{STREET_VIEW_NOTE[lang]}</p>
          <div className="place-explore">
            {place.explore.map((x) => (
              <a key={x.url} href={x.url} target="_blank" rel="noopener noreferrer" className="place-explore-link">
                {x.kind === 'earth' ? <Globe2 className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                {x.label[lang]}
              </a>
            ))}
          </div>
        </section>

        {place.images.length > 0 && (
          <section className="place-credits">
            <h3 className="place-h3">{t('credits')}</h3>
            <ul>
              {place.images.map((im) => (
                <li key={im.page}>
                  {im.author} — <a href={im.page} target="_blank" rel="noopener noreferrer">{im.license}</a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
