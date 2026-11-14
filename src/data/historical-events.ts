import type { RegionId } from '@/lib/types'
import type { Stat } from './phenomena-briefing'

export interface HistoricalEvent {
  id: string
  year: number
  // Representative day of the event (peak or best-documented date).
  date: string
  shortLabel: string
  label: string
  // Normalized 0..1 for marker sizing on the timeline.
  severity: number
  // Headline magnitude shown on the marker tooltip + above the timeline when selected.
  magnitude: { value: string; unit: string }
  // Dates passed to the ASF/Worldview snapshot queries when this event is selected.
  beforeDate: string
  afterDate: string
  // Short contextual note (one sentence) shown as a chip when this event is active.
  note: string
  // Stats for this specific event (replace briefing.stats when selected).
  stats: Stat[]
}

const YANO_EVENTS: HistoricalEvent[] = [
  {
    id: 'yano-2019',
    year: 2019,
    date: '2019-07-15',
    shortLabel: '2019',
    label: 'Início do avanço · +1,4 km² em 2019',
    severity: 0.25,
    magnitude: { value: '+ 1,4', unit: 'km² novo' },
    beforeDate: '2018-07-15',
    afterDate: '2019-07-15',
    note: 'Primeiro ano com aceleração perceptível do garimpo via MapBiomas Alerta.',
    stats: [
      { value: '+ 1,4 km²', label: 'novo garimpo em 2019', source: 'MapBiomas Garimpo' },
      { value: '~ 95 km²', label: 'acumulado histórico', source: 'MapBiomas Garimpo' },
      { value: '~ 3 500', label: 'garimpeiros estimados', source: 'Hutukara' },
      { value: '—', label: 'operação federal', source: '—' },
    ],
  },
  {
    id: 'yano-2020',
    year: 2020,
    date: '2020-07-15',
    shortLabel: '2020',
    label: 'Expansão pandêmica · +2,9 km² em 2020',
    severity: 0.4,
    magnitude: { value: '+ 2,9', unit: 'km² novo' },
    beforeDate: '2019-07-15',
    afterDate: '2020-07-15',
    note: 'Pandemia isolou fiscalização; garimpo dobrou em alguns setores.',
    stats: [
      { value: '+ 2,9 km²', label: 'novo garimpo em 2020', source: 'MapBiomas Garimpo' },
      { value: '~ 98 km²', label: 'acumulado histórico', source: 'MapBiomas Garimpo' },
      { value: '~ 8 000', label: 'garimpeiros estimados', source: 'Hutukara' },
      { value: '—', label: 'operação federal', source: '—' },
    ],
  },
  {
    id: 'yano-2021',
    year: 2021,
    date: '2021-07-15',
    shortLabel: '2021',
    label: 'Crescimento exponencial · +10,2 km² em 2021',
    severity: 0.75,
    magnitude: { value: '+ 10,2', unit: 'km² novo' },
    beforeDate: '2020-07-15',
    afterDate: '2021-07-15',
    note: 'Avanço mais violento em 15 anos até então — triplicou em um ano.',
    stats: [
      { value: '+ 10,2 km²', label: 'novo garimpo em 2021', source: 'MapBiomas Garimpo' },
      { value: '~ 108 km²', label: 'acumulado histórico', source: 'MapBiomas Garimpo' },
      { value: '~ 15 000', label: 'garimpeiros estimados', source: 'Hutukara' },
      { value: '—', label: 'operação federal', source: '—' },
    ],
  },
  {
    id: 'yano-2022',
    year: 2022,
    date: '2022-07-15',
    shortLabel: '2022',
    label: 'PICO histórico · +17,8 km² em 2022',
    severity: 1.0,
    magnitude: { value: '+ 17,8', unit: 'km² novo (recorde)' },
    beforeDate: '2021-07-15',
    afterDate: '2022-07-15',
    note: 'Ano recorde. Crise humanitária reportada por Hutukara e Palácio dirigida ao MS.',
    stats: [
      { value: '+ 17,8 km²', label: 'novo garimpo em 2022 (recorde)', source: 'MapBiomas Garimpo' },
      { value: '~ 126 km²', label: 'acumulado histórico', source: 'MapBiomas Garimpo' },
      { value: '~ 20 000', label: 'garimpeiros estimados', source: 'Hutukara · Governo' },
      { value: '570 +', label: 'óbitos infantis 2019-22', source: 'Ministério da Saúde' },
    ],
  },
  {
    id: 'yano-2023',
    year: 2023,
    date: '2023-07-15',
    shortLabel: '2023',
    label: 'Operação Libertação · −52% em 2023',
    severity: 0.55,
    magnitude: { value: '+ 8,4', unit: 'km² novo' },
    beforeDate: '2022-07-15',
    afterDate: '2023-07-15',
    note: 'Fev/2023: emergência sanitária decretada; Operação Libertação reduz garimpo pela metade.',
    stats: [
      { value: '+ 8,4 km²', label: 'novo garimpo em 2023', source: 'MapBiomas Garimpo' },
      { value: '~ 134 km²', label: 'acumulado histórico', source: 'MapBiomas Garimpo' },
      { value: '− 52%', label: 'queda vs 2022', source: 'MapBiomas · ISA' },
      { value: 'fev/2023', label: 'início da operação federal', source: 'MJSP · Ibama · FUNAI' },
    ],
  },
  {
    id: 'yano-2024',
    year: 2024,
    date: '2024-07-15',
    shortLabel: '2024',
    label: 'Retomada parcial · +4,5 km² em 2024',
    severity: 0.35,
    magnitude: { value: '+ 4,5', unit: 'km² novo' },
    beforeDate: '2023-07-15',
    afterDate: '2024-07-15',
    note: 'Fiscalização sustenta queda, mas focos voltam em áreas remotas.',
    stats: [
      { value: '+ 4,5 km²', label: 'novo garimpo em 2024', source: 'MapBiomas Garimpo' },
      { value: '~ 139 km²', label: 'acumulado histórico', source: 'MapBiomas Garimpo' },
      { value: '≈ 1 500', label: 'garimpeiros estimados remanescentes', source: 'Hutukara' },
      { value: 'em curso', label: 'operação federal', source: 'MJSP · Ibama · FUNAI' },
    ],
  },
]

