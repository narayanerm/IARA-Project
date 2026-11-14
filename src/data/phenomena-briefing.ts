import type { RegionId } from '@/lib/types'

export interface Stat {
  value: string
  label: string
  source: string
}

export interface Source {
  label: string
  url: string
}

export interface OpticalLayer {
  key: string
  label: string
  layer: string
  note?: string
}

export interface PhenomenonBriefing {
  title: string
  period: string
  tagline: string
  // Narrative in plain language (2-3 short paragraphs).
  narrative: string[]
  // Before/after MODIS true-color snapshots via NASA Worldview.
  beforeDate: string
  afterDate: string
  snapshotBbox: [number, number, number, number]
  snapshotLayer: string
  // Alternate optical layers (different sensor, cloud condition, veg index) per AOI.
  opticalLayers: OpticalLayer[]
  // External high-resolution viewer (MapBiomas / Worldview) for public inspection.
  externalViewer: { label: string; url: string }
  // Headline statistics with explicit sourcing.
  stats: Stat[]
  // How to read the SAR signal for this phenomenon.
  sarReading: string
  sources: Source[]
}

const AMAZON_OPTICAL_VARIANTS: OpticalLayer[] = [
  {
    key: 'modis-terra',
    label: 'MODIS Terra',
    layer: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    note: 'Daily 250 m · morning overpass',
  },
  {
    key: 'modis-aqua',
    label: 'MODIS Aqua',
    layer: 'MODIS_Aqua_CorrectedReflectance_TrueColor',
    note: 'Daily 250 m · afternoon overpass · frequently fewer clouds than Terra',
  },
  {
    key: 'viirs-snpp',
    label: 'VIIRS SNPP',
    layer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
    note: 'Daily 375 m · modern sensor · sharper detail',
  },
  {
    key: 'viirs-noaa20',
    label: 'VIIRS NOAA-20',
    layer: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor',
    note: 'Daily 375 m · second overpass · often different cloud mask',
  },
  {
    key: 'modis-bands721',
    label: 'MODIS Bands 7-2-1',
    layer: 'MODIS_Terra_CorrectedReflectance_Bands721',
    note: 'False color · bare soil pops red/magenta over green forest · ideal for garimpo',
  },
]

// NASA Worldview snapshot URL (JPEG) for a given date + bbox.
export function worldviewSnapshot(
  date: string,
  bbox: [number, number, number, number],
  layer = 'MODIS_Terra_CorrectedReflectance_TrueColor',
  w = 800,
  h = 600
): string {
  const [minLon, minLat, maxLon, maxLat] = bbox
  const params = new URLSearchParams({
    REQUEST: 'GetSnapshot',
    TIME: date,
    BBOX: `${minLat},${minLon},${maxLat},${maxLon}`,
    CRS: 'EPSG:4326',
    LAYERS: layer,
    WRAP: 'day',
    FORMAT: 'image/jpeg',
    WIDTH: String(w),
    HEIGHT: String(h),
  })
  return `https://wvs.earthdata.nasa.gov/api/v1/snapshot?${params}`
}

