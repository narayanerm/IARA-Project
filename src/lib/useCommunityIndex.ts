import { useEffect, useState } from 'react'
import type { FeatureCollection, Point } from 'geojson'
import { COMMUNITY_DATA, type RiversideProps, type TiPointProps } from '@/data/layers/communities'
import type { CommunityKind } from '@/components/app/Map/community-kind'
import { focusFromRiverside, focusFromTi, focusKey, type Focus } from './community'

export interface CommunityEntry {
  focus: Focus
  /** Secondary line: ethnicities for a TI, river and municipality for a riverside community. */
  detail: string
  nameNorm: string
  tokens: string[]
}

export interface CommunityIndex {
  entries: CommunityEntry[]
  byKey: Map<string, CommunityEntry>
}

export type KindFilter = 'all' | CommunityKind

export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function tokensOf(s: string): string[] {
  return normalize(s).split(/[^a-z0-9]+/).filter(Boolean)
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} ${res.status}`)
  return (await res.json()) as T
}

function build(
  ti: FeatureCollection<Point, TiPointProps>,
  riv: FeatureCollection<Point, RiversideProps>
): CommunityIndex {
  const entries: CommunityEntry[] = []
  for (const f of ti.features) {
    const p = f.properties
    const lngLat = f.geometry.coordinates as [number, number]
    entries.push({
      focus: focusFromTi(p, lngLat),
      detail: p.etnia ?? '',
      nameNorm: normalize(p.nome),
      tokens: tokensOf(`${p.nome} ${p.etnia ?? ''} ${p.fase ?? ''}`),
    })
  }
  for (const f of riv.features) {
    const p = f.properties
    const lngLat = f.geometry.coordinates as [number, number]
    entries.push({
      focus: focusFromRiverside(p, lngLat),
      detail: [p.rio, p.municipio].filter(Boolean).join(' · '),
      nameNorm: normalize(p.nome),
      tokens: tokensOf(`${p.nome} ${p.municipio ?? ''} ${p.rio ?? ''} ${p.tipo ?? ''}`),
    })
  }
  entries.sort((a, b) => a.focus.name.localeCompare(b.focus.name, 'pt-BR'))
  return { entries, byKey: new Map(entries.map((e) => [focusKey(e.focus), e])) }
}

let indexPromise: Promise<CommunityIndex> | null = null

/** Loads the TI and riverside points once and shares them between the search, the map and the panel. */
export function loadCommunityIndex(): Promise<CommunityIndex> {
  if (!indexPromise) {
    indexPromise = Promise.all([
      fetchJson<FeatureCollection<Point, TiPointProps>>(COMMUNITY_DATA.tiPoints),
      fetchJson<FeatureCollection<Point, RiversideProps>>(COMMUNITY_DATA.riverside),
    ]).then(([ti, riv]) => build(ti, riv))
    indexPromise.catch(() => {
      indexPromise = null
    })
  }
  return indexPromise
}

export function useCommunityIndex(): CommunityIndex | null {
  const [index, setIndex] = useState<CommunityIndex | null>(null)
  useEffect(() => {
    let cancelled = false
    loadCommunityIndex()
      .then((i) => {
        if (!cancelled) setIndex(i)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])
  return index
}

/** Prefix search over name (ranked first) and tokens, the same rule the community sidebar used. */
export function searchCommunities(
  index: CommunityIndex,
  query: string,
  filter: KindFilter,
  limit: number
): CommunityEntry[] {
  const q = normalize(query.trim())
  const pool = filter === 'all' ? index.entries : index.entries.filter((e) => e.focus.kind === filter)
  if (!q) return pool.slice(0, limit)
  const byName: CommunityEntry[] = []
  const byToken: CommunityEntry[] = []
  for (const e of pool) {
    if (e.nameNorm.startsWith(q)) byName.push(e)
    else if (e.tokens.some((t) => t.startsWith(q))) byToken.push(e)
  }
  return [...byName, ...byToken].slice(0, limit)
}

export function countMatches(index: CommunityIndex, query: string, filter: KindFilter): number {
  return searchCommunities(index, query, filter, Number.POSITIVE_INFINITY).length
}
