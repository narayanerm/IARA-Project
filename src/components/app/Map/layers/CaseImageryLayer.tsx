import { useEffect } from 'react'
import { Layer, Source } from 'react-map-gl/maplibre'
import type { Feature, Polygon } from 'geojson'
import { CASES } from '@/data/cases'
import { cropSize, findOpticalScene, sceneImageUrl, useSarArchive, type Bbox } from '@/lib/sarArchive'
import { useUi } from '@/lib/store'
import type { RegionId } from '@/lib/types'

/**
 * Cloud-free Sentinel-2 mosaic 2025 (EOX, 10 m) for the case box, as a 2×2 grid of WMS images
 * (the WMS refuses images much larger than 2048 px, so one image would be too coarse).
 */
export function satelliteTiles(bbox: Bbox): Array<{ url: string; box: Bbox }> {
  const [w, s, e, n] = bbox
  const mx = (w + e) / 2
  const my = (s + n) / 2
  const boxes: Bbox[] = [
    [w, my, mx, n],
    [mx, my, e, n],
    [w, s, mx, my],
    [mx, s, e, my],
  ]
  return boxes.map((box) => {
    const { width, height } = cropSize(box, 2000)
    const q = new URLSearchParams({
      service: 'WMS',
      request: 'GetMap',
      version: '1.1.1',
      layers: 's2cloudless-2025',
      styles: '',
      srs: 'EPSG:4326',
      bbox: box.join(','),
      width: String(width),
      height: String(height),
      format: 'image/jpeg',
    })
    return { url: `https://tiles.maps.eox.at/wms?${q}`, box }
  })
}

const corners = ([w, s, e, n]: Bbox): [[number, number], [number, number], [number, number], [number, number]] => [
  [w, n],
  [e, n],
  [e, s],
  [w, s],
]

/**
 * Imagery limited to the case area (urban Manaus and its rivers): the recent satellite mosaic by
 * default, or the Sentinel-1 radar scene picked in the case panel. Outside the box the basemap stays as is.
 */
export function CaseImageryLayer({
  activeRegion,
  visible,
  beforeId,
}: {
  activeRegion: RegionId
  visible: boolean
  beforeId: string | undefined
}) {
  const mode = useUi((s) => s.caseImagery)
  const sar = useUi((s) => s.sarMapScene)
  const pickId = useUi((s) => s.sarMapPickId)
  const setSarMapScene = useUi((s) => s.setSarMapScene)
  const optical = useUi((s) => s.opticalMapScene)
  const setOpticalMapScene = useUi((s) => s.setOpticalMapScene)
  const bbox = CASES[activeRegion].sarCrop
  const { scenes } = useSarArchive(visible ? bbox : undefined)

  // Radar image for the map, ready before the user switches to SAR: the scene picked in the case
  // panel, or the latest NISAR scene (the challenge is about NISAR), else the latest scene.
  useEffect(() => {
    if (!bbox || !scenes.length) return
    const scene =
      scenes.find((s) => s.id === pickId) ??
      [...scenes].reverse().find((s) => s.mission === 'NISAR') ??
      scenes[scenes.length - 1]
    let cancelled = false
    sceneImageUrl(scene, bbox)
      .then((url) => {
        if (!cancelled) setSarMapScene({ url, date: scene.date, mission: scene.mission })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes, pickId, bbox?.join(','), setSarMapScene])

  // Satellite mode follows the radar date: the Sentinel-2 scene closest to it (yearly mosaic meanwhile).
  const sarDate = sar?.date
  useEffect(() => {
    if (!bbox || !sarDate) return
    let cancelled = false
    setOpticalMapScene(null)
    findOpticalScene(bbox, sarDate)
      .then((o) => {
        if (!cancelled) setOpticalMapScene(o ? { url: o.url, date: o.date, cloud: o.cloud } : null)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sarDate, bbox?.join(','), setOpticalMapScene])

  if (!visible || !bbox || !beforeId) return null

  const [w, s, e, n] = bbox
  const images =
    mode === 'sar'
      ? sar
        ? [{ url: sar.url, box: bbox }]
        : []
      : optical
        ? [{ url: optical.url, box: bbox }]
        : satelliteTiles(bbox)
  const outline: Feature<Polygon> = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
  }

  return (
    <>
      {images.map((img, i) => (
        <Source key={img.url} id={`case-imagery-${mode}-${i}-${images.length}`} type="image" url={img.url} coordinates={corners(img.box)}>
          <Layer
            id={`case-imagery-${mode}-${i}-${images.length}-layer`}
            type="raster"
            beforeId={beforeId}
            paint={{ 'raster-fade-duration': 150 }}
          />
        </Source>
      ))}
      <Source id="case-imagery-outline" type="geojson" data={outline}>
        <Layer
          id="case-imagery-outline-line"
          type="line"
          beforeId={beforeId}
          paint={{ 'line-color': '#5AA7C9', 'line-width': 1.5, 'line-opacity': 0.9 }}
        />
      </Source>
    </>
  )
}
