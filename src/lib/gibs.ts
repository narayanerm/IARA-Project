import type { RegionId } from './types'

export type GibsLayerKind = 'raster' | 'vector'

export interface GibsLayer {
  identifier: string
  kind: GibsLayerKind
  tileMatrixSet: string
  format: 'png' | 'jpg' | 'pbf'
  time: string
  legendLabel: string
  sensor: string
  explanation: string
  paintColor: string
}

const BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'

function fmtExt(fmt: GibsLayer['format']) {
  return fmt === 'pbf' ? 'mvt' : fmt
}

export function gibsTileUrl(layer: GibsLayer): string {
  return `${BASE}/${layer.identifier}/default/${layer.time}/${layer.tileMatrixSet}/{z}/{y}/{x}.${fmtExt(layer.format)}`
}

// Deepest zoom GIBS serves for a layer (GoogleMapsCompatible_LevelN); deeper requests return HTTP 400.
export function gibsMaxZoom(layer: GibsLayer): number {
  return Number(/Level(\d+)/.exec(layer.tileMatrixSet)?.[1] ?? 9)
}

export const GIBS_BY_REGION: Record<RegionId, GibsLayer | null> = {
  YANO: {
    identifier: 'MODIS_Terra_NDVI_8Day',
    kind: 'raster',
    tileMatrixSet: 'GoogleMapsCompatible_Level9',
    format: 'png',
    time: '2025-09-14',
    legendLabel: 'MODIS · NDVI 8-dias',
    sensor: 'MODIS',
    explanation:
      'Índice de vegetação (NDVI). Óptico cai sob nuvem; L-band SAR detecta clareira de garimpo sob copa.',
    paintColor: 'hsl(140 70% 55%)',
  },
  ENCH: {
    identifier: 'IMERG_Precipitation_Rate',
    kind: 'raster',
    tileMatrixSet: 'GoogleMapsCompatible_Level6',
    format: 'png',
    time: '2021-06-16',
    legendLabel: 'IMERG · precipitação',
    sensor: 'GPM IMERG',
    explanation:
      'Taxa de precipitação (mm/h) — contexto da cheia. SAR mapeia a lâmina de água; IMERG mostra o input.',
    paintColor: 'hsl(210 95% 62%)',
  },
  SECA: {
    identifier: 'AMSRU2_Soil_Moisture_NPD_Day',
    kind: 'raster',
    tileMatrixSet: 'GoogleMapsCompatible_Level6',
    format: 'png',
    time: '2023-10-15',
    legendLabel: 'AMSR2 · umidade de solo',
    sensor: 'AMSR2',
    explanation:
      'Umidade superficial de solo (passivo). Complementa SAR na análise de retração de corpos d\'água.',
    paintColor: 'hsl(270 80% 65%)',
  },
}

export const TRUE_COLOR_LAYER: GibsLayer = {
  identifier: 'MODIS_Terra_CorrectedReflectance_TrueColor',
  kind: 'raster',
  tileMatrixSet: 'GoogleMapsCompatible_Level9',
  format: 'jpg',
  time: '2025-09-15',
  legendLabel: 'MODIS · true color',
  sensor: 'MODIS',
  explanation:
    'Visão óptica diária. Contraste "o que o olho vê" vs. "o que o SAR vê sob nuvem/fumaça/noite".',
  paintColor: 'hsl(190 95% 60%)',
}
