import type { RegionId } from '@/lib/types'

/*
 * One case study per phenomenon (MVP scope): a single, well-documented community
 * per problem. Each teammate owns one entry:
 *   YANO (mining)  · Nara
 *   ENCH (flood)   · Johann
 *   SECA (drought) · Elias
 * Every number here must come with a source the reader can open.
 */

export interface CaseNews {
  title: string
  outlet: string
  /** ISO date (YYYY-MM-DD or YYYY-MM) of publication. */
  date: string
  url: string
  /** One sentence, in our own words, on why this piece matters for the community. */
  summary: string
}

export interface CaseSite {
  name: string
  kind: 'neighborhood' | 'gauge' | 'landmark' | 'label'
  lon: number
  lat: number
  note: string
  /** Label side on the map, to keep nearby labels apart. */
  labelSide?: 'left' | 'right' | 'top' | 'bottom'
}

export interface StagePeak {
  year: number
  /** Annual maximum at the gauge, in metres. */
  value: number
  date: string
  /** True when the value is the highest reading published so far, not the consolidated annual maximum. */
  approx?: boolean
}

export interface StageThreshold {
  value: number
  label: string
}

export interface RiverStage {
  station: string
  stationUrl: string
  thresholds: StageThreshold[]
  peaks: StagePeak[]
  recordLow: { value: number; date: string }
  /** Empirical probability of an extreme flood (≥ 29.69 m), before and after 2009. */
  extremeOdds: { threshold: number; before: string; beforePct: number; after: string; afterPct: number; source: string; url: string }
  sources: Array<{ label: string; url: string }>
}

export interface CaseFact {
  value: string
  label: string
  source: string
  url: string
}

export interface CaseStory {
  /** Paraphrase of a resident's account, in our own words. */
  text: string
  who: string
  source: string
  url: string
}

export interface CaseForecast {
  status: 'pending' | 'ready'
  /** What the model will read. */
  inputs: string[]
  /** Official forecast the model should be compared against. */
  benchmark: { label: string; url: string }
  /** Last season's official forecast vs what happened, as a yardstick. */
  lastSeason?: { forecast: string; observed: string; note: string }
}

export interface CaseStudy {
  id: RegionId
  community: string
  place: string
  /** One-line hook for the selection screen. */
  hook: string
  /** Short intro shown at the top of the case panel. */
  intro?: string
  /** Headline figures about the community, each with its source. */
  facts: CaseFact[]
  story?: CaseStory
  /** Area cropped from every radar scene in the SAR archive viewer: [west, south, east, north]. */
  sarCrop?: [number, number, number, number]
  sites: CaseSite[]
  news: CaseNews[]
  riverStage?: RiverStage
  forecast: CaseForecast
}

