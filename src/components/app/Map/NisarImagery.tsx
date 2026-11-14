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
  const region = useMemo(() => REGIONS.find((r) => r.id === activeRegion)!, [activeRegion])
  const { scene, track } = useNisarSelection(region)
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

  if (!visible || !shown) return null

  const m = map?.getMap()
  // Above the coverage/footprint fills (which would wash out the radar image), below the detection polygons.
  const beforeId = m?.getLayer('yano-change-fill') ? 'yano-change-fill' : undefined

  return (
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
  )
}
