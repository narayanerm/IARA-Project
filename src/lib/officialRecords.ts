import { useEffect, useState } from 'react'

// Official records for every Indigenous Land and every riverside community's
// municipality, built by scripts/build-official-records.mjs from FUNAI and IBGE
// (public/data/official-records.json). Keys are names without accents, case or
// punctuation, the same rule as recordKey() below.

export interface OfficialLand {
  name: string
  isaId: number | null
  funai: {
    code: number
    name: string
    phase: string | null
    modality: string | null
    areaKm2: number | null
    declared: string | null
    homologated: string | null
    regularized: string | null
  } | null
  /** FUNAI regional office (Coordenação Regional) that serves the land. */
  office: { code: string; name: string | null; url: string | null } | null
  /** IBGE Census 2022 residents in the land. */
  census2022: { residents: number; indigenous: number } | null
}

export interface OfficialMunicipality {
  name: string
  ibgeCode: number
  uf: string
  /** IBGE Cidades page. */
  url: string
  /** IBGE Census 2022. */
  population: number | null
  areaKm2: number | null
}

export interface OfficialRecords {
  generatedAt: string
  sources: Record<string, string>
  lands: Record<string, OfficialLand>
  municipalities: Record<string, OfficialMunicipality>
}

/** FUNAI page listing every regional office: the fallback when a land has none. */
export const FUNAI_OFFICES_URL =
  'https://www.gov.br/funai/pt-br/acesso-a-informacao/institucional/coordenacoes-regionais-funai'

export function recordKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

let request: Promise<OfficialRecords | null> | null = null

export function loadOfficialRecords(): Promise<OfficialRecords | null> {
  request ??= fetch(`${import.meta.env.BASE_URL}data/official-records.json`)
    .then((r) => (r.ok ? (r.json() as Promise<OfficialRecords>) : null))
    .catch(() => null)
  return request
}

export function useOfficialRecords(): OfficialRecords | null {
  const [records, setRecords] = useState<OfficialRecords | null>(null)
  useEffect(() => {
    let alive = true
    loadOfficialRecords().then((r) => alive && setRecords(r))
    return () => {
      alive = false
    }
  }, [])
  return records
}

/** Record of a land by any of the names the app uses ("Yanomami", "TI Yanomami", "Parque Indígena do Xingu"). */
export function landRecord(records: OfficialRecords | null, name: string | null | undefined): OfficialLand | null {
  if (!records || !name) return null
  const bare = name.replace(/^TI\s+/i, '')
  const park = bare.match(/^Parque Ind[ií]gena d[oa]\s+(.+)$/i)
  const keys = [recordKey(name), recordKey(bare), park ? `parquedo${recordKey(park[1])}` : '']
  for (const k of keys) if (k && records.lands[k]) return records.lands[k]
  return null
}

export function municipalityRecord(
  records: OfficialRecords | null,
  name: string | null | undefined
): OfficialMunicipality | null {
  if (!records || !name) return null
  return records.municipalities[recordKey(name)] ?? null
}

export const yearOf = (iso: string | null | undefined): number | null => (iso ? Number(iso.slice(0, 4)) : null)

/** "1992-05-25" -> "25.05.1992" */
export const formatOfficialDate = (iso: string | null | undefined): string | null =>
  iso ? iso.slice(0, 10).split('-').reverse().join('.') : null
