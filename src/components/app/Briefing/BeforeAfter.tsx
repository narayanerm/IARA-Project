import { useRef, useState } from 'react'
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type { AffectedAreaProps } from '@/data/layers/affected-areas'
import { useT } from '@/lib/i18n'

type Bbox = [number, number, number, number]

interface Props {
  beforeUrl: string
  afterUrl: string
  beforeLabel: string
  afterLabel: string
  // Each side has its own image bbox (may differ for SAR granules on different orbits).
  beforeBbox: Bbox
  afterBbox: Bbox
  // Affected-area polygons overlay on both frames (projected to the per-frame bbox).
  affected?: FeatureCollection<Polygon, AffectedAreaProps>
}

export function BeforeAfter({
  beforeUrl,
  afterUrl,
  beforeLabel,
  afterLabel,
  beforeBbox,
  afterBbox,
  affected,
}: Props) {
  const t = useT()
  const [pos, setPos] = useState(50)
  const [dragging, setDragging] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const onMove = (clientX: number) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const p = ((clientX - rect.left) / rect.width) * 100
    setPos(Math.max(2, Math.min(98, p)))
  }

  return (
    <div
      ref={ref}
      className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-black border border-border/60 select-none"
      onMouseMove={(e) => dragging && onMove(e.clientX)}
      onMouseUp={() => setDragging(false)}
      onMouseLeave={() => setDragging(false)}
      onTouchMove={(e) => onMove(e.touches[0].clientX)}
    >
      <Frame url={afterUrl} bbox={afterBbox} affected={affected} className="absolute inset-0" />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <Frame url={beforeUrl} bbox={beforeBbox} affected={affected} className="absolute inset-0" />
      </div>

      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 text-white text-[11px] font-mono backdrop-blur-sm z-10">
        {t('sar.before').toUpperCase()} · {beforeLabel}
      </span>
      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/70 text-white text-[11px] font-mono backdrop-blur-sm z-10">
        {t('sar.after').toUpperCase()} · {afterLabel}
      </span>

      <div
        className="absolute top-0 bottom-0 w-[2px] bg-white/90 pointer-events-none shadow-[0_0_8px_rgba(255,255,255,0.6)] z-10"
        style={{ left: `calc(${pos}% - 1px)` }}
      />
      <button
        onMouseDown={() => setDragging(true)}
        onTouchStart={() => setDragging(true)}
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 grid place-items-center h-10 w-10 rounded-full bg-white shadow-lg cursor-ew-resize hover:scale-110 transition-transform z-10"
        style={{ left: `${pos}%` }}
        aria-label={t('sar.dragAria')}
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-black" fill="none">
          <path d="M8 6L4 12L8 18M16 6L20 12L16 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] font-mono text-white/80 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5 z-10">
        {t('sar.drag')}
      </div>
    </div>
  )
}

function Frame({
  url,
  bbox,
  affected,
  className,
}: {
  url: string
  bbox: Bbox
  affected?: FeatureCollection<Polygon, AffectedAreaProps>
  className?: string
}) {
  const [minLon, minLat, maxLon, maxLat] = bbox
  const vbW = 1000
  const vbH = Math.max(300, Math.round((vbW * (maxLat - minLat)) / (maxLon - minLon || 0.001)))

  const project = ([lon, lat]: number[]): [number, number] => {
    const x = ((lon - minLon) / (maxLon - minLon)) * vbW
    const y = vbH - ((lat - minLat) / (maxLat - minLat)) * vbH
    return [x, y]
  }

  const colorFor = (kind: AffectedAreaProps['kind']): string => {
    switch (kind) {
      case 'mining':
        return 'hsl(0 95% 55%)'
      case 'flood':
        return 'hsl(210 95% 65%)'
      case 'drought-shrink':
        return 'hsl(38 95% 60%)'
      case 'drought-original':
        return 'hsl(200 70% 65%)'
    }
  }

  const path = (f: Feature<Polygon, AffectedAreaProps>): string =>
    f.geometry.coordinates[0]
      .map((pt, i) => {
        const [x, y] = project(pt)
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ') + ' Z'

  return (
    <div className={className}>
      <img
        src={url}
        alt=""
        draggable={false}
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
      />
      {affected && (
        <svg
          viewBox={`0 0 ${vbW} ${vbH}`}
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          {affected.features.map((f, i) => {
            const c = colorFor(f.properties.kind)
            const isOriginal = f.properties.kind === 'drought-original'
            return (
              <g key={i}>
                <path
                  d={path(f as Feature<Polygon, AffectedAreaProps>)}
                  fill={c}
                  fillOpacity={isOriginal ? 0.08 : 0.55}
                  stroke={c}
                  strokeWidth={5}
                  strokeOpacity={1}
                  strokeDasharray={isOriginal ? '12 8' : undefined}
                  style={{ mixBlendMode: isOriginal ? undefined : 'screen' }}
                />
                {!isOriginal && (() => {
                  const ring = f.geometry.coordinates[0]
                  const cx = ring.reduce((a, p) => a + p[0], 0) / ring.length
                  const cy = ring.reduce((a, p) => a + p[1], 0) / ring.length
                  const [lx, ly] = project([cx, cy])
                  return (
                    <text
                      x={lx}
                      y={ly}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#fff"
                      stroke="#000"
                      strokeWidth="4"
                      paintOrder="stroke"
                      fontSize="26"
                      fontFamily="Inter, sans-serif"
                      fontWeight="700"
                    >
                      {f.properties.area_km2.toLocaleString('pt-BR')} km²
                    </text>
                  )
                })()}
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
