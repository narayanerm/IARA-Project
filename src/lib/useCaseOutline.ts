import { useEffect, useState } from 'react'
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import type { CaseOutline } from '@/data/cases'
import { COMMUNITY_DATA } from '@/data/layers/communities'

// IBGE data services. The servicodados API answers with CORS open; the cidades.ibge.gov.br
// pages are behind a bot challenge, so the app reads the numbers from here instead.
const IBGE = 'https://servicodados.ibge.gov.br/api/v3'

export type Outline = Feature<Polygon | MultiPolygon>

const outlineCache = new Map<string, Promise<Outline | null>>()
const popCache = new Map<number, Promise<number | null>>()

function keyOf(o: CaseOutline) {
  return o.kind === 'ti' ? `ti:${o.name}` : `ibge:${o.code}`
}

async function loadOutline(o: CaseOutline): Promise<Outline | null> {
  if (o.kind === 'ibge') {
    const url = `${IBGE}/malhas/municipios/${o.code}?formato=application/vnd.geo%2Bjson&qualidade=intermediaria`
    const r = await fetch(url)
    if (!r.ok) throw new Error(`IBGE ${r.status}`)
    const fc = (await r.json()) as FeatureCollection<Polygon | MultiPolygon>
    return fc.features[0] ?? null
  }
  const r = await fetch(COMMUNITY_DATA.tiAreas)
  if (!r.ok) throw new Error(`TI ${r.status}`)
  const fc = (await r.json()) as FeatureCollection<Polygon | MultiPolygon, { nome?: string }>
  return fc.features.find((f) => f.properties?.nome === o.name) ?? null
}

/** Official boundary of the case: FUNAI land (local data) or IBGE municipality (live). */
export function useCaseOutline(o: CaseOutline | null): Outline | null {
  const [state, setState] = useState<{ key: string; feature: Outline | null } | null>(null)
  const key = o ? keyOf(o) : null

  useEffect(() => {
    if (!o || !key) return
    let p = outlineCache.get(key)
    if (!p) {
      p = loadOutline(o).catch(() => {
        outlineCache.delete(key)
        return null
      })
      outlineCache.set(key, p)
    }
    let alive = true
    p.then((feature) => alive && setState({ key, feature }))
    return () => {
      alive = false
    }
    // `key` identifies `o`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state && state.key === key ? state.feature : null
}

/** 2022 Census resident population from IBGE SIDRA (table 4714, variable 93). */
export function useIbgePopulation(code: number | undefined): number | null {
  const [pop, setPop] = useState<{ code: number; value: number | null } | null>(null)

  useEffect(() => {
    if (!code) return
    let p = popCache.get(code)
    if (!p) {
      p = fetch(`${IBGE}/agregados/4714/periodos/2022/variaveis/93?localidades=N6[${code}]`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`IBGE ${r.status}`))))
        .then((d: Array<{ resultados: Array<{ series: Array<{ serie: Record<string, string> }> }> }>) => {
          const v = Number(d[0]?.resultados[0]?.series[0]?.serie['2022'])
          return Number.isFinite(v) && v > 0 ? v : null
        })
        .catch(() => {
          popCache.delete(code)
          return null
        })
      popCache.set(code, p)
    }
    let alive = true
    p.then((value) => alive && setPop({ code, value }))
    return () => {
      alive = false
    }
  }, [code])

  return pop && pop.code === code ? pop.value : null
}
