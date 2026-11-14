// Community layers built by scripts/build-community-data.mjs from the team data package (IBGE, FUNAI via INPE, MMA/CNUC via INPE).

const base = `${import.meta.env.BASE_URL}data/`

export const COMMUNITY_DATA = {
  tiAreas: `${base}terras-indigenas.geojson`,
  tiPoints: `${base}terras-indigenas-pontos.geojson`,
  reserves: `${base}territorios-tradicionais.geojson`,
  riverside: `${base}comunidades-ribeirinhas.geojson`,
} as const

export type Risk = 'baixo' | 'moderado' | 'alto' | 'muito alto'

export interface TiPointProps {
  id: number
  nome: string
  etnia: string | null
  fase: string | null
  area_km2: number | null
  revisao_fase: string | null
  revisao_area_km2: number | null
  focos_2026: number
  risco: Risk | null
  isaId: number | null
  // Outline bounding box, flattened because MapLibre stringifies nested properties.
  bw: number
  bs: number
  be: number
  bn: number
  minzoom: number
}

export interface RiversideProps {
  id: number
  nome: string
  tipo: string
  municipio: string
  rio: string | null
  cidade_prox: string | null
  dist_cidade_km: number | null
  focos_10km: number
  risco: Risk | null
  dificuldade: 'baixa' | 'média' | 'alta' | null
  atividade_principal_mun: string | null
  minzoom: number
}
