import type { GranuleMetadata, SubsidencePolygon, ValidationReport } from '@/lib/types'

// Yanomami/Homoxi mining mock; displacementMmPerYear encodes L-HH backscatter drop in dB (negative = canopy loss).

export const YANO_GRANULE: GranuleMetadata = {
  observationId: 'NISAR_L2_GCOV_20260918T142314_YANO_A041',
  mission: 'NISAR',
  band: 'L',
  polarizations: ['HH', 'HV'],
  orbitPass: 'Ascending',
  acquisitionDate: '2026-10-28',
  incidenceAngleDeg: 33.8,
  productLevel: 'L2 GCOV',
  processingVersion: 'v1.2.0',
  pixelSpacingM: 20,
  temporalBaselineDays: 12,
  attribution: 'NASA/ISRO NISAR · processed by ASF DAAC',
}

function pit(
  id: string,
  name: string,
  center: [number, number],
  sizeDeg: number,
  dbDrop: number,
  coherence: number
): SubsidencePolygon {
  const [lon, lat] = center
  const h = sizeDeg / 2
  const jitter = (seed: number) => {
    const x = Math.sin(seed * 9301 + 49297) * 233280
    return (x - Math.floor(x) - 0.5) * sizeDeg * 0.35
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
    const noise = (Math.sin(i * 1.7 + dbDrop) + Math.cos(i * 0.9)) * 0.25
    const cumulative = dbDrop * t + noise
    const date = new Date(2024, 10 + i, 2).toISOString().slice(0, 10)
    return { date, displacementMm: Number(cumulative.toFixed(2)) }
  })

  return {
    id,
    name,
    displacementMmPerYear: Number(dbDrop.toFixed(2)),
    coherence: Number(coherence.toFixed(2)),
    cumulativeDisplacementMm: series[series.length - 1].displacementMm,
    geometry: { type: 'Polygon', coordinates: [coords] },
    series,
  }
}

// Synthetic coords around Homoxi (~-63.5°W, 2.5°N).
export const YANO_MINING: SubsidencePolygon[] = [
  pit('yn-01', 'Homoxi · pit A', [-63.56, 2.52], 0.024, -7.2, 0.68),
  pit('yn-02', 'Homoxi · pit B', [-63.52, 2.5], 0.028, -8.9, 0.62),
  pit('yn-03', 'Homoxi · pit C', [-63.49, 2.54], 0.02, -4.6, 0.74),
  pit('yn-04', 'Homoxi · pit D', [-63.46, 2.58], 0.022, -5.8, 0.71),
  pit('yn-05', 'Alto Mucajaí · pit E', [-63.6, 2.46], 0.03, -9.4, 0.59),
  pit('yn-06', 'Alto Mucajaí · pit F', [-63.63, 2.48], 0.026, -6.3, 0.66),
  pit('yn-07', 'Serra da Estrutura · pit G', [-63.4, 2.56], 0.024, -3.9, 0.78),
  pit('yn-08', 'Serra da Estrutura · pit H', [-63.38, 2.6], 0.022, -2.8, 0.82),
  pit('yn-09', 'Waikás · pit I', [-63.33, 2.63], 0.028, -5.1, 0.72),
  pit('yn-10', 'Waikás · pit J', [-63.3, 2.66], 0.03, -6.7, 0.69),
  pit('yn-11', 'Parima · pit K', [-63.55, 2.68], 0.026, -4.3, 0.75),
  pit('yn-12', 'Parima · pit L', [-63.58, 2.72], 0.024, -3.6, 0.77),
  pit('yn-13', 'Surucucu · pit M', [-63.68, 2.4], 0.032, -10.1, 0.56),
  pit('yn-14', 'Surucucu · pit N', [-63.72, 2.44], 0.03, -8.2, 0.63),
  pit('yn-15', 'Floresta intacta ref.', [-63.44, 2.44], 0.02, 0.1, 0.9),
  pit('yn-16', 'Floresta intacta ref.', [-63.58, 2.58], 0.02, 0.3, 0.91),
]

export const YANO_VALIDATION: ValidationReport = {
  aoi: 'TI Yanomami · Homoxi',
  nSamples: 96,
  precision: 0.82,
  recall: 0.76,
  f1: 0.789,
  cohensKappa: 0.69,
  confusion: {
    truePositive: 48,
    falsePositive: 10,
    falseNegative: 15,
    trueNegative: 23,
  },
  groundTruthSource: 'MapBiomas Alerta + DETER/INPE · polígonos de garimpo validados',
  periodStart: '2024-11-01',
  periodEnd: '2026-10-28',
}
