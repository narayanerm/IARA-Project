import { useEffect, useRef, useState } from 'react'
import { Layers } from 'lucide-react'
import { useApp, useUi } from '@/lib/store'
import { cn } from '@/lib/utils'

/**
 * SAR layer switcher shown in every case, laid out like a map app's layer picker: one thumbnail
 * tile in the corner shows the active band; pointing at it (or tapping it) opens a row of cards,
 * each a thumbnail of that band's mosaic for this case with its name underneath. Three bands
 * (NISAR L, NISAR S, Sentinel-1 C); in the YANO (garimpo) case also the two ground-truth
 * overlays that stack on any band, RADD alerts and DETER mineração.
 * Positioned bottom-right, just above the HomeButton and the MapLibre attribution.
 */

type Band = 'nisar' | 'sband' | 's1c'

const BANDS: Array<{ id: Band; label: string; hint: string; color: string }> = [
  { id: 'nisar', label: 'L-band', hint: 'NISAR L-band · λ 24 cm · penetra a copa', color: '#F07A45' },
  { id: 'sband', label: 'S-band', hint: 'NISAR S-band · λ 10 cm · topo do dossel', color: '#B59EF5' },
  { id: 's1c', label: 'Sentinel-1', hint: 'Sentinel-1 C-band · λ 5,6 cm · superfície', color: '#9ED9FF' },
]

const thumb = (region: string, band: Band) => `/layer-thumbs/${region}-${band}.webp`

/* Drawn thumbnails for the two overlays: scattered alert pixels, and mining polygons. */
function RaddThumb() {
  const cells = [
    [10, 12], [14, 12], [14, 16], [30, 8], [34, 10], [22, 30], [26, 30], [26, 34], [40, 26],
    [8, 38], [12, 42], [36, 40], [40, 40], [44, 44], [18, 22], [46, 14],
  ]
  return (
    <svg viewBox="0 0 56 56" className="h-full w-full">
      <rect width="56" height="56" fill="#16241d" />
      <path d="M0 34 C12 30 20 40 32 34 S50 22 56 26" stroke="#2b7ea6" strokeWidth="3" fill="none" opacity="0.7" />
      {cells.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="4" height="4" fill="#FF4D6D" opacity={0.65 + (i % 3) * 0.12} />
      ))}
    </svg>
  )
}
function DeterThumb() {
  return (
    <svg viewBox="0 0 56 56" className="h-full w-full">
      <rect width="56" height="56" fill="#16241d" />
      <path d="M0 30 C14 26 22 36 34 30 S50 18 56 22" stroke="#2b7ea6" strokeWidth="3" fill="none" opacity="0.7" />
      <g fill="rgb(255 255 255 / 0.12)" stroke="#fff" strokeWidth="1.2">
        <path d="M8 8 L22 6 L24 16 L12 20 Z" />
        <path d="M30 36 L44 32 L48 44 L34 48 Z" />
        <path d="M36 8 L46 10 L44 18 L34 16 Z" />
        <path d="M6 40 L14 38 L16 46 L8 48 Z" />
      </g>
    </svg>
  )
}

