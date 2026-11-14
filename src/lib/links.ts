// Per-TI profile on Terras Indígenas no Brasil (ISA).
export const tiProfileUrl = (isaId: number) => `https://terrasindigenas.org.br/pt-br/terras-indigenas/${isaId}`

// FUNAI SICI (Sistema de Informações da Coordenação-Geral): per-TI search.
export const funaiSiciUrl = (name: string) =>
  `https://sistemas.funai.gov.br/sici/busca.php?nome=${encodeURIComponent(name.replace(/^TI\s+/i, ''))}`

// Official FUNAI page for Indigenous Lands geodata and maps.
export const FUNAI_TI_URL = 'https://www.gov.br/funai/pt-br/atuacao/terras-indigenas/geoprocessamento-e-mapas'

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

// IBGE Cidades: per-municipality profile.
export const ibgeCidadeUrl = (slug: string) =>
  `https://cidades.ibge.gov.br/brasil/${encodeURIComponent(slug.toLowerCase())}`

// ISA (Instituto Socioambiental) — Indigenous Lands portal.
export const ISA_TI_PORTAL = 'https://terrasindigenas.org.br/'

export const osmObjectUrl = (osmType: string, osmId: number) => `https://www.openstreetmap.org/${osmType}/${osmId}`
