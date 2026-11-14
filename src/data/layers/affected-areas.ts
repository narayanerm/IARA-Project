import type { FeatureCollection, Polygon } from 'geojson'
import type { RegionId } from '@/lib/types'

export interface AffectedAreaProps {
  kind: 'mining' | 'flood' | 'drought-shrink' | 'drought-original'
  label: string
  area_km2: number
  year: string
  source: string
}

// Simplified footprints; authoritative sources: MapBiomas Alerta, DETER, ANA, Instituto Mamirauá.

const YANO_MINING_FOOTPRINT: FeatureCollection<Polygon, AffectedAreaProps> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        kind: 'mining',
        label: 'Homoxi · frente de garimpo',
        area_km2: 42,
        year: '2019-2023',
        source: 'MapBiomas Garimpo',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-63.62, 2.46],
            [-63.52, 2.44],
            [-63.42, 2.5],
            [-63.38, 2.56],
            [-63.44, 2.63],
            [-63.56, 2.62],
            [-63.63, 2.55],
            [-63.62, 2.46],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        kind: 'mining',
        label: 'Alto Mucajaí · poços e dragas',
        area_km2: 28,
        year: '2020-2023',
        source: 'MapBiomas Garimpo',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-63.72, 2.38],
            [-63.6, 2.36],
            [-63.55, 2.42],
            [-63.6, 2.48],
            [-63.7, 2.47],
            [-63.74, 2.42],
            [-63.72, 2.38],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        kind: 'mining',
        label: 'Waikás · pistas clandestinas',
        area_km2: 19,
        year: '2021-2023',
        source: 'ISA · Rede Pró-Yanomami',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-63.36, 2.6],
            [-63.28, 2.59],
            [-63.24, 2.65],
            [-63.28, 2.7],
            [-63.36, 2.69],
            [-63.38, 2.64],
            [-63.36, 2.6],
          ],
        ],
      },
    },
  ],
}

const MANAUS_FLOOD_EXTENT: FeatureCollection<Polygon, AffectedAreaProps> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        kind: 'flood',
        label: 'Rio Negro · lâmina de cheia 2021',
        area_km2: 4100,
        year: '2021-05-24',
        source: 'ANA · Sentinel-1 derivado',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-60.5, -3.15],
            [-60.25, -3.1],
            [-60.1, -3.05],
            [-59.95, -3.0],
            [-59.8, -3.02],
            [-59.7, -3.08],
            [-59.65, -3.18],
            [-59.72, -3.28],
            [-59.85, -3.35],
            [-60.05, -3.32],
            [-60.25, -3.25],
            [-60.42, -3.2],
            [-60.5, -3.15],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        kind: 'flood',
        label: 'Rio Solimões · lâmina de cheia 2021',
        area_km2: 3200,
        year: '2021-05-24',
        source: 'ANA · Sentinel-1 derivado',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-60.4, -3.3],
            [-60.1, -3.3],
            [-59.9, -3.28],
            [-59.75, -3.32],
            [-59.7, -3.4],
            [-59.8, -3.5],
            [-60.1, -3.55],
            [-60.35, -3.48],
            [-60.42, -3.38],
            [-60.4, -3.3],
          ],
        ],
      },
    },
  ],
}

const TEFE_DROUGHT: FeatureCollection<Polygon, AffectedAreaProps> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        kind: 'drought-original',
        label: 'Lago Tefé · espelho normal',
        area_km2: 310,
        year: '2022',
        source: 'Instituto Mamirauá',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-64.9, -3.2],
            [-64.75, -3.22],
            [-64.65, -3.28],
            [-64.6, -3.36],
            [-64.65, -3.46],
            [-64.75, -3.52],
            [-64.9, -3.48],
            [-64.98, -3.38],
            [-64.95, -3.28],
            [-64.9, -3.2],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        kind: 'drought-shrink',
        label: 'Lago Tefé · retração seca 2023',
        area_km2: 92,
        year: '2023-10',
        source: 'Instituto Mamirauá',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-64.85, -3.3],
            [-64.78, -3.33],
            [-64.74, -3.39],
            [-64.78, -3.44],
            [-64.86, -3.43],
            [-64.9, -3.37],
            [-64.85, -3.3],
          ],
        ],
      },
    },
  ],
}

export const AFFECTED_AREAS: Record<RegionId, FeatureCollection<Polygon, AffectedAreaProps>> = {
  YANO: YANO_MINING_FOOTPRINT,
  ENCH: MANAUS_FLOOD_EXTENT,
  SECA: TEFE_DROUGHT,
}

export function affectedAreaTotal(id: RegionId): number {
  return AFFECTED_AREAS[id].features
    .filter((f) => f.properties.kind !== 'drought-original')
    .reduce((sum, f) => sum + f.properties.area_km2, 0)
}

export function affectedAreaColor(kind: AffectedAreaProps['kind']): string {
  switch (kind) {
    case 'mining':
      return 'hsl(10 85% 55%)'
    case 'flood':
      return 'hsl(210 95% 62%)'
    case 'drought-shrink':
      return 'hsl(38 95% 60%)'
    case 'drought-original':
      return 'hsl(200 60% 50%)'
  }
}