function Card({
  label,
  hint,
  active,
  color,
  onClick,
  children,
}: {
  label: string
  hint: string
  active: boolean
  color: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={hint}
      className="group flex w-[64px] shrink-0 flex-col items-center gap-1 rounded-lg p-1 text-center transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className="block h-[52px] w-[52px] overflow-hidden rounded-lg transition-[box-shadow,transform] duration-200 group-hover:scale-[1.04]"
        style={{ boxShadow: active ? `0 0 0 2px ${color}, 0 0 0 4px rgb(0 0 0 / 0.5)` : 'inset 0 0 0 1px rgb(255 255 255 / 0.12)' }}
      >
        {children}
      </span>
      <span className={cn('text-[11px] font-semibold leading-tight', active ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground')}>
        {label}
      </span>
    </button>
  )
}

export function YanomamiCaseControls() {
  const activeRegion = useApp((s) => s.activeRegion)
  const aoiActive = useApp((s) => s.aoiActive)
  const band = useUi((s) => s.yanomamiBand)
  const raddOn = useUi((s) => s.yanomamiRaddOn)
  const deterOn = useUi((s) => s.yanomamiDeterOn)
  const setBand = useUi((s) => s.setYanomamiBand)
  const toggleRadd = useUi((s) => s.toggleYanomamiRadd)
  const toggleDeter = useUi((s) => s.toggleYanomamiDeter)
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  if (!aoiActive) return null

  const showGarimpoOverlays = activeRegion === 'YANO'
  const current = BANDS.find((b) => b.id === band)
  const overlays = (showGarimpoOverlays ? [raddOn && 'RADD', deterOn && 'DETER'] : []).filter(Boolean)
  const tileLabel = current ? current.label : 'Camadas SAR'

  const show = () => {
    window.clearTimeout(closeTimer.current)
    setOpen(true)
  }
  const hide = () => {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setOpen(false), 260)
  }

  return (
    <div
      className="pointer-events-auto absolute z-40 flex items-end gap-2"
      style={{ right: 8, bottom: 44 }}
      onPointerEnter={(e) => e.pointerType === 'mouse' && show()}
      onPointerLeave={(e) => e.pointerType === 'mouse' && hide()}
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
    >
      {/* The row of cards opens to the left of the tile. */}
      <div
        className={cn(
          'flex items-start gap-0.5 rounded-xl border border-white/10 bg-[rgb(13_21_18/0.95)] p-1.5 shadow-2xl backdrop-blur-md transition-all duration-200 ease-out',
          open ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-2 opacity-0'
        )}
        role="group"
        aria-label="Camadas SAR"
        aria-hidden={!open}
      >
        {BANDS.map((b) => (
          <Card
            key={b.id}
            label={b.label}
            hint={b.hint}
            color={b.color}
            active={band === b.id}
            onClick={() => setBand(band === b.id ? null : b.id)}
          >
            <img src={thumb(activeRegion, b.id)} alt="" draggable={false} className="h-full w-full object-cover" />
          </Card>
        ))}
        {showGarimpoOverlays && (
          <>
            <span className="mx-1 mt-2 h-[44px] w-px shrink-0 bg-white/12" aria-hidden="true" />
            <Card label="RADD" hint="Alertas RADD · derivado do Sentinel-1 · 2020 até hoje" color="#FF4D6D" active={raddOn} onClick={toggleRadd}>
              <RaddThumb />
            </Card>
            <Card label="DETER" hint="DETER mineração · 683 polígonos INPE · 2019-2026" color="#ffffff" active={deterOn} onClick={toggleDeter}>
              <DeterThumb />
            </Card>
          </>
        )}
      </div>

      {/* The tile: shows the active band; tapping it opens or closes the row (touch screens). */}
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : show())}
        onFocus={show}
        aria-expanded={open}
        aria-label={`Camadas SAR: ${current ? current.hint : 'nenhuma banda'}`}
        className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-xl bg-[#0d1512] shadow-2xl transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ boxShadow: `0 0 0 2px ${current ? current.color : 'rgb(255 255 255 / 0.85)'}, 0 8px 24px rgb(0 0 0 / 0.5)` }}
      >
        {current ? (
          <img src={thumb(activeRegion, current.id)} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0 grid place-items-center bg-[#16241d]">
            <Layers className="mb-3 h-6 w-6 text-white/85" strokeWidth={1.75} />
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-1 pb-1 pt-4 text-center text-[11px] font-semibold leading-tight text-white">
          {tileLabel}
          {overlays.length > 0 && <span className="block text-[9.5px] font-medium text-white/75">+ {overlays.join(' + ')}</span>}
        </span>
      </button>
    </div>
  )
}
