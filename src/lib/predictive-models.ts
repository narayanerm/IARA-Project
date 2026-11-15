import { inAmazon } from '@/lib/amazon'

export type ForecastPoint = [longitude: number, latitude: number]
export type ForecastBounds = [west: number, south: number, east: number, north: number]

export function pointInForecastBounds([lon, lat]: ForecastPoint, [west, south, east, north]: ForecastBounds) {
  return lon >= west && lon <= east && lat >= south && lat <= north && inAmazon(lon, lat)
}
const RIVER_PREVIEW_POINTS: { name: string; point: ForecastPoint }[] = [
  { name: 'Rio Negro · Manaus', point: [-59.98, -3.15] },
  { name: 'Solimões · Tefé', point: [-64.72, -3.35] },
  { name: 'Amazonas · Santarém', point: [-54.72, -2.38] },
  { name: 'Amazonas · Itacoatiara', point: [-58.46, -3.15] },
  { name: 'Amazonas · Parintins', point: [-56.74, -2.62] },
  { name: 'Amazonas · Óbidos', point: [-55.52, -1.94] },
]
export const AMAZON_RIVER_SITES = RIVER_PREVIEW_POINTS.filter(({ point }) => inAmazon(...point))
export const AMAZON_RIVER_PREVIEWS = AMAZON_RIVER_SITES.map(({ point }) => point)
export type GlofasSignal = {
  layer: FloodLayer
  color: string
  band?: { threshold: number; range: string }
}
export type FloodSignal = { point: ForecastPoint; color: string; glofas?: GlofasSignal }
export type FloodChance = number | GlofasSignal | 'loading' | 'unavailable' | null

// Swatches from the GloFAS FloodSummary1_30 WMS legend, ordered by exceedance band.
export const GLOFAS_SWATCHES = [
  { threshold: 2, colors: [[255, 255, 193], [255, 255, 139], [255, 254, 0]] },
  { threshold: 5, colors: [[255, 115, 115], [255, 67, 67], [230, 0, 0]] },
  { threshold: 20, colors: [[225, 117, 255], [212, 55, 255], [168, 0, 214]] },
]
const GLOFAS_RANGES = ['30–50%', '50–75%', '75–100%']

export function glofasProbabilityBand(r: number, g: number, b: number): GlofasSignal['band'] {
  let match: GlofasSignal['band']
  let minDistance = 30
  for (const { threshold, colors } of GLOFAS_SWATCHES) {
    colors.forEach(([red, green, blue], index) => {
      const distance = Math.hypot(r - red, g - green, b - blue)
      if (distance >= minDistance) return
      minDistance = distance
      match = { threshold, range: GLOFAS_RANGES[index] }
    })
  }
  return match
}

export function floodChanceColor(chance: FloodChance) {
  if (typeof chance === 'number') return `hsl(${120 * (1 - chance / 100)} 76% 60%)`
  return chance && typeof chance === 'object' ? chance.color : undefined
}

export type ForecastMapProps = {
  fireDate: string | null
  floodLayer: WaterLayer | null
  observedDate: string
  floodFocus: ForecastPoint | null
  floodSignals: FloodSignal[]
  riverPoint: ForecastPoint | null
  riverChance: FloodChance
  onRiverSelect?: (point: ForecastPoint) => void
  onFireTileError: () => void
  onFloodTileError: () => void
}

