/**
 * Forest details for the assistant panel, in the same flat style as the ask bar leaves and the
 * SAR layers river: a toucan on a branch in the header, tufts of leaves in the lower corners and
 * a thin river running above the input. Decorative only.
 */
const LEAF = 'M0 0C3.2-4.4 9.6-6.2 15.6-4.9C13.9 1.2 8.6 4.9 3.1 4.4C1.8 4.3.8 2.8 0 0Z'
const VEIN = 'M0.6 0.2C5 -1 9.5 -2.2 14.4 -4.4'

type Leaf = { a: number; s: number; c: string }

const LEFT_TUFT: Leaf[] = [
  { a: -100, s: 3.9, c: 'var(--leaf-3)' },
  { a: -74, s: 4.8, c: 'var(--leaf-1)' },
  { a: -50, s: 4.2, c: 'var(--leaf-2)' },
  { a: -28, s: 3.4, c: 'var(--leaf-4)' },
  { a: -8, s: 2.6, c: 'var(--leaf-1)' },
  { a: -62, s: 2.3, c: 'hsl(var(--primary))' },
]
const RIGHT_TUFT: Leaf[] = [
  { a: -82, s: 3.6, c: 'var(--leaf-1)' },
  { a: -108, s: 4.5, c: 'var(--leaf-3)' },
  { a: -134, s: 3.9, c: 'var(--leaf-2)' },
  { a: -158, s: 2.9, c: 'var(--leaf-4)' },
  { a: -176, s: 2.3, c: 'var(--leaf-1)' },
]
const BRANCH_LEAVES: Array<Leaf & { x: number; y: number }> = [
  { x: 14, y: 47, a: -150, s: 1.0, c: 'var(--leaf-2)' },
  { x: 22, y: 46, a: -60, s: 0.9, c: 'var(--leaf-1)' },
  { x: 70, y: 45, a: -35, s: 1.1, c: 'var(--leaf-4)' },
  { x: 76, y: 47, a: 30, s: 0.9, c: 'var(--leaf-3)' },
]

function LeafShape({ color }: { color: string }) {
  return (
    <>
      <path d={LEAF} fill={color} />
      <path d={VEIN} stroke="rgb(0 0 0 / 0.28)" strokeWidth="0.6" fill="none" />
    </>
  )
}

function Tuft({ leaves, className }: { leaves: Leaf[]; className: string }) {
  return (
    <span className={`flora-tuft ${className}`}>
      {leaves.map((l, i) => (
        <span key={i} className="flora-leaf" style={{ ['--a' as string]: `${l.a}deg`, ['--s' as string]: l.s, ['--i' as string]: i }}>
          <svg viewBox="-1 -7 18 13" width="18" height="13">
            <LeafShape color={l.c} />
          </svg>
        </span>
      ))}
    </span>
  )
}

/** A toucan perched on a leafy branch. It tilts its head now and then. */
export function Toucan({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 88 60" className={`flora-toucan ${className ?? ''}`} aria-hidden="true" focusable="false">
      <path d="M6 50C24 46 52 47 88 44" stroke="#6b4a2f" strokeWidth="3.2" strokeLinecap="round" fill="none" />
      {BRANCH_LEAVES.map((l, i) => (
        <g key={i} transform={`translate(${l.x} ${l.y}) rotate(${l.a}) scale(${l.s})`}>
          <LeafShape color={l.c} />
        </g>
      ))}
      {/* tail and body */}
      <path d="M58 40L74 55L66 56L54 44Z" fill="#17201c" />
      <path d="M38 27C38 17 46 13 53 16C61 19.5 64 30 60 39C57 45.5 48 47 43 43C39.5 40 38 34 38 27Z" fill="#1d2823" />
      <path d="M50 22C56 25 59 32 57 39" stroke="rgb(255 255 255 / 0.14)" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      {/* feet */}
      <path d="M46 44.5V48M51 45V48.3" stroke="#7c93a6" strokeWidth="1.8" strokeLinecap="round" />
      <g className="flora-toucan-head">
        {/* bib */}
        <path d="M37.5 22C37 30 39 36 43.5 39C47.5 35 48.5 27 46 20Z" fill="#fff4d6" />
        <path d="M38.5 33C40 36 41.5 38 43.5 39C45 37.5 46 35.5 46.8 33C44 34.5 41 34.5 38.5 33Z" fill="hsl(var(--primary))" />
        {/* head */}
        <path d="M36.5 19C36.5 12.5 41.5 9 47 9.5C52.5 10 56 14.5 55 20C54 24.5 50 26 46 24.5C42 23 38 23.5 36.5 19Z" fill="#1d2823" />
        {/* beak */}
        <path d="M38 13.5C30 9.5 17 10.5 8 19C6.5 20.5 7 22 8.5 21.5C17 19 28 20.5 37.5 23C39.5 20 39.5 16.5 38 13.5Z" fill="#f6a43a" />
        <path d="M38 13.5C30 9.5 17 10.5 8 19C17 14.5 28 14.5 38.8 17.5C38.8 16 38.5 14.7 38 13.5Z" fill="#ffd257" />
        <path d="M8 19C6.5 20.5 7 22 8.5 21.5C11 20.8 13.5 20.4 16 20.3C14.5 17.8 13 16.5 11.5 16C10.2 16.9 9 17.9 8 19Z" fill="#2a2420" />
        <path d="M10 20.8C19 18.8 29 19.8 37.8 22" stroke="rgb(0 0 0 / 0.28)" strokeWidth="0.7" fill="none" />
        {/* eye */}
        <circle cx="44.5" cy="15.5" r="3.3" fill="#5fb8ff" />
        <circle cx="44.5" cy="15.5" r="1.7" fill="#10160f" />
        <circle cx="45.1" cy="14.9" r="0.55" fill="#fff" />
      </g>
    </svg>
  )
}

/** Leaves in the lower corners and the river line, placed behind the conversation. */
export function PanelFlora() {
  return (
    <div className="flora" aria-hidden="true">
      <Tuft leaves={LEFT_TUFT} className="is-left" />
      <Tuft leaves={RIGHT_TUFT} className="is-right" />
      <svg className="flora-river" viewBox="0 0 1200 24" preserveAspectRatio="none">
        <defs>
          <linearGradient id="flora-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9ed9ff" />
            <stop offset="1" stopColor="#5fb8ff" />
          </linearGradient>
        </defs>
        <path
          className="is-water"
          d="M0 10C50 4 100 16 150 10S250 4 300 10S400 16 450 10S550 4 600 10S700 16 750 10S850 4 900 10S1000 16 1050 10S1150 4 1200 10V24H0Z"
          fill="url(#flora-water)"
        />
        <path className="is-shimmer" d="M0 12C50 6 100 18 150 12S250 6 300 12S400 18 450 12S550 6 600 12S700 18 750 12S850 6 900 12S1000 18 1050 12S1150 6 1200 12" />
      </svg>
    </div>
  )
}
