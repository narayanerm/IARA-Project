import type { Region } from './types'

export const REGIONS: Region[] = [
  {
    id: 'YANO',
    name: 'TI Yanomami',
    phenomenon: 'mining',
    phenomenonLabel: 'Garimpo',
    anchorCity: 'Homoxi · Roraima',
    // Full Yanomami TI (FUNAI polygon) — spans from Roraima down into Amazonas.
    // Previous bbox covered only the Roraima mining frontier, so the camera opened
    // off-center with the southern (Amazonas) half of the land out of frame.
    bbox: [-66.63, -0.47, -61.18, 4.43],
    center: [-63.9, 1.98],
    zoom: 7,
    tagline:
      'L-band penetra copa. Clareira de solo exposto = queda abrupta de backscatter.',
    isAnchor: true,
    status: 'ready',
  },
  {
    id: 'ENCH',
    name: 'Manaus',
    phenomenon: 'flood',
    phenomenonLabel: 'Enchente',
    anchorCity: 'Manaus · AM',
    // Manaus municipio (IBGE 1302603) — Rio Negro + Solimões + Encontro das Águas.
    bbox: [-60.9, -3.3, -59.1, -1.85],
    center: [-60.0, -2.6],
    zoom: 9,
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
    // Manaquiri municipality (IBGE 1302553) full extent — the hotspots cluster in the NE of
    // the land, so using the hotspot-only bbox made the camera open on a corner.
    bbox: [-61.16, -4.18, -60.18, -3.31],
    center: [-60.67, -3.75],
    zoom: 9.2,
    tagline:
      'Retração de corpos d\'água ao longo do tempo. Área hidrográfica como sinal de estresse.',
    isAnchor: false,
    status: 'preview',
  },
]

export const ANCHOR_REGION: Region = REGIONS.find((r) => r.isAnchor)!
