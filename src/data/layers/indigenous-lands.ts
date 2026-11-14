import type { FeatureCollection, Polygon } from 'geojson'

// Simplified TI polygons for demo only; authoritative source is FUNAI (SIRGAS 2000).

export interface TiProps {
  name: string
  state: string
  area_km2: number
  year: number
  status: 'homologada' | 'declarada' | 'identificada'
  population?: number
  ethnicities?: string[]
}

export const INDIGENOUS_LANDS: FeatureCollection<Polygon, TiProps> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        name: 'TI Yanomami',
        state: 'RR/AM',
        area_km2: 96650,
        year: 1992,
        status: 'homologada',
        population: 29139,
        ethnicities: ['Yanomami', 'Ye\'kuana'],
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-65.2, 4.3],
            [-63.4, 4.4],
            [-62.2, 3.9],
            [-61.3, 3.2],
            [-61.0, 2.5],
            [-61.2, 1.7],
            [-61.9, 1.1],
            [-62.8, 0.8],
            [-63.9, 0.9],
            [-64.6, 1.3],
            [-65.1, 1.9],
            [-65.4, 2.8],
            [-65.3, 3.6],
            [-65.2, 4.3],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'TI Raposa Serra do Sol',
        state: 'RR',
        area_km2: 17474,
        year: 2005,
        status: 'homologada',
        population: 25897,
        ethnicities: ['Macuxi', 'Wapixana', 'Taurepang', 'Ingarikó', 'Patamona'],
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-61.0, 5.2],
            [-60.1, 5.3],
            [-59.5, 4.8],
            [-59.7, 4.0],
            [-60.5, 3.9],
            [-61.0, 4.3],
            [-61.0, 5.2],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'TI Vale do Javari',
        state: 'AM',
        area_km2: 85440,
        year: 2001,
        status: 'homologada',
        population: 6300,
        ethnicities: ['Matis', 'Matsés', 'Marubo', 'Kanamari', 'Kulina', 'isolados'],
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-73.8, -4.2],
            [-72.8, -4.1],
            [-72.0, -4.8],
            [-71.6, -5.8],
            [-71.8, -6.8],
            [-72.6, -7.2],
            [-73.5, -7.0],
            [-74.0, -6.1],
            [-74.1, -5.0],
            [-73.8, -4.2],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'Parque Indígena do Xingu',
        state: 'MT',
        area_km2: 26420,
        year: 1991,
        status: 'homologada',
        population: 6590,
        ethnicities: ['Kamayurá', 'Yawalapiti', 'Kuikuro', 'Kalapalo', 'Suyá'],
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-54.2, -10.1],
            [-53.2, -10.0],
            [-52.5, -10.6],
            [-52.3, -11.8],
            [-52.8, -12.5],
            [-53.8, -12.4],
            [-54.4, -11.7],
            [-54.5, -10.8],
            [-54.2, -10.1],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'TI Kayapó',
        state: 'PA/MT',
        area_km2: 32940,
        year: 1991,
        status: 'homologada',
        population: 8638,
        ethnicities: ['Kayapó (Mebêngôkre)'],
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-55.2, -6.9],
            [-54.0, -7.1],
            [-53.2, -7.6],
            [-52.8, -8.5],
            [-52.9, -9.3],
            [-53.6, -9.8],
            [-54.8, -9.5],
            [-55.6, -8.8],
            [-55.7, -7.8],
            [-55.2, -6.9],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'TI Trombetas-Mapuera',
        state: 'PA/AM/RR',
        area_km2: 39560,
        year: 1989,
        status: 'homologada',
        population: 2500,
        ethnicities: ['Waiwai', 'Hixkaryana', 'Katwena'],
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-58.8, 0.9],
            [-57.5, 0.7],
            [-56.6, 0.2],
            [-56.8, -0.8],
            [-57.6, -1.4],
            [-58.6, -1.1],
            [-59.2, -0.3],
            [-58.8, 0.9],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'TI Alto Rio Negro',
        state: 'AM',
        area_km2: 79990,
        year: 1998,
        status: 'homologada',
        population: 11000,
        ethnicities: ['Tukano', 'Baré', 'Desana', 'Baniwa', 'Hupda', 'Yanomami'],
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-69.8, 1.8],
            [-68.0, 1.7],
            [-66.9, 1.2],
            [-66.7, 0.3],
            [-67.2, -0.6],
            [-68.3, -0.9],
            [-69.6, -0.6],
            [-70.4, 0.2],
            [-70.5, 1.1],
            [-69.8, 1.8],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'TI Munduruku',
        state: 'PA',
        area_km2: 23381,
        year: 2004,
        status: 'homologada',
        population: 7900,
        ethnicities: ['Munduruku'],
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-58.4, -6.4],
            [-57.3, -6.3],
            [-56.8, -6.9],
            [-56.9, -7.8],
            [-57.7, -8.2],
            [-58.6, -7.7],
            [-58.8, -6.9],
            [-58.4, -6.4],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'TI Apyterewa',
        state: 'PA',
        area_km2: 7733,
        year: 2007,
        status: 'homologada',
        population: 850,
        ethnicities: ['Parakanã'],
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-52.5, -4.8],
            [-52.0, -4.9],
            [-51.7, -5.4],
            [-52.0, -5.8],
            [-52.5, -5.7],
            [-52.7, -5.2],
            [-52.5, -4.8],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'TI Araribóia',
        state: 'MA',
        area_km2: 4133,
        year: 1990,
        status: 'homologada',
        population: 5300,
        ethnicities: ['Guajajara', 'Awá-Guajá (isolados)'],
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-46.6, -4.5],
            [-46.0, -4.4],
            [-45.6, -4.9],
            [-45.7, -5.5],
            [-46.2, -5.6],
            [-46.7, -5.1],
            [-46.6, -4.5],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'TI Alto Turiaçu',
        state: 'MA',
        area_km2: 5308,
        year: 1993,
        status: 'homologada',
        population: 2100,
        ethnicities: ['Ka\'apor', 'Tembé'],
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-46.8, -2.0],
            [-46.3, -2.0],
            [-46.0, -2.5],
            [-46.3, -2.9],
            [-46.8, -2.8],
            [-47.0, -2.4],
            [-46.8, -2.0],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'TI Kaxinawá do Rio Humaitá',
        state: 'AC',
        area_km2: 1278,
        year: 1998,
        status: 'homologada',
        population: 450,
        ethnicities: ['Kaxinawá (Huni Kuĩ)'],
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-72.4, -8.5],
            [-72.1, -8.4],
            [-71.9, -8.7],
            [-72.1, -8.9],
            [-72.4, -8.8],
            [-72.5, -8.6],
            [-72.4, -8.5],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'TI Mamoadate',
        state: 'AC',
        area_km2: 3137,
        year: 1991,
        status: 'homologada',
        population: 980,
        ethnicities: ['Yaminawá', 'Machineri'],
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-70.2, -10.4],
            [-69.8, -10.3],
            [-69.6, -10.7],
            [-69.9, -11.0],
            [-70.3, -10.9],
            [-70.4, -10.6],
            [-70.2, -10.4],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'TI Uru-Eu-Wau-Wau',
        state: 'RO',
        area_km2: 18670,
        year: 1991,
        status: 'homologada',
        population: 115,
        ethnicities: ['Uru-Eu-Wau-Wau', 'Amondawa', 'isolados'],
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-64.4, -10.8],
            [-63.5, -10.9],
            [-63.0, -11.5],
            [-63.2, -12.2],
            [-63.9, -12.4],
            [-64.6, -12.0],
            [-64.7, -11.3],
            [-64.4, -10.8],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'TI Waimiri-Atroari',
        state: 'AM/RR',
        area_km2: 25843,
        year: 1989,
        status: 'homologada',
        population: 2009,
        ethnicities: ['Waimiri-Atroari'],
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-61.6, -0.2],
            [-60.3, -0.3],
            [-59.5, -0.9],
            [-59.6, -1.9],
            [-60.4, -2.3],
            [-61.3, -2.0],
            [-61.9, -1.2],
            [-61.6, -0.2],
          ],
        ],
      },
    },
  ],
}

