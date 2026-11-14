import { memo } from 'react'
import { SATELLITE_TILES } from '../Map/constants'

const N = 4

function tileXY(lon: number, lat: number, z: number): [number, number] {
  const n = 2 ** z
  const r = (lat * Math.PI) / 180
  return [((lon + 180) / 360) * n, ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n]
}

/**
 * High-resolution still of a place, stitched from the same Sentinel-2 cloudless tiles as the map.
 * The 4x4 mosaic is sized from the card (container query units) so it always covers it, with the
 * requested point kept at the centre whatever the card's shape.
 */
export const SatCover = memo(function SatCover({
  center,
  zoom,
  className,
}: {
  center: [number, number]
  zoom: number
  className?: string
}) {
  const [tx, ty] = tileXY(center[0], center[1], zoom)
  const x0 = Math.round(tx) - N / 2
  const y0 = Math.round(ty) - N / 2
  const fx = (tx - x0) / N
  const fy = (ty - y0) / N
  const tiles = []
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
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
          style={{ left: `${(i * 100) / N}%`, top: `${(j * 100) / N}%` }}
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
