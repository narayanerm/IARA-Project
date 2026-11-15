import { useRef, useState } from 'react'
import type { OpticalScene } from '@/data/cases'

type Bbox = [number, number, number, number]

const PC = 'https://planetarycomputer.microsoft.com/api/data/v1/item/bbox'
const LANDSAT =
  'assets=red&assets=green&assets=blue&nodata=0&color_formula=' +
  encodeURIComponent('gamma RGB 2.7, saturation 1.5, sigmoidal RGB 15 0.55')
const SENTINEL2 = 'assets=visual&asset_bidx=visual%7C1%2C2%2C3&nodata=0'

/** True-colour crop of one scene, north-up and cut to exactly the case box (Planetary Computer). */
export function opticalUrl(scene: OpticalScene, bbox: Bbox, width = 1400): string {
  const height = Math.round((width * (bbox[3] - bbox[1])) / (bbox[2] - bbox[0]))
  const landsat = scene.collection === 'landsat-c2-l2'
  return `${PC}/${bbox.join(',')}/${width}x${height}.${landsat ? 'png' : 'jpg'}?collection=${scene.collection}&item=${scene.id}&${landsat ? LANDSAT : SENTINEL2}`
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

/** Before/after slider of two visible-light scenes over the same box, so they overlay exactly. */
export function OpticalCompare({ before, after, bbox }: { before: OpticalScene; after: OpticalScene; bbox: Bbox }) {
  const [pos, setPos] = useState(50)
  const [drag, setDrag] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const move = (x: number) => {
    const r = ref.current?.getBoundingClientRect()
    if (r) setPos(Math.max(2, Math.min(98, ((x - r.left) / r.width) * 100)))
  }

  return (
    <div
      ref={ref}
      className="relative w-full select-none overflow-hidden rounded-lg border border-border/60 bg-black"
      style={{ aspectRatio: `${bbox[2] - bbox[0]} / ${bbox[3] - bbox[1]}`, cursor: 'ew-resize' }}
      onMouseDown={(e) => {
        setDrag(true)
        move(e.clientX)
      }}
      onMouseMove={(e) => drag && move(e.clientX)}
      onMouseUp={() => setDrag(false)}
      onMouseLeave={() => setDrag(false)}
      onTouchMove={(e) => move(e.touches[0].clientX)}
    >
      <img src={opticalUrl(after, bbox)} alt="" draggable={false} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={opticalUrl(before, bbox)} alt="" draggable={false} className="absolute inset-0 h-full w-full" />
      </div>
      <div className="absolute inset-y-0 w-0.5 bg-white/90" style={{ left: `${pos}%` }} />
      <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 font-mono text-[11px] text-white">
        ANTES · {fmtDate(before.date)}
      </span>
      <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 font-mono text-[11px] text-white">
        DEPOIS · {fmtDate(after.date)}
      </span>
    </div>
  )
}