const FLOOD_MANAUS: CaseStudy = {
  id: 'ENCH',
  community: 'Educandos e São Jorge',
  place: 'Manaus · AM',
  hook: 'Bairros de palafitas na beira dos igarapés, alagados a cada grande cheia do Rio Negro.',
  intro:
    'Na beira do Rio Negro e dos igarapés, milhares de famílias moram em casas de madeira e palafitas. Quando o rio sobe, a água entra em casa e fica por semanas; o acesso passa a ser por passarelas de madeira.',
  facts: [
    {
      value: '2,06 mi',
      label: 'habitantes em Manaus (2.063.689)',
      source: 'IBGE · Censo 2022',
      url: 'https://cidades.ibge.gov.br/brasil/am/manaus/panorama',
    },
    {
      value: '~15 mil',
      label: 'moradores no Educandos, um dos bairros mais antigos da cidade',
      source: 'National Geographic Brasil · 2021',
      url: 'https://www.nationalgeographicbrasil.com/meio-ambiente/2021/09/cheias-recordes-atingiram-cidades-na-bacia-amazonica-este-ano-mas-a-vida-seguiu',
    },
    {
      value: '24 mil',
      label: 'moradores de Manaus atingidos em 17 bairros na cheia recorde de 2021',
      source: 'Defesa Civil · Agência Estado',
      url: 'https://www.folhavitoria.com.br/geral/no-amazonas-rio-negro-registra-a-maior-cheia-da-historia/',
    },
    {
      value: '13 mil m',
      label: 'de passarelas de madeira erguidas em 21 bairros em 2021',
      source: 'Prefeitura de Manaus · NatGeo',
      url: 'https://www.nationalgeographicbrasil.com/meio-ambiente/2021/09/cheias-recordes-atingiram-cidades-na-bacia-amazonica-este-ano-mas-a-vida-seguiu',
    },
    {
      value: '1 em 4',
      label: 'anos com cheia extrema desde 2009; antes, era cerca de 1 em 100',
      source: 'Oliveira 2025 · UFAM/SGB',
      url: 'https://static.even3.com/anais/1211771.pdf',
    },
    {
      value: '534 mil',
      label: 'pessoas atingidas pela cheia de 2025 no Amazonas',
      source: 'Defesa Civil AM',
      url: 'https://revistaoeste.com/brasil/amazonas-tem-40-cidades-em-emergencia-por-causa-da-cheia/',
    },
  ],
  story: {
    text: 'Morou com a água do Rio Negro dentro de casa em 20 dos seus 26 anos de vida.',
    who: 'Pâmela, moradora do Educandos',
    source: 'Brasil de Fato · 01.06.2021',
    url: 'https://www.brasildefato.com.br/2021/06/01/cheia-recorde-do-rio-negro-am-ja-registrou-6-das-10-maiores-cheias-na-ultima-decada/',
  },
  // Urban Manaus with the Rio Negro to the west and the Meeting of the Waters / Solimões to the south-east
  sarCrop: [-60.16, -3.22, -59.82, -3.0],
  sites: [
    { name: 'MANAUS', kind: 'label', lon: -60.015, lat: -3.06, note: 'Capital do Amazonas, 2,06 milhões de habitantes.' },
    { name: 'Rio Negro', kind: 'label', lon: -60.105, lat: -3.115, note: 'Margem esquerda da cidade.' },
    { name: 'Encontro das Águas', kind: 'label', lon: -59.875, lat: -3.155, note: 'Rio Negro encontra o Solimões e forma o Amazonas.' },
    {
      name: 'Educandos',
      kind: 'neighborhood',
      lon: -60.012,
      lat: -3.144,
      note: 'Bairro antigo na foz do Igarapé do Educandos; casas de madeira e palafitas convivem com a água nas grandes cheias.',
      labelSide: 'right',
    },
    {
      name: 'São Jorge',
      kind: 'neighborhood',
      lon: -60.037,
      lat: -3.109,
      note: 'Referência do SGB para a cota de inundação: com o rio acima de 27,50 m, a água chega ao bairro.',
      labelSide: 'left',
    },
    {
      name: 'Centro · Rua dos Barés',
      kind: 'landmark',
      lon: -60.0236,
      lat: -3.1392,
      note: 'Referência do SGB para a inundação severa (29,00 m): ruas do centro histórico e da Manaus Moderna alagam.',
      labelSide: 'top',
    },
    {
      name: 'Porto de Manaus · régua',
      kind: 'gauge',
      lon: -60.0262,
      lat: -3.1418,
      note: 'Estação fluviométrica 14990000 (ANA): leitura diária do nível do Rio Negro desde setembro de 1902.',
      labelSide: 'bottom',
    },
  ],
  news: [
    {
      title: 'Rio Negro chega a 27,52 metros em Manaus e atinge cota de inundação',
      outlet: 'Portal Amazônia',
      date: '2026-05-21',
      url: 'https://portalamazonia.com/meio-ambiente/rio-negro-manaus-cota-inundacao-2026/',
      summary: 'Em 2026 o rio voltou a passar da cota de inundação, com pico esperado entre junho e julho.',
    },
    {
      title: 'SGB aponta que nível dos rios amazônicos não ultrapassará cota de inundação severa em 2026',
      outlet: 'Portal Amazônia / Rede Amazônica',
      date: '2026-05-29',
      url: 'https://portalamazonia.com/meio-ambiente/nivel-rios-amazonicos-sgb/',
      summary: 'Último alerta oficial da temporada previu 28,20 m em Manaus; o rio chegou a cerca de 28,50 m no fim de junho.',
    },
    {
      title: 'Cheia obriga moradores de bairros afetados a viver entre lixo e risco à saúde em Manaus',
      outlet: 'Portal Amazônia',
      date: '2025-07',
      url: 'https://portalamazonia.com/fram/cheia-obriga-moradores-de-bairros-afetados-a-viver-entre-lixo-e-risco-a-saude-em-manaus/',
      summary: 'Em 2025 o rio passou de 29 m em pleno julho, e famílias dos bairros baixos ficaram entre água parada e lixo.',
    },
    {
      title: 'Nota explicativa da delimitação da mancha de inundação do rio Negro na zona urbana de Manaus',
      outlet: 'Serviço Geológico do Brasil (SGB/CPRM)',
      date: '2021',
      url: 'https://rigeo.cprm.gov.br/bitstream/doc/23747/1/nota-explicativa_manchainundacao.pdf',
      summary: 'Mapeamento com drone da área alagada na cheia recorde; Educandos, São Jorge, Centro, Mauazinho e Raiz entre os mais atingidos.',
    },
    {
      title: 'Cheias recordes atingiram cidades na bacia amazônica este ano – mas a vida seguiu',
      outlet: 'National Geographic Brasil',
      date: '2021-09',
      url: 'https://www.nationalgeographicbrasil.com/meio-ambiente/2021/09/cheias-recordes-atingiram-cidades-na-bacia-amazonica-este-ano-mas-a-vida-seguiu',
      summary: 'Ensaio sobre moradores do Educandos que adaptaram as casas de madeira à água durante a maior cheia já medida.',
    },
    {
      title: 'Mais de 6 mil metros de pontes são construídos pela prefeitura',
      outlet: 'Informe Manaus',
      date: '2021',
      url: 'https://informemanaus.com/2021/mais-de-6-mil-metros-de-pontes-sao-construidos-pela-prefeitura',
      summary: 'A Operação Cheia 2021 ergueu passarelas de madeira em bairros como São Jorge, Glória, Educandos e Centro.',
    },
    {
      title: 'Cheia recorde do Rio Negro: AM já registrou 6 das 10 maiores cheias na última década',
      outlet: 'Brasil de Fato',
      date: '2021-06-01',
      url: 'https://www.brasildefato.com.br/2021/06/01/cheia-recorde-do-rio-negro-am-ja-registrou-6-das-10-maiores-cheias-na-ultima-decada/',
      summary: 'Uma moradora do Educandos conta que conviveu com a água dentro de casa em 20 dos seus 26 anos.',
    },
  ],
  riverStage: {
    station: 'Rio Negro · Porto de Manaus (ANA 14990000)',
    stationUrl: 'https://www.sgb.gov.br/sace/amazonas/ultimo_boletim.php',
    thresholds: [
      { value: 27.0, label: 'Alerta' },
      { value: 27.5, label: 'Inundação · São Jorge' },
      { value: 29.0, label: 'Inundação severa · Rua dos Barés' },
    ],
    peaks: [
      { year: 1953, value: 29.69, date: '1953-06-09' },
      { year: 2009, value: 29.77, date: '2009-07-01' },
      { year: 2012, value: 29.97, date: '2012-05-29' },
      { year: 2021, value: 30.02, date: '2021-06-16' },
      { year: 2022, value: 29.75, date: '2022-06-22' },
      { year: 2025, value: 29.04, date: '2025-07-05', approx: true },
      { year: 2026, value: 28.5, date: '2026-06-30', approx: true },
    ],
    recordLow: { value: 12.11, date: '2024-10-09' },
    extremeOdds: {
      threshold: 29.69,
      before: '1903–2008',
      beforePct: 0.94,
      after: '2009–2024',
      afterPct: 25,
      source: 'Oliveira, H. S. (UFAM/SGB) · VI CoBICET 2025',
      url: 'https://static.even3.com/anais/1211771.pdf',
    },
    sources: [
      { label: 'SGB · Alerta Hidrológico do Amazonas', url: 'https://www.sgb.gov.br/sace/amazonas/ultimo_boletim.php' },
      { label: 'Oliveira (2025) · cheias e secas extremas 1902–2024', url: 'https://static.even3.com/anais/1211771.pdf' },
      { label: 'ANA · HidroWeb (estação 14990000)', url: 'https://www.snirh.gov.br/hidroweb/' },
    ],
  },
  forecast: {
    status: 'pending',
    inputs: [
      'Cota diária do Rio Negro no Porto de Manaus (ANA 14990000, desde 1902)',
      'Chuva acumulada na bacia do Negro (NASA GPM IMERG)',
      'Extensão de água vista por SAR (Sentinel-1 e NISAR)',
    ],
    benchmark: {
      label: 'SGB · Alerta de Cheias (previsões ~75, 45 e 15 dias antes do pico)',
      url: 'https://www.sgb.gov.br/sace/amazonas/ultimo_boletim.php',
    },
    lastSeason: {
      forecast: '28,20 m',
      observed: '≈ 28,50 m',
      note: 'Cheia de 2026: último alerta oficial (fim de maio) vs. nível no fim de junho.',
    },
  },
}

