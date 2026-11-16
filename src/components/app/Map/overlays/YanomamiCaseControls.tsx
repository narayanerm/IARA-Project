import { useEffect, useId, useState } from 'react'
import { Layers } from 'lucide-react'
import { useApp, useUi, useCaseVideoActive } from '@/lib/store'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'

/**
 * SAR layer switcher shown in every case, laid out like a map app's layer picker: one thumbnail
 * tile in the corner shows the active band; pointing at it (or tapping it) opens a row of cards,
 * each a thumbnail of that band's mosaic for this case with its name underneath. Three bands
 * (NISAR L, NISAR S, Sentinel-1 C); in the YANO (garimpo) case also the RADD alerts
 * ground-truth overlay that stacks on any band.
 * Positioned bottom-right, just above the HomeButton and the MapLibre attribution.
 */

type Band = 'nisar' | 'sband' | 's1c'

const BANDS: Array<{ id: Band; label: string; color: string }> = [
  { id: 'nisar', label: 'L-band', color: '#F07A45' },
  { id: 'sband', label: 'S-band', color: '#B59EF5' },
  { id: 's1c', label: 'Sentinel-1', color: '#9ED9FF' },
]

// Balloon over each card: full name, then a plain-language description in the site language.
const DESC: Record<Band | 'radd' | 'ench' | 'seca', { title: { pt: string; en: string }; pt: string; en: string }> = {
  nisar: {
    title: { pt: 'NISAR L-band · λ 24 cm', en: 'NISAR L-band · λ 24 cm' },
    pt: 'Onda longa que atravessa a copa e chega ao chão e aos troncos. Mostra onde a floresta foi aberta, mesmo com nuvens.',
    en: 'A long wave that passes through the canopy to the ground and trunks. Shows where the forest was cleared, even under clouds.',
  },
  sband: {
    title: { pt: 'NISAR S-band · λ 10 cm', en: 'NISAR S-band · λ 10 cm' },
    pt: 'Onda média que reflete no topo do dossel e nos galhos. Mostra mudanças na copa das árvores.',
    en: 'A mid-length wave that bounces off the top of the canopy and branches. Shows changes in the tree crowns.',
  },
  s1c: {
    title: { pt: 'Sentinel-1 banda C · λ 5,6 cm', en: 'Sentinel-1 C-band · λ 5.6 cm' },
    pt: 'Onda curta que vê a superfície: água aberta, solo exposto e cicatrizes de garimpo.',
    en: 'A short wave that sees the surface: open water, bare soil and mining scars.',
  },
  radd: {
    title: { pt: 'Alertas RADD', en: 'RADD alerts' },
    pt: 'Perda de floresta detectada pelo radar do Sentinel-1, de 2020 até hoje. Cada ponto é um alerta.',
    en: 'Forest loss detected by Sentinel-1 radar, from 2020 to today. Each dot is an alert.',
  },
  ench: {
    title: { pt: 'Marcas da cheia · JRC GSW', en: 'Flood extent · JRC GSW' },
    pt: 'Pixels que viram água na cheia, do JRC Global Surface Water (JRC, 30 m, 1984–2020). Fonte oficial da UE.',
    en: 'Pixels that turned to water at the flood peak, from JRC Global Surface Water (30 m, 1984–2020). Official EU source.',
  },
  seca: {
    title: { pt: 'Retração dos lagos · JRC GSW', en: 'Lake retraction · JRC GSW' },
    pt: 'Anel sazonal dos lagos que desaparece na estiagem, do JRC Global Surface Water (JRC, 30 m, 1984–2020).',
    en: 'Seasonal ring of lakes that vanishes during drought, from JRC Global Surface Water (30 m, 1984–2020).',
  },
}