const ENCH_EVENTS: HistoricalEvent[] = [
  {
    id: 'ench-2009',
    year: 2009,
    date: '2009-06-01',
    shortLabel: '2009',
    label: 'Cheia 2009 · 29,77 m',
    severity: 0.7,
    magnitude: { value: '29,77', unit: 'm' },
    beforeDate: '2008-11-15',
    afterDate: '2009-06-01',
    note: 'Nova maior cheia desde 1953 — na época, considerada histórica.',
    stats: [
      { value: '29,77 m', label: 'cota máxima Rio Negro / Manaus', source: 'ANA · Porto de Manaus' },
      { value: '184 500 +', label: 'pessoas afetadas no AM', source: 'Defesa Civil AM' },
      { value: '40 +', label: 'municípios em emergência', source: 'SEDEC/MDR' },
      { value: '> 29 m', label: 'cota supera limite crítico', source: 'ANA' },
    ],
  },
  {
    id: 'ench-2012',
    year: 2012,
    date: '2012-05-29',
    shortLabel: '2012',
    label: 'Cheia 2012 · 29,97 m',
    severity: 0.85,
    magnitude: { value: '29,97', unit: 'm' },
    beforeDate: '2011-11-15',
    afterDate: '2012-05-29',
    note: 'Quebrou o recorde de 2009. Primeira vez acima de 29,90 m.',
    stats: [
      { value: '29,97 m', label: 'cota máxima (2012)', source: 'ANA · Porto de Manaus' },
      { value: '300 000 +', label: 'pessoas afetadas no AM', source: 'Defesa Civil AM' },
      { value: '42', label: 'municípios em emergência', source: 'SEDEC/MDR' },
      { value: 'recorde', label: 'maior cheia em 108 anos (até então)', source: 'ANA' },
    ],
  },
  {
    id: 'ench-2015',
    year: 2015,
    date: '2015-07-04',
    shortLabel: '2015',
    label: 'Cheia 2015 · 29,66 m',
    severity: 0.7,
    magnitude: { value: '29,66', unit: 'm' },
    beforeDate: '2014-11-15',
    afterDate: '2015-07-04',
    note: 'Terceira cheia acima de 29,5 m na década — padrão de recorrência instalado.',
    stats: [
      { value: '29,66 m', label: 'cota máxima (2015)', source: 'ANA · Porto de Manaus' },
      { value: '220 000 +', label: 'pessoas afetadas no AM', source: 'Defesa Civil AM' },
      { value: '55', label: 'municípios em emergência', source: 'SEDEC/MDR' },
      { value: '> 29 m', label: 'mais um ano crítico', source: 'ANA' },
    ],
  },
  {
    id: 'ench-2021',
    year: 2021,
    date: '2021-05-24',
    shortLabel: '2021',
    label: 'RECORDE 2021 · 30,02 m',
    severity: 1.0,
    magnitude: { value: '30,02', unit: 'm (recorde)' },
    beforeDate: '2020-11-15',
    afterDate: '2021-05-24',
    note: 'Maior cheia em 119 anos. Primeira vez acima de 30 m na série histórica.',
    stats: [
      { value: '30,02 m', label: 'cota recorde do Rio Negro (24/mai/2021)', source: 'ANA · Porto de Manaus' },
      { value: '2 450 000 +', label: 'pessoas afetadas no AM em 2021', source: 'Defesa Civil AM' },
      { value: '> 60', label: 'municípios em emergência', source: 'SEDEC/MDR' },
      { value: '119', label: 'anos: maior da série histórica', source: 'ANA' },
    ],
  },
  {
    id: 'ench-2024',
    year: 2024,
    date: '2024-05-20',
    shortLabel: '2024',
    label: 'Cheia 2024 · 29,33 m',
    severity: 0.5,
    magnitude: { value: '29,33', unit: 'm' },
    beforeDate: '2023-11-01',
    afterDate: '2024-05-20',
    note: 'Depois da seca extrema de 2023, Rio Negro subiu rápido demais — enchente dentro do ciclo irregular.',
    stats: [
      { value: '29,33 m', label: 'cota máxima (2024)', source: 'ANA · Porto de Manaus' },
      { value: '150 000 +', label: 'pessoas afetadas no AM', source: 'Defesa Civil AM' },
      { value: 'após seca', label: 'ciclo seca → cheia extremo', source: 'CPRM · ANA' },
      { value: '> 29 m', label: 'quarto ano acima do limiar na década', source: 'ANA' },
    ],
  },
]

