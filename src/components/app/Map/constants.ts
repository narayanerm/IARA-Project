import type { HillshadeLayerSpecification, TerrainSpecification } from 'maplibre-gl'

export const BASEMAP_URL = 'https://tiles.openfreemap.org/styles/dark'

// Basemap style already credits OpenFreeMap, OpenMapTiles and OpenStreetMap; this adds the community data
// sources (full list in ATTRIBUTIONS.md). Kept short so the expanded credit stays on one line above the timeline.
export const MAP_ATTRIBUTION = 'Comunidades: IBGE, FUNAI, MMA via INPE TerraBrasilis'

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