// Leaves around the row's edges for the entrance; some fly up and away, the rest settle and fade.
const LAYER_LEAVES: { x: string; y: string; a: number; c: string; fly?: boolean }[] = [
  { x: '-6px', y: '-6px', a: -140, c: '#3f9a5e' },
  { x: '18%', y: '-9px', a: -100, c: '#79c97a', fly: true },
  { x: '42%', y: '-8px', a: -70, c: '#a7dc7c' },
  { x: '66%', y: '-9px', a: -110, c: '#3f9a5e', fly: true },
  { x: '92%', y: '-6px', a: -40, c: '#79c97a' },
  { x: '-8px', y: '70%', a: 160, c: '#2c6b45', fly: true },
  { x: '30%', y: 'calc(100% - 4px)', a: 120, c: '#a7dc7c' },
  { x: '78%', y: 'calc(100% - 4px)', a: 60, c: '#3f9a5e', fly: true },
]

// When the ask bar's unroll finishes after it mounts (see .ask-reveal .ask-unroll in index.css).
const ASK_BAR_ENTRANCE_MS = 1750

const thumb = (region: string, band: Band) => `/layer-thumbs/${region}-${band}.webp`

/* Drawn thumbnail for the RADD overlay: scattered alert pixels. */
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

/* Drawn thumbnail for the ENCH flood overlay: same layout as RADD, dots in blue. */
function EnchThumb() {
  const cells = [
    [10, 12], [14, 12], [14, 16], [30, 8], [34, 10], [22, 30], [26, 30], [26, 34], [40, 26],
    [8, 38], [12, 42], [36, 40], [40, 40], [44, 44], [18, 22], [46, 14],
  ]
  return (
    <svg viewBox="0 0 56 56" className="h-full w-full">
      <rect width="56" height="56" fill="#16241d" />
      <path d="M0 34 C12 30 20 40 32 34 S50 22 56 26" stroke="#2b7ea6" strokeWidth="3" fill="none" opacity="0.7" />
      {cells.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="4" height="4" fill="#5AA7C9" opacity={0.65 + (i % 3) * 0.12} />
      ))}
    </svg>
  )
}

/* Drawn thumbnail for the SECA drought overlay: same layout as RADD, dots in yellow. */
function SecaThumb() {
  const cells = [
    [10, 12], [14, 12], [14, 16], [30, 8], [34, 10], [22, 30], [26, 30], [26, 34], [40, 26],
    [8, 38], [12, 42], [36, 40], [40, 40], [44, 44], [18, 22], [46, 14],
  ]
  return (
    <svg viewBox="0 0 56 56" className="h-full w-full">
      <rect width="56" height="56" fill="#16241d" />
      <path d="M0 34 C12 30 20 40 32 34 S50 22 56 26" stroke="#2b7ea6" strokeWidth="3" fill="none" opacity="0.7" />
      {cells.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="4" height="4" fill="#E0B64B" opacity={0.65 + (i % 3) * 0.12} />
      ))}
    </svg>
  )
}
function Card({
  label,
  sub,
  tipTitle,
  desc,
  alignRight = false,
  active,
  color,
  onClick,
  children,
}: {
  label: string
  /** Optional source/attribution line shown under the label (e.g. "JRC GSW"). */
  sub?: string
  tipTitle: string
  desc: string
  alignRight?: boolean
  active: boolean
  color: string
  onClick: () => void
  children: React.ReactNode
}) {
  const tipId = useId()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-describedby={tipId}
      className="group relative flex w-[64px] shrink-0 flex-col items-center gap-1 rounded-lg p-1 text-center transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className="block h-[52px] w-[52px] overflow-hidden rounded-lg transition-[box-shadow,transform] duration-200 group-hover:scale-[1.04]"
        style={{ boxShadow: active ? `0 0 0 2px ${color}, 0 0 0 4px rgb(0 0 0 / 0.5)` : 'inset 0 0 0 1px rgb(255 255 255 / 0.12)' }}
      >
        {children}
      </span>
      <span className={cn('text-[11px] font-bold leading-tight', active ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground')}>
        {label}
      </span>
      {sub && (
        <span className="text-[8.5px] font-mono uppercase tracking-wider leading-tight text-muted-foreground/80">
          {sub}
        </span>
      )}
      {/* Balloon with a plain-language description, rising above the card on hover or keyboard focus. */}
      <span
        id={tipId}
        role="tooltip"
        className={cn(
          'pointer-events-none absolute bottom-full z-10 mb-2.5 w-[230px] translate-y-1 rounded-lg bg-[#0d1512] px-3 py-2 text-left text-[12px] leading-relaxed opacity-0 shadow-2xl ring-1 ring-white/10 transition-[opacity,transform] duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100',
          alignRight ? 'right-0' : 'left-1/2 -translate-x-1/2'
        )}
      >
        <span className="block font-bold text-foreground">{tipTitle}</span>
        <span className="mt-0.5 block font-medium text-foreground/85">{desc}</span>
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-full -mt-[5px] h-2.5 w-2.5 rotate-45 bg-[#0d1512] shadow-[1px_1px_0_0_rgb(255_255_255/0.1)]',
            alignRight ? 'right-[27px]' : 'left-1/2 -translate-x-1/2'
          )}
        />
      </span>
    </button>
  )
}

