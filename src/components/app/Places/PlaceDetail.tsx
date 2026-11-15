import { useEffect, useMemo, useState } from 'react'
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import { ArrowLeft, ExternalLink, Globe2, MapPin } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useUi } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  STREET_VIEW_NOTE,
  YANOMAMI_TERRITORY,
  type PlaceEvent,
  type SourceLink,
  type YanomamiPlace,
} from '@/data/yanomamiPlaces'

const DETER_URL = '/analysis/data/deter-mineracao-regional-2019-2026.geojson'
const DETER_SOURCE: SourceLink = { label: 'INPE · DETER (mineração, 2019–2026)', url: 'https://terrabrasilis.dpi.inpe.br/' }
const RADIUS_KM = 25

const T = {
  back: { pt: 'Voltar ao overview', en: 'Back to overview' },
  approx: { pt: 'posição aproximada', en: 'approximate position' },
  layers: { pt: 'Ver no mapa', en: 'Show on the map' },
  satellite: { pt: 'Satélite', en: 'Satellite' },
  gallery: { pt: 'Imagens deste local', en: 'Images of this place' },
  territoryGallery: { pt: 'Imagens do território (não deste local)', en: 'Images of the territory (not of this place)' },
  data: { pt: 'Dados locais', en: 'Local data' },
  mining: { pt: `Garimpo num raio de ${RADIUS_KM} km`, en: `Mining within ${RADIUS_KM} km` },
  alerts: { pt: 'polígonos DETER', en: 'DETER polygons' },
  area: { pt: 'de área mapeada', en: 'of mapped area' },
  noMining: { pt: 'Nenhum polígono DETER de mineração neste raio.', en: 'No DETER mining polygon in this radius.' },
  territory: { pt: 'Toda a Terra Indígena Yanomami', en: 'The whole Yanomami Indigenous Territory' },
  economy: { pt: 'Atividade econômica (território)', en: 'Economic activity (territory)' },
  legal: { pt: 'Tradicional e legal', en: 'Traditional and legal' },
  illegal: { pt: 'Ilegal', en: 'Illegal' },
  history: { pt: 'História', en: 'History' },
  explore: { pt: 'Conhecer mais', en: 'Explore more' },
  sources: { pt: 'Fontes', en: 'Sources' },
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
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Mining polygons are small (well under 1 km); their first vertex stands in for their position.
function firstPoint(g: Polygon | MultiPolygon): [number, number] {
  const ring = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]
  return [ring[0][0], ring[0][1]]
}

let deterCache: Promise<FeatureCollection> | null = null
const loadDeter = () => (deterCache ??= fetch(DETER_URL).then((r) => r.json() as Promise<FeatureCollection>))

