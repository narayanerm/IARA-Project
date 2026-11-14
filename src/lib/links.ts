// Per-TI profile on Terras Indígenas no Brasil (ISA).
export const tiProfileUrl = (isaId: number) => `https://terrasindigenas.org.br/pt-br/terras-indigenas/${isaId}`

// Per-land FUNAI links come from public/data/official-records.json (see src/lib/officialRecords.ts):
// each land points to the page of the FUNAI regional office that serves it.

// TerraBrasilis (INPE): FUNAI/PRODES/DETER data host.
export const TERRABRASILIS_URL = 'https://terrabrasilis.dpi.inpe.br/'
export const TERRABRASILIS_FUNAI_URL =
  'https://terrabrasilis.dpi.inpe.br/geoserver/prodes-legal-amz/ows?service=WFS&request=GetCapabilities'

// DETER-Amz (INPE): near-real-time Amazon deforestation / mining alerts.
export const DETER_URL = 'http://terrabrasilis.dpi.inpe.br/app/map/deter?hl=pt-br'
export const DETER_WFS_URL =
  'https://terrabrasilis.dpi.inpe.br/geoserver/deter-amz/ows?service=WFS&request=GetCapabilities'

// IBGE Malhas API (municipal/state boundaries).
export const IBGE_MALHAS_URL = 'https://servicodados.ibge.gov.br/api/docs/malhas-geograficas'

// IBGE BC250: 1:250 000 continuous base map (riverside community coordinates come from here).
export const IBGE_BC250_URL =
  'https://www.ibge.gov.br/geociencias/cartas-e-mapas/bases-cartograficas-continuas/15759-brasil.html'

// INPE Programa Queimadas (fire hotspots).
export const INPE_QUEIMADAS_URL = 'https://queimadas.dgi.inpe.br/'

// IBGE Cidades: per-municipality profile (needs the UF, e.g. /brasil/am/manicore/panorama).
// Per-community links come ready from public/data/official-records.json.
export const ibgeCidadeUrl = (uf: string, municipio: string) =>
  `https://cidades.ibge.gov.br/brasil/${uf.toLowerCase()}/${municipio
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}/panorama`

// ISA (Instituto Socioambiental) — Indigenous Lands portal.
export const ISA_TI_PORTAL = 'https://terrasindigenas.org.br/'

export const osmObjectUrl = (osmType: string, osmId: number) => `https://www.openstreetmap.org/${osmType}/${osmId}`