export function YanomamiCaseControls() {
  const activeRegion = useApp((s) => s.activeRegion)
  const lang = useI18n((s) => s.lang)
  const aoiActive = useApp((s) => s.aoiActive)
  const caseArrived = useApp((s) => s.caseArrived)
  const videoOn = useCaseVideoActive() !== null
  const band = useUi((s) => s.yanomamiBand)
  const raddOn = useUi((s) => s.yanomamiRaddOn)
  const floodOn = useUi((s) => s.enchFloodOn)
  const droughtOn = useUi((s) => s.secaDroughtOn)
  const setBand = useUi((s) => s.setYanomamiBand)
  const toggleRadd = useUi((s) => s.toggleYanomamiRadd)
  const toggleFlood = useUi((s) => s.toggleEnchFlood)
  const toggleDrought = useUi((s) => s.toggleSecaDrought)
  // Open by default (and again on every case change); the tile toggles it.
  const [open, setOpen] = useState(true)
  useEffect(() => setOpen(true), [activeRegion])
  // The picker waits for the ask bar: it appears once the camera has arrived and the bar has unrolled
  // (ask-unroll ends 1750ms after the bar mounts in index.css), then fades in.
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!caseArrived) {
      setShown(false)
      return
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const id = window.setTimeout(() => setShown(true), reduced ? 0 : ASK_BAR_ENTRANCE_MS + 150)
    return () => window.clearTimeout(id)
  }, [caseArrived, activeRegion])
  // Bumped on every open once shown (and on case change) so the row's entrance replays when it is seen.
  const [openSeq, setOpenSeq] = useState(0)
  useEffect(() => {
    if (open && shown) setOpenSeq((n) => n + 1)
  }, [open, shown, activeRegion])

  if (!aoiActive || videoOn) return null

  const showGarimpoOverlays = activeRegion === 'YANO'
  const showFloodOverlay = activeRegion === 'ENCH'
  const showDroughtOverlay = activeRegion === 'SECA'
  const current = BANDS.find((b) => b.id === band)
  const overlays = [
    showGarimpoOverlays && raddOn && 'RADD',
    showFloodOverlay && floodOn && (lang === 'pt' ? 'Cheia' : 'Flood'),
    showDroughtOverlay && droughtOn && (lang === 'pt' ? 'Seca' : 'Drought'),
  ].filter(Boolean)
  const panelName = lang === 'pt' ? 'Camadas SAR' : 'SAR layers'
  const tileLabel = current ? current.label : panelName

  return (
    <div
      className={cn(
        'absolute z-40 flex items-end gap-2 font-[Inter,ui-sans-serif,system-ui,sans-serif]',
        shown ? 'layers-enter pointer-events-auto' : 'pointer-events-none opacity-0'
      )}
      aria-hidden={!shown}
      data-tour={shown ? 'sar-layers' : undefined}
      style={{ right: 8, bottom: 44 }}
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
    >
      {/* The row of cards opens to the left of the tile. */}
      <div
        key={open ? `open-${openSeq}` : 'closed'}
        className={cn(
          'relative flex items-start gap-0.5 rounded-xl border border-white/10 bg-[rgb(13_21_18/0.95)] p-1.5 shadow-2xl backdrop-blur-md transition-all duration-200 ease-out',
          open ? 'layers-reveal opacity-100' : 'pointer-events-none translate-x-2 opacity-0'
        )}
        role="group"
        aria-label={panelName}
        aria-hidden={!open}
      >
        {/* Entrance: a river runs over the cards (clipped to the row), leaves rustle around the edges, then one flash. */}
        {open && shown && (
          <>
            <span className="layers-fx" aria-hidden="true">
              <svg className="layers-river" viewBox="0 0 1200 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="layers-water" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#9ed9ff" />
                    <stop offset="1" stopColor="#5fb8ff" />
                  </linearGradient>
                </defs>
                <path
                  className="is-water"
                  d="M0 40 C60 22 120 58 200 40 S340 22 400 40 S540 58 600 40 S740 22 800 40 S940 58 1000 40 S1140 22 1200 40 L1200 70 C1140 88 1060 52 1000 70 S860 88 800 70 S660 52 600 70 S460 88 400 70 S260 52 200 70 S60 88 0 70 Z"
                  fill="url(#layers-water)"
                />
                <path className="is-shimmer" d="M0 46 C60 30 120 62 200 46 S340 30 400 46 S540 62 600 46 S740 30 800 46 S940 62 1000 46 S1140 30 1200 46" />
              </svg>
              <span className="layers-flash" />
            </span>
            <span className="layers-leaves" aria-hidden="true">
              {LAYER_LEAVES.map((l, i) => (
                <span
                  key={i}
                  className={l.fly ? 'layers-leaf is-fly' : 'layers-leaf'}
                  style={{ left: l.x, top: l.y, ['--a' as string]: `${l.a}deg`, ['--i' as string]: i }}
                >
                  <svg viewBox="-1 -7 18 13" width="18" height="13">
                    <path d="M0 0C3.2-4.4 9.6-6.2 15.6-4.9C13.9 1.2 8.6 4.9 3.1 4.4C1.8 4.3.8 2.8 0 0Z" fill={l.c} />
                    <path d="M0.6 0.2C5 -1 9.5 -2.2 14.4 -4.4" stroke="rgb(0 0 0 / 0.28)" strokeWidth="0.6" fill="none" />
                  </svg>
                </span>
              ))}
            </span>
          </>
        )}
        {BANDS.map((b) => (
          <Card
            key={b.id}
            label={b.label}
            tipTitle={DESC[b.id].title[lang]}
            desc={DESC[b.id][lang]}
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
            <Card label="RADD" tipTitle={DESC.radd.title[lang]} desc={DESC.radd[lang]} alignRight color="#FF4D6D" active={raddOn} onClick={toggleRadd}>
              <RaddThumb />
            </Card>
          </>
        )}
        {showFloodOverlay && (
          <>
            <span className="mx-1 mt-2 h-[44px] w-px shrink-0 bg-white/12" aria-hidden="true" />
            <Card label={lang === 'pt' ? 'Cheia' : 'Flood'} sub="JRC GSW" tipTitle={DESC.ench.title[lang]} desc={DESC.ench[lang]} alignRight color="#5AA7C9" active={floodOn} onClick={toggleFlood}>
              <EnchThumb />
            </Card>
          </>
        )}
        {showDroughtOverlay && (
          <>
            <span className="mx-1 mt-2 h-[44px] w-px shrink-0 bg-white/12" aria-hidden="true" />
            <Card label={lang === 'pt' ? 'Seca' : 'Drought'} sub="JRC GSW" tipTitle={DESC.seca.title[lang]} desc={DESC.seca[lang]} alignRight color="#E97A4B" active={droughtOn} onClick={toggleDrought}>
              <SecaThumb />
            </Card>
          </>
        )}
      </div>

      {/* The tile: shows the active band; clicking it opens or closes the row. */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`${panelName}: ${current ? DESC[current.id].title[lang] : lang === 'pt' ? 'nenhuma banda' : 'no band'}`}
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
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-1 pb-1 pt-4 text-center text-[11px] font-bold leading-tight text-white">
          {tileLabel}
          {overlays.length > 0 && <span className="block text-[9.5px] font-bold text-white/75">+ {overlays.join(' + ')}</span>}
        </span>
      </button>
    </div>
  )
}
