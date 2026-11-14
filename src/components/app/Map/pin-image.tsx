import { renderToStaticMarkup } from 'react-dom/server'
import { CommunityPin } from './CommunityPin'
import type { CommunityKind } from './community-kind'

// Rasterises a pin for MapLibre's sprite registry; pixelRatio keeps it crisp on HiDPI screens.
export function loadPinImage(kind: CommunityKind, cssSize: number, pixelRatio: number): Promise<HTMLImageElement> {
  const svg = renderToStaticMarkup(<CommunityPin kind={kind} size={cssSize * pixelRatio} />)
  return new Promise((resolve, reject) => {
    const img = new Image(cssSize * pixelRatio, cssSize * pixelRatio)
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}
