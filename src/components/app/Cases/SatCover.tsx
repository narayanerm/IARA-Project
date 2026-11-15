import { memo } from 'react'
import { SATELLITE_TILES } from '../Map/constants'

function tileXY(lon: number, lat: number, z: number): [number, number] {
  const n = 2 ** z
  const r = (lat * Math.PI) / 180
  return [((lon + 180) / 360) * n, ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n]
}

/**
 * High-resolution still of a place, stitched from the same Sentinel-2 cloudless tiles as the map.
 * The NxN mosaic is sized from its container (container query units) so it always covers it, with
 * the requested point kept at the centre. With the default 6x6 grid each 256 px tile lands at
 * roughly 130-150 CSS px in the picker window, so the picture stays sharp on 2x screens.
 */
export const SatCover = memo(function SatCover({
  center,
  zoom,
  grid = 6,
  className,
}: {
  center: [number, number]
  zoom: number
  grid?: number
  className?: string
}) {
  const [tx, ty] = tileXY(center[0], center[1], zoom)
  const x0 = Math.round(tx) - grid / 2
  const y0 = Math.round(ty) - grid / 2
  const fx = (tx - x0) / grid
  const fy = (ty - y0) / grid
  const size = `calc(${100 / grid}% + 0.6px)`
  const tiles = []
  for (let j = 0; j < grid; j++) {
    for (let i = 0; i < grid; i++) {
      const url = SATELLITE_TILES.replace('{z}', String(zoom))
        .replace('{x}', String(x0 + i))
        .replace('{y}', String(y0 + j))
      tiles.push(
        <img
          key={`${i}-${j}`}
          src={url}
          alt=""
          draggable={false}
          decoding="async"
          onLoad={(e) => e.currentTarget.classList.add('is-loaded')}
          style={{ left: `${(i * 100) / grid}%`, top: `${(j * 100) / grid}%`, width: size, height: size }}
        />
      )
    }
  }
  return (
    <div className={className} aria-hidden="true">
      <div className="sat-cover" style={{ translate: `${-fx * 100}% ${-fy * 100}%` }}>
        {tiles}
      </div>
    </div>
  )
})
