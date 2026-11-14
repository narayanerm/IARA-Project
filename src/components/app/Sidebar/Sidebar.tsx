import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Droplets,
  ExternalLink,
  MapPin,
  Pickaxe,
  Search,
  Sun,
  Trees,
  Users,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { REGIONS } from '@/lib/regions'
import type { Phenomenon } from '@/lib/types'
import { useApp, useAoiPopup } from '@/lib/store'
import { INDIGENOUS_LANDS } from '@/data/layers/indigenous-lands'
import { AFFECTED_AREAS } from '@/data/layers/affected-areas'

const ICON_BY_PHENOMENON: Record<Phenomenon, LucideIcon> = {
  mining: Pickaxe,
  flood: Droplets,
  drought: Sun,
}

type Kind = 'ti' | 'riverside'
type FilterKind = 'all' | Kind

interface Entry {
  kind: Kind
  name: string
  subtitle: string
  area_km2?: number
  population?: number
  year?: number
  centroid: [number, number]
  risk?: string
  // For accent / fallback lookup (indigenous name uses ISA detail if present).
  focusKey: string
  // Lowercase name (primary) + tokenized haystack for word-prefix search.
  nameLc: string
  tokens: string[]
}

interface TiPoint {
  nome: string
  etnia?: string | null
  fase?: string | null
  area_km2?: number
  risco?: string
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
  focos_10km?: number
  risco?: string
  dificuldade?: string
  dist_cidade_km?: number
  cidade_prox?: string
  populacao_mun?: number
}

