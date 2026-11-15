import { useEffect, useMemo } from 'react'
import { Layer, Source, useMap } from 'react-map-gl/maplibre'
import type { FeatureCollection, Point } from 'geojson'
import { CASES } from '@/data/cases'
import type { RegionId } from '@/lib/types'

// IARA brand: water #5AA7C9, flooded forest #F07A45, ink #E6EEE8, background #0A110E
const KIND_COLOR = ['match', ['get', 'kind'], 'gauge', '#5AA7C9', 'landmark', '#E6EEE8', '#F07A45'] as const

// Label side on the map → MapLibre text-anchor (the anchor is the side of the text touching the dot).
const ANCHOR: Record<string, string> = { right: 'left', left: 'right', top: 'bottom', bottom: 'top' }

const LAYER_IDS = ['case-sites-halo', 'case-sites-dot', 'case-sites-label', 'case-sites-area-label']

/**
 * Documented places of the active case study (neighbourhoods, gauge, landmarks) and area names
 * (city, rivers). Kept above every other layer so the city can always be read, even over imagery.
 */
export function CaseSitesLayer({ activeRegion, visible }: { activeRegion: RegionId; visible: boolean }) {
  const { current: map } = useMap()

  const data = useMemo<FeatureCollection<Point>>(() => {
    const sites = visible ? CASES[activeRegion].sites : []
    return {
      type: 'FeatureCollection',
      features: sites.map((s) => ({
        type: 'Feature',
        properties: { name: s.name, kind: s.kind, note: s.note, anchor: ANCHOR[s.labelSide ?? 'right'] },
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      })),
    }
  }, [activeRegion, visible])

  // Imagery and other overlays are added later and can land above these layers: move them back on top.
  useEffect(() => {
    const m = map?.getMap()
    if (!m) return
    const raise = () => {
      const ids = m.getStyle()?.layers.map((l) => l.id) ?? []
      const ours = LAYER_IDS.filter((id) => ids.includes(id))
      const top = ids.slice(ids.length - ours.length)
      if (ours.length && ours.join() !== top.join()) ours.forEach((id) => m.moveLayer(id))
    }
    raise()
    m.on('styledata', raise)
    return () => {
      m.off('styledata', raise)
    }
  }, [map])

  const isPoint = ['!=', ['get', 'kind'], 'label'] as unknown as boolean

  return (
    <Source id="case-sites" type="geojson" data={data}>
      <Layer
        id="case-sites-halo"
        type="circle"
        filter={isPoint}
        paint={{
          'circle-radius': ['match', ['get', 'kind'], 'neighborhood', 16, 9],
          'circle-color': KIND_COLOR as unknown as string,
          'circle-opacity': 0.25,
        }}
      />
      <Layer
        id="case-sites-dot"
        type="circle"
        filter={isPoint}
        paint={{
          'circle-radius': ['match', ['get', 'kind'], 'neighborhood', 6, 4.5],
          'circle-color': KIND_COLOR as unknown as string,
          'circle-stroke-color': '#0A110E',
          'circle-stroke-width': 1.5,
        }}
      />
      <Layer
        id="case-sites-label"
        type="symbol"
        filter={isPoint}
        layout={{
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['match', ['get', 'kind'], 'neighborhood', 15, 12],
          'text-anchor': ['get', 'anchor'] as unknown as 'left',
          'text-radial-offset': 1.1,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        }}
        paint={{ 'text-color': '#E6EEE8', 'text-halo-color': '#0A110E', 'text-halo-width': 2 }}
      />
      <Layer
        id="case-sites-area-label"
        type="symbol"
        filter={['==', ['get', 'kind'], 'label'] as unknown as boolean}
        layout={{
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 9, 12, 13, 20],
          'text-letter-spacing': 0.08,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        }}
        paint={{ 'text-color': '#E6EEE8', 'text-halo-color': '#0A110E', 'text-halo-width': 2.5 }}
      />
    </Source>
  )
}
