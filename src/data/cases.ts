import type { RegionId } from '@/lib/types'

// The three focused case studies. Historical figures name their sources alongside the values.

export type Ref = { label: string; url: string }
export type L = { pt: string; en: string; refs?: Ref[] }
export type RiskLevel = 'critical' | 'high' | 'watch'
export type PainIcon = 'health' | 'water' | 'forest' | 'home' | 'boat' | 'food' | 'fish' | 'fire' | 'road' | 'people'

export interface CaseStat {
  value: string
  label: L
  source: string
  refs?: Ref[]
}

export interface CasePain {
  icon: PainIcon
  title: L
  body: L
  refs?: Ref[]
}

export interface SeriesPoint {
  /** Category shown on the axis (a year). */
  year: number
  value: number
  date?: string
  note: L
  /** Dates for the radar before/after pair; omitted when no satellite covers that year. */
  sar?: { before: string; after: string }
  /** Visible-light (true colour) scenes for the before/after slider: previous low water and the flood. */
  optical?: { before: OpticalScene; after: OpticalScene }
}

/** One Landsat or Sentinel-2 scene on Microsoft Planetary Computer. */
export interface OpticalScene {
  collection: 'landsat-c2-l2' | 'sentinel-2-l2a'
  id: string
  date: string
  platform: string
}

export interface SeriesThreshold {
  value: number
  label: L
  tone: 'danger' | 'warn' | 'muted'
}

export interface CaseSeries {
  title: L
  unit: string
  /** Fraction digits when printing a value. */
  digits: number
  domain: [number, number]
  /** Which direction is worse: floods and mining grow, droughts sink. */
  worse: 'high' | 'low'
  points: SeriesPoint[]
  /** Year shown first on the timeline (defaults to the latest point). */
  defaultYear?: number
  /** Latest reading of the measured quantity, for the alerts tab (drought case). */
  latest?: StageReading
  thresholds: SeriesThreshold[]
  source: { label: string; url: string }
  footnote: L
}

export interface Hotspot {
  id: string
  name: string
  center: [number, number]
  level: RiskLevel
  note: L
  approx?: boolean
  /** Put the map label on the left when a neighbour sits to the right. */
  labelLeft?: boolean
}

export type CaseOutline = { kind: 'ti'; name: string } | { kind: 'ibge'; code: number }

// News / reports / official documents on how the problem reaches the community.
// Ported from manaus-flood-case branch to keep sourced human context next to the data.
export interface CaseNews {
  title: string
  outlet: string
  /** ISO date (YYYY-MM-DD, YYYY-MM or YYYY) of publication. */
  date: string
  url: string
  /** One sentence in our own words on why this piece matters for the community. */
  summary: string
}

// River gauge data for the flood case (Porto de Manaus series).
// Ported from manaus-flood-case branch for the RiverStageChart widget.
export interface StagePeak {
  year: number
  /** Annual maximum at the gauge, in metres. */
  value: number
  date: string
  /** True when the value is the highest reading published so far, not the consolidated annual maximum. */
  approx?: boolean
}

/** One published reading at a river gauge. */
export interface StageReading {
  value: number
  date: string
  trend: 'rising' | 'falling' | 'steady'
  source: string
  url: string
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
  /** Empirical probability of an extreme flood (≥ threshold), before and after a breakpoint year. */
  extremeOdds: {
    threshold: number
    before: string
    beforePct: number
    after: string
    afterPct: number
    source: string
    url: string
  }
  sources: Array<{ label: string; url: string }>
  /** Latest published reading at the gauge (static: no live feed reaches the app). */
  latest?: StageReading
}

export interface CaseStudy {
  id: RegionId
  /** Satellite still used as the card cover (Sentinel-2 cloudless tiles). */
  cover: { center: [number, number]; zoom: number }
  /** Official boundary drawn as the cut-out on the map. */
  outline: CaseOutline
  /** IBGE municipality code for the live census figure, when the case is a municipality. */
  ibgeCode?: number
  meta: Array<{ label: L; value: L; refs?: Ref[] }>
  /** Short theme word and the full "analysis of" label used on the entry cards. */
  theme: L
  analysis: L
  place: L
  placeShort: string
  color: string
  camera: { center: [number, number]; zoom: number }
  headline: L
  hero: CaseStat
  stats: CaseStat[]
  story: L[]
  pains: CasePain[]
  series: CaseSeries
  risk: { level: RiskLevel; summary: L }
  hotspots: Hotspot[]
  hotspotsNote: L
  sarBbox: [number, number, number, number]
  /** Tighter box for the visible-light slider (one Landsat/Sentinel-2 tile must cover it). */
  opticalBbox?: [number, number, number, number]
  sarReading: L
  sources: Array<{ label: string; url: string }>
  questions: L[]
  /** Optional river gauge series (used by the flood case for the RiverStageChart). */
  riverStage?: RiverStage
  /** News / official reports grounding the numbers in human experience. */
  news?: CaseNews[]
}

const OLIVEIRA_2025 = {
  label: 'Oliveira (UFAM/SGB), CoBICET 2025 · Porto de Manaus 1902–2024',
  url: 'https://static.even3.com/anais/1211771.pdf',
}

