import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/store'
import { useT, useI18n } from '@/lib/i18n'
import { COMMUNITY_DATA } from '@/data/layers/communities'
import { INDIGENOUS_LANDS } from '@/data/layers/indigenous-lands'
import { CommunityPin } from '../Map/CommunityPin'

type Kind = 'ti' | 'riverside'
type FilterKind = 'all' | Kind

interface Entry {
  kind: Kind
  name: string
  subtitle: string
  area_km2?: number
  population?: number
  centroid: [number, number]
  /** lowercase, accent-free name and word tokens for prefix search */
  nameKey: string
  tokens: string[]
}

interface TiPoint {
  nome: string
  etnia?: string | null
  fase?: string | null
  area_km2?: number | null
  bw?: number
  bs?: number
  be?: number
  bn?: number
}

interface RiversidePoint {
  nome: string
  municipio?: string
  rio?: string
  tipo?: string
}

type Feat<P> = { properties: P; geometry: { coordinates: [number, number] } }

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const tokensOf = (s: string) => fold(s).split(/[^a-z0-9]+/).filter(Boolean)

// ISA facts (population) for the lands the local snapshot covers, keyed by bare name.
const ENRICHED = new Map(
  INDIGENOUS_LANDS.features.map((f) => [
    f.properties.name.replace(/^TI\s+/i, '').replace(/^Parque Indígena do\s+/i, '').toLowerCase(),
    f.properties,
  ])
)

const PAGE = 40

