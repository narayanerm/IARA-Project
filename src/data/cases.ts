import type { RegionId } from '@/lib/types'

// The three focused case studies. Every figure here is traceable to the source named next to it;
// forecast slots are placeholders until the prediction models land.

export type L = { pt: string; en: string }
export type RiskLevel = 'critical' | 'high' | 'watch'
export type PainIcon = 'health' | 'water' | 'forest' | 'home' | 'boat' | 'food' | 'fish' | 'fire' | 'road' | 'people'

export interface CaseStat {
  value: string
  label: L
  source: string
}

export interface CasePain {
  icon: PainIcon
  title: L
  body: L
}

export interface SeriesPoint {
  /** Category shown on the axis (a year). */
  year: number
  value: number
  date?: string
  note: L
  /** Dates for the radar before/after pair; omitted when no satellite covers that year. */
  sar?: { before: string; after: string }
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
  thresholds: SeriesThreshold[]
  source: { label: string; url: string }
  footnote: L
  forecast: L
}

export interface Hotspot {
  id: string
  name: string
  center: [number, number]
  level: RiskLevel
  note: L
  approx?: boolean
}

export interface CaseStudy {
  id: RegionId
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
  sarReading: L
  sources: Array<{ label: string; url: string }>
  questions: L[]
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
      source: { label: 'Hutukara Associação Yanomami', url: 'https://hutukara.org/' },
      footnote: {
        pt: 'Sem dado consolidado da Hutukara para 2019. Em 2024 o Greenpeace mediu 223 hectares novos.',
        en: 'No consolidated Hutukara figure for 2019. In 2024 Greenpeace measured 223 new hectares.',
      },
      forecast: { pt: 'Zonas de risco previstas pelo modelo', en: 'Risk zones predicted by the model' },
    },
    risk: {
      level: 'high',
      summary: {
        pt: 'O ritmo caiu desde 2023, mas as frentes seguem ativas e mudam de lugar.',
        en: 'The pace has fallen since 2023, but the fronts remain active and keep moving.',
      },
    },
    hotspots: [
      {
        id: 'uraricoera',
        name: 'Rio Uraricoera',
        center: [-62.9, 3.45],
        level: 'critical',
        note: {
          pt: 'Principal corredor de balsas e dragas dentro da terra.',
          en: 'Main corridor of barges and dredges inside the land.',
        },
        approx: true,
      },
      {
        id: 'homoxi',
        name: 'Homoxi',
        center: [-63.5, 2.53],
        level: 'critical',
        note: {
          pt: 'Frente documentada de 2019 a 2023 no alto rio Mucajaí.',
          en: 'Front documented from 2019 to 2023 on the upper Mucajaí river.',
        },
      },
      {
        id: 'mucajai',
        name: 'Alto Mucajaí',
        center: [-63.65, 2.42],
        level: 'high',
        note: { pt: 'Poços e dragas ao longo do rio.', en: 'Pits and dredges along the river.' },
      },
      {
        id: 'xitei',
        name: 'Xitei',
        center: [-63.87, 2.6],
        level: 'high',
        note: {
          pt: 'Região de aldeias cercada por novas clareiras.',
          en: 'Village area surrounded by new clearings.',
        },
        approx: true,
      },
    ],
    hotspotsNote: {
      pt: 'Os alertas do DETER (INPE) aparecem no mapa quase em tempo real, em vermelho.',
      en: 'DETER alerts (INPE) show on the map in near real time, in red.',
    },
    sarBbox: [-63.85, 2.3, -63.2, 2.75],
    sarReading: {
      pt: 'Floresta espalha o sinal do radar e aparece clara. Solo exposto e água de cava devolvem pouco sinal: a clareira surge como mancha escura, mesmo sob nuvem.',
      en: 'Forest scatters the radar signal and looks bright. Bare soil and pit water return little signal: the clearing shows up as a dark patch, even under cloud.',
    },
    sources: [
      { label: 'Hutukara', url: 'https://hutukara.org/' },
      { label: 'MapBiomas Alerta', url: 'https://alerta.mapbiomas.org/' },
      { label: 'INPE DETER', url: 'http://terrabrasilis.dpi.inpe.br/app/map/deter' },
      { label: 'ISA · Terras Indígenas', url: 'https://terrasindigenas.org.br/pt-br/terras-indigenas/4016' },
    ],
    questions: [
      { pt: 'Como o radar enxerga o garimpo?', en: 'How does radar see mining?' },
      { pt: 'Onde o garimpo mais cresceu?', en: 'Where did mining grow the most?' },
    ],
  },

  ENCH: {
    id: 'ENCH',
    theme: { pt: 'Enchente', en: 'Flood' },
    analysis: { pt: 'Análise de enchente', en: 'Flood analysis' },
    place: { pt: 'Manaus urbana e região', en: 'Urban Manaus and surroundings' },
    placeShort: 'Manaus',
    color: '#4DA3F7',
    camera: { center: [-60.0, -3.1], zoom: 11 },
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
      points: [
        {
          year: 2009,
          value: 29.77,
          date: '2009-07-01',
          note: { pt: 'Supera a cheia de 1953 e abre a série de extremos.', en: 'Tops the 1953 flood and opens the run of extremes.' },
          sar: { before: '2008-11-01', after: '2009-07-01' },
        },
        {
          year: 2012,
          value: 29.97,
          date: '2012-05-29',
          note: { pt: 'Novo recorde, 34 dias acima de 29,69 m.', en: 'New record, 34 days above 29.69 m.' },
          sar: { before: '2011-11-01', after: '2012-05-29' },
        },
        {
          year: 2021,
          value: 30.02,
          date: '2021-06-16',
          note: { pt: 'Maior cheia da história: 58 dias acima de 29,69 m.', en: 'Largest flood on record: 58 days above 29.69 m.' },
          sar: { before: '2020-11-01', after: '2021-06-16' },
        },
        {
          year: 2022,
          value: 29.75,
          date: '2022-06-22',
          note: { pt: 'Quarta maior, um ano depois do recorde.', en: 'Fourth largest, one year after the record.' },
          sar: { before: '2021-11-01', after: '2022-06-22' },
        },
        {
          year: 2023,
          value: 28.3,
          date: '2023-06-20',
          note: {
            pt: 'Cheia comum, seguida pela pior seca até então: 15,60 m de diferença no mesmo ano.',
            en: 'Ordinary flood, followed by the worst drought until then: a 15.60 m swing in one year.',
          },
          sar: { before: '2022-11-01', after: '2023-06-20' },
        },
        {
          year: 2024,
          value: 26.85,
          date: '2024-06-20',
          note: { pt: 'Rio abaixo da cota de inundação, em ano de seca recorde.', en: 'River below flood stage, in a record drought year.' },
          sar: { before: '2023-11-01', after: '2024-06-20' },
        },
      ],
      thresholds: [
        { value: 29, label: { pt: 'Inundação severa', en: 'Severe flood' }, tone: 'danger' },
        { value: 27.5, label: { pt: 'Cota de inundação', en: 'Flood stage' }, tone: 'warn' },
      ],
      source: OLIVEIRA_2025,
      footnote: {
        pt: 'Anos de destaque da série. Máximas de 2023 e 2024 calculadas a partir da amplitude anual do estudo.',
        en: 'Highlight years of the series. 2023 and 2024 peaks derived from the annual range in the study.',
      },
      forecast: { pt: 'Cota prevista para a próxima cheia', en: 'Level predicted for the next flood' },
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
    sarBbox: [-60.3, -3.3, -59.75, -2.95],
    sarReading: {
      pt: 'Água lisa funciona como espelho e não devolve sinal ao radar: aparece preta. Comparando a seca com a cheia, a área preta que cresce é a área alagada.',
      en: 'Smooth water acts like a mirror and returns no signal to the radar: it looks black. Comparing low and high water, the black area that grows is the flooded area.',
    },
    sources: [
      OLIVEIRA_2025,
      { label: 'SGB · Alerta de Cheias', url: 'https://www.sgb.gov.br/sace/' },
      { label: 'Porto de Manaus', url: 'https://portodemanaus.com.br/' },
      { label: 'IBGE Cidades · Manaus', url: 'https://cidades.ibge.gov.br/brasil/am/manaus/panorama' },
    ],
    questions: [
      { pt: 'Como o radar enxerga a enchente?', en: 'How does radar see a flood?' },
      { pt: 'Quais bairros alagam primeiro?', en: 'Which districts flood first?' },
    ],
  },

  SECA: {
    id: 'SECA',
    theme: { pt: 'Seca', en: 'Drought' },
    analysis: { pt: 'Análise de seca', en: 'Drought analysis' },
    place: { pt: 'Ribeirinhos de Manaquiri e região', en: 'Riverside Manaquiri and surroundings' },
    placeShort: 'Manaquiri',
    color: '#F2C14E',
    camera: { center: [-60.39, -3.45], zoom: 10.3 },
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
      points: [
        {
          year: 1963,
          value: 13.64,
          date: '1963-10-30',
          note: { pt: 'A maior seca do século XX. Sem imagem de satélite nessa época.', en: 'The worst drought of the 20th century. No satellite imagery back then.' },
        },
        {
          year: 2010,
          value: 13.63,
          date: '2010-10-24',
          note: { pt: 'Primeiro recorde em 47 anos, por um centímetro.', en: 'First record in 47 years, by one centimetre.' },
          sar: { before: '2010-06-20', after: '2010-10-24' },
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
        },
      ],
      thresholds: [
        { value: 17.73, label: { pt: 'Média 1902–2008', en: '1902–2008 mean' }, tone: 'muted' },
        { value: 16.5, label: { pt: 'Média 2009–2024', en: '2009–2024 mean' }, tone: 'warn' },
        { value: 13.64, label: { pt: 'Seca extrema', en: 'Extreme drought' }, tone: 'danger' },
      ],
      source: OLIVEIRA_2025,
      footnote: {
        pt: 'As quatro secas extremas da série histórica (cota igual ou abaixo de 13,64 m).',
        en: 'The four extreme droughts in the record (level at or below 13.64 m).',
      },
      forecast: { pt: 'Cota prevista para a próxima vazante', en: 'Level predicted for the next low-water season' },
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
        level: 'watch',
        note: { pt: 'No Paraná Manaquiri, a 5 km da sede.', en: 'On the Manaquiri channel, 5 km from town.' },
      },
    ],
    hotspotsNote: {
      pt: 'Comunidades do cadastro do IBGE, classificadas pela distância até a sede e pela dependência de lago.',
      en: 'Communities from the IBGE register, ranked by distance to town and reliance on a lake.',
    },
    sarBbox: [-60.65, -3.65, -60.1, -3.25],
    sarReading: {
      pt: 'Água aparece preta no radar. Na seca, o preto dos lagos encolhe e dá lugar ao cinza do leito exposto: dá para medir quantos km² de espelho d’água sumiram.',
      en: 'Water looks black on radar. In a drought the black of the lakes shrinks into the grey of the exposed bed: you can measure how many km² of open water are gone.',
    },
    sources: [
      OLIVEIRA_2025,
      { label: 'Portal Amazônia · Manaquiri sem água', url: 'https://portalamazonia.com/cidades/comunidades-do-manaquiri-sofrem-sem-abastecimento-de-agua-no-am/' },
      { label: 'IBGE Cidades · Manaquiri', url: 'https://cidades.ibge.gov.br/brasil/am/manaquiri/panorama' },
      { label: 'SGB · Monitoramento hidrológico', url: 'https://www.sgb.gov.br/sace/' },
    ],
    questions: [
      { pt: 'Como o radar mede a seca?', en: 'How does radar measure drought?' },
      { pt: 'Quais comunidades ficam isoladas?', en: 'Which communities get cut off?' },
    ],
  },
}

export const CASE_ORDER: RegionId[] = ['YANO', 'ENCH', 'SECA']

export const RISK_COLOR: Record<RiskLevel, string> = {
  critical: '#F0524F',
  high: '#F59E42',
  watch: '#F2D24E',
}