function tokensOf(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

const ENRICHED = new Map(
  INDIGENOUS_LANDS.features.map((f) => [
    f.properties.name.replace(/^TI\s+/i, '').replace(/^Parque Indígena do\s+/i, '').toLowerCase(),
    f.properties,
  ])
)

export function Sidebar() {
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1440)
  const activeRegion = useApp((s) => s.activeRegion)
  const setActiveRegion = useApp((s) => s.setActiveRegion)
  const focusedTi = useApp((s) => s.focusedTi)
  const setFocusedTi = useApp((s) => s.setFocusedTi)
  const openPopup = useAoiPopup((s) => s.openPopup)

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterKind>('all')
  const [limit, setLimit] = useState(40)
  type TiFeat = { properties: TiPoint; geometry: { coordinates: [number, number] } }
  type RivFeat = { properties: RiversidePoint; geometry: { coordinates: [number, number] } }
  const [tiFeats, setTiFeats] = useState<TiFeat[] | null>(null)
  const [rivFeats, setRivFeats] = useState<RivFeat[] | null>(null)
  const tiPoints = tiFeats?.map((f) => f.properties) ?? null
  const rivPoints = rivFeats?.map((f) => f.properties) ?? null
  const scrollRef = useRef<HTMLDivElement>(null)
  const requestFlyTo = useApp((s) => s.requestFlyTo)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/data/terras-indigenas-pontos.geojson').then((r) => r.json()),
      fetch('/data/comunidades-ribeirinhas.geojson').then((r) => r.json()),
    ])
      .then(([ti, riv]) => {
        if (cancelled) return
        setTiFeats(ti.features as TiFeat[])
        setRivFeats(riv.features as RivFeat[])
      })
      .catch(() => void 0)
    return () => {
      cancelled = true
    }
  }, [])

  const panorama = useMemo(() => {
    const localCount = INDIGENOUS_LANDS.features.length
    const localArea = INDIGENOUS_LANDS.features.reduce((s, f) => s + (f.properties.area_km2 ?? 0), 0)
    const population = INDIGENOUS_LANDS.features.reduce((s, f) => s + (f.properties.population ?? 0), 0)
    const funaiArea = (tiPoints ?? []).reduce((s, p) => s + (p.area_km2 ?? 0), 0)
    const miningKm2 = AFFECTED_AREAS.YANO.features
      .filter((f) => f.properties.kind === 'mining')
      .reduce((s, f) => s + f.properties.area_km2, 0)
    return {
      localCount,
      localArea,
      population,
      funaiCount: tiPoints?.length ?? null,
      funaiArea,
      rivCount: rivPoints?.length ?? null,
      miningKm2,
    }
  }, [tiPoints, rivPoints])

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = []
    for (const f of tiFeats ?? []) {
      const p = f.properties
      const centroid: [number, number] = [
        ((p.bw ?? f.geometry.coordinates[0]) + (p.be ?? f.geometry.coordinates[0])) / 2,
        ((p.bs ?? f.geometry.coordinates[1]) + (p.bn ?? f.geometry.coordinates[1])) / 2,
      ]
      const enriched = ENRICHED.get(p.nome.toLowerCase())
      const nameLc = p.nome.toLowerCase()
      out.push({
        kind: 'ti',
        name: p.nome,
        subtitle: p.etnia || 'Terra Indígena',
        area_km2: p.area_km2,
        population: enriched?.population,
        year: enriched?.year,
        risk: p.risco,
        centroid,
        focusKey: p.nome,
        nameLc,
        tokens: tokensOf(`${p.nome} ${p.etnia ?? ''} ${p.fase ?? ''}`),
      })
    }
    for (const f of rivFeats ?? []) {
      const p = f.properties
      const [lon, lat] = f.geometry.coordinates
      out.push({
        kind: 'riverside',
        name: p.nome,
        subtitle: [p.rio, p.municipio].filter(Boolean).join(' · ') || 'Comunidade ribeirinha',
        risk: p.risco,
        centroid: [lon, lat],
        focusKey: p.nome,
        nameLc: p.nome.toLowerCase(),
        tokens: tokensOf(`${p.nome} ${p.municipio ?? ''} ${p.rio ?? ''} ${p.tipo ?? ''}`),
      })
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [tiFeats, rivFeats])

  const q = query.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const filtered = useMemo(() => {
    let xs = entries
    if (filter !== 'all') xs = xs.filter((e) => e.kind === filter)
    if (!q) return xs
    // Prefix-only match: entries whose name (preferred) or any token starts with the query.
    // Rank: name-starts-with > token-starts-with.
    const scored: Array<{ e: Entry; score: number }> = []
    for (const e of xs) {
      const nameNorm = e.nameLc.normalize('NFD').replace(/[̀-ͯ]/g, '')
      if (nameNorm.startsWith(q)) scored.push({ e, score: 2 })
      else if (e.tokens.some((t) => t.startsWith(q))) scored.push({ e, score: 1 })
    }
    scored.sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name, 'pt-BR'))
    return scored.map((s) => s.e)
  }, [entries, filter, q])

  useEffect(() => {
    setLimit(40)
    scrollRef.current?.scrollTo({ top: 0 })
  }, [q, filter])

  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => setScrolled(el.scrollTop > 280)
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [open])

  const shown = filtered.slice(0, limit)

  return (
    <aside
      className={cn(
        'relative z-10 h-full border-r border-border/60 bg-card/40 backdrop-blur-xl transition-[width] duration-300',
        open ? 'w-[300px] 2xl:w-[336px]' : 'w-10'
      )}
    >
      <div className="flex h-12 items-center justify-between border-b border-border/60 px-2">
        {open && (
          <div className="text-[12px] font-mono uppercase tracking-wider text-muted-foreground px-1">
            Panorama Amazônia
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Colapsar' : 'Expandir'}
        >
          {open ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>

      {open && scrolled && (
        <button
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="absolute left-1/2 top-16 z-20 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-card/95 backdrop-blur-md px-3 py-1.5 text-[11px] font-mono font-semibold text-primary shadow-lg hover:bg-primary/15 transition-colors"
          aria-label="Voltar ao topo"
        >
          <ArrowUp className="h-3.5 w-3.5" />
          Topo
        </button>
      )}

      {open && (
        <div ref={scrollRef} className="relative flex h-[calc(100%-3rem)] flex-col gap-3 overflow-y-auto p-3">
          <div className="flex gap-1.5">
            {REGIONS.map((r) => {
              const Icon = ICON_BY_PHENOMENON[r.phenomenon]
              const isActive = r.id === activeRegion
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    setActiveRegion(r.id)
                    openPopup()
                  }}
                  title={`${r.phenomenonLabel} · ${r.anchorCity}`}
                  className={cn(
                    'flex-1 inline-flex flex-col items-center gap-1 rounded-md border px-2 py-2 transition-colors',
                    isActive
                      ? 'bg-primary/15 border-primary/40 text-primary'
                      : 'bg-background/40 border-border/60 text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                  <span className="text-[11px] font-mono font-semibold leading-none">
                    {r.phenomenonLabel}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <StatBox
              icon={Trees}
              value={`${panorama.funaiCount ?? panorama.localCount}`}
              label={panorama.funaiCount ? 'TIs FUNAI (Amz)' : 'TIs destacadas'}
            />
            <StatBox
              icon={Users}
              value={`${panorama.rivCount ?? '…'}`}
              label="Comunidades ribeirinhas"
            />
            <StatBox
              icon={MapPin}
              value={`${((panorama.funaiArea || panorama.localArea) / 1000).toFixed(0)}k`}
              label="km² TIs protegidos"
            />
            <StatBox
              icon={Pickaxe}
              value={`${panorama.miningKm2}`}
              label="km² garimpo em Yanomami"
            />
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar TI, etnia, município, rio…"
              className="w-full rounded-md border border-border/60 bg-background/40 pl-7 pr-7 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/40"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex gap-1">
            {(['all', 'ti', 'riverside'] as FilterKind[]).map((k) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={cn(
                  'flex-1 rounded-md border px-2 py-1 text-[11px] font-mono transition-colors',
                  filter === k
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : 'border-border/60 bg-background/40 text-muted-foreground hover:text-foreground'
                )}
              >
                {k === 'all' ? 'todas' : k === 'ti' ? 'TI (FUNAI)' : 'Ribeirinhas'}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between px-1">
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              {q ? 'resultados' : 'todas as comunidades'}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground">
              {filtered.length.toLocaleString('pt-BR')}
              {filtered.length > shown.length && (
                <span className="opacity-70"> (mostrando {shown.length})</span>
              )}
            </div>
          </div>

          {!tiPoints && !rivPoints && (
            <div className="text-[12px] text-muted-foreground px-1">Carregando FUNAI / IBGE…</div>
          )}

          <div className="flex flex-col gap-1.5">
            {shown.map((e) => {
              const isTi = e.kind === 'ti'
              const focused = isTi && focusedTi === e.focusKey
              const kindColor = isTi ? 'sar-amber' : 'sar-cyan'
              const ribAccent = isTi ? 'hover:border-sar-amber/40' : 'hover:border-sar-cyan/40'
              return (
                <button
                  key={`${e.kind}-${e.name}-${e.centroid[0]}`}
                  onClick={() => {
                    if (isTi) setFocusedTi(focused ? null : e.focusKey)
                    requestFlyTo(e.centroid, isTi ? 7.5 : 9.5)
                  }}
                  className={cn(
                    'w-full rounded-md border p-2 text-left transition-colors',
                    focused
                      ? 'bg-sar-amber/15 border-sar-amber/50 shadow-[0_0_14px_-6px_hsl(28,95%,55%)]'
                      : cn('bg-background/40 border-border/60 hover:bg-background/60', ribAccent)
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                        <span
                          className={cn('inline-block h-1.5 w-1.5 rounded-full shrink-0', `bg-${kindColor}`)}
                        />
                        <span className="truncate">{e.name}</span>
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground truncate">
                        {e.subtitle}
                      </div>
                    </div>
                    {focused && (
                      <Badge variant="outline" className="shrink-0 text-[10px] font-mono px-1.5 py-0 h-4">
                        focused
                      </Badge>
                    )}
                  </div>

                  <div className="mt-1.5 grid grid-cols-3 gap-1 text-[11px] font-mono text-muted-foreground">
                    <MiniStat
                      label="área"
                      value={e.area_km2 != null ? `${compact(e.area_km2)} km²` : '—'}
                    />
                    <MiniStat
                      label="hab"
                      value={e.population != null ? compact(e.population) : '—'}
                    />
                    <MiniStat
                      label="ano"
                      value={e.year != null ? String(e.year) : '—'}
                    />
                  </div>

                  {isTi && (
                    <div className="mt-1.5 flex items-center justify-end">
                      <a
                        href={buildAsfVertexUrl(e.centroid)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(ev) => ev.stopPropagation()}
                        className="inline-flex items-center gap-1 rounded-sm border border-sar-cyan/40 bg-sar-cyan/10 px-1.5 py-0.5 text-[10px] font-mono text-sar-cyan hover:bg-sar-cyan/20 transition-colors"
                        title="Abrir catálogo SAR da ASF"
                      >
                        SAR ↗
                      </a>
                    </div>
                  )}
                </button>
              )
            })}
            {filtered.length > shown.length && (
              <button
                onClick={() => setLimit(filtered.length)}
                className="rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-[12px] font-mono text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors"
              >
                Mostrar todas ({filtered.length - shown.length} restantes)
              </button>
            )}
            {filtered.length === 0 && (tiPoints || rivPoints) && (
              <div className="text-[12px] text-muted-foreground px-1 py-4 text-center">
                Nada encontrado pra "{query}".
              </div>
            )}
          </div>

          <div className="mt-auto pt-2 border-t border-border/40 text-[10px] font-mono text-muted-foreground leading-relaxed">
            TIs:{' '}
            <a
              href="https://terrabrasilis.dpi.inpe.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              FUNAI via TerraBrasilis
            </a>
            . Ribeirinhas:{' '}
            <a
              href="https://www.ibge.gov.br/geociencias/cartas-e-mapas/bases-cartograficas-continuas/15759-brasil.html"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              IBGE BC250
            </a>
            .
          </div>
        </div>
      )}
    </aside>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-start rounded border border-border/50 bg-background/60 px-1.5 py-0.5">
      <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/70">
        {label}
      </span>
      <span className="text-[11px] font-mono text-foreground truncate max-w-full">{value}</span>
    </div>
  )
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`
  return n.toLocaleString('pt-BR')
}

function StatBox({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon
  value: string
  label: string
}) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-2">
      <div className="flex items-center gap-1 text-primary">
        <Icon className="h-3 w-3" strokeWidth={2} />
        <span className="text-base font-semibold leading-none">{value}</span>
      </div>
      <div className="text-[10px] font-mono text-muted-foreground mt-1 leading-tight">
        {label}
      </div>
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

// Icon import no longer needed since we don't link FUNAI SIG from the footer any more.
// (Kept here so the diff is self-contained; linter will remove if unused.)
export { ExternalLink }