/** Searchable list of every Indigenous Land (FUNAI) and riverside community (IBGE) in the Amazon. */
export function CommunityList({ locked }: { locked: boolean }) {
  const t = useT()
  const lang = useI18n((s) => s.lang)
  const numberFmt = lang === 'pt' ? 'pt-BR' : 'en-US'
  const focusedTi = useApp((s) => s.focusedTi)
  const setFocusedTi = useApp((s) => s.setFocusedTi)
  const requestFlyTo = useApp((s) => s.requestFlyTo)

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterKind>('all')
  // Page size resets whenever the query or filter changes.
  const [paging, setPaging] = useState({ key: '', n: PAGE })
  const [tiFeats, setTiFeats] = useState<Feat<TiPoint>[] | null>(null)
  const [rivFeats, setRivFeats] = useState<Feat<RiversidePoint>[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (locked || tiFeats) return
    let cancelled = false
    Promise.all([
      fetch(COMMUNITY_DATA.tiPoints).then((r) => r.json()),
      fetch(COMMUNITY_DATA.riverside).then((r) => r.json()),
    ])
      .then(([ti, riv]) => {
        if (cancelled) return
        setTiFeats(ti.features)
        setRivFeats(riv.features)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [locked, tiFeats])

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = []
    for (const f of tiFeats ?? []) {
      const p = f.properties
      const [x, y] = f.geometry.coordinates
      out.push({
        kind: 'ti',
        name: p.nome,
        subtitle: p.etnia || t('community.indigenous'),
        area_km2: p.area_km2 ?? undefined,
        population: ENRICHED.get(p.nome.toLowerCase())?.population,
        centroid: [((p.bw ?? x) + (p.be ?? x)) / 2, ((p.bs ?? y) + (p.bn ?? y)) / 2],
        nameKey: fold(p.nome),
        tokens: tokensOf(`${p.nome} ${p.etnia ?? ''} ${p.fase ?? ''}`),
      })
    }
    for (const f of rivFeats ?? []) {
      const p = f.properties
      out.push({
        kind: 'riverside',
        name: p.nome,
        subtitle: [p.rio, p.municipio].filter(Boolean).join(', ') || t('community.riverside'),
        centroid: f.geometry.coordinates,
        nameKey: fold(p.nome),
        tokens: tokensOf(`${p.nome} ${p.municipio ?? ''} ${p.rio ?? ''} ${p.tipo ?? ''}`),
      })
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [tiFeats, rivFeats, t])

  const q = fold(query.trim())
  const filtered = useMemo(() => {
    const xs = filter === 'all' ? entries : entries.filter((e) => e.kind === filter)
    if (!q) return xs
    // Prefix match: name first, then any word (ethnic group, river, municipality).
    const byName = xs.filter((e) => e.nameKey.startsWith(q))
    const byToken = xs.filter((e) => !e.nameKey.startsWith(q) && e.tokens.some((w) => w.startsWith(q)))
    return [...byName, ...byToken]
  }, [entries, filter, q])

  const pageKey = `${q}|${filter}`
  const limit = paging.key === pageKey ? paging.n : PAGE
  const shown = filtered.slice(0, limit)
  const counts = { ti: tiFeats?.length ?? 0, riverside: rivFeats?.length ?? 0 }

  if (locked) {
    return <p className="px-1 py-1 text-[12px] leading-snug text-muted-foreground">{t('side.communitiesLocked')}</p>
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('side.searchPlaceholder')}
          aria-label={t('side.searchPlaceholder')}
          className="w-full rounded-md border border-border bg-raised py-1.5 pl-7 pr-7 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={t('side.clearSearch')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex gap-1" role="group" aria-label={t('side.filter')}>
        {(['all', 'ti', 'riverside'] as FilterKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            aria-pressed={filter === k}
            className={cn(
              'min-w-0 flex-1 truncate rounded-md px-2 py-1 text-[12px] font-medium transition-colors',
              filter === k ? 'bg-raised text-foreground' : 'text-muted-foreground hover:bg-raised/60 hover:text-foreground'
            )}
          >
            {k === 'all'
              ? t('side.filterAll')
              : k === 'ti'
                ? `${t('side.filterTi')} ${counts.ti || ''}`.trim()
                : `${t('side.filterRiverside')} ${counts.riverside || ''}`.trim()}
          </button>
        ))}
      </div>

      <div className="flex items-baseline justify-between px-1 text-[12px] text-muted-foreground">
        <span>{q ? t('side.results') : t('side.allCommunities')}</span>
        <span className="tabular-nums">{filtered.length.toLocaleString(numberFmt)}</span>
      </div>

      {!tiFeats && !failed && <p className="px-1 text-[12px] text-muted-foreground">{t('side.loadingCommunities')}</p>}
      {failed && <p className="px-1 text-[12px] text-destructive">{t('side.communitiesFailed')}</p>}

      <ul data-community-list className="flex flex-col divide-y divide-border">
        {shown.map((e, i) => {
          const isTi = e.kind === 'ti'
          const focused = isTi && focusedTi === e.name
          return (
            <li key={`${e.kind}-${i}-${e.name}`} className={cn('flex min-w-0 items-start gap-2 rounded-md px-1', focused && 'bg-raised')}>
              <button
                onClick={() => {
                  if (isTi) setFocusedTi(focused ? null : e.name)
                  requestFlyTo(e.centroid, isTi ? 7.5 : 9.5)
                }}
                aria-pressed={isTi ? focused : undefined}
                title={e.name}
                className="flex min-w-0 flex-1 items-start gap-2 py-2 pl-0.5 text-left"
              >
                <span className="mt-0.5 shrink-0">
                  <CommunityPin kind={isTi ? 'indigenous' : 'riverside'} size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-foreground">{e.name}</span>
                  <span className="block truncate text-[12px] tabular-nums text-muted-foreground">
                    {e.subtitle}
                    {e.area_km2 != null ? `, ${Math.round(e.area_km2).toLocaleString(numberFmt)} km²` : ''}
                    {e.population ? `, ${(e.population / 1000).toFixed(e.population >= 10000 ? 0 : 1)}k ${t('side.inh')}` : ''}
                  </span>
                </span>
              </button>
              {isTi && (
                <a
                  href={buildAsfVertexUrl(e.centroid)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 shrink-0 rounded-sm px-1.5 py-0.5 text-[12px] font-medium text-water hover:bg-raised"
                  title={t('side.sarLink')}
                  aria-label={`${t('side.sarLink')}: ${e.name}`}
                >
                  SAR ↗
                </a>
              )}
            </li>
          )
        })}
      </ul>

      {filtered.length > shown.length && (
        <button
          onClick={() => setPaging({ key: pageKey, n: limit + PAGE * 5 })}
          className="rounded-md border border-border px-2 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-raised hover:text-foreground"
        >
          {t('side.showMore', { n: (filtered.length - shown.length).toLocaleString(numberFmt) })}
        </button>
      )}
      {filtered.length === 0 && tiFeats && (
        <p className="px-1 py-4 text-center text-[12px] text-muted-foreground">{t('side.noMatch', { q: query })}</p>
      )}
    </div>
  )
}

function buildAsfVertexUrl([lon, lat]: [number, number]): string {
  const params = new URLSearchParams({
    zoom: '8',
    center: `${lon.toFixed(3)},${lat.toFixed(3)}`,
    dataset: 'SENTINEL-1',
    start: '2023-01-01T00:00:00Z',
    productTypes: 'GRD_HD',
  })
  return `https://search.asf.alaska.edu/#/?${params}`
}
