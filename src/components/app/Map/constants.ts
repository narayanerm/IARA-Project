import type { TerrainSpecification } from 'maplibre-gl'

export const BASEMAP_URL = 'https://tiles.openfreemap.org/styles/dark'

// Full data provenance for the "i" popup in the bottom-right corner of the map.
// Written as a single flowing paragraph that credits every upstream source we rely on.
export const MAP_ATTRIBUTION =
  'O IARA combina dados abertos de várias instituições. A base cartográfica vem do ' +
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>, ' +
  '<a href="https://openmaptiles.org" target="_blank" rel="noopener">OpenMapTiles</a> e do ' +
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, ' +
  'complementada por imagens de satélite óptico do mosaico Sentinel-2 cloudless da ' +
  '<a href="https://cloudless.eox.at" target="_blank" rel="noopener">EOX</a> e pelas camadas ' +
  '<a href="https://gibs.earthdata.nasa.gov" target="_blank" rel="noopener">NASA GIBS</a> ' +
  '(MODIS, NDVI, IMERG, AMSR2). As imagens de radar vêm do catálogo da ' +
  '<a href="https://asf.alaska.edu" target="_blank" rel="noopener">ASF DAAC</a>, incluindo ' +
  'produtos NISAR, Sentinel-1 e ALOS-2 PALSAR. Os limites das Terras Indígenas são publicados pela ' +
  '<a href="https://www.gov.br/funai" target="_blank" rel="noopener">FUNAI</a> via ' +
  '<a href="https://terrabrasilis.dpi.inpe.br" target="_blank" rel="noopener">TerraBrasilis/INPE</a> ' +
  'e cruzados com o portal da ' +
  '<a href="https://terrasindigenas.org.br" target="_blank" rel="noopener">ISA</a>. ' +
  'Comunidades ribeirinhas e municípios usam o ' +
  '<a href="https://www.ibge.gov.br" target="_blank" rel="noopener">IBGE</a> (BC250, Malhas, Censo 2022 e Cidades). ' +
  'Alertas de desmatamento e garimpo vêm do ' +
  '<a href="http://terrabrasilis.dpi.inpe.br/app/map/deter" target="_blank" rel="noopener">INPE DETER-Amz</a>, ' +
  'com focos de calor do ' +
  '<a href="https://queimadas.dgi.inpe.br" target="_blank" rel="noopener">INPE Queimadas</a>. ' +
  'O relevo 3D usa AWS Terrain Tiles.'

// Moderate tilt keeps the 3D feel without loading low-detail tiles across a long horizon.
export const PITCH = 40
export const BEARING = -12
export const TERRAIN: TerrainSpecification = { source: 'terrain-dem', exaggeration: 1.4 }

// Centre of the Amazon biome used when no AOI is active.
export const AMAZON_CENTER: [number, number] = [-61, -5]
export const AMAZON_ZOOM = 4

// Cloud-free Sentinel-2 mosaic at 10 m (EOX, CC BY-NC-SA 4.0).
export const SATELLITE_TILES =
  'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg'
export const SATELLITE_ATTRIBUTION =
  'Sentinel-2 cloudless 2025 by <a href="https://cloudless.eox.at" target="_blank" rel="noopener">EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data 2025), CC BY-NC-SA 4.0'

// OpenMapTiles vector layers hidden when the satellite backdrop is on.
export const HIDDEN_UNDER_SATELLITE = new Set([
  'transportation',
  'building',
  'aeroway',
  'park',
  'landuse',
  'landcover',
  'water',
])
