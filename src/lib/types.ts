import type { Polygon } from 'geojson'

export type RegionId = 'YANO' | 'ENCH' | 'SECA'

export type Phenomenon = 'mining' | 'flood' | 'drought'

export interface Region {
  id: RegionId
  name: string
  phenomenon: Phenomenon
  phenomenonLabel: string
  anchorCity: string
  bbox: [number, number, number, number]
  center: [number, number]
  zoom: number
  tagline: string
  isAnchor: boolean
  status: 'ready' | 'preview' | 'planned'
}

export interface GranuleMetadata {
  observationId: string
  mission: 'NISAR' | 'Sentinel-1' | 'ALOS-2 PALSAR-2'
  band: 'L' | 'S' | 'C'
  polarizations: Array<'HH' | 'HV' | 'VH' | 'VV'>
  orbitPass: 'Ascending' | 'Descending'
  acquisitionDate: string
  incidenceAngleDeg: number
  productLevel: string
  processingVersion: string
  pixelSpacingM: number
  baselinePerpM?: number
  temporalBaselineDays?: number
  attribution: string
}

export type ProductLayer =
  | 'amplitude'
  | 'coherence'
  | 'interferogram'
  | 'displacement'
  | 'change'

// Phenomenon-polymorphic detection polygon; displacement value is reinterpreted per AOI (dB, m², %).
export interface SubsidencePolygon {
  id: string
  name: string
  displacementMmPerYear: number
  coherence: number
  cumulativeDisplacementMm: number
  geometry: Polygon
  series: Array<{ date: string; displacementMm: number }>
}

export interface ValidationReport {
  aoi: string
  nSamples: number
  precision: number
  recall: number
  f1: number
  cohensKappa: number
  confusion: {
    truePositive: number
    falsePositive: number
    falseNegative: number
    trueNegative: number
  }
  groundTruthSource: string
  periodStart: string
  periodEnd: string
}
