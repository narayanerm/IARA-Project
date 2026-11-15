import type { RegionId } from '@/lib/types'
import type { Stat } from './phenomena-briefing'
import type { AsfPlatform } from '@/lib/asf'

export interface HistoricalEvent {
  id: string
  year: number
  date: string
  shortLabel: string
  label: string
  severity: number
  magnitude: { value: string; unit: string }
  beforeDate: string
  afterDate: string
  sarPlatform?: AsfPlatform
  note: string
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

// Manaus floods: annual maxima at the Porto de Manaus gauge (ANA 14990000).
// Sources: SGB boletins de alerta; Oliveira (2025, UFAM/SGB, VI CoBICET); Defesa Civil via press.
// SAR pairs compare the previous low-water season (before) with the flood peak (after).
const ENCH_EVENTS: HistoricalEvent[] = [
  {
    id: 'ench-2009',
    year: 2009,
    date: '2009-07-01',
    shortLabel: '2009',
    label: 'Cheia 2009 · 29,77 m',
    severity: 0.75,
    magnitude: { value: '29,77', unit: 'm' },
    beforeDate: '2008-11-15',
    afterDate: '2009-07-01',
    note: 'Primeira cheia do século a superar a marca de 1953; 16 dias acima de 29,69 m.',
    stats: [
      { value: '29,77 m', label: 'pico em 01/07/2009', source: 'Porto de Manaus · SGB' },
      { value: '16 dias', label: 'acima de 29,69 m (nível de 1953)', source: 'Oliveira 2025 · UFAM/SGB' },
      { value: '244 dias', label: 'duração do processo de cheia', source: 'Portal Amazônia · SGB' },
      { value: '3ª', label: 'maior cheia da série desde 1902', source: 'SGB' },
    ],
  },
  {
    id: 'ench-2012',
    year: 2012,
    date: '2012-05-29',
    shortLabel: '2012',
    label: 'Cheia 2012 · 29,97 m',
    severity: 0.9,
    magnitude: { value: '29,97', unit: 'm' },
    beforeDate: '2011-11-15',
    afterDate: '2012-05-29',
    note: 'Recorde até 2021. SGB estimou tempo de retorno de 113 anos para esse nível.',
    stats: [
      { value: '29,97 m', label: 'pico em 29/05/2012', source: 'Porto de Manaus · SGB' },
      { value: '34 dias', label: 'acima de 29,69 m', source: 'Oliveira 2025 · UFAM/SGB' },
      { value: '230 dias', label: 'de enchente (12/10/2011 a 29/05/2012)', source: 'SGB · relatório 2014' },
      { value: '113 anos', label: 'tempo de retorno estimado na época', source: 'SGB · relatório 2014' },
    ],
  },
  {
    id: 'ench-2021',
    year: 2021,
    date: '2021-06-16',
    shortLabel: '2021',
    label: 'RECORDE 2021 · 30,02 m',
    severity: 1.0,
    magnitude: { value: '30,02', unit: 'm (recorde)' },
    beforeDate: '2020-11-15',
    afterDate: '2021-06-16',
    note: 'Maior cheia desde 1902. Educandos e São Jorge entre os bairros mais atingidos.',
    stats: [
      { value: '30,02 m', label: 'pico em 16/06/2021, recorde da série', source: 'Porto de Manaus · SGB' },
      { value: '58 dias', label: 'acima de 29,69 m', source: 'Oliveira 2025 · UFAM/SGB' },
      { value: '24 mil', label: 'moradores de Manaus atingidos em 15 bairros', source: 'Defesa Civil de Manaus' },
      { value: '13 mil m', label: 'de passarelas de madeira em 21 bairros', source: 'Prefeitura de Manaus · NatGeo' },
    ],
  },
  {
    id: 'ench-2022',
    year: 2022,
    date: '2022-06-22',
    shortLabel: '2022',
    label: 'Cheia 2022 · 29,75 m',
    severity: 0.75,
    magnitude: { value: '29,75', unit: 'm' },
    beforeDate: '2021-11-15',
    afterDate: '2022-06-22',
    note: 'Segundo ano seguido acima da inundação severa; 4ª maior cheia da história.',
    stats: [
      { value: '29,75 m', label: 'pico em 22/06/2022', source: 'Porto de Manaus · SGB' },
      { value: '16 dias', label: 'acima de 29,69 m', source: 'Oliveira 2025 · UFAM/SGB' },
      { value: '4ª', label: 'maior cheia da série desde 1902', source: 'SGB' },
      { value: '2 anos', label: 'seguidos acima de 29,69 m (2021 e 2022)', source: 'Oliveira 2025 · UFAM/SGB' },
    ],
  },
  {
    id: 'ench-2025',
    year: 2025,
    date: '2025-07-04',
    shortLabel: '2025',
    label: 'Cheia 2025 · 29,04 m',
    severity: 0.55,
    magnitude: { value: '29,04', unit: 'm' },
    beforeDate: '2024-10-09',
    afterDate: '2025-07-04',
    note: 'Nove meses depois da seca recorde (12,11 m), o rio passou da inundação severa em pleno julho.',
    stats: [
      { value: '29,04 m', label: 'em 04/07/2025, acima da inundação severa', source: 'Defesa Civil do Amazonas' },
      { value: '16,9 m', label: 'de subida desde a seca recorde de out/2024', source: 'SGB · Porto de Manaus' },
      { value: '534 mil', label: 'pessoas atingidas no estado do Amazonas (todas as calhas)', source: 'Defesa Civil do Amazonas' },
      { value: '40', label: 'dos 62 municípios do estado do Amazonas em situação de emergência', source: 'Defesa Civil do Amazonas' },
    ],
  },
  {
    id: 'ench-2026',
    year: 2026,
    date: '2026-06-30',
    shortLabel: '2026',
    label: 'Cheia 2026 · ≈ 28,5 m · NISAR',
    severity: 0.35,
    magnitude: { value: '≈ 28,5', unit: 'm' },
    beforeDate: '2026-06-23',
    afterDate: '2026-11-02',
    sarPlatform: 'NISAR',
    note: 'Primeira cheia vista pelo NISAR: compare o rio na cheia (jun/2026, acima de 27,50 m) com a vazante (nov/2026).',
    stats: [
      { value: '28,50 m', label: 'nível em 30/06/2026', source: 'SGB · boletim de alerta' },
      { value: '21/05', label: 'rio passa da cota de inundação (27,52 m)', source: 'Porto de Manaus' },
      { value: '28,20 m', label: 'previsão do último alerta oficial', source: 'SGB · Alerta de Cheias' },
      { value: 'NISAR', label: 'primeira temporada com radar banda L', source: 'NASA/ISRO · ASF DAAC' },
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