export const FLOOD_WMS = 'https://ows.globalfloods.eu/glofas-ows/ows.py'
export const FLOOD_LAYER = 'FloodSummary1_30'
export const FLOOD_EXTENT_LAYER = 'RapidFloodMapping'
export type FloodLayer = typeof FLOOD_LAYER | typeof FLOOD_EXTENT_LAYER
export const SUBSEASONAL_RIVERS = 'SubSeasonalOutlookRivers'
export const SEASONAL_BASINS = 'SeasonalOutlookBasins'
export const MODIS_FLOOD = 'MODIS_Combined_Flood_3-Day'
export const VIIRS_FLOOD = 'VIIRS_Combined_Flood_3-Day'
export type ObservedFloodLayer = typeof MODIS_FLOOD | typeof VIIRS_FLOOD
export type OutlookLayer = typeof SUBSEASONAL_RIVERS | typeof SEASONAL_BASINS
export type WaterLayer = FloodLayer | OutlookLayer | ObservedFloodLayer
export const NASA_FLOOD_ATTRIBUTION = 'NASA EOSDIS · GIBS'
export const NASA_FLOOD_VIEWER = 'https://worldview.earthdata.nasa.gov/?tr=flood-product'
export const isFloodLayer = (layer: WaterLayer): layer is FloodLayer => layer === FLOOD_LAYER || layer === FLOOD_EXTENT_LAYER
export const isObservedFlood = (layer: WaterLayer): layer is ObservedFloodLayer => layer === MODIS_FLOOD || layer === VIIRS_FLOOD
export const observedFloodStart = (layer: WaterLayer) => layer === VIIRS_FLOOD ? '2025-06-01' : '2021-01-01'
export const FLOOD_ATTRIBUTION = '© European Union · Copernicus EMS / GloFAS'
export const FLOOD_VIEWER = 'https://global-flood.emergency.copernicus.eu/'
export const floodTiles = (layer: FloodLayer | OutlookLayer, bbox = '{bbox}') => `${FLOOD_WMS}?service=WMS&version=1.3.0&request=GetMap&layers=${layer}&styles=&crs=EPSG:3857&bbox=${bbox}&width=256&height=256&format=image/png&transparent=true&exceptions=XML`

export function waterTileTemplate(layer: WaterLayer, date: string) {
  return isObservedFlood(layer)
    ? `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`
    : floodTiles(layer)
}

export async function findRegionalFloodSignals(layer: FloodLayer, bounds: ForecastBounds, signal: AbortSignal): Promise<FloodSignal[]> {
  const radius = 6378137
  const projectLon = (lon: number) => lon * Math.PI / 180 * radius
  const projectLat = (lat: number) => Math.asinh(Math.tan(lat * Math.PI / 180)) * radius
  const [west, south, east, north] = [projectLon(bounds[0]), projectLat(bounds[1]), projectLon(bounds[2]), projectLat(bounds[3])]
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
    for (let i = 0; i < bitmap.width * bitmap.height; i++) {
      if (data[i * 4 + 3] < 128) continue
      const column = i % bitmap.width
      const row = Math.floor(i / bitmap.width)
      const key = Math.floor(row / gridSize) * columns + Math.floor(column / gridSize)
      if (samples.has(key)) continue
      const x = west + ((column + 0.5) / bitmap.width) * (east - west)
      const y = north - ((row + 0.5) / bitmap.height) * (north - south)
      const lon = x / radius * 180 / Math.PI
      const lat = Math.atan(Math.sinh(y / radius)) * 180 / Math.PI
      if (!pointInForecastBounds([lon, lat], bounds)) continue
      const [r, g, b] = data.subarray(i * 4, i * 4 + 3)
      const color = `rgb(${r}, ${g}, ${b})`
      samples.set(key, {
        point: [lon, lat],
        color,
        glofas: { layer, color, band: layer === FLOOD_LAYER ? glofasProbabilityBand(r, g, b) : undefined },
      })
    }
    const center = [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2]
    return [...samples.values()].sort((a, b) =>
      Math.hypot(a.point[0] - center[0], a.point[1] - center[1]) - Math.hypot(b.point[0] - center[0], b.point[1] - center[1]))
  } finally {
    bitmap.close()
  }
}

export const GWIS_VIEWER = 'https://gwis.jrc.ec.europa.eu/apps/gwis_current_situation/index.html'
const GWIS_WMS = 'https://maps.effis.emergency.copernicus.eu/gwis'
const FIRE_LAYER = 'nasa_geos5.fwi'
export const GWIS_ATTRIBUTION = '© European Union · Copernicus EMS / GWIS · NASA GEOS-5'
export const GEOGLOWS_VIEWER = 'https://geoglows.ecmwf.int/'
const GEOGLOWS_API = `${GEOGLOWS_VIEWER}api/v2`
const DAY_MS = 86_400_000

