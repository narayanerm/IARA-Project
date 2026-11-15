/**
 * A small tuft of leaves at the left end of the ask bar. On entry they rustle, the bar
 * unrolls out of them from left to right, and a few leaves blow along the bar and fade.
 * Purely decorative; with reduced motion the bar simply appears.
 */
const LEAF = 'M0 0C3.2-4.4 9.6-6.2 15.6-4.9C13.9 1.2 8.6 4.9 3.1 4.4C1.8 4.3.8 2.8 0 0Z'

// angle (deg), size scale, colour, whether it blows away along the bar
const LEAVES: { a: number; s: number; c: string; fly?: boolean }[] = [
  { a: -64, s: 1.05, c: 'var(--leaf-1)' },
  { a: -28, s: 1.2, c: 'var(--leaf-2)', fly: true },
  { a: 8, s: 1.1, c: 'var(--leaf-3)' },
  { a: 40, s: 1.15, c: 'var(--leaf-1)', fly: true },
  { a: 72, s: 0.95, c: 'var(--leaf-2)' },
  { a: -8, s: 0.85, c: 'hsl(var(--primary))', fly: true },
  { a: 104, s: 0.8, c: 'var(--leaf-3)' },
]

export function AskBarLeaves() {
  return (
    <span className="ask-leaves" aria-hidden="true">
      {LEAVES.map((l, i) => (
        <span
          key={i}
          className={l.fly ? 'ask-leaf is-fly' : 'ask-leaf'}
          style={{ ['--a' as string]: `${l.a}deg`, ['--s' as string]: l.s, ['--i' as string]: i }}
        >
          <svg viewBox="-1 -7 18 13" width="26" height="19">
            <path d={LEAF} fill={l.c} />
            <path d="M0.6 0.2C5 -1 9.5 -2.2 14.4 -4.4" stroke="rgb(0 0 0 / 0.28)" strokeWidth="0.6" fill="none" />
          </svg>
        </span>
      ))}
    </span>
  )
}
