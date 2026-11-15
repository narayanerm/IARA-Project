import { Layer, Source } from 'react-map-gl/maplibre'
import { CASES } from '@/data/cases'
import { cropSize, type Bbox } from '@/lib/sarArchive'
import type { RegionId } from '@/lib/types'

/**
 * Cloud-free Sentinel-2 mosaic 2025 (EOX, 10 m) cropped to the case box, served as a 2×2 grid of
 * WMS images so each tile stays under the WMS 2048 px limit.
 *
 * Ported (simplified) from manaus-flood-case. The branch version also had a SAR mode toggled by
 * extra UI state (caseImagery/sarMapScene/opticalMapScene); here we only ship the satellite overlay
 * — main's BeforeAfter slider already handles the SAR before/after per case.
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

export interface CaseImageryLayerProps {
  activeRegion: RegionId
  visible: boolean
  /** Optional MapLibre layer id to insert all imagery layers before. */
  beforeId?: string
}

export function CaseImageryLayer({ activeRegion, visible, beforeId }: CaseImageryLayerProps) {
  const bbox = CASES[activeRegion].sarBbox

  if (!visible || !bbox) return null

  const images = satelliteTiles(bbox)

  return (
    <>
      {images.map((img, i) => (
        <Source
          key={img.url}
          id={`case-imagery-${activeRegion}-${i}`}
          type="image"
          url={img.url}
          coordinates={corners(img.box)}
        >
          <Layer
            id={`case-imagery-${activeRegion}-${i}-layer`}
            type="raster"
            beforeId={beforeId}
            paint={{ 'raster-fade-duration': 150 }}
          />
        </Source>
      ))}
    </>
  )
}
