import type { Region } from './types'

export const REGIONS: Region[] = [
  {
    id: 'YANO',
    name: 'TI Yanomami',
    phenomenon: 'mining',
    phenomenonLabel: 'Garimpo',
    anchorCity: 'Homoxi · Roraima',
    // Mining fronts in the Roraima side of the land (Uraricoera, Homoxi, Mucajaí)
    bbox: [-64.2, 2.1, -62.6, 3.7],
    center: [-63.38, 2.92],
    zoom: 8.2,
    tagline:
      'L-band penetra copa. Clareira de solo exposto = queda abrupta de backscatter.',
    isAnchor: true,
    status: 'ready',
  },
  {
    id: 'ENCH',
    name: 'Manaus urbana',
    phenomenon: 'flood',
    phenomenonLabel: 'Enchente',
    anchorCity: 'Manaus · AM',
    // Urban Manaus on the Rio Negro, record flood in 2021
    bbox: [-60.3, -3.3, -59.75, -2.95],
    center: [-60.0, -3.1],
    zoom: 11,
    tagline:
      'Água sob nuvem perene. Especular em SAR = pixel preto, delimitação robusta.',
    isAnchor: false,
    status: 'preview',
  },
  {
    id: 'SECA',
    name: 'Manaquiri ribeirinha',
    phenomenon: 'drought',
    phenomenonLabel: 'Seca',
    anchorCity: 'Manaquiri · AM',
    // Manaquiri lakes (Andiroba and neighbours), 2023-24 record droughts
    bbox: [-60.65, -3.65, -60.1, -3.25],
    center: [-60.39, -3.45],
    zoom: 10.3,
    tagline:
      'Retração de corpos d\'água ao longo do tempo. Área hidrográfica como sinal de estresse.',
    isAnchor: false,
    status: 'preview',
  },
]

export const ANCHOR_REGION: Region = REGIONS.find((r) => r.isAnchor)!
