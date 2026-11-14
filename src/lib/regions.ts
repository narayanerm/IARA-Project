import type { Region } from './types'

export const REGIONS: Region[] = [
  {
    id: 'YANO',
    name: 'TI Yanomami',
    phenomenon: 'mining',
    phenomenonLabel: 'Garimpo',
    anchorCity: 'Homoxi · Roraima',
    // Homoxi bbox — documented 2019-2024 mining front
    bbox: [-63.8, 2.2, -63.2, 2.8],
    center: [-63.5, 2.5],
    zoom: 10.6,
    tagline:
      'L-band penetra copa. Clareira de solo exposto = queda abrupta de backscatter.',
    isAnchor: true,
    status: 'ready',
  },
  {
    id: 'ENCH',
    name: 'Encontro das Águas',
    phenomenon: 'flood',
    phenomenonLabel: 'Enchente',
    anchorCity: 'Manaus · AM 2024',
    // Solimões/Negro confluence — 2024 historic flood
    bbox: [-60.3, -3.3, -59.6, -2.9],
    center: [-59.95, -3.1],
    zoom: 9.6,
    tagline:
      'Água sob nuvem perene. Especular em SAR = pixel preto, delimitação robusta.',
    isAnchor: false,
    status: 'preview',
  },
  {
    id: 'SECA',
    name: 'Lago Tefé',
    phenomenon: 'drought',
    phenomenonLabel: 'Seca',
    anchorCity: 'Tefé · AM 2023-24',
    // Lake Tefé — 2023-24 historic drought
    bbox: [-65.0, -3.6, -64.5, -3.2],
    center: [-64.75, -3.4],
    zoom: 10.2,
    tagline:
      'Retração de corpos d\'água ao longo do tempo. Área hidrográfica como sinal de estresse.',
    isAnchor: false,
    status: 'preview',
  },
]

export const ANCHOR_REGION: Region = REGIONS.find((r) => r.isAnchor)!