const SECA_EVENTS: HistoricalEvent[] = [
  {
    id: 'seca-2010',
    year: 2010,
    date: '2010-10-25',
    shortLabel: '2010',
    label: 'Seca 2010 · 13,63 m',
    severity: 0.75,
    magnitude: { value: '13,63', unit: 'm mínimo' },
    beforeDate: '2009-10-01',
    afterDate: '2010-10-25',
    note: 'Previamente considerada a seca do século. Lago Tefé sofreu retração severa pela primeira vez documentada.',
    stats: [
      { value: '13,63 m', label: 'menor cota Rio Negro (2010)', source: 'ANA · Porto de Manaus' },
      { value: '62', label: 'municípios amazonenses em emergência', source: 'Defesa Civil AM' },
      { value: '360 000 +', label: 'pessoas isoladas em comunidades ribeirinhas', source: 'Defesa Civil AM' },
      { value: '—', label: 'mortandade de botos', source: '—' },
    ],
  },
  {
    id: 'seca-2016',
    year: 2016,
    date: '2016-11-01',
    shortLabel: '2016',
    label: 'Seca 2016 · 15,25 m',
    severity: 0.55,
    magnitude: { value: '15,25', unit: 'm mínimo' },
    beforeDate: '2015-10-01',
    afterDate: '2016-11-01',
    note: 'Seca intermediária, forte impacto na navegação do Solimões.',
    stats: [
      { value: '15,25 m', label: 'menor cota Rio Negro (2016)', source: 'ANA · Porto de Manaus' },
      { value: '19', label: 'municípios em emergência', source: 'Defesa Civil AM' },
      { value: '120 000 +', label: 'pessoas afetadas', source: 'Defesa Civil AM' },
      { value: '—', label: 'mortandade de botos', source: '—' },
    ],
  },
  {
    id: 'seca-2023',
    year: 2023,
    date: '2023-10-15',
    shortLabel: '2023',
    label: 'RECORDE 2023 · 13,59 m',
    severity: 1.0,
    magnitude: { value: '13,59', unit: 'm (recorde)' },
    beforeDate: '2022-10-01',
    afterDate: '2023-10-15',
    note: 'Menor cota em 121 anos. Lago Tefé atingiu 39,1 °C, mortandade massiva de botos-rosa.',
    stats: [
      { value: '13,59 m', label: 'menor cota em 121 anos', source: 'ANA · Porto de Manaus' },
      { value: '39,1 °C', label: 'temperatura da água Lago Tefé (28/set/2023)', source: 'Instituto Mamirauá' },
      { value: '150 +', label: 'botos-rosa e tucuxis mortos', source: 'Mamirauá · ICMBio' },
      { value: '500 000 +', label: 'pessoas afetadas no AM', source: 'Defesa Civil AM' },
    ],
  },
  {
    id: 'seca-2024',
    year: 2024,
    date: '2024-09-30',
    shortLabel: '2024',
    label: 'Seca 2024 · continua severa',
    severity: 0.85,
    magnitude: { value: '< 14', unit: 'm (sob monitoramento)' },
    beforeDate: '2023-10-01',
    afterDate: '2024-09-30',
    note: 'Segunda seca extrema consecutiva, ciclo de estresse hídrico se intensifica.',
    stats: [
      { value: '< 14 m', label: 'cota mínima Rio Negro (2024)', source: 'ANA · Porto de Manaus' },
      { value: '590 000 +', label: 'pessoas afetadas no AM', source: 'Defesa Civil AM' },
      { value: '> 60', label: 'municípios em emergência', source: 'SEDEC/MDR' },
      { value: '2x', label: 'segunda seca extrema consecutiva', source: 'INPE · ANA' },
    ],
  },
]

export const HISTORICAL_EVENTS: Record<RegionId, HistoricalEvent[]> = {
  YANO: YANO_EVENTS,
  ENCH: ENCH_EVENTS,
  SECA: SECA_EVENTS,
}

export function peakEvent(id: RegionId): HistoricalEvent {
  const list = HISTORICAL_EVENTS[id]
  return list.reduce((best, e) => (e.severity > best.severity ? e : best))
}
