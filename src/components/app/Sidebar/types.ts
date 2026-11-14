export type Kind = 'ti' | 'riverside'
export type FilterKind = 'all' | Kind

export interface Entry {
  kind: Kind
  name: string
  subtitle: string
  area_km2?: number
  population?: number
  year?: number
  centroid: [number, number]
  risk?: string
  focusKey: string
  // Lowercase name (primary) + tokenized haystack for word-prefix search.
  nameLc: string
  tokens: string[]
}

export interface TiPoint {
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

export interface RiversidePoint {
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

export type TiFeat = { properties: TiPoint; geometry: { coordinates: [number, number] } }
export type RivFeat = { properties: RiversidePoint; geometry: { coordinates: [number, number] } }
