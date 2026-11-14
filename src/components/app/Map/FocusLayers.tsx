import { useEffect, useMemo, useRef } from 'react'
import { Layer, Source, useMap } from 'react-map-gl/maplibre'
import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl'
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import { useApp } from '@/lib/store'
import { REGIONS } from '@/lib/regions'
import { RIVERSIDE_RADIUS_KM, type Focus } from '@/lib/community'
import { circleRing, worldWithHolesFC } from '@/lib/polygon-bbox'
import { useTiBoundary } from '@/lib/useCommunityIndex'
import { useDeterAlerts } from '@/lib/useDeterAlerts'
import { useNisarSelection } from '@/lib/useNisarCatalog'
import { prefersReducedMotion } from '@/lib/utils'
import { KIND_COLOR } from './community-kind'
import { EXPLORE_VIEW } from './map-views'

const ANCHOR = 'community-points-anchor'

// Zooming out this far below the framed zoom counts as leaving the community.
const EXIT_ZOOM_DELTA = 1.5

const DETER_COLOR: ExpressionSpecification = [
  'case',
  ['in', 'MINERACAO', ['upcase', ['coalesce', ['get', 'classname'], '']]], 'hsl(0 90% 60%)',
  ['in', 'GARIMPO', ['upcase', ['coalesce', ['get', 'classname'], '']]], 'hsl(0 90% 60%)',
  ['in', 'DESMATAMENTO', ['upcase', ['coalesce', ['get', 'classname'], '']]], 'hsl(28 95% 60%)',
  ['in', 'DEGRADACAO', ['upcase', ['coalesce', ['get', 'classname'], '']]], 'hsl(48 85% 55%)',
  'hsl(190 85% 60%)',
]

/** Outer rings of the followed area: the FUNAI outline for a TI, the 10 km circle for a riverside community. */
function useFocusRings(focus: Focus): number[][][] {
  const boundary = useTiBoundary(focus.kind === 'indigenous' ? focus.id : null)
  return useMemo(() => {
    if (focus.kind === 'riverside') return [circleRing(focus.lngLat, RIVERSIDE_RADIUS_KM)]
    if (boundary?.type === 'Polygon') return [boundary.coordinates[0]]
    if (boundary?.type === 'MultiPolygon') return boundary.coordinates.map((p) => p[0])
    const [w, s, e, n] = focus.bbox
    return [[[w, s], [e, s], [e, n], [w, n], [w, s]]]
  }, [focus, boundary])
}

/** Date (YYYY-MM-DD) of the radar image on screen; alerts after it are hidden so the map matches that moment. */
function useRadarDate(): string | null {
  const activeRegion = useApp((s) => s.activeRegion)
  const region = useMemo(() => REGIONS.find((r) => r.id === activeRegion)!, [activeRegion])
  const { scene } = useNisarSelection(region)
  return scene?.date ? scene.date.slice(0, 10) : null
}

export function FocusLayers({ focus }: { focus: Focus }) {
  const rings = useFocusRings(focus)
  const deter = useDeterAlerts(focus.bbox)
  const radarDate = useRadarDate()

  const mask = useMemo(() => worldWithHolesFC(rings), [rings])
  const outline = useMemo<FeatureCollection<Polygon>>(
    () => ({
      type: 'FeatureCollection',
      features: rings.map(
        (ring): Feature<Polygon> => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } })
      ),
    }),
    [rings]
  )
  // Without a radar image every alert shows; MapLibre rejects an undefined filter, so keep one in place.
  const deterFilter: FilterSpecification = ['<=', ['coalesce', ['get', 'view_date'], ''], radarDate ?? '9999-12-31']
  const color = KIND_COLOR[focus.kind].fill

  return (
    <>
      <Source id="focus-mask" type="geojson" data={mask}>
        <Layer
          id="focus-mask-fill"
          type="fill"
          beforeId={ANCHOR}
          paint={{ 'fill-color': 'hsl(222 47% 5%)', 'fill-opacity': 0.72 }}
        />
      </Source>
      {deter.features.features.length > 0 && (
        <Source id="focus-deter" type="geojson" data={deter.features}>
          <Layer
            id="focus-deter-fill"
            type="fill"
            beforeId={ANCHOR}
            filter={deterFilter}
            paint={{ 'fill-color': DETER_COLOR, 'fill-opacity': 0.6 }}
          />
          <Layer
            id="focus-deter-line"
            type="line"
            beforeId={ANCHOR}
            filter={deterFilter}
            paint={{ 'line-color': '#fff', 'line-opacity': 0.7, 'line-width': 0.7 }}
          />
        </Source>
      )}
      <Source id="focus-outline" type="geojson" data={outline}>
        <Layer
          id="focus-outline-line"
          type="line"
          beforeId={ANCHOR}
          paint={{ 'line-color': color, 'line-width': 2.5, 'line-opacity': 1 }}
        />
      </Source>
    </>
  )
}

/** Frames the focused community, returns to the overview on exit, and leaves the community on a deep zoom out. */
export function FocusCamera() {
  const { current: ref } = useMap()
  const focus = useApp((s) => s.focus)
  const clearFocus = useApp((s) => s.clearFocus)
  const fitZoom = useRef<number | null>(null)
  const moving = useRef(false)
  const leftByZoom = useRef(false)
  const previous = useRef<Focus | null>(null)

  useEffect(() => {
    const map = ref?.getMap()
    if (!map) return
    const was = previous.current
    previous.current = focus
    const duration = prefersReducedMotion() ? 0 : 1300

    // The panel opens or closes in the same render and changes the map width; sync it before framing.
    map.resize()

    if (focus) {
      const el = map.getContainer()
      // On phones the panel is a bottom sheet over the map; frame the area in the strip left above it.
      const sheet = document.getElementById('community-sheet')?.getBoundingClientRect()
      const covered = sheet ? Math.max(0, el.getBoundingClientRect().bottom - sheet.top) : 0
      const padding =
        el.clientWidth < 768
          ? { top: 60, bottom: Math.min(covered + 20, Math.round(el.clientHeight * 0.75)), left: 20, right: 20 }
          : { top: 72, bottom: 72, left: 72, right: 72 }
      const [w, s, e, n] = focus.bbox
      const camera = map.cameraForBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding, maxZoom: focus.kind === 'riverside' ? 12 : 11 }
      )
      if (!camera) return
      moving.current = true
      map.once('moveend', () => {
        moving.current = false
        fitZoom.current = map.getZoom()
      })
      map.flyTo({ ...camera, bearing: 0, pitch: 0, duration, essential: true })
      return
    }

    fitZoom.current = null
    if (was && !leftByZoom.current) {
      map.flyTo({
        center: [EXPLORE_VIEW.longitude, EXPLORE_VIEW.latitude],
        zoom: Math.min(map.getZoom(), EXPLORE_VIEW.zoom + 1),
        bearing: 0,
        pitch: 0,
        duration,
        essential: true,
      })
    }
    leftByZoom.current = false
  }, [focus, ref])

  useEffect(() => {
    const map = ref?.getMap()
    if (!map) return
    const onZoomEnd = () => {
      const framed = fitZoom.current
      if (moving.current || framed == null || !useApp.getState().focus) return
      if (map.getZoom() < framed - EXIT_ZOOM_DELTA) {
        leftByZoom.current = true
        clearFocus()
      }
    }
    map.on('zoomend', onZoomEnd)
    return () => {
      map.off('zoomend', onZoomEnd)
    }
  }, [ref, clearFocus])

  return null
}
