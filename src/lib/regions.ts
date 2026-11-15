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
    name: 'Educandos · São Jorge',
    phenomenon: 'flood',
    phenomenonLabel: 'Enchente',
    anchorCity: 'Manaus · AM',
    // Urban Manaus waterfront: Educandos, Centro and São Jorge along the Rio Negro igarapés
    bbox: [-60.06, -3.16, -59.99, -3.09],
    // Camera target sits south of the sites because the map view is offset downwards for the case panel.
    center: [-59.99, -3.135],
    zoom: 11.7,
    tagline:
      'Rio Negro invade os bairros baixos de Manaus. No SAR, água aberta fica escura e rua alagada entre casas brilha.',
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
