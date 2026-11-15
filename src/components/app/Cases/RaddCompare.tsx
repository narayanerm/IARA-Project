import { useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n'

type Bbox = [number, number, number, number]

const EOX = (year: number) =>
  `https://tiles.maps.eox.at/wmts/1.0.0/${year === 2016 ? 's2cloudless_3857' : `s2cloudless-${year}_3857`}/default/GoogleMapsCompatible`
// Same published RADD version as the map layer (pinned to skip the alias redirect).
const RADD = 'https://tiles.globalforestwatch.org/wur_radd_alerts/v20261108/dynamic'
// RADD covers South America from 2020 on.
const RADD_START = 2020
const ZOOM = 10
// The RADD tiles come pink with confidence shading; paint every alert pixel one solid red instead.
const RADD_FILTER =
  'brightness(0) saturate(100%) invert(16%) sepia(96%) saturate(6000%) hue-rotate(356deg) brightness(97%) contrast(121%)'
export const RADD_RED = '#E3121F'

/** Years with both a yearly cloud-free Sentinel-2 mosaic (EOX) and RADD alerts. */
export const RADD_YEARS = [2020, 2021, 2022, 2023, 2024, 2025]

const COPY = {
  pt: {
    pickStart: 'Escolha o ano inicial',
    pickEnd: 'Agora escolha o ano final',
    radd: 'Alertas RADD',
    legend: (y: string) => `Floresta derrubada detectada pelo radar de 2020 até o fim de ${y} (RADD · Wageningen/GFW, a partir do Sentinel-1).`,
    noRadd: 'O RADD só cobre a América do Sul a partir de 2020.',
    caption:
      'Mosaico anual sem nuvens do Sentinel-2 (EOX), o mesmo do mapa. Em vermelho, os alertas RADD acumulados até cada ano: arraste para ver a floresta virar clareira.',
  },
  en: {
    pickStart: 'Pick the start year',
    pickEnd: 'Now pick the end year',
    radd: 'RADD alerts',
    legend: (y: string) => `Forest loss detected by radar from 2020 to the end of ${y} (RADD · Wageningen/GFW, from Sentinel-1).`,
    noRadd: 'RADD only covers South America from 2020.',
    caption:
      'Yearly cloud-free Sentinel-2 mosaic (EOX), the same as on the map. In red, RADD alerts accumulated up to each year: drag to watch forest turn into clearings.',
  },
}

const mx = (lon: number) => ((lon + 180) / 360) * 2 ** ZOOM
const my = (lat: number) => {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** ZOOM
}

/** Web-Mercator tiles laid out so the box fills the frame exactly (same grid for radar and RADD). */
function Tiles({ bbox, url, filter }: { bbox: Bbox; url: (x: number, y: number) => string; filter?: string }) {
  const [w, s, e, n] = bbox
  const x0 = mx(w)
  const x1 = mx(e)
  const y0 = my(n)
  const y1 = my(s)
  const tiles: Array<[number, number]> = []
  for (let x = Math.floor(x0); x < Math.ceil(x1); x++) for (let y = Math.floor(y0); y < Math.ceil(y1); y++) tiles.push([x, y])
  return (
    <>
      {tiles.map(([x, y]) => (
        <img
          key={`${x}/${y}`}
          src={url(x, y)}
          alt=""
          draggable={false}
          className="absolute max-w-none"
          style={{
            left: `${((x - x0) / (x1 - x0)) * 100}%`,
            top: `${((y - y0) / (y1 - y0)) * 100}%`,
            // A hair of overlap hides the seams between tiles.
            width: `${(1 / (x1 - x0)) * 100 + 0.15}%`,
            height: `${(1 / (y1 - y0)) * 100 + 0.2}%`,
            filter,
          }}
        />
      ))}
    </>
  )
}

/** One side of the slider: the yearly mosaic, with the RADD alerts accumulated up to that year on top. */
function Side({ bbox, year, radd }: { bbox: Bbox; year: number; radd: boolean }) {
  return (
    <>
      <Tiles bbox={bbox} url={(x, y) => `${EOX(year)}/${ZOOM}/${y}/${x}.jpg`} filter="brightness(1.12) saturate(1.1)" />
      {radd && year >= RADD_START && (
        <Tiles
          bbox={bbox}
          url={(x, y) => `${RADD}/${ZOOM}/${x}/${y}.png?start_date=${RADD_START}-01-01&end_date=${year}-12-31`}
          filter={RADD_FILTER}
        />
      )}
    </>
  )
}

/**
 * Mining case: two yearly cloud-free Sentinel-2 mosaics side by side on a slider, each with the RADD
 * deforestation alerts accumulated up to its year, so the red spreading across the green is the advance.
 */
export function RaddCompare({
  bbox,
  start,
  end,
  onRange,
  color,
}: {
  bbox: Bbox
  start: number
  end: number
  onRange: (start: number, end: number) => void
  color: string
}) {
  const lang = useI18n((s) => s.lang)
  const copy = COPY[lang] ?? COPY.pt
  const [raddOn, setRaddOn] = useState(true)
  const [pos, setPos] = useState(50)
  const [drag, setDrag] = useState(false)
  // Like a flight search: the first click sets the start year, the second the end year.
  const [pickingEnd, setPickingEnd] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const move = (x: number) => {
    const r = ref.current?.getBoundingClientRect()
    if (r) setPos(Math.max(2, Math.min(98, ((x - r.left) / r.width) * 100)))
  }
  const [w, s, e, n] = bbox
  const pick = (y: number) => {
    if (pickingEnd && y > start) {
      onRange(start, y)
      setPickingEnd(false)
    } else {
      onRange(y, y)
      setPickingEnd(true)
    }
  }
  const before = start
  const after = end

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex overflow-hidden rounded-full border border-border" role="group" aria-label={copy.pickStart}>
          {RADD_YEARS.map((y) => {
            const edge = y === start || y === end
            const inside = y > start && y < end
            return (
              <button
                key={y}
                type="button"
                aria-pressed={edge}
                onClick={() => pick(y)}
                className="flex-1 py-1 text-center text-[12px] font-semibold tabular-nums transition-colors hover:bg-white/[0.06]"
                style={
                  edge
                    ? { background: color, color: '#10160f' }
                    : inside
                      ? {
                          background: `repeating-linear-gradient(135deg, color-mix(in srgb, ${color} 34%, transparent) 0 4px, color-mix(in srgb, ${color} 12%, transparent) 4px 8px)`,
                        }
                      : undefined
                }
              >
                {y}
              </button>
            )
          })}
        </div>
        <p className="font-mono text-[10.5px] text-muted-foreground">{pickingEnd ? copy.pickEnd : copy.pickStart}</p>
      </div>

      <div
        ref={ref}
        className="relative w-full select-none overflow-hidden rounded-lg border border-border/60 bg-black"
        style={{ aspectRatio: `${mx(e) - mx(w)} / ${my(s) - my(n)}`, cursor: 'ew-resize' }}
        onMouseDown={(ev) => {
          setDrag(true)
          move(ev.clientX)
        }}
        onMouseMove={(ev) => drag && move(ev.clientX)}
        onMouseUp={() => setDrag(false)}
        onMouseLeave={() => setDrag(false)}
        onTouchMove={(ev) => move(ev.touches[0].clientX)}
      >
        <div className="absolute inset-0">
          <Side bbox={bbox} year={after} radd={raddOn} />
        </div>
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <Side bbox={bbox} year={before} radd={raddOn} />
        </div>
        <div className="absolute inset-y-0 w-0.5 bg-white/90" style={{ left: `${pos}%` }} />
        <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 font-mono text-[11px] text-white">
          {before}
        </span>
        <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 font-mono text-[11px] text-white">
          {after}
        </span>
      </div>

      <button
        type="button"
        aria-pressed={raddOn}
        onClick={() => setRaddOn((v) => !v)}
        className="flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left text-[12px] leading-snug transition-colors"
        style={raddOn ? { borderColor: RADD_RED, background: `${RADD_RED}14` } : { borderColor: 'hsl(var(--border))' }}
      >
        <span
          className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-sm border"
          style={{ background: raddOn ? RADD_RED : 'transparent', borderColor: RADD_RED }}
        />
        <span>
          <span className="font-semibold">{copy.radd}</span>{' '}
          <span className="text-muted-foreground">
            {after >= RADD_START ? copy.legend(String(after)) : copy.noRadd}
          </span>
        </span>
      </button>
      <p className="text-[11.5px] leading-snug text-muted-foreground">{copy.caption}</p>
    </div>
  )
}
