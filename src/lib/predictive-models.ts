export type ForecastPoint = [longitude: number, latitude: number]
export type FloodSignal = { point: ForecastPoint; color: string }

export type ForecastMapProps = {
  fireDate: string | null
  floodLayer: FloodLayer | null
  floodFocus: ForecastPoint | null
  floodSignals: FloodSignal[]
  riverPoint: ForecastPoint | null
  onRiverSelect?: (point: ForecastPoint) => void
  onFireTileError: () => void
  onFloodTileError: () => void
}

export const FLOOD_WMS = 'https://ows.globalfloods.eu/glofas-ows/ows.py'
export const FLOOD_LAYER = 'FloodSummary1_30'
export const FLOOD_EXTENT_LAYER = 'RapidFloodMapping'
export type FloodLayer = typeof FLOOD_LAYER | typeof FLOOD_EXTENT_LAYER
export const FLOOD_ATTRIBUTION = '© European Union · Copernicus EMS / GloFAS'
export const FLOOD_VIEWER = 'https://global-flood.emergency.copernicus.eu/'
export const floodLegend = (layer: FloodLayer) => `${FLOOD_WMS}?service=WMS&version=1.3.0&request=GetLegendGraphic&sld_version=1.1.0&layer=${layer}&format=image/png&STYLE=default`
export const floodTiles = (layer: FloodLayer, bbox = '{bbox-epsg-3857}') => `${FLOOD_WMS}?service=WMS&version=1.3.0&request=GetMap&layers=${layer}&styles=&crs=EPSG:3857&bbox=${bbox}&width=256&height=256&format=image/png&transparent=true&exceptions=XML`

export async function findRegionalFloodSignals(layer: FloodLayer, signal: AbortSignal): Promise<FloodSignal[]> {
  // Include neighboring parts of the basin so nearby flood signals are discoverable.
  const [west, south, east, north] = [-8240000, -1560000, -5030000, 615000]
  const response = await fetch(floodTiles(layer, [west, south, east, north].join(',')), { signal })
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/png')) {
    throw new Error('GloFAS regional preview unavailable')
  }
  const bitmap = await createImageBitmap(await response.blob())
  try {
    signal.throwIfAborted()
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not read the GloFAS preview')
    context.drawImage(bitmap, 0, 0)
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height)
    const samples = new Map<number, FloodSignal>()
    const gridSize = 8
    const columns = Math.ceil(bitmap.width / gridSize)
    const radius = 6378137
    for (let i = 0; i < bitmap.width * bitmap.height; i++) {
      if (data[i * 4 + 3] < 128) continue
      const column = i % bitmap.width
      const row = Math.floor(i / bitmap.width)
      const key = Math.floor(row / gridSize) * columns + Math.floor(column / gridSize)
      if (samples.has(key)) continue
      const x = west + ((column + 0.5) / bitmap.width) * (east - west)
      const y = north - ((row + 0.5) / bitmap.height) * (north - south)
      const [r, g, b] = data.subarray(i * 4, i * 4 + 3)
      samples.set(key, {
        point: [x / radius * 180 / Math.PI, Math.atan(Math.sinh(y / radius)) * 180 / Math.PI],
        color: `rgb(${r}, ${g}, ${b})`,
      })
    }
    return [...samples.values()].sort((a, b) =>
      Math.hypot(a.point[0] + 60, a.point[1] + 4) - Math.hypot(b.point[0] + 60, b.point[1] + 4))
  } finally {
    bitmap.close()
  }
}

export const GWIS_VIEWER = 'https://gwis.jrc.ec.europa.eu/apps/gwis_current_situation/index.html'
const GWIS_WMS = 'https://maps.effis.emergency.copernicus.eu/gwis'
const FIRE_LAYER = 'nasa_geos5.fwi'
export const GWIS_ATTRIBUTION = '© European Union · Copernicus EMS / GWIS · NASA GEOS-5'
export const GWIS_LEGEND = `${GWIS_WMS}?language=eng&version=1.3.0&service=WMS&request=GetLegendGraphic&sld_version=1.1.0&layer=${FIRE_LAYER}&format=image/png&STYLE=default`
export const GEOGLOWS_VIEWER = 'https://geoglows.ecmwf.int/'
const GEOGLOWS_API = `${GEOGLOWS_VIEWER}api/v2`

export function gwisMapUrl(date: string, bbox: string) {
  return `${GWIS_WMS}?service=WMS&version=1.1.1&request=GetMap&layers=${FIRE_LAYER}&styles=default&srs=EPSG:3857&bbox=${bbox}&width=256&height=256&format=image/png&transparent=true&time=${date}`
}

export function gwisDates() {
  const today = new Date()
  return Array.from({ length: 6 }, (_, offset) =>
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + offset))
      .toISOString().slice(0, 10)
  )
}

export type FlowForecast = {
  riverId: number
  days: { date: string; median: number; lower: number; upper: number }[]
}

export async function fetchFlowForecast([longitude, latitude]: ForecastPoint, signal: AbortSignal): Promise<FlowForecast | null> {
  const lon = ((longitude + 180) % 360 + 360) % 360 - 180
  const reach = await fetch(`${GEOGLOWS_API}/getriverid?lat=${latitude.toFixed(5)}&lon=${lon.toFixed(5)}`, { signal })
  if (reach.status === 404) return null
  if (!reach.ok) throw new Error(`GEOGLOWS reach lookup: ${reach.status}`)
  const { river_id: riverId } = await reach.json()
  if (riverId == null || riverId === 0 || riverId === -1) return null
  if (!Number.isSafeInteger(riverId) || riverId < 1) throw new Error('Invalid GEOGLOWS reach ID')

  const response = await fetch(`${GEOGLOWS_API}/ForecastStats/${riverId}?format=csv`, { signal })
  if (!response.ok) throw new Error(`GEOGLOWS forecast: ${response.status}`)
  const [header, ...rows] = (await response.text()).trim().split(/\r?\n/)
  const columns = header.split(',')
  const indexes = ['datetime', 'flow_med', 'flow_25p', 'flow_75p'].map((column) => columns.indexOf(column))
  if (indexes.includes(-1)) throw new Error('Missing GEOGLOWS forecast columns')

  const days: FlowForecast['days'] = []
  const today = new Date().toISOString().slice(0, 10)
  for (const row of rows) {
    const cells = row.split(',')
    const [time, median, lower, upper] = indexes.map((index) => cells[index])
    if (!time || time.slice(0, 10) < today || time.slice(11, 16) !== '00:00' || !/^\d{4}-\d{2}-\d{2}T/.test(time)) continue
    if (![median, lower, upper].every((value) => value?.trim() && Number.isFinite(Number(value)))) continue
    days.push({ date: time.slice(0, 10), median: Number(median), lower: Number(lower), upper: Number(upper) })
  }
  return { riverId, days }
}
