import { AMAZON_BIOME } from '@/data/layers/indigenous-lands'

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

export async function drawAmazonForecastTile(
  canvas: HTMLCanvasElement,
  urlTemplate: string,
  { x, y, z }: { x: number; y: number; z: number },
  signal: AbortSignal,
  hideInsufficientData = false,
) {
  canvas.width = canvas.height = SIZE
  const scale = 2 ** z
  if ((x + 1) / scale < west || x / scale > east || (y + 1) / scale < north || y / scale > south) return

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create the forecast tile canvas')
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
  const url = urlTemplate.replace('{bbox}', [left, top - span, left + span, top].join(','))
    .replace('{x}', String(x)).replace('{y}', String(y)).replace('{z}', String(z))
  const response = await fetch(url, { signal })
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/png')) {
    throw new Error('Forecast image unavailable')
  }
  const bitmap = await createImageBitmap(await response.blob())
  try {
    signal.throwIfAborted()
    context.clip(path, 'evenodd')
    context.drawImage(bitmap, 0, 0, SIZE, SIZE)
    if (hideInsufficientData) {
      // NASA GIBS MODIS_Flood palette: source class 255 is RGB 175/175/175.
      const image = context.getImageData(0, 0, SIZE, SIZE)
      const { data } = image
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === 175 && data[i + 1] === 175 && data[i + 2] === 175) data[i + 3] = 0
      }
      context.putImageData(image, 0, 0)
    }
  } finally {
    bitmap.close()
  }
}
