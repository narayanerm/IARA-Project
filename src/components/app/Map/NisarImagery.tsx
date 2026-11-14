import { useEffect, useMemo, useState } from 'react'
import { Layer, Source, useMap } from 'react-map-gl/maplibre'
import { REGIONS } from '@/lib/regions'
import { useApp } from '@/lib/store'
import { useNisarSelection } from '@/lib/useNisarCatalog'
import { browseCorners, type ImageCorners } from '@/lib/nisar'

// Renders the public NISAR browse image (LATLON PNG, georeferenced by its KML or by its footprint)
// of the selected scene directly on the map. No product download involved.
export function NisarImagery() {
  const { current: map } = useMap()
  const activeRegion = useApp((s) => s.activeRegion)
  const visible = useApp((s) => s.nisarVisible)
  const opacity = useApp((s) => s.nisarOpacity)
  const nasaOverlay = useApp((s) => s.nasaOverlay)
  const trueColorOverlay = useApp((s) => s.trueColorOverlay)
  const region = useMemo(() => REGIONS.find((r) => r.id === activeRegion)!, [activeRegion])
  const { scene, track, point } = useNisarSelection(region)
  const [shown, setShown] = useState<{ url: string; corners: ImageCorners } | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!scene?.browsePng) {
      setShown(null)
      return
    }
    const url = scene.browsePng
    browseCorners(scene).then((corners) => {
      if (cancelled || !corners) return
      // Decode the image first so the swap on the map is seamless while animating.
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = url
      img
        .decode()
        .catch(() => undefined)
        .then(() => {
          if (!cancelled) setShown({ url, corners })
        })
    })
    return () => {
      cancelled = true
    }
  }, [scene])

  // After the first image is on the map, warm the cache with the rest of the track,
  // one image at a time (each browse PNG is ~4 MB), so playback is smooth.
  const firstShown = shown !== null
  useEffect(() => {
    if (!track || !firstShown) return
    let cancelled = false
    ;(async () => {
      for (const s of track.scenes) {
        if (cancelled) return
        void browseCorners(s)
        if (!s.browsePng) continue
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = s.browsePng
        await img.decode().catch(() => undefined)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [track, firstShown])

  // Other layers (NASA GIBS, footprints) are re-added when the region or toggles change and would
  // land on top of the radar image; keep the NISAR image above them (below the detection polygons).
  useEffect(() => {
    const m = map?.getMap()
    if (!m || !shown) return
    const raise = () => {
      if (!m.getLayer('nisar-browse-layer')) return
      const ids = m.getStyle().layers.map((l) => l.id)
      const before = m.getLayer('nisar-point-halo')
        ? 'nisar-point-halo'
        : m.getLayer('yano-change-fill')
          ? 'yano-change-fill'
          : undefined
      const want = before ? ids.indexOf(before) - 1 : ids.length - 1
      // Only move when out of place: moveLayer itself fires 'styledata'.
      if (ids.indexOf('nisar-browse-layer') !== want) m.moveLayer('nisar-browse-layer', before)
    }
    const id = window.setTimeout(raise, 0)
    m.on('styledata', raise)
    return () => {
      window.clearTimeout(id)
      m.off('styledata', raise)
    }
  }, [map, shown, activeRegion, nasaOverlay, trueColorOverlay, point])

  const pointMarker = point && (
    <Source
      id="nisar-point"
      type="geojson"
      data={{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: point } }}
    >
      <Layer
        id="nisar-point-halo"
        type="circle"
        paint={{ 'circle-radius': 14, 'circle-color': 'hsl(190 95% 60%)', 'circle-opacity': 0.25 }}
      />
      <Layer
        id="nisar-point-dot"
        type="circle"
        paint={{
          'circle-radius': 5,
          'circle-color': 'hsl(190 95% 60%)',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1.5,
        }}
      />
    </Source>
  )

  const m = map?.getMap()
  // Above the coverage/footprint fills (which would wash out the radar image), below the detection polygons.
  const beforeId = m?.getLayer('yano-change-fill') ? 'yano-change-fill' : undefined
  // Only render the SAR raster after the user explicitly clicks a point on the map.
  const showRaster = visible && shown !== null && point !== null

  return (
    <>
      {showRaster && (
        <Source
          id="nisar-browse"
          type="image"
          url={shown.url}
          coordinates={shown.corners}
        >
          <Layer
            id="nisar-browse-layer"
            type="raster"
            beforeId={beforeId}
            paint={{ 'raster-opacity': opacity, 'raster-fade-duration': 0, 'raster-resampling': 'linear' }}
          />
        </Source>
      )}
      {pointMarker}
    </>
  )
}
