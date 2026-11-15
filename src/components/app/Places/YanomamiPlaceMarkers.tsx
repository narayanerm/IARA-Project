import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Marker, useMap } from 'react-map-gl/maplibre'
import { useApp, usePlaces } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { YANOMAMI_PLACES, placeById } from '@/data/yanomamiPlaces'
import { PlaceDetail } from './PlaceDetail'
import './places.css'

const FLY_MS = 1400
// Places whose label would sit on a neighbour's: draw it on the left of the pin.
const LABEL_LEFT = new Set(['haximu'])

type Camera = { center: [number, number]; zoom: number; pitch: number; bearing: number }

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * Notable Yanomami places as clickable pins (Yanomami case only). A click flies the camera to the place while
 * "expression lines" (pulse rings and radiating traces) draw from it, then the detail view opens from that point.
 * Esc or Back reverses it and returns to the previous camera.
 */
export function YanomamiPlaceMarkers() {
  const { current: mapRef } = useMap()
  const lang = useI18n((s) => s.lang)
  const aoiActive = useApp((s) => s.aoiActive)
  const activeRegion = useApp((s) => s.activeRegion)
  const arrived = useApp((s) => s.caseArrived)
  const placeId = usePlaces((s) => s.yanomamiPlaceId)
  const phase = usePlaces((s) => s.placePhase)
  const openPlace = usePlaces((s) => s.openPlace)
  const closePlace = usePlaces((s) => s.closePlace)
  const saved = useRef<Camera | null>(null)
  const [fxPoint, setFxPoint] = useState<{ x: number; y: number } | null>(null)
  const [fxKey, setFxKey] = useState(0)

  const map = mapRef?.getMap()
  const place = placeId ? placeById(placeId) : undefined

  // Keep the expression lines pinned to the place while the camera moves.
  useEffect(() => {
    if (!map || !place || phase === 'idle') return
    const update = () => {
      const p = map.project([place.lon, place.lat])
      setFxPoint({ x: p.x, y: p.y })
    }
    update()
    map.on('move', update)
    return () => {
      map.off('move', update)
    }
  }, [map, place, phase])

  const start = useCallback(
    (id: string) => {
      const p = placeById(id)
      if (!map || !p) return
      const c = map.getCenter()
      saved.current = { center: [c.lng, c.lat], zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() }
      openPlace(id)
      setFxKey((k) => k + 1)
      const reduced = reducedMotion()
      map.flyTo({
        center: [p.lon, p.lat],
        zoom: p.approx ? 9 : 10.2,
        pitch: 50,
        bearing: map.getBearing(),
        // Keep the place clear of the left panel that will show its page.
        padding: window.innerWidth >= 768 ? { left: Math.min(440, window.innerWidth * 0.3 + 24), top: 60, right: 40, bottom: 80 } : { top: 40, bottom: window.innerHeight * 0.55, left: 0, right: 0 },
        duration: reduced ? 0 : FLY_MS,
        essential: true,
      })
      window.setTimeout(() => usePlaces.getState().setPlacePhase('open'), reduced ? 0 : FLY_MS)
    },
    [map, openPlace]
  )

  // Going back: fly to the camera from before the click, then clear the place.
  useEffect(() => {
    if (phase !== 'closing' || !map) return
    const cam = saved.current
    const reduced = reducedMotion()
    if (cam) map.flyTo({ ...cam, padding: { left: 0, top: 0, right: 0, bottom: 0 }, duration: reduced ? 0 : 1100, essential: true })
    const id = window.setTimeout(() => {
      usePlaces.setState({ yanomamiPlaceId: null, placePhase: 'idle' })
      setFxPoint(null)
    }, reduced ? 0 : 1100)
    return () => window.clearTimeout(id)
  }, [phase, map])

  // Esc closes the detail view.
  useEffect(() => {
    if (phase !== 'open') return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closePlace()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, closePlace])

  // Leaving the case resets the place view.
  useEffect(() => {
    if (!aoiActive || activeRegion !== 'YANO') usePlaces.setState({ yanomamiPlaceId: null, placePhase: 'idle' })
  }, [aoiActive, activeRegion])

  // Single gate for the pins (e.g. hide them while a guided tour runs).
  const pinsEnabled = aoiActive && activeRegion === 'YANO' && arrived
  if (!pinsEnabled) return null
  const container = map?.getContainer()

  return (
    <>
      {phase === 'idle' &&
        YANOMAMI_PLACES.map((p, i) => (
          <Marker key={p.id} longitude={p.lon} latitude={p.lat} anchor="center">
            <button
              type="button"
              className={`place-pin hotspot-in${LABEL_LEFT.has(p.id) ? ' is-left' : ''}`}
              style={{ '--delay-in': `${300 + i * 90}ms` } as React.CSSProperties}
              onClick={(e) => {
                e.stopPropagation()
                start(p.id)
              }}
              aria-label={`${p.name[lang]}: ${lang === 'pt' ? 'abrir detalhes da região' : 'open region details'}`}
            >
              <span className="place-pin-dot" aria-hidden="true" />
              <span className="place-pin-label">
                {p.name[lang]}
                {p.approx && <span className="place-pin-approx">~</span>}
              </span>
            </button>
          </Marker>
        ))}
      {place && phase !== 'idle' && (
        <Marker longitude={place.lon} latitude={place.lat} anchor="center">
          <span className="place-focus" aria-hidden="true" />
        </Marker>
      )}
      {container &&
        fxPoint &&
        phase === 'flying' &&
        createPortal(<ExpressionLines key={fxKey} x={fxPoint.x} y={fxPoint.y} />, container)}
      {container &&
        place &&
        (phase === 'open' || phase === 'closing') &&
        createPortal(
          <PlaceDetail place={place} origin={fxPoint} closing={phase === 'closing'} onClose={closePlace} />,
          container
        )}
    </>
  )
}

/** Concentric pulses plus thin traces radiating from the place, drawn while the camera flies in. */
function ExpressionLines({ x, y }: { x: number; y: number }) {
  const rays = Array.from({ length: 14 }, (_, i) => (i / 14) * Math.PI * 2)
  return (
    <svg className="place-fx" aria-hidden="true">
      <g transform={`translate(${x} ${y})`}>
        {[0, 1, 2].map((i) => (
          <circle key={`r${i}`} className="place-fx-ring" r="18" style={{ animationDelay: `${i * 220}ms` }} />
        ))}
        {[56, 96].map((r, i) => (
          <circle key={`c${i}`} className="place-fx-contour" r={r} style={{ animationDelay: `${150 + i * 180}ms` }} />
        ))}
        {rays.map((a, i) => {
          const r0 = 22
          const r1 = 70 + (i % 3) * 38
          return (
            <line
              key={`l${i}`}
              className="place-fx-ray"
              x1={Math.cos(a) * r0}
              y1={Math.sin(a) * r0}
              x2={Math.cos(a) * r1}
              y2={Math.sin(a) * r1}
              style={{ animationDelay: `${200 + (i % 5) * 70}ms` }}
            />
          )
        })}
      </g>
    </svg>
  )
}
