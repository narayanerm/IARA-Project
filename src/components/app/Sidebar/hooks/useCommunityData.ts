import { useEffect, useMemo, useState } from 'react'
import { INDIGENOUS_LANDS } from '@/data/layers/indigenous-lands'
import { AFFECTED_AREAS } from '@/data/layers/affected-areas'
import type { Entry, RivFeat, TiFeat } from '../types'
import { ENRICHED_TI_PROPS, tokensOf } from '../utils'

export function useCommunityData() {
  const [tiFeats, setTiFeats] = useState<TiFeat[] | null>(null)
  const [rivFeats, setRivFeats] = useState<RivFeat[] | null>(null)

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
    const tiPoints = tiFeats?.map((f) => f.properties) ?? null
    const rivPoints = rivFeats?.map((f) => f.properties) ?? null
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
  }, [tiFeats, rivFeats])

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = []
    for (const f of tiFeats ?? []) {
      const p = f.properties
      const centroid: [number, number] = [
        ((p.bw ?? f.geometry.coordinates[0]) + (p.be ?? f.geometry.coordinates[0])) / 2,
        ((p.bs ?? f.geometry.coordinates[1]) + (p.bn ?? f.geometry.coordinates[1])) / 2,
      ]
      const enriched = ENRICHED_TI_PROPS.get(p.nome.toLowerCase())
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
        nameLc: p.nome.toLowerCase(),
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

  return { entries, panorama }
}
