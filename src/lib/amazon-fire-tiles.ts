import { AMAZON_BIOME } from '@/data/layers/indigenous-lands'
import { gwisMapUrl } from '@/lib/predictive-models'

const SIZE = 256
const HALF_WORLD = 20037508.342789244
const polygons = AMAZON_BIOME.features.flatMap(({ geometry }) => {
  if (geometry.type === 'Polygon') return [geometry.coordinates]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates
  return []
}).map((polygon) => polygon.map((ring) => ring.map(([lon, lat]) => {
  const sin = Math.sin(lat * Math.PI / 180)
  return [(lon + 180) / 360, 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)]
})))
const vertices = polygons.flat(2)
const west = Math.min(...vertices.map(([x]) => x))
const east = Math.max(...vertices.map(([x]) => x))
const north = Math.min(...vertices.map(([, y]) => y))
const south = Math.max(...vertices.map(([, y]) => y))

export async function drawAmazonFireTile(
  canvas: HTMLCanvasElement,
  date: string,
  { x, y, z }: { x: number; y: number; z: number },
  signal: AbortSignal,
) {
  canvas.width = canvas.height = SIZE
  const scale = 2 ** z
  if ((x + 1) / scale < west || x / scale > east || (y + 1) / scale < north || y / scale > south) return

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create the fire tile canvas')
  const path = new Path2D()
  for (const polygon of polygons) {
    for (const ring of polygon) {
      ring.forEach(([worldX, worldY], index) => {
        const px = (worldX * scale - x) * SIZE
        const py = (worldY * scale - y) * SIZE
        if (index === 0) path.moveTo(px, py)
        else path.lineTo(px, py)
      })
      path.closePath()
    }
  }

  const span = 2 * HALF_WORLD / scale
  const left = x * span - HALF_WORLD
  const top = HALF_WORLD - y * span
  const response = await fetch(gwisMapUrl(date, [left, top - span, left + span, top].join(',')), { signal })
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/png')) {
    throw new Error('GWIS fire forecast image unavailable')
  }
  const bitmap = await createImageBitmap(await response.blob())
  try {
    signal.throwIfAborted()
    context.clip(path, 'evenodd')
    context.drawImage(bitmap, 0, 0, SIZE, SIZE)
  } finally {
    bitmap.close()
  }
}
