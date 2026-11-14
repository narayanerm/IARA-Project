import type { GranuleMetadata, SubsidencePolygon, ValidationReport } from '@/lib/types'

export const SP_GRANULE: GranuleMetadata = {
  observationId: 'NISAR_L2_INSAR_20260918T092314_20261002T092316_SP_D133',
  mission: 'NISAR',
  band: 'L',
  polarizations: ['HH', 'HV'],
  orbitPass: 'Descending',
  acquisitionDate: '2026-10-02',
  incidenceAngleDeg: 37.4,
  productLevel: 'L2 GUNW',
  processingVersion: 'v1.2.0',
  pixelSpacingM: 20,
  baselinePerpM: 146,
  temporalBaselineDays: 14,
  attribution: 'NASA/ISRO NISAR · processed by ASF DAAC',
}

function bairro(
  id: string,
  name: string,
  center: [number, number],
  sizeDeg: number,
  displacement: number,
  coherence: number
): SubsidencePolygon {
  const [lon, lat] = center
  const h = sizeDeg / 2
  const jitter = (seed: number) => {
    const x = Math.sin(seed * 9301 + 49297) * 233280
    return (x - Math.floor(x) - 0.5) * sizeDeg * 0.3
  }
  const coords: Array<[number, number]> = [
    [lon - h + jitter(1), lat - h + jitter(2)],
    [lon + h + jitter(3), lat - h + jitter(4)],
    [lon + h + jitter(5), lat + h + jitter(6)],
    [lon - h + jitter(7), lat + h + jitter(8)],
    [lon - h + jitter(1), lat - h + jitter(2)],
  ]

  const months = 24
  const series = Array.from({ length: months }, (_, i) => {
    const t = i / (months - 1)
    const noise = (Math.sin(i * 1.7 + displacement) + Math.cos(i * 0.9)) * 0.6
    const cumulative = displacement * (24 / 12) * t + noise
    const date = new Date(2024, 10 + i, 2).toISOString().slice(0, 10)
    return { date, displacementMm: Number(cumulative.toFixed(2)) }
  })

  return {
    id,
    name,
    displacementMmPerYear: Number(displacement.toFixed(2)),
    coherence: Number(coherence.toFixed(2)),
    cumulativeDisplacementMm: series[series.length - 1].displacementMm,
    geometry: { type: 'Polygon', coordinates: [coords] },
    series,
  }
}

export const SP_SUBSIDENCE: SubsidencePolygon[] = [
  bairro('sp-01', 'Mooca', [-46.6, -23.558], 0.028, -8.4, 0.78),
  bairro('sp-02', 'Vila Prudente', [-46.573, -23.585], 0.026, -12.1, 0.72),
  bairro('sp-03', 'Ipiranga', [-46.6, -23.59], 0.028, -5.3, 0.81),
  bairro('sp-04', 'Sé', [-46.636, -23.55], 0.022, -2.1, 0.85),
  bairro('sp-05', 'República', [-46.646, -23.542], 0.022, -1.4, 0.87),
  bairro('sp-06', 'Bela Vista', [-46.654, -23.562], 0.024, -3.8, 0.83),
  bairro('sp-07', 'Pinheiros', [-46.683, -23.566], 0.028, 0.6, 0.86),
  bairro('sp-08', 'Vila Mariana', [-46.635, -23.588], 0.026, -2.4, 0.84),
  bairro('sp-09', 'Moema', [-46.66, -23.605], 0.026, -1.7, 0.86),
  bairro('sp-10', 'Santo Amaro', [-46.709, -23.65], 0.034, -4.2, 0.79),
  bairro('sp-11', 'Jabaquara', [-46.646, -23.646], 0.03, -6.0, 0.77),
  bairro('sp-12', 'Tatuapé', [-46.572, -23.541], 0.028, -9.7, 0.74),
  bairro('sp-13', 'Penha', [-46.542, -23.527], 0.03, -11.5, 0.71),
  bairro('sp-14', 'Itaquera', [-46.457, -23.541], 0.036, -14.8, 0.68),
  bairro('sp-15', 'São Mateus', [-46.478, -23.606], 0.034, -16.2, 0.66),
  bairro('sp-16', 'Grajaú', [-46.69, -23.763], 0.044, -18.9, 0.63),
  bairro('sp-17', 'Capão Redondo', [-46.767, -23.667], 0.034, -7.1, 0.75),
  bairro('sp-18', 'Butantã', [-46.72, -23.572], 0.03, -1.1, 0.88),
  bairro('sp-19', 'Lapa', [-46.706, -23.527], 0.028, 0.3, 0.9),
  bairro('sp-20', 'Freguesia do Ó', [-46.69, -23.49], 0.032, -2.9, 0.82),
]

export const SP_VALIDATION: ValidationReport = {
  aoi: 'São Paulo Metropolitana',
  nSamples: 118,
  precision: 0.86,
  recall: 0.81,
  f1: 0.835,
  cohensKappa: 0.74,
  confusion: {
    truePositive: 61,
    falsePositive: 10,
    falseNegative: 14,
    trueNegative: 33,
  },
  groundTruthSource: 'IPT levantamento planialtimétrico 2023 + marcos geodésicos IBGE',
  periodStart: '2024-11-01',
  periodEnd: '2026-10-02',
}