// Simplified Amazon biome outline; source: IBGE.
export const AMAZON_BIOME: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Bioma Amazônia (BR)', source: 'IBGE · simplificado' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-74.0, 5.3],
            [-71.0, 5.5],
            [-68.0, 5.0],
            [-64.0, 4.8],
            [-60.0, 4.8],
            [-56.5, 4.5],
            [-53.0, 3.8],
            [-50.0, 2.0],
            [-48.0, -0.5],
            [-46.5, -2.0],
            [-45.5, -4.0],
            [-46.0, -6.0],
            [-47.5, -7.5],
            [-49.5, -9.0],
            [-52.0, -10.5],
            [-55.0, -12.0],
            [-58.0, -13.5],
            [-61.0, -13.8],
            [-64.0, -13.0],
            [-66.5, -12.0],
            [-69.0, -11.0],
            [-71.5, -10.0],
            [-72.5, -9.0],
            [-73.0, -7.5],
            [-73.5, -5.5],
            [-73.8, -3.5],
            [-74.2, -1.5],
            [-74.0, 0.5],
            [-73.8, 2.0],
            [-74.0, 5.3],
          ],
        ],
      },
    },
  ],
}

export function polygonCentroid(polygon: Polygon): [number, number] {
  const ring = polygon.coordinates[0]
  let x = 0
  let y = 0
  const n = ring.length - 1 // ignore closing duplicate
  for (let i = 0; i < n; i++) {
    x += ring[i][0]
    y += ring[i][1]
  }
  return [x / n, y / n]
}