/** The place page, shown in the left panel where the case overview sits; the main map shows the place on the right. */
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
  const band = useUi((s) => s.yanomamiBand)
  const setBand = useUi((s) => s.setYanomamiBand)
  const raddOn = useUi((s) => s.yanomamiRaddOn)
  const deterOn = useUi((s) => s.yanomamiDeterOn)
  const toggleRadd = useUi((s) => s.toggleYanomamiRadd)
  const toggleDeter = useUi((s) => s.toggleYanomamiDeter)
  const [imgIndex, setImgIndex] = useState(0)
  const [deter, setDeter] = useState<FeatureCollection | null>(null)

  useEffect(() => {
    let cancelled = false
    loadDeter().then((d) => !cancelled && setDeter(d))
    return () => {
      cancelled = true
    }
  }, [])
  useEffect(() => setImgIndex(0), [place.id])

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
    // The place's own entry replaces the territory-wide one for the same year.
    const own = new Set(place.events.map((e) => e.year))
    return [...YANOMAMI_TERRITORY.events.filter((e) => !own.has(e.year)), ...place.events].sort(
      (a, b) => parseInt(a.year) - parseInt(b.year)
    )
  }, [place])

  const ownImages = place.images.length > 0
  const images = ownImages ? place.images : YANOMAMI_TERRITORY.images
  const img = images[imgIndex] ?? images[0]
  const style = {
    '--ox': origin ? `${origin.x - 12}px` : '50%',
    '--oy': origin ? `${origin.y - 68}px` : '50%',
  } as React.CSSProperties

  return (
    <aside className={cn('place-panel liquid-glass', closing && 'is-closing')} style={style} aria-label={place.name[lang]}>
      <div className="place-panel-scroll">
        <button type="button" className="place-back" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" /> {t('back')}
        </button>
        <h2 className="place-title">{place.name[lang]}</h2>
        <p className="place-sub">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            {place.river[lang]} · {place.lat.toFixed(3)}°, {place.lon.toFixed(3)}°
          </span>
          {place.approx && <span className="place-badge">{t('approx')}</span>}
        </p>
        <p className="place-summary">{place.summary[lang]}</p>
        {place.approx && place.approxNote && <p className="place-note">{place.approxNote[lang]}</p>}
        <p className="place-note">
          {t('sources')}: <Sources list={[...place.coordSources, ...(place.summarySources ?? [])]} />
        </p>

        <div className="place-layer-row" role="group" aria-label={t('layers')}>
          <span className="place-layer-label">{t('layers')}</span>
          {([null, 'nisar', 'sband', 's1c'] as const).map((b) => (
            <button key={b ?? 'sat'} type="button" aria-pressed={band === b} className={cn('place-chip', band === b && 'is-on')} onClick={() => setBand(b)}>
              {b === null ? t('satellite') : b === 'nisar' ? 'NISAR L' : b === 'sband' ? 'NISAR S' : 'Sentinel-1'}
            </button>
          ))}
          <button type="button" aria-pressed={raddOn} className={cn('place-chip', raddOn && 'is-on')} onClick={toggleRadd}>
            RADD
          </button>
          <button type="button" aria-pressed={deterOn} className={cn('place-chip', deterOn && 'is-on')} onClick={toggleDeter}>
            DETER
          </button>
        </div>

        <section className="place-section">
          <h3 className="place-h3">{ownImages ? t('gallery') : t('territoryGallery')}</h3>
          {img && (
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
          )}
          {images.length > 1 && (
            <div className="place-thumbs">
              {images.map((im, i) => (
                <button key={im.src} type="button" className={cn('place-thumb', i === imgIndex && 'is-on')} onClick={() => setImgIndex(i)} aria-label={im.alt[lang]}>
                  <img src={im.src} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="place-section">
          <h3 className="place-h3">{t('data')}</h3>
          <div className="place-stats">
            <div className="place-stat glass-card">
              <div className="place-stat-label">{t('mining')}</div>
              {mining == null ? (
                <div className="place-stat-text">{t('loading')}</div>
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
              <div key={s.label.pt} className="place-stat glass-card">
                <div className="place-stat-label">{s.label[lang]}</div>
                <div className="place-stat-value">{s.value}</div>
                <Sources list={s.sources} />
              </div>
            ))}
          </div>
          <div className="place-subhead">{t('territory')}</div>
          <div className="place-stats">
            {YANOMAMI_TERRITORY.stats.map((s) => (
              <div key={s.label.pt} className="place-stat glass-card is-territory">
                <div className="place-stat-label">{s.label[lang]}</div>
                <div className="place-stat-value">{s.value}</div>
                <Sources list={s.sources} />
              </div>
            ))}
          </div>
          <div className="glass-card place-econ">
            <div className="place-stat-label">{t('economy')}</div>
            <p>
              <strong>{t('legal')}:</strong> {YANOMAMI_TERRITORY.economy.legal[lang]}
            </p>
            <p>
              <strong className="text-[#ff9b7d]">{t('illegal')}:</strong> {YANOMAMI_TERRITORY.economy.illegal[lang]}
            </p>
            <Sources list={YANOMAMI_TERRITORY.economy.sources} />
          </div>
        </section>

        <section className="place-section">
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

        <section className="place-section">
          <h3 className="place-h3">{t('explore')}</h3>
          <p className="place-note">{STREET_VIEW_NOTE[lang]}</p>
          <div className="place-explore">
            {place.explore.map((x) => (
              <a key={x.url} href={x.url} target="_blank" rel="noopener noreferrer" className="place-explore-link">
                {x.kind === 'earth' ? <Globe2 className="h-4 w-4 shrink-0" /> : <ExternalLink className="h-4 w-4 shrink-0" />}
                {x.label[lang]}
              </a>
            ))}
          </div>
        </section>
      </div>
    </aside>
  )
}