const MINING_YANOMAMI: CaseStudy = {
  id: 'YANO',
  community: 'Povo Yanomami · Homoxi',
  place: 'TI Yanomami · RR',
  hook: 'Garimpo ilegal abre clareiras sob a floresta; o radar banda L enxerga através da copa.',
  facts: [],
  sites: [],
  news: [],
  forecast: {
    status: 'pending',
    inputs: [],
    benchmark: { label: 'MapBiomas Alerta', url: 'https://alerta.mapbiomas.org/' },
  },
}

const DROUGHT_TEFE: CaseStudy = {
  id: 'SECA',
  community: 'Lago Tefé',
  place: 'Tefé · AM',
  hook: 'A seca de 2023–24 encolheu o lago e isolou comunidades ribeirinhas.',
  facts: [],
  sites: [],
  news: [],
  forecast: {
    status: 'pending',
    inputs: [],
    benchmark: { label: 'SGB · Alerta Hidrológico do Amazonas', url: 'https://www.sgb.gov.br/sace/amazonas/ultimo_boletim.php' },
  },
}

export const CASES: Record<RegionId, CaseStudy> = {
  YANO: MINING_YANOMAMI,
  ENCH: FLOOD_MANAUS,
  SECA: DROUGHT_TEFE,
}

export const CASE_ORDER: RegionId[] = ['YANO', 'ENCH', 'SECA']
