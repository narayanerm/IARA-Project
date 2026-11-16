import type { MapRef } from 'react-map-gl/maplibre'

// The live map instance, registered by SarMap so the export can grab what is on screen.
type MapInstance = ReturnType<MapRef['getMap']>

let current: MapInstance | null = null

export function setSnapshotMap(map: MapInstance | null) {
  current = map
}

export function getSnapshotMap(): MapInstance | null {
  return current
}

/**
 * Copies the WebGL canvas right after a frame is drawn (the drawing buffer is cleared afterwards),
 * so it works without preserveDrawingBuffer. Resolves null if no map is mounted.
 */
export function captureMapCanvas(timeoutMs = 4000): Promise<HTMLCanvasElement | null> {
  const map = current
  if (!map) return Promise.resolve(null)
  return new Promise((resolve) => {
    let settled = false
    const copy = () => {
      if (settled) return
      settled = true
      const src = map.getCanvas()
      const out = document.createElement('canvas')
      out.width = src.width
      out.height = src.height
      const g = out.getContext('2d')
      if (g) {
        // Areas with no tiles are transparent on the GL canvas; give them the app background.
        g.fillStyle = '#0b1210'
        g.fillRect(0, 0, out.width, out.height)
        g.drawImage(src, 0, 0)
      }
      resolve(out)
    }
    map.once('render', copy)
    map.triggerRepaint()
    setTimeout(copy, timeoutMs)
  })
}
