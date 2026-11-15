import type { HillshadeLayerSpecification, TerrainSpecification } from 'maplibre-gl'

export const BASEMAP_URL = 'https://tiles.openfreemap.org/styles/dark'

// Full data provenance for the "i" popup in the bottom-right corner of the map, per language.
export const MAP_ATTRIBUTION: Record<'pt' | 'en', string> = {
  pt: 'O IARA combina dados abertos de várias instituições. A base cartográfica vem do <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>, <a href="https://openmaptiles.org" target="_blank" rel="noopener">OpenMapTiles</a> e do <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, complementada por imagens de satélite óptico do mosaico Sentinel-2 cloudless da <a href="https://cloudless.eox.at" target="_blank" rel="noopener">EOX</a> e pelas camadas <a href="https://gibs.earthdata.nasa.gov" target="_blank" rel="noopener">NASA GIBS</a> (MODIS, NDVI, IMERG, AMSR2). As imagens de radar vêm do catálogo da <a href="https://asf.alaska.edu" target="_blank" rel="noopener">ASF DAAC</a>, incluindo produtos NISAR, Sentinel-1 e ALOS-2 PALSAR. Os limites das Terras Indígenas são publicados pela <a href="https://www.gov.br/funai" target="_blank" rel="noopener">FUNAI</a> via <a href="https://terrabrasilis.dpi.inpe.br" target="_blank" rel="noopener">TerraBrasilis/INPE</a> e cruzados com o portal da <a href="https://terrasindigenas.org.br" target="_blank" rel="noopener">ISA</a>. Comunidades ribeirinhas e municípios usam o <a href="https://www.ibge.gov.br" target="_blank" rel="noopener">IBGE</a> (BC250, Malhas, Censo 2022 e Cidades). Alertas de desmatamento e garimpo vêm do <a href="http://terrabrasilis.dpi.inpe.br/app/map/deter" target="_blank" rel="noopener">INPE DETER-Amz</a>, com focos de calor do <a href="https://queimadas.dgi.inpe.br" target="_blank" rel="noopener">INPE Queimadas</a>. O relevo 3D usa AWS Terrain Tiles.',
  en: 'IARA combines open data from several institutions. The base map comes from <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>, <a href="https://openmaptiles.org" target="_blank" rel="noopener">OpenMapTiles</a> and <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, complemented by optical satellite imagery from the Sentinel-2 cloudless mosaic by <a href="https://cloudless.eox.at" target="_blank" rel="noopener">EOX</a> and by <a href="https://gibs.earthdata.nasa.gov" target="_blank" rel="noopener">NASA GIBS</a> layers (MODIS, NDVI, IMERG, AMSR2). Radar imagery comes from the <a href="https://asf.alaska.edu" target="_blank" rel="noopener">ASF DAAC</a> catalogue, including NISAR, Sentinel-1 and ALOS-2 PALSAR products. Indigenous land boundaries are published by <a href="https://www.gov.br/funai" target="_blank" rel="noopener">FUNAI</a> through <a href="https://terrabrasilis.dpi.inpe.br" target="_blank" rel="noopener">TerraBrasilis/INPE</a> and checked against the <a href="https://terrasindigenas.org.br" target="_blank" rel="noopener">ISA</a> portal. Riverside communities and municipalities use <a href="https://www.ibge.gov.br" target="_blank" rel="noopener">IBGE</a> data (BC250, Malhas, 2022 Census and Cidades). Deforestation and mining alerts come from <a href="http://terrabrasilis.dpi.inpe.br/app/map/deter" target="_blank" rel="noopener">INPE DETER-Amz</a>, with fire hotspots from <a href="https://queimadas.dgi.inpe.br" target="_blank" rel="noopener">INPE Queimadas</a>. 3D relief uses AWS Terrain Tiles.',
}

// Moderate tilt keeps the 3D feel without loading low-detail tiles across a long horizon.
export const PITCH = 40
export const BEARING = -12
// Relief = 3D mesh plus slope shading. The mesh has its own DEM source (MapLibre renders badly when
// terrain and hillshade share one) and is dropped below TERRAIN_MIN_ZOOM: zoomed out it shows nothing
// and draping the whole basin through the offscreen texture is where the tiles used to glitch.
export const TERRAIN: TerrainSpecification = { source: 'terrain-mesh', exaggeration: 1.5 }
export const TERRAIN_MIN_ZOOM = 6
export const RELIEF_LAYER = 'relief-hillshade'
export const RELIEF_PAINT: HillshadeLayerSpecification['paint'] = {
  'hillshade-method': 'multidirectional',
  'hillshade-exaggeration': 0.75,
  'hillshade-shadow-color': 'hsl(222 60% 2%)',
  'hillshade-highlight-color': 'hsl(40 40% 88% / 0.45)',
  'hillshade-accent-color': 'hsl(222 40% 8%)',
}

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