export const BRIEFINGS: Record<RegionId, PhenomenonBriefing> = {
  YANO: {
    title: 'Garimpo na Terra Indígena Yanomami',
    period: '2019 — 2024',
    tagline:
      'O maior território indígena do Brasil foi invadido por garimpo ilegal, destruindo mata e envenenando rios com mercúrio.',
    narrative: [
      'Entre 2019 e 2022, o garimpo ilegal avançou de forma explosiva sobre a TI Yanomami (9,6 milhões de hectares, maior do Brasil). A mata virou clareira, o solo virou poço, e os rios Mucajaí, Uraricoera e Parima receberam toneladas de mercúrio usado na separação do ouro.',
      'Em janeiro de 2023 o governo federal declarou **Emergência em Saúde Pública** por desnutrição severa e malária entre os Yanomami. A Operação Libertação começou em fevereiro e removeu milhares de garimpeiros, mas o retorno do garimpo seguiu sendo monitorado.',
      'O radar de banda L do NISAR atravessa a copa da floresta — por isso ele consegue ver pistas de pouso clandestinas, dragas e clareiras de solo exposto que o satélite óptico perde sob nuvem perene da Amazônia.',
    ],
    beforeDate: '2019-07-15',
    afterDate: '2023-07-15',
    snapshotBbox: [-63.85, 2.3, -63.2, 2.75],
    snapshotLayer: 'MODIS_Terra_CorrectedReflectance_Bands721',
    opticalLayers: AMAZON_OPTICAL_VARIANTS,
    externalViewer: {
      label: 'Abrir no MapBiomas Alerta (Sentinel-2 10m)',
      url: 'https://plataforma.alerta.mapbiomas.org/mapa?ano=2023&categoria=mineracao&lat=2.5&lng=-63.5&zoom=10',
    },
    stats: [
      {
        value: '138,6 km²',
        label: 'área acumulada invadida por garimpo na TI Yanomami (até 2023)',
        source: 'MapBiomas · Rede Garimpo',
      },
      {
        value: '+ 17,8 km²',
        label: 'novo garimpo só em 2022 (ano recorde)',
        source: 'MapBiomas Alerta',
      },
      {
        value: '~ 20 000',
        label: 'estimativa de garimpeiros em 2022',
        source: 'Governo Federal · Hutukara',
      },
      {
        value: '570 +',
        label: 'óbitos de crianças Yanomami 2019 — 2022',
        source: 'Ministério da Saúde',
      },
    ],
    sarReading:
      'L-band HH despenca 6 a 10 dB quando dossel vira solo exposto. Pistas de pouso e áreas de dragagem aparecem como manchas escuras e geometricamente retas na imagem de retroespalhamento.',
    sources: [
      { label: 'MapBiomas Alerta (Rede Garimpo)', url: 'https://alerta.mapbiomas.org/' },
      { label: 'ISA · Rede Pró-Yanomami e Ye\'kwana', url: 'https://acervo.socioambiental.org/' },
      { label: 'Hutukara Associação Yanomami', url: 'https://hutukara.org/' },
      { label: 'INPE DETER', url: 'http://terrabrasilis.dpi.inpe.br/app/map/deter' },
    ],
  },

  ENCH: {
    title: 'Cheias extremas em Manaus',
    period: '2021 (recorde histórico) · 2024 (top-5)',
    tagline:
      'O Rio Negro em Manaus bateu a marca histórica em 2021 e voltou a inundar bairros e ribeirinhos em cheias sucessivas na década.',
    narrative: [
      'Em 24 de maio de 2021 o Rio Negro atingiu **30,02 m** no Porto de Manaus — a maior cheia registrada em 119 anos de medição. Em 2024 a cota voltou a ficar entre as 5 maiores já observadas, pressionando ribeirinhos, bairros baixos e o Encontro das Águas.',
      'A causa é climática: a Zona de Convergência Intertropical empurra chuva extrema sobre a Bacia Amazônica em anos de La Niña. O resultado é um ciclo cada vez mais intenso de cheias e secas — o oposto do "rio equilibrado" que a região tinha.',
      'O radar SAR é ideal para mapear inundação porque **água lisa reflete especular** (longe do sensor): a cheia aparece como uma mancha preta bem definida na imagem, mesmo sob nuvem.',
    ],
    beforeDate: '2020-11-15',
    afterDate: '2021-06-01',
    snapshotBbox: [-60.4, -3.35, -59.6, -2.85],
    snapshotLayer: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    opticalLayers: AMAZON_OPTICAL_VARIANTS,
    externalViewer: {
      label: 'Abrir no NASA Worldview',
      url: 'https://worldview.earthdata.nasa.gov/?v=-60.4,-3.35,-59.6,-2.85&t=2021-05-24&l=MODIS_Terra_CorrectedReflectance_TrueColor,Reference_Features_15m',
    },
    stats: [
      {
        value: '30,02 m',
        label: 'cota recorde do Rio Negro em Manaus (24/mai/2021)',
        source: 'ANA · Porto de Manaus',
      },
      {
        value: '2 450 000 +',
        label: 'pessoas afetadas por cheias no AM em 2021',
        source: 'Defesa Civil AM',
      },
      {
        value: '> 60',
        label: 'municípios amazonenses em emergência (2021)',
        source: 'SEDEC/MDR',
      },
      {
        value: '> 29 m',
        label: 'cotas acima desse patamar em 2012, 2015, 2021, 2024',
        source: 'ANA',
      },
    ],
    sarReading:
      'Água aberta gera retroespalhamento quase zero em C e L-band (pixel preto, < -18 dB). Vegetação inundada (floresta de várzea) tem double-bounce: brilha mais que floresta seca em HH.',
    sources: [
      { label: 'ANA · Portal HidroWeb', url: 'https://www.snirh.gov.br/hidroweb/' },
      { label: 'Defesa Civil Amazonas', url: 'http://www.defesacivil.am.gov.br/' },
      { label: 'CPRM · Acompanhamento de cheias', url: 'https://www.sgb.gov.br/' },
      { label: 'INPE CPTEC', url: 'https://www.cptec.inpe.br/' },
    ],
  },

  SECA: {
    title: 'Seca histórica no Lago Tefé',
    period: '2023 — 2024',
    tagline:
      'O lago encolheu, a água ferveu a 39,1 °C e mais de 150 botos-rosa morreram em setembro e outubro de 2023.',
    narrative: [
      'A seca de 2023 foi a mais severa já medida na Amazônia Central. O Lago Tefé — braço do Rio Solimões no AM — perdeu grande parte do seu espelho d\'água. No dia 28 de setembro de 2023 a temperatura do lago atingiu **39,1 °C**, muito acima do limite fisiológico dos cetáceos amazônicos (~32 °C).',
      'Mais de **150 botos-rosa (Inia geoffrensis)** e tucuxis foram encontrados mortos em semanas. O Instituto Mamirauá e o ICMBio removeram carcaças e resgataram animais sobreviventes. A seca fechou rios à navegação, isolou comunidades e aumentou incêndios florestais.',
      'O SAR mede a retração do espelho d\'água com precisão: comparando dois frames em datas diferentes, a diferença de pixels "água" revela quantos **km² evaporaram** entre o normal e a seca extrema.',
    ],
    beforeDate: '2022-10-05',
    afterDate: '2023-10-05',
    snapshotBbox: [-65.1, -3.55, -64.5, -3.15],
    snapshotLayer: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    opticalLayers: AMAZON_OPTICAL_VARIANTS,
    externalViewer: {
      label: 'Abrir no NASA Worldview',
      url: 'https://worldview.earthdata.nasa.gov/?v=-65.1,-3.55,-64.5,-3.15&t=2023-10-05&l=MODIS_Terra_CorrectedReflectance_TrueColor',
    },
    stats: [
      {
        value: '39,1 °C',
        label: 'temperatura da água no Lago Tefé (28/set/2023)',
        source: 'Instituto Mamirauá',
      },
      {
        value: '150 +',
        label: 'botos-rosa e tucuxis mortos (set–out/2023)',
        source: 'Instituto Mamirauá · ICMBio',
      },
      {
        value: '13,59 m',
        label: 'menor cota do Rio Negro em 121 anos (26/out/2023)',
        source: 'Porto de Manaus · ANA',
      },
      {
        value: '> 500 000',
        label: 'pessoas afetadas pela seca no AM (2023)',
        source: 'Defesa Civil AM',
      },
    ],
    sarReading:
      'Mapeando o pixel-água por threshold de amplitude em duas datas, dá para calcular **área retraída em km²** e publicar a evolução temporal como curva — assinatura direta de estresse hídrico.',
    sources: [
      { label: 'Instituto Mamirauá', url: 'https://www.mamiraua.org.br/' },
      { label: 'ICMBio', url: 'https://www.gov.br/icmbio/' },
      { label: 'ANA · Portal HidroWeb', url: 'https://www.snirh.gov.br/hidroweb/' },
      { label: 'INPE Queimadas', url: 'https://queimadas.dgi.inpe.br/' },
    ],
  },
}