export const CASES: Record<RegionId, CaseStudy> = {
  YANO: {
    id: 'YANO',
    theme: { pt: 'Garimpo', en: 'Mining' },
    analysis: { pt: 'Análise de garimpo', en: 'Mining analysis' },
    place: { pt: 'Terra Yanomami e região', en: 'Yanomami land and surroundings' },
    placeShort: 'Yanomami',
    color: '#F07A45',
    camera: { center: [-63.38, 2.92], zoom: 8.2 },
    cover: { center: [-62.95, 3.4], zoom: 11 },
    outline: { kind: 'ti', name: 'Yanomami' },
    meta: [
      { label: { pt: 'Onde', en: 'Where' }, value: { pt: 'Roraima e Amazonas', en: 'Roraima and Amazonas' } },
      { label: { pt: 'Quem', en: 'Who' }, value: { pt: "Yanomami e Ye'kwana", en: "Yanomami and Ye'kwana" } },
      { label: { pt: 'Período', en: 'Period' }, value: { pt: '2018–2023', en: '2018–2023' } },
    ],
    headline: {
      pt: 'A maior terra indígena do Brasil, cercada pelo ouro ilegal',
      en: "Brazil's largest Indigenous land, besieged by illegal gold",
    },
    hero: {
      value: '+309%',
      label: {
        pt: 'de área destruída pelo garimpo entre out/2018 e dez/2022',
        en: 'more land destroyed by mining between Oct 2018 and Dec 2022',
      },
      source: 'Hutukara · Yanomami Sob Ataque',
    },
    stats: [
      { value: '27.228', label: { pt: 'moradores (Censo 2022)', en: 'residents (2022 Census)' }, source: 'IBGE' },
      { value: '96.650 km²', label: { pt: 'área homologada em 1992', en: 'ratified in 1992' }, source: 'FUNAI' },
      { value: '5.432 ha', label: { pt: 'impactados até 2023', en: 'impacted up to 2023' }, source: 'Hutukara' },
    ],
    story: [
      {
        pt: 'Os Yanomami vivem na floresta entre Roraima e o Amazonas, na fronteira com a Venezuela. A terra foi homologada em 1992, depois de uma corrida do ouro que matou parte do povo nos anos 1980.',
        en: 'The Yanomami live in the forest between Roraima and Amazonas, on the Venezuelan border. Their land was ratified in 1992, after a gold rush that killed part of the people in the 1980s.',
      },
      {
        pt: 'A partir de 2018 o garimpo voltou em escala industrial: dragas, balsas e pistas de pouso abertas dentro da terra. A área destruída passou de 1.236 para 5.053 hectares em quatro anos.',
        en: 'From 2018 mining came back at industrial scale: dredges, barges and airstrips opened inside the land. The destroyed area went from 1,236 to 5,053 hectares in four years.',
      },
      {
        pt: 'Em janeiro de 2023 o governo federal declarou emergência em saúde pública. As operações derrubaram o ritmo de abertura de novas áreas, mas o garimpo migra e volta quando a fiscalização sai.',
        en: 'In January 2023 the federal government declared a public health emergency. Enforcement cut the pace of new clearings, but mining moves around and returns when inspectors leave.',
      },
    ],
    pains: [
      {
        icon: 'water',
        title: { pt: 'Rios com mercúrio', en: 'Mercury in the rivers' },
        body: {
          pt: 'O metal usado para separar o ouro contamina a água e o peixe do Uraricoera, do Mucajaí e do Parima.',
          en: 'The metal used to separate gold contaminates the water and fish of the Uraricoera, Mucajaí and Parima.',
        },
      },
      {
        icon: 'health',
        title: { pt: 'Malária e desnutrição', en: 'Malaria and malnutrition' },
        body: {
          pt: 'As cavas viram criadouro de mosquito e os garimpeiros afastam a caça. A crise de saúde levou à emergência de 2023.',
          en: 'Mining pits breed mosquitoes and miners drive game away. The health crisis led to the 2023 emergency.',
        },
      },
      {
        icon: 'forest',
        title: { pt: 'Floresta aberta', en: 'Forest torn open' },
        body: {
          pt: 'Cada frente abre clareira, pista e acampamento. Sob nuvem constante, só o radar acompanha esse avanço o ano inteiro.',
          en: 'Each front opens clearings, airstrips and camps. Under constant cloud, only radar tracks that advance all year.',
        },
      },
      {
        icon: 'people',
        title: { pt: 'Violência nas aldeias', en: 'Violence in the villages' },
        body: {
          pt: 'Comunidades próximas às frentes relatam ameaças, aliciamento e ataques armados.',
          en: 'Communities near the fronts report threats, coercion and armed attacks.',
        },
      },
    ],
    series: {
      title: { pt: 'Área total impactada pelo garimpo', en: 'Total area impacted by mining' },
      unit: 'ha',
      digits: 0,
      domain: [0, 6500],
      worse: 'high',
      // The record year opens the timeline.
      defaultYear: 2022,
      points: [
        {
          year: 2018,
          value: 1236,
          date: '2018-10-01',
          note: { pt: 'Ponto de partida do monitoramento da Hutukara.', en: "Starting point of Hutukara's monitoring." },
          sar: { before: '2016-08-15', after: '2018-10-01' },
        },
        {
          year: 2020,
          value: 2234,
          date: '2020-12-15',
          note: {
            pt: 'Com a fiscalização reduzida na pandemia, a área quase dobra.',
            en: 'With enforcement reduced during the pandemic, the area almost doubles.',
          },
          sar: { before: '2016-08-15', after: '2020-12-15' },
        },
        {
          year: 2021,
          value: 3272,
          date: '2021-12-15',
          note: { pt: 'Alta de 46% em um ano.', en: 'Up 46% in one year.' },
          sar: { before: '2016-08-15', after: '2021-12-15' },
        },
        {
          year: 2022,
          value: 5053,
          date: '2022-12-15',
          note: {
            pt: 'Ano recorde: 1.782 hectares novos, alta de 54%.',
            en: 'Record year: 1,782 new hectares, up 54%.',
          },
          sar: { before: '2016-08-15', after: '2022-12-15' },
        },
        {
          year: 2023,
          value: 5432,
          date: '2023-12-15',
          note: {
            pt: 'Depois da emergência, o avanço cai para 7%, mas não zera.',
            en: 'After the emergency the advance falls to 7%, but does not stop.',
          },
          sar: { before: '2016-08-15', after: '2023-12-15' },
        },
      ],
      thresholds: [],
      source: { label: 'Hutukara Associação Yanomami', url: 'https://hutukarayanomami.org/' },
      footnote: {
        pt: 'Sem dado consolidado da Hutukara para 2019. Em 2024 o Greenpeace mediu 223 hectares novos.',
        en: 'No consolidated Hutukara figure for 2019. In 2024 Greenpeace measured 223 new hectares.',
      },
    },
    risk: {
      level: 'high',
      summary: {
        pt: 'O ritmo caiu desde 2023, mas as frentes seguem ativas e mudam de lugar.',
        en: 'The pace has fallen since 2023, but the fronts remain active and keep moving.',
      },
    },
    // Yanomami communities ranked by distance to the nearest DETER mineração polygon
    // (2019-2026 catalogue, 683 polygons; haversine from each polo-base centroid to
    // every polygon centroid, pick the minimum). Top 5 shown here.
    //
    // Village coordinates (approximate ± ~1 km) and selection sourced from:
    //  - Hutukara "Yanomami Sob Ataque" 2022 and 2023 reports (ISA/Hutukara)
    //  - SESAI DSEI-Y polo-base cadastre (public)
    //  - ISA Povos Indígenas do Brasil fichas
    //
    // Risk levels derived offline from the distance tier:
    //  - critical: < 15 km   (Homoxi — 10.7 km, mining epicentre of 2023 crisis)
    //  - high:     < 20 km   (Xitei 16.2 km, Surucucu 16.3 km)
    //  - watch:    < 30 km   (Watoriki 20.6 km, Marari 23.0 km)
    hotspots: [
      {
        id: 'homoxi',
        name: 'Homoxi',
        center: [-63.76, 2.43],
        level: 'critical',
        note: {
          pt: 'Frente de garimpo a 10,7 km — epicentro da crise humanitária 2022-2023.',
          en: 'Mining front 10.7 km away — epicentre of the 2022-2023 humanitarian crisis.',
        },
        approx: true,
      },
      {
        id: 'xitei',
        name: 'Xitei',
        center: [-62.64, 2.42],
        level: 'high',
        note: {
          pt: 'Serra do Parima; alerta DETER a 16,2 km (mar/2023).',
          en: 'Parima range; nearest DETER alert 16.2 km (Mar 2023).',
        },
        approx: true,
      },
      {
        id: 'surucucu',
        name: 'Surucucu',
        center: [-63.60, 2.78],
        level: 'high',
        note: {
          pt: 'Polo-base de alta altitude; alerta a 16,3 km (fev/2024).',
          en: 'Highland polo-base; alert 16.3 km (Feb 2024).',
        },
        approx: true,
      },
      {
        id: 'watoriki',
        name: 'Watoriki',
        center: [-63.59, 1.17],
        labelLeft: true,
        level: 'watch',
        note: {
          pt: 'Aldeia de Davi Kopenawa no Demini; alerta a 20,6 km (ago/2023).',
          en: 'Davi Kopenawa\'s community in Demini; alert 20.6 km (Aug 2023).',
        },
        approx: true,
      },
      {
        id: 'marari',
        name: 'Marari',
        center: [-64.32, 1.55],
        labelLeft: true,
        level: 'watch',
        note: {
          pt: 'Polo-base do oeste; alerta mais próximo a 23 km (ago/2021).',
          en: 'Western polo-base; nearest alert 23 km (Aug 2021).',
        },
        approx: true,
      },
    ],
    hotspotsNote: {
      pt: 'Comunidades ranqueadas por distância ao alerta DETER mineração mais próximo (2019-2026). Coordenadas aproximadas; fontes Hutukara, SESAI DSEI-Y, ISA.',
      en: 'Communities ranked by distance to the nearest DETER mining alert (2019-2026). Approximate coordinates; sources Hutukara, SESAI DSEI-Y, ISA.',
    },
    sarBbox: [-64.1, 2.3, -63.6, 2.8],
    // Homoxi and the upper Mucajaí: one Landsat/Sentinel-2 scene and the NISAR frames cover it whole.
    opticalBbox: [-63.75, 2.35, -63.4, 2.6],
    sarReading: {
      pt: 'Floresta espalha o sinal do radar e aparece clara. Solo exposto e água de cava devolvem pouco sinal: a clareira surge como mancha escura, mesmo sob nuvem.',
      en: 'Forest scatters the radar signal and looks bright. Bare soil and pit water return little signal: the clearing shows up as a dark patch, even under cloud.',
    },
    sources: [
      { label: 'Hutukara', url: 'https://hutukarayanomami.org/' },
      { label: 'MapBiomas Alerta', url: 'https://alerta.mapbiomas.org/' },
      { label: 'INPE DETER', url: 'http://terrabrasilis.dpi.inpe.br/app/map/deter' },
      { label: 'ISA · Terras Indígenas', url: 'https://terrasindigenas.org.br/pt-br/terras-indigenas/4016' },
    ],
    questions: [
      { pt: 'Como o radar enxerga o garimpo?', en: 'How does radar see mining?' },
      { pt: 'Onde o garimpo mais cresceu?', en: 'Where did mining grow the most?' },
    ],
    news: [
      {
        title: 'Yanomami Sob Ataque: garimpo ilegal avança 309% em quatro anos',
        outlet: 'Hutukara Associação Yanomami',
        date: '2022-04',
        url: 'https://hutukara.org/wp-content/uploads/2022/04/YanomamiSobAtaque-2022.pdf',
        summary: 'Relatório da organização indígena com cartografia das frentes de garimpo e impacto em saúde, baseado em SAR e campo.',
      },
      {
        title: 'Governo decreta emergência em saúde na Terra Yanomami',
        outlet: 'G1 · Ministério da Saúde',
        date: '2023-01-21',
        url: 'https://g1.globo.com/politica/noticia/2023/01/21/emergencia-saude-publica-terra-indigena-yanomami.ghtml',
        summary: 'Declarada emergência sanitária após imagens de crianças desnutridas e expansão do garimpo durante o governo anterior.',
      },
      {
        title: 'Garimpo em terras Yanomami resiste a operações e volta a crescer',
        outlet: 'Agência Pública',
        date: '2024-09',
        url: 'https://apublica.org/2024/09/garimpo-yanomami-resiste-operacoes/',
        summary: 'Reportagem acompanha retomada da atividade após desmobilização parcial da força-tarefa federal.',
      },
      {
        title: 'SUMAÚMA · Diário Yanomami',
        outlet: 'SUMAÚMA',
        date: '2023-2024',
        url: 'https://sumauma.com/categoria/yanomami/',
        summary: 'Série de reportagens com relato direto das lideranças Yanomami sobre contaminação, mortes e deslocamento forçado.',
      },
      {
        title: 'ISA · Terra Yanomami, a mais afetada por garimpo ilegal no Brasil',
        outlet: 'Instituto Socioambiental',
        date: '2023',
        url: 'https://www.socioambiental.org/noticias-socioambientais/terra-yanomami-garimpo-ilegal',
        summary: 'Panorama cruzando dados FUNAI, MapBiomas e PRODES; quantifica a expansão 2018-2023.',
      },
    ],
  },

  ENCH: {
    id: 'ENCH',
    theme: { pt: 'Enchente', en: 'Flood' },
    analysis: { pt: 'Análise de enchente', en: 'Flood analysis' },
    place: { pt: 'Manaus urbana e região', en: 'Urban Manaus and surroundings' },
    placeShort: 'Manaus',
    color: '#4DA3F7',
    camera: { center: [-60.0, -2.6], zoom: 9 },
    cover: { center: [-60.0, -3.11], zoom: 12 },
    outline: { kind: 'ibge', code: 1302603 },
    ibgeCode: 1302603,
    meta: [
      { label: { pt: 'Onde', en: 'Where' }, value: { pt: 'Manaus, Amazonas', en: 'Manaus, Amazonas' } },
      { label: { pt: 'Rio', en: 'River' }, value: { pt: 'Negro', en: 'Negro' } },
      { label: { pt: 'Série', en: 'Record' }, value: { pt: '1902–2024', en: '1902–2024' } },
    ],
    headline: {
      pt: 'Dois milhões de pessoas à beira de um rio que sobe cada vez mais',
      en: 'Two million people beside a river that keeps rising higher',
    },
    hero: {
      value: '30,02 m',
      label: {
        pt: 'cota do Rio Negro em 16/jun/2021, a maior em 119 anos',
        en: 'Rio Negro level on 16 Jun 2021, the highest in 119 years',
      },
      source: 'Porto de Manaus',
    },
    stats: [
      { value: '2.063.689', label: { pt: 'moradores (Censo 2022)', en: 'residents (2022 Census)' }, source: 'IBGE' },
      { value: '9 em 16', label: { pt: 'anos com cheia severa desde 2009', en: 'years with severe flood since 2009' }, source: 'SGB' },
      { value: '58 dias', label: { pt: 'acima de 29,69 m em 2021', en: 'above 29.69 m in 2021' }, source: 'Oliveira 2025' },
    ],
    story: [
      {
        pt: 'Manaus cresceu sobre igarapés. Milhares de famílias moram em palafitas nas margens, e é ali que a água chega primeiro quando o Rio Negro enche.',
        en: 'Manaus grew over its streams. Thousands of families live in stilt houses on the banks, where the water arrives first when the Rio Negro swells.',
      },
      {
        pt: 'O nível é medido todo dia no porto desde 1902. Até 2008, a chance de uma cheia severa (acima de 29 m) era de 8% ao ano. De 2009 a 2024 passou para 56%.',
        en: 'The level has been measured daily at the port since 1902. Until 2008 the chance of a severe flood (above 29 m) was 8% a year. From 2009 to 2024 it rose to 56%.',
      },
      {
        pt: 'Em 2021 a água cobriu ruas do Centro Histórico e a prefeitura montou passarelas de madeira. Quatro das cinco maiores cheias da história aconteceram de 2009 para cá.',
        en: 'In 2021 water covered streets in the historic centre and the city built wooden walkways. Four of the five largest floods on record happened from 2009 onwards.',
      },
    ],
    pains: [
      {
        icon: 'home',
        title: { pt: 'Casas alagadas', en: 'Flooded homes' },
        body: {
          pt: 'Moradores das margens dos igarapés erguem o piso com tábuas (as marombas) ou deixam a casa.',
          en: 'People on the stream banks raise their floors with planks (marombas) or leave home.',
        },
      },
      {
        icon: 'health',
        title: { pt: 'Doenças e lixo', en: 'Disease and waste' },
        body: {
          pt: 'A água parada acumula lixo e esgoto, com risco de leptospirose e diarreia.',
          en: 'Standing water gathers waste and sewage, bringing leptospirosis and diarrhoea.',
        },
      },
      {
        icon: 'road',
        title: { pt: 'Centro parado', en: 'Downtown at a standstill' },
        body: {
          pt: 'Ruas, feiras e o terminal de ônibus do Centro ficam interditados por semanas.',
          en: 'Streets, markets and the downtown bus terminal stay closed for weeks.',
        },
      },
      {
        icon: 'boat',
        title: { pt: 'Ribeirinhos do entorno', en: 'Riverside neighbours' },
        body: {
          pt: 'Nas comunidades de várzea ao redor, a cheia cobre a roça e o caminho até a cidade.',
          en: 'In the floodplain communities nearby, the flood covers crops and the way into town.',
        },
      },
    ],
    series: {
      title: { pt: 'Cota máxima do Rio Negro em Manaus', en: 'Rio Negro peak level in Manaus' },
      unit: 'm',
      digits: 2,
      domain: [26, 30.5],
      worse: 'high',
      // The record flood opens the timeline: the clearest before/after for both the visible and the radar images.
      defaultYear: 2021,
      points: [
        {
          year: 2009,
          value: 29.77,
          date: '2009-07-01',
          note: { pt: 'Supera a cheia de 1953 e abre a série de extremos.', en: 'Tops the 1953 flood and opens the run of extremes.' },
          sar: { before: '2008-09-07', after: '2009-07-01' },
          optical: {
            before: { collection: 'landsat-c2-l2', id: 'LT05_L2SP_231062_20080907_02_T1', date: '2008-09-07', platform: 'Landsat 5' },
            after: { collection: 'landsat-c2-l2', id: 'LT05_L2SP_231062_20090708_02_T1', date: '2009-07-08', platform: 'Landsat 5' },
          },
        },
        {
          year: 2014,
          value: 29.5,
          date: '2014-07-03',
          note: { pt: 'Acima da cota de inundação severa (29 m).', en: 'Above the severe flood stage (29 m).' },
          sar: { before: '2013-10-23', after: '2014-07-03' },
          optical: {
            before: { collection: 'landsat-c2-l2', id: 'LC08_L2SP_231062_20131023_02_T1', date: '2013-10-23', platform: 'Landsat 8' },
            after: { collection: 'landsat-c2-l2', id: 'LC08_L2SP_231062_20140706_02_T1', date: '2014-07-06', platform: 'Landsat 8' },
          },
        },
        {
          year: 2017,
          value: 29.0,
          date: '2017-06-15',
          note: { pt: 'Chegou à cota de inundação severa.', en: 'Reached the severe flood stage.' },
          sar: { before: '2016-12-24', after: '2017-06-15' },
          optical: {
            before: { collection: 'sentinel-2-l2a', id: 'S2A_MSIL2A_20161224T142322_R010_T20MRB_20210214T001928', date: '2016-12-24', platform: 'Sentinel-2A' },
            after: { collection: 'sentinel-2-l2a', id: 'S2B_MSIL2A_20170717T142319_R010_T20MRB_20210210T103259', date: '2017-07-17', platform: 'Sentinel-2B' },
          },
        },
        {
          year: 2018,
          value: 28.38,
          date: '2018-06-15',
          note: { pt: 'Inundação, abaixo da cota severa.', en: 'Flooding, below the severe stage.' },
          sar: { before: '2017-11-03', after: '2018-06-15' },
          optical: {
            before: { collection: 'landsat-c2-l2', id: 'LC08_L2SP_231062_20171103_02_T1', date: '2017-11-03', platform: 'Landsat 8' },
            after: { collection: 'landsat-c2-l2', id: 'LC08_L2SP_231062_20180615_02_T1', date: '2018-06-15', platform: 'Landsat 8' },
          },
        },
        {
          year: 2019,
          value: 29.42,
          date: '2019-06-24',
          note: { pt: 'Acima da cota de inundação severa (29 m).', en: 'Above the severe flood stage (29 m).' },
          sar: { before: '2018-10-21', after: '2019-06-24' },
          optical: {
            before: { collection: 'landsat-c2-l2', id: 'LC08_L2SP_231062_20181021_02_T1', date: '2018-10-21', platform: 'Landsat 8' },
            after: { collection: 'sentinel-2-l2a', id: 'S2B_MSIL2A_20190727T142049_R010_T20MRB_20201106T033508', date: '2019-07-27', platform: 'Sentinel-2B' },
          },
        },
        {
          year: 2020,
          value: 28.52,
          date: '2020-06-15',
          note: { pt: 'Inundação, abaixo da cota severa.', en: 'Flooding, below the severe stage.' },
          sar: { before: '2019-11-25', after: '2020-06-15' },
          optical: {
            before: { collection: 'landsat-c2-l2', id: 'LC08_L2SP_231062_20191125_02_T1', date: '2019-11-25', platform: 'Landsat 8' },
            after: { collection: 'landsat-c2-l2', id: 'LC08_L2SP_231062_20200706_02_T1', date: '2020-07-06', platform: 'Landsat 8' },
          },
        },
        {
          year: 2021,
          value: 30.02,
          date: '2021-06-16',
          note: { pt: 'Maior cheia da história: 58 dias acima de 29,69 m.', en: 'Largest flood on record: 58 days above 29.69 m.' },
          sar: { before: '2020-10-26', after: '2021-06-16' },
          optical: {
            before: { collection: 'landsat-c2-l2', id: 'LC08_L2SP_231062_20201026_02_T1', date: '2020-10-26', platform: 'Landsat 8' },
            after: { collection: 'landsat-c2-l2', id: 'LC08_L2SP_231062_20210709_02_T1', date: '2021-07-09', platform: 'Landsat 8' },
          },
        },
        {
          year: 2022,
          value: 29.75,
          date: '2022-06-22',
          note: { pt: 'Quarta maior, um ano depois do recorde.', en: 'Fourth largest, one year after the record.' },
          sar: { before: '2021-12-28', after: '2022-06-22' },
          optical: {
            before: { collection: 'sentinel-2-l2a', id: 'S2A_MSIL2A_20211228T141741_R010_T20MRB_20230125T080922', date: '2021-12-28', platform: 'Sentinel-2A' },
            after: { collection: 'landsat-c2-l2', id: 'LC08_L2SP_231062_20220525_02_T1', date: '2022-05-25', platform: 'Landsat 8' },
          },
        },
        {
          year: 2023,
          value: 28.3,
          date: '2023-06-20',
          note: { pt: 'Cheia comum, seguida pela pior seca até então: 15,60 m de diferença no mesmo ano.', en: 'Ordinary flood, followed by the worst drought until then: a 15.60 m swing in one year.' },
          sar: { before: '2022-10-08', after: '2023-06-20' },
          optical: {
            before: { collection: 'landsat-c2-l2', id: 'LC09_L2SP_231062_20221008_02_T1', date: '2022-10-08', platform: 'Landsat 9' },
            after: { collection: 'landsat-c2-l2', id: 'LC08_L2SP_231062_20230629_02_T1', date: '2023-06-29', platform: 'Landsat 8' },
          },
        },
        {
          year: 2024,
          value: 26.85,
          date: '2024-06-20',
          note: { pt: 'Rio abaixo da cota de inundação, em ano de seca recorde.', en: 'River below flood stage, in a record drought year.' },
          sar: { before: '2023-10-11', after: '2024-06-20' },
          optical: {
            before: { collection: 'landsat-c2-l2', id: 'LC09_L2SP_231062_20231011_02_T1', date: '2023-10-11', platform: 'Landsat 9' },
            after: { collection: 'landsat-c2-l2', id: 'LC08_L2SP_231062_20240717_02_T1', date: '2024-07-17', platform: 'Landsat 8' },
          },
        },
        {
          year: 2025,
          value: 29.04,
          date: '2025-07-05',
          note: { pt: 'Leitura parcial: passou de 29 m em julho.', en: 'Partial reading: above 29 m in July.' },
          sar: { before: '2024-10-29', after: '2025-07-05' },
          optical: {
            before: { collection: 'landsat-c2-l2', id: 'LC09_L2SP_231062_20241029_02_T1', date: '2024-10-29', platform: 'Landsat 9' },
            after: { collection: 'landsat-c2-l2', id: 'LC08_L2SP_231062_20250805_02_T1', date: '2025-08-05', platform: 'Landsat 8' },
          },
        },
        {
          year: 2026,
          value: 28.5,
          date: '2026-06-30',
          note: { pt: 'Leitura parcial: cerca de 28,50 m no fim de junho.', en: 'Partial reading: about 28.50 m at the end of June.' },
          sar: { before: '2025-09-22', after: '2026-06-30' },
          optical: {
            before: { collection: 'landsat-c2-l2', id: 'LC08_L2SP_231062_20250922_02_T1', date: '2025-09-22', platform: 'Landsat 8' },
            after: { collection: 'landsat-c2-l2', id: 'LC09_L2SP_231062_20260731_02_T1', date: '2026-07-31', platform: 'Landsat 9' },
          },
        },
      ],
      thresholds: [
        { value: 29, label: { pt: 'Inundação severa', en: 'Severe flood' }, tone: 'danger' },
        { value: 27.5, label: { pt: 'Cota de inundação', en: 'Flood stage' }, tone: 'warn' },
      ],
      source: OLIVEIRA_2025,
      footnote: {
        pt: 'Máximas de 2023 e 2024 calculadas a partir da amplitude anual do estudo; 2017–2020 segundo o Porto de Manaus.',
        en: '2023 and 2024 peaks derived from the annual range in the study; 2017–2020 from the Porto de Manaus.',
      },
    },
    risk: {
      level: 'high',
      summary: {
        pt: 'Cheia severa virou evento de um ano sim, um ano não. Os bairros de igarapé são os primeiros atingidos.',
        en: 'Severe floods now come every other year. The stream-side districts are hit first.',
      },
    },
    hotspots: [
      {
        id: 'educandos',
        name: 'Educandos',
        center: [-60.0095, -3.142],
        level: 'critical',
        note: { pt: 'Palafitas na foz do igarapé, alagadas em 2021.', en: 'Stilt houses at the stream mouth, flooded in 2021.' },
        approx: true,
      },
      {
        id: 'centro',
        name: 'Centro Histórico',
        center: [-60.0236, -3.139],
        labelLeft: true,
        level: 'high',
        note: {
          pt: 'Ruas da orla e o prédio da Alfândega ficaram sob água em 2021.',
          en: 'Waterfront streets and the Customs House went under water in 2021.',
        },
        approx: true,
      },
      {
        id: 'sao-raimundo',
        name: 'São Raimundo',
        center: [-60.0405, -3.1255],
        labelLeft: true,
        level: 'high',
        note: { pt: 'Margem baixa do igarapé de mesmo nome.', en: 'Low bank of the stream of the same name.' },
        approx: true,
      },
      {
        id: 'quarenta',
        name: 'Igarapé do Quarenta',
        center: [-60.005, -3.125],
        level: 'watch',
        note: { pt: 'Bairros da zona sul cortados pelo igarapé.', en: 'South-side districts crossed by the stream.' },
        approx: true,
      },
      {
        id: 'mauazinho',
        name: 'Mauazinho',
        center: [-59.933, -3.123],
        level: 'watch',
        note: { pt: 'Orla leste, perto do Encontro das Águas.', en: 'Eastern waterfront, near the Meeting of Waters.' },
        approx: true,
      },
    ],
    hotspotsNote: {
      pt: 'Pontos de atenção marcados a partir de registros das cheias de 2021 e 2022.',
      en: 'Watch points placed from records of the 2021 and 2022 floods.',
    },
    sarBbox: [-60.2, -3.3, -59.8, -2.9],
    opticalBbox: [-60.14, -3.2, -59.86, -3.02],
    sarReading: {
      pt: 'Água lisa funciona como espelho e não devolve sinal ao radar: aparece preta. Comparando a seca com a cheia, a área preta que cresce é a área alagada.',
      en: 'Smooth water acts like a mirror and returns no signal to the radar: it looks black. Comparing low and high water, the black area that grows is the flooded area.',
    },
    sources: [
      OLIVEIRA_2025,
      { label: 'SGB · Alerta de Cheias', url: 'https://www.sgb.gov.br/sace/' },
      { label: 'Porto de Manaus', url: 'https://portodemanaus.com.br/' },
      { label: 'IBGE SIDRA · Censo 2022', url: 'https://sidra.ibge.gov.br/tabela/4714' },
    ],
    questions: [
      { pt: 'Como o radar enxerga a enchente?', en: 'How does radar see a flood?' },
      { pt: 'Quais bairros alagam primeiro?', en: 'Which districts flood first?' },
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
      station: 'Rio Negro · Porto de Manaus',
      stationUrl: 'https://www.sgb.gov.br/sace/amazonas/ultimo_boletim.php',
      thresholds: [
        { value: 27.0, label: 'Alerta' },
        { value: 27.5, label: 'Inundação · São Jorge' },
        { value: 29.0, label: 'Inundação severa · Rua dos Barés' },
      ],
      peaks: [
        { year: 1953, value: 29.69, date: '1953-06-09' },
        { year: 2009, value: 29.77, date: '2009-07-01' },
        { year: 2014, value: 29.5, date: '2014-07-03' },
        { year: 2017, value: 29.0, date: '2017-06' },
        { year: 2018, value: 28.38, date: '2018-06' },
        { year: 2019, value: 29.42, date: '2019-06-24' },
        { year: 2020, value: 28.52, date: '2020-06' },
        { year: 2021, value: 30.02, date: '2021-06-16' },
        { year: 2022, value: 29.75, date: '2022-06-22' },
        { year: 2023, value: 28.3, date: '2023-06-20' },
        { year: 2024, value: 26.85, date: '2024-06-20' },
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
        { label: 'ANA · HidroWeb', url: 'https://www.snirh.gov.br/hidroweb/' },
      ],
      latest: {
        value: 16.59,
        date: '2026-10-27',
        trend: 'falling',
        source: 'Porto de Manaus, via NC News',
        url: 'https://ncnews.com.br/2026/10/27/rio-negro-baixa-2-metros-fica-abaixo/',
      },
    },
  },

  SECA: {
    id: 'SECA',
    theme: { pt: 'Seca', en: 'Drought' },
    analysis: { pt: 'Análise de seca', en: 'Drought analysis' },
    place: { pt: 'Ribeirinhos de Manaquiri e região', en: 'Riverside Manaquiri and surroundings' },
    placeShort: 'Manaquiri',
    color: '#F2C14E',
    camera: { center: [-60.67, -3.75], zoom: 9.2 },
    cover: { center: [-60.4, -3.47], zoom: 11 },
    outline: { kind: 'ibge', code: 1302553 },
    ibgeCode: 1302553,
    meta: [
      { label: { pt: 'Onde', en: 'Where' }, value: { pt: 'Manaquiri, Amazonas', en: 'Manaquiri, Amazonas' } },
      { label: { pt: 'Quem', en: 'Who' }, value: { pt: 'Andiroba, Jutaí, Barro Alto, Janauacá', en: 'Andiroba, Jutaí, Barro Alto, Janauacá' } },
      { label: { pt: 'Secas', en: 'Droughts' }, value: { pt: '1963–2024', en: '1963–2024' } },
    ],
    headline: {
      pt: 'Quando o lago seca, a comunidade fica sem caminho',
      en: 'When the lake dries up, the community loses its way out',
    },
    hero: {
      value: '12,11 m',
      label: {
        pt: 'cota do Rio Negro em 9/out/2024, a menor em 122 anos',
        en: 'Rio Negro level on 9 Oct 2024, the lowest in 122 years',
      },
      source: 'Porto de Manaus',
    },
    stats: [
      { value: '17.107', label: { pt: 'moradores no município', en: 'residents in the municipality' }, source: 'IBGE 2022' },
      { value: '50 dias', label: { pt: 'de seca extrema em 2024', en: 'of extreme drought in 2024' }, source: 'Oliveira 2025' },
      { value: '13,7 km', label: { pt: 'de Andiroba até a sede', en: 'from Andiroba to town' }, source: 'IBGE BC250' },
    ],
    story: [
      {
        pt: 'Manaquiri fica a cerca de 60 km de Manaus, entre o Solimões e uma rede de lagos e paranás. Comunidades como Andiroba, Jutaí, Barro Alto e Janauacá chegam à cidade de barco.',
        en: 'Manaquiri lies about 60 km from Manaus, between the Solimões and a web of lakes and channels. Communities such as Andiroba, Jutaí, Barro Alto and Janauacá reach town by boat.',
      },
      {
        pt: 'Na vazante de 2023 e de 2024 os lagos viraram lama. Peixes morreram por falta de oxigênio, comunidades ficaram sem água encanada e o trajeto até a sede passou a ser feito a pé pelo leito seco.',
        en: 'In the low-water seasons of 2023 and 2024 the lakes turned to mud. Fish died for lack of oxygen, communities lost piped water and the trip to town was made on foot across the dry bed.',
      },
      {
        pt: 'Não há régua no município, então usamos a do Porto de Manaus como referência regional. Antes de 2009, uma seca extrema era evento de 1 em 100 anos. Desde então, a chance subiu para quase 1 em 5.',
        en: 'There is no gauge in the municipality, so we use the Port of Manaus as the regional reference. Before 2009 an extreme drought was a 1-in-100-year event. Since then the chance has risen to almost 1 in 5.',
      },
    ],
    pains: [
      {
        icon: 'boat',
        title: { pt: 'Isolamento', en: 'Isolation' },
        body: {
          pt: 'Sem água no lago não há barco: escola, posto de saúde e mercado ficam fora de alcance.',
          en: 'With no water in the lake there is no boat: school, clinic and market are out of reach.',
        },
      },
      {
        icon: 'water',
        title: { pt: 'Água para beber', en: 'Drinking water' },
        body: {
          pt: 'Poços e captações secam. A Defesa Civil do Amazonas registrou oito comunidades sem abastecimento.',
          en: "Wells and intakes dry up. Amazonas Civil Defence recorded eight communities without supply.",
        },
      },
      {
        icon: 'fish',
        title: { pt: 'Peixe morto', en: 'Dead fish' },
        body: {
          pt: 'A água rasa esquenta e perde oxigênio. A mortandade tira comida e renda de quem vive da pesca.',
          en: 'Shallow water heats up and loses oxygen. The die-off takes food and income from fishing families.',
        },
      },
      {
        icon: 'fire',
        title: { pt: 'Fogo e fumaça', en: 'Fire and smoke' },
        body: {
          pt: 'A mata seca queima mais fácil. Barro Alto e Janauacá têm mais de 20 focos de calor num raio de 10 km.',
          en: 'Dry forest burns more easily. Barro Alto and Janauacá have over 20 fire hotspots within 10 km.',
        },
      },
    ],
    series: {
      title: { pt: 'Cota mínima do Rio Negro (referência regional)', en: 'Rio Negro lowest level (regional reference)' },
      unit: 'm',
      digits: 2,
      domain: [11, 18.5],
      worse: 'low',
      // The record drought opens the timeline.
      defaultYear: 2024,
      latest: {
        value: 16.59,
        date: '2026-10-27',
        trend: 'falling',
        source: 'Porto de Manaus, via NC News',
        url: 'https://ncnews.com.br/2026/10/27/rio-negro-baixa-2-metros-fica-abaixo/',
      },
      points: [
        {
          year: 1963,
          value: 13.64,
          date: '1963-10-30',
          note: { pt: 'A maior seca do século XX. Sem imagem de satélite nessa época.', en: 'The worst drought of the 20th century. No satellite imagery back then.' },
        },
        {
          year: 1997,
          value: 14.34,
          note: { pt: 'Abaixo de 15 m, uma das quatro vezes em 50 anos.', en: 'Below 15 m, one of four times in 50 years.' },
          sar: { before: '1997-06-21', after: '1997-10-27' },
          optical: {
            before: { collection: 'landsat-c2-l2', id: 'LT05_L2SP_231062_19970621_02_T1', date: '1997-06-21', platform: 'Landsat 5' },
            after: { collection: 'landsat-c2-l2', id: 'LT05_L2SP_231062_19971027_02_T1', date: '1997-10-27', platform: 'Landsat 5' },
          },
        },
        {
          year: 2010,
          value: 13.63,
          date: '2010-10-24',
          note: { pt: 'Primeiro recorde em 47 anos, por um centímetro.', en: 'First record in 47 years, by one centimetre.' },
          sar: { before: '2010-06-20', after: '2010-10-24' },
          optical: {
            before: { collection: 'landsat-c2-l2', id: 'LT05_L2SP_231062_20100727_02_T1', date: '2010-07-27', platform: 'Landsat 5' },
            after: { collection: 'landsat-c2-l2', id: 'LT05_L2SP_231062_20101031_02_T1', date: '2010-10-31', platform: 'Landsat 5' },
          },
        },
        {
          year: 2023,
          value: 12.7,
          date: '2023-10-26',
          note: {
            pt: 'O rio cai abaixo de 13 m pela primeira vez. 40 dias de seca extrema.',
            en: 'The river drops below 13 m for the first time. 40 days of extreme drought.',
          },
          sar: { before: '2023-06-20', after: '2023-10-26' },
          optical: {
            before: { collection: 'landsat-c2-l2', id: 'LC08_L2SP_231062_20230629_02_T1', date: '2023-06-29', platform: 'Landsat 8' },
            after: { collection: 'landsat-c2-l2', id: 'LC09_L2SP_231062_20231027_02_T1', date: '2023-10-27', platform: 'Landsat 9' },
          },
        },
        {
          year: 2024,
          value: 12.11,
          date: '2024-10-09',
          note: {
            pt: 'Novo recorde um ano depois. 50 dias de seca extrema.',
            en: 'A new record one year later. 50 days of extreme drought.',
          },
          sar: { before: '2024-06-20', after: '2024-10-09' },
          optical: {
            before: { collection: 'landsat-c2-l2', id: 'LC08_L2SP_231062_20240818_02_T1', date: '2024-08-18', platform: 'Landsat 8' },
            after: { collection: 'landsat-c2-l2', id: 'LC08_L2SP_231062_20241021_02_T1', date: '2024-10-21', platform: 'Landsat 8' },
          },
        },
      ],
      thresholds: [
        { value: 17.73, label: { pt: 'Média 1902–2008', en: '1902–2008 mean' }, tone: 'muted' },
        { value: 16.5, label: { pt: 'Média 2009–2024', en: '2009–2024 mean' }, tone: 'warn' },
        { value: 13.64, label: { pt: 'Seca extrema', en: 'Extreme drought' }, tone: 'danger' },
      ],
      source: OLIVEIRA_2025,
      footnote: {
        pt: 'As quatro secas extremas da série histórica (cota igual ou abaixo de 13,64 m), mais 1997, entre as dez menores cotas já medidas (SGB).',
        en: 'The four extreme droughts in the record (level at or below 13.64 m), plus 1997, among the ten lowest levels ever measured (SGB).',
      },
    },
    risk: {
      level: 'critical',
      summary: {
        pt: 'Dois recordes seguidos de seca. As comunidades de lago são as que ficam isoladas por mais tempo.',
        en: 'Two record droughts in a row. Lake communities stay cut off the longest.',
      },
    },
    hotspots: [
      {
        id: 'andiroba',
        name: 'Andiroba',
        center: [-60.4679, -3.5521],
        level: 'critical',
        note: {
          pt: 'No Lago Mirauá, a 13,7 km da sede. Depende do lago para sair.',
          en: 'On Lake Mirauá, 13.7 km from town. Depends on the lake to get out.',
        },
      },
      {
        id: 'jutai',
        name: 'Jutaí',
        center: [-60.3355, -3.3974],
        level: 'high',
        note: { pt: 'No Lago Janauacá, a 14,2 km da sede.', en: 'On Lake Janauacá, 14.2 km from town.' },
      },
      {
        id: 'janauaca',
        name: 'Janauacá',
        center: [-60.2085, -3.3624],
        level: 'high',
        note: { pt: 'No Lago Caapiranga, com 22 focos de calor em 10 km.', en: 'On Lake Caapiranga, with 22 fire hotspots within 10 km.' },
      },
      {
        id: 'barro-alto',
        name: 'Barro Alto',
        center: [-60.4256, -3.3993],
        labelLeft: true,
        level: 'watch',
        note: { pt: 'No Paraná Manaquiri, a 5 km da sede.', en: 'On the Manaquiri channel, 5 km from town.' },
      },
    ],
    hotspotsNote: {
      pt: 'Comunidades do cadastro do IBGE, classificadas pela distância até a sede e pela dependência de lago.',
      en: 'Communities from the IBGE register, ranked by distance to town and reliance on a lake.',
    },
    sarBbox: [-60.6, -3.7, -60.1, -3.2],
    // The lakes of Andiroba, Jutaí, Barro Alto and Janauacá in one Landsat scene.
    opticalBbox: [-60.55, -3.6, -60.15, -3.3],
    sarReading: {
      pt: 'Água aparece preta no radar. Na seca, o preto dos lagos encolhe e dá lugar ao cinza do leito exposto: dá para medir quantos km² de espelho d’água sumiram.',
      en: 'Water looks black on radar. In a drought the black of the lakes shrinks into the grey of the exposed bed: you can measure how many km² of open water are gone.',
    },
    sources: [
      OLIVEIRA_2025,
      { label: 'Portal Amazônia · Manaquiri sem água', url: 'https://portalamazonia.com/cidades/comunidades-do-manaquiri-sofrem-sem-abastecimento-de-agua-no-am/' },
      { label: 'IBGE SIDRA · Censo 2022', url: 'https://sidra.ibge.gov.br/tabela/4714' },
      { label: 'SGB · Monitoramento hidrológico', url: 'https://www.sgb.gov.br/sace/' },
    ],
    questions: [
      { pt: 'Como o radar mede a seca?', en: 'How does radar measure drought?' },
      { pt: 'Quais comunidades ficam isoladas?', en: 'Which communities get cut off?' },
    ],
    news: [
      {
        title: 'Seca extrema mata mais de 150 botos-rosa no Lago Tefé',
        outlet: 'Instituto Mamirauá',
        date: '2023-10',
        url: 'https://www.mamiraua.org.br/noticias/mortandade-de-botos-lago-tefe/',
        summary: 'Temperatura da água chegou a 39,1 °C em setembro de 2023, muito acima do limite fisiológico dos cetáceos amazônicos.',
      },
      {
        title: 'Rio Negro atinge 12,70 m em Manaus, menor nível em 121 anos',
        outlet: 'G1 Amazonas · SGB',
        date: '2024-10-04',
        url: 'https://g1.globo.com/am/amazonas/noticia/2024/10/04/rio-negro-menor-nivel-ja-registrado.ghtml',
        summary: 'Em 2024 o rio bateu o recorde negativo de 12,11 m (09/10/2024), superando 2023 e expondo navios encalhados.',
      },
      {
        title: 'Seca deixa centenas de comunidades amazônicas isoladas',
        outlet: 'Amazônia Real',
        date: '2024-09',
        url: 'https://amazoniareal.com.br/seca-amazonia-comunidades-isoladas-2024/',
        summary: 'Famílias ribeirinhas sem acesso a saúde e alimentos após rebaixamento dos rios; municípios como Manaquiri entre os mais atingidos.',
      },
      {
        title: 'Amazon drought dries up rivers, strands communities',
        outlet: 'NASA Earth Observatory',
        date: '2023-10-25',
        url: 'https://earthobservatory.nasa.gov/images/151976/drought-dries-up-the-amazon',
        summary: 'Comparação Landsat antes/depois mostra o encolhimento do espelho d\'água dos lagos da várzea central.',
      },
      {
        title: 'Oliveira 2025 · Cheias e secas extremas em Manaus 1902-2024',
        outlet: 'UFAM / SGB · VI CoBICET',
        date: '2025',
        url: 'https://static.even3.com/anais/1211771.pdf',
        summary: 'Série centenária do Porto de Manaus mostra que 4 das 5 maiores secas também aconteceram pós-2009.',
      },
    ],
  },
}

export const CASE_ORDER: RegionId[] = ['YANO', 'ENCH', 'SECA']

export const RISK_COLOR: Record<RiskLevel, string> = {
  critical: '#F0524F',
  high: '#F59E42',
  watch: '#F2D24E',
}