export async function fetchFloodChance(riverId: number, signal: AbortSignal): Promise<number | 'unavailable'> {
  const [history, forecast] = await Promise.all([
    fetch(`${GEOGLOWS_API}/RetrospectiveDaily/${riverId}?format=csv`, { signal }),
    fetch(`${GEOGLOWS_API}/ForecastEnsembles/${riverId}?format=csv`, { signal }),
  ])
  if (!history.ok || !forecast.ok) return 'unavailable'
  const [historyCsv, forecastCsv] = await Promise.all([history.text(), forecast.text()])

  // The median of historical annual maxima estimates the 2-year daily high-flow threshold.
  const annual = new Map<string, { days: number; max: number }>()
  const today = Math.floor(Date.now() / DAY_MS) * DAY_MS
  const currentYear = new Date(today).getUTCFullYear()
  for (const row of historyCsv.trim().split(/\r?\n/).slice(1)) {
    const [date, value] = row.split(',')
    const year = date.slice(0, 4)
    if (!/^\d{4}-\d{2}-\d{2}/.test(date) || Number(year) >= currentYear || !value?.trim() || !Number.isFinite(Number(value))) continue
    const record = annual.get(year) ?? { days: 0, max: 0 }
    record.days++
    record.max = Math.max(record.max, Number(value))
    annual.set(year, record)
  }
  const maxima = [...annual.values()].filter(({ days }) => days >= 365).map(({ max }) => max).sort((a, b) => a - b)
  if (maxima.length < 10) return 'unavailable'
  const middle = Math.floor(maxima.length / 2)
  const threshold = (maxima[middle] + maxima[Math.floor((maxima.length - 1) / 2)]) / 2
  if (threshold <= 0) return 'unavailable'

  const [header, ...rows] = forecastCsv.trim().split(/\r?\n/)
  // The 52nd column is the high-resolution run and does not enter the ensemble probability.
  const indexes = header.split(',').flatMap((column, index) => /^ensemble_(0[1-9]|[1-4]\d|5[01])$/.test(column) ? [index] : [])
  if (indexes.length !== 51) return 'unavailable'
  const days = Array.from({ length: 7 }, () => indexes.map(() => ({ samples: 0, sum: 0 })))
  for (const row of rows) {
    const cells = row.split(',')
    const day = Math.floor((Date.parse(cells[0]) - today) / DAY_MS)
    if (!days[day]) continue
    indexes.forEach((index, member) => {
      const value = cells[index]
      if (!value?.trim() || !Number.isFinite(Number(value))) return
      const flow = days[day][member]
      flow.samples++
      flow.sum += Number(value)
    })
  }
  if (days.some((day) => day.some(({ samples }) => samples < 8))) return 'unavailable'
  const exceeded = indexes.filter((_, member) => days.some((day) => day[member].sum / day[member].samples > threshold))
  return Math.round(exceeded.length / indexes.length * 100)
}

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

export type SavedFloodForecast = {
  name: string
  point: ForecastPoint
  flow: FlowForecast
  chance: number
}

export type FloodForecastSnapshot = {
  generatedAt: string
  forecasts: SavedFloodForecast[]
}

export async function loadFloodForecastSnapshot(signal: AbortSignal): Promise<FloodForecastSnapshot | null> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/flood-forecasts.json`, { signal, cache: 'no-cache' })
    if (!response.ok) return null
    const snapshot: FloodForecastSnapshot = await response.json()
    const now = new Date().toISOString()
    if (typeof snapshot.generatedAt !== 'string' || snapshot.generatedAt > now
      || snapshot.generatedAt.slice(0, 10) !== now.slice(0, 10) || !Array.isArray(snapshot.forecasts)) return null
    return snapshot
  } catch {
    return null
  }
}

export async function findForecastReach([longitude, latitude]: ForecastPoint, signal: AbortSignal): Promise<number | null> {
  const lon = ((longitude + 180) % 360 + 360) % 360 - 180
  const reach = await fetch(`${GEOGLOWS_API}/getriverid?lat=${latitude.toFixed(5)}&lon=${lon.toFixed(5)}`, { signal })
  if (reach.status === 404) return null
  if (!reach.ok) throw new Error(`GEOGLOWS reach lookup: ${reach.status}`)
  const { river_id: riverId } = await reach.json()
  if (riverId == null || riverId === 0 || riverId === -1) return null
  if (!Number.isSafeInteger(riverId) || riverId < 1) throw new Error('Invalid GEOGLOWS reach ID')
  return riverId
}

export async function fetchFlowForecast(riverId: number, signal: AbortSignal): Promise<FlowForecast> {
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
