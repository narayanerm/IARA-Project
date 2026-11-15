import { useEffect, useState } from 'react'
import { Layer, Source } from 'react-map-gl/maplibre'
import type { FeatureCollection } from 'geojson'
import { useApp, useUi } from '@/lib/store'
import type { RegionId } from '@/lib/types'

/**
 * Case-scoped SAR overlays. For every case we ship pre-built mosaics for three
 * bands (NISAR L, NISAR S, Sentinel-1 C) and the user toggles one at a time via
 * `useUi.yanomamiBand`.
 *
 * YANO (garimpo) additionally gets two ground-truth overlays that stack on any
 * band: RADD alerts (Wageningen/GFW, S1-derived) and DETER mineração (INPE).
 */

type Bbox4 = [number, number, number, number]

interface BandSpec {
  url: string
  bbox: Bbox4
}

// Mosaic bboxes ship in the .meta.json / .bounds.json alongside each PNG.
// Kept inline so the layer renders without a fetch round-trip.
const MOSAICS: Record<RegionId, Record<'nisar' | 'sband' | 's1c', BandSpec>> = {
  YANO: {
    nisar: { url: '/analysis/data/yanomami-nisar-mosaic.png', bbox: [-66.6269, -0.4732, -61.1829, 4.4272] },
    sband: { url: '/analysis/data/yanomami-nisar-sband-mosaic.png', bbox: [-66.6269, -0.4732, -61.1829, 4.4272] },
    s1c: { url: '/analysis/data/sentinel1-yanomami-mosaic.png', bbox: [-66.5, -0.5, -61.0, 4.5] },
  },
  ENCH: {
    nisar: { url: '/analysis/data/manaus-nisar-mosaic.png', bbox: [-60.4, -3.4, -59.5, -2.8] },
    sband: { url: '/analysis/data/manaus-nisar-sband-mosaic.png', bbox: [-60.4, -3.4, -59.5, -2.8] },
    s1c: { url: '/analysis/data/sentinel1-manaus-mosaic.png', bbox: [-60.4, -3.4, -59.5, -2.8] },
  },
  SECA: {
    nisar: { url: '/analysis/data/manaquiri-nisar-mosaic.png', bbox: [-60.7, -3.7, -60.1, -3.2] },
    sband: { url: '/analysis/data/manaquiri-nisar-sband-mosaic.png', bbox: [-60.7, -3.7, -60.1, -3.2] },
    s1c: { url: '/analysis/data/sentinel1-manaquiri-mosaic.png', bbox: [-60.7, -3.7, -60.1, -3.2] },
  },
}

// Pin to a published version instead of `latest` to skip the CloudFront Lambda that
// resolves the alias (adds 307 + ~2-3 s cold start). Bump periodically.
const RADD_VERSION = 'v20261108'
const RADD_TILE =
  `https://tiles.globalforestwatch.org/wur_radd_alerts/${RADD_VERSION}/dynamic/{z}/{x}/{y}.png` +
  '?start_date=2020-01-01&end_date=2026-11-15'

const DETER_URL = '/analysis/data/deter-mineracao-regional-2019-2026.geojson'

function corners([w, s, e, n]: Bbox4): [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] {
  return [
    [w, n],
    [e, n],
    [e, s],
    [w, s],
  ]
}

export function YanomamiCaseLayers({ beforeId }: { beforeId?: string }) {
  const activeRegion = useApp((s) => s.activeRegion)
  const band = useUi((s) => s.yanomamiBand)
  const raddOn = useUi((s) => s.yanomamiRaddOn)
  const deterOn = useUi((s) => s.yanomamiDeterOn)
  const [deter, setDeter] = useState<FeatureCollection | null>(null)

  useEffect(() => {
    if (activeRegion !== 'YANO' || !deterOn || deter) return
    let cancelled = false
    fetch(DETER_URL)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setDeter(j as FeatureCollection)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [activeRegion, deterOn, deter])

  const imageBand = band ? MOSAICS[activeRegion][band] : null
  // RADD and DETER are garimpo-specific — only render in YANO case.
  const showGarimpoOverlays = activeRegion === 'YANO'

  return (
    <>
      {imageBand && (
        <Source
          key={`${activeRegion}-${band}`}
          id={`case-band-${activeRegion}-${band}`}
          type="image"
          url={imageBand.url}
          coordinates={corners(imageBand.bbox)}
        >
          <Layer
            id={`case-band-${activeRegion}-${band}-layer`}
            type="raster"
            beforeId={beforeId}
            paint={{ 'raster-opacity': 0.9, 'raster-fade-duration': 150 }}
          />
        </Source>
      )}

      {showGarimpoOverlays && raddOn && (
        <Source id="yano-radd" type="raster" tiles={[RADD_TILE]} tileSize={256} maxzoom={14}>
          <Layer
            id="yano-radd-layer"
            type="raster"
            beforeId={beforeId}
            // RADD tiles come pink: turn them red, like the alerts in the case timeline.
            paint={{
              'raster-opacity': 0.9,
              'raster-fade-duration': 0,
              'raster-hue-rotate': 38,
              'raster-saturation': 1,
              'raster-contrast': 0.4,
              'raster-brightness-max': 0.85,
            }}
          />
        </Source>
      )}

      {showGarimpoOverlays && deterOn && deter && (
        <Source id="yano-deter-mineracao" type="geojson" data={deter}>
          <Layer
            id="yano-deter-mineracao-fill"
            type="fill"
            beforeId={beforeId}
            paint={{ 'fill-color': '#F07A45', 'fill-opacity': 0.75, 'fill-outline-color': '#ffffff' }}
          />
          <Layer
            id="yano-deter-mineracao-outline"
            type="line"
            beforeId={beforeId}
            paint={{ 'line-color': '#ffffff', 'line-width': 0.6, 'line-opacity': 0.9 }}
          />
        </Source>
      )}
    </>
  )
}
