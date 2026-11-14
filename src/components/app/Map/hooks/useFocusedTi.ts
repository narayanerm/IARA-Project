import { useMemo } from 'react'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import { INDIGENOUS_LANDS, type TiProps } from '@/data/layers/indigenous-lands'
import { useApp } from '@/lib/store'
import { useFunaiTi, type FunaiTiFeature, type FunaiTiProps } from '@/lib/useFunaiTi'
import { polygonBbox, type Bbox } from '@/lib/polygon-bbox'

export interface FocusedTiState {
  name: string | null
  localFeature: Feature<Polygon, TiProps> | null
  localProps: TiProps | null
  funaiFeature: FunaiTiFeature | null
  funaiProps: FunaiTiProps | null
  funaiLoading: boolean
  funaiError: string | null
  // Best available feature (FUNAI if loaded, else local simplified).
  feature: Feature<Polygon | MultiPolygon, TiProps | FunaiTiProps> | null
  sourceLabel: string
  bbox: Bbox | null
}

// Resolves the currently-focused TI into a normalized object: local fallback, FUNAI live, bbox, labels.
export function useFocusedTi(): FocusedTiState {
  const name = useApp((s) => s.focusedTi)
  const localFeature = useMemo(
    () => (INDIGENOUS_LANDS.features.find((f) => f.properties.name === name) ?? null) as
      | Feature<Polygon, TiProps>
      | null,
    [name]
  )
  const funai = useFunaiTi(name)
  const feature = (funai.feature ?? localFeature) as FocusedTiState['feature']

  const sourceLabel = funai.feature
    ? 'FUNAI oficial · TerraBrasilis/INPE'
    : funai.loading
    ? 'carregando FUNAI…'
    : 'contorno simplificado (FUNAI indisp.)'

  const bbox = useMemo<Bbox | null>(() => {
    if (!feature) return null
    if (feature.geometry.type === 'MultiPolygon') {
      let minLon = Infinity
      let minLat = Infinity
      let maxLon = -Infinity
      let maxLat = -Infinity
      for (const poly of feature.geometry.coordinates) {
        for (const ring of poly) {
          for (const [lon, lat] of ring) {
            if (lon < minLon) minLon = lon
            if (lat < minLat) minLat = lat
            if (lon > maxLon) maxLon = lon
            if (lat > maxLat) maxLat = lat
          }
        }
      }
      return [minLon, minLat, maxLon, maxLat]
    }
    return polygonBbox(feature.geometry as Polygon)
  }, [feature])

  return {
    name,
    localFeature,
    localProps: localFeature?.properties ?? null,
    funaiFeature: funai.feature,
    funaiProps: funai.feature?.properties ?? null,
    funaiLoading: funai.loading,
    funaiError: funai.error,
    feature,
    sourceLabel,
    bbox,
  }
}

// Extract the primary ring of a feature's geometry (for worldWithHoleFC).
export function firstRingOf(feature: Feature<Polygon | MultiPolygon, unknown>): number[][] {
  if (feature.geometry.type === 'MultiPolygon') return feature.geometry.coordinates[0][0]
  return feature.geometry.coordinates[0] as number[][]
}
