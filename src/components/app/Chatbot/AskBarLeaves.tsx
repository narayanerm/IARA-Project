/**
 * A tuft of leaves at the left end of the ask bar. On entry they burst out and rustle, the bar
 * unrolls out of them from left to right, a flurry of leaves blows along the bar, and a warm glow
 * runs across it. The tuft stays, swaying gently. With reduced motion the bar simply appears.
 */
const LEAF = 'M0 0C3.2-4.4 9.6-6.2 15.6-4.9C13.9 1.2 8.6 4.9 3.1 4.4C1.8 4.3.8 2.8 0 0Z'

// angle (deg), size scale, colour, whether it blows away along the bar
const LEAVES: { a: number; s: number; c: string; fly?: boolean }[] = [
  { a: -78, s: 1.0, c: 'var(--leaf-3)' },
  { a: -52, s: 1.25, c: 'var(--leaf-1)' },
  { a: -30, s: 1.35, c: 'var(--leaf-2)', fly: true },
  { a: -12, s: 1.1, c: 'var(--leaf-4)', fly: true },
  { a: 6, s: 1.4, c: 'var(--leaf-1)' },
  { a: 24, s: 1.2, c: 'hsl(var(--primary))', fly: true },
  { a: 42, s: 1.3, c: 'var(--leaf-2)' },
  { a: 60, s: 1.05, c: 'var(--leaf-4)', fly: true },
  { a: 80, s: 1.15, c: 'var(--leaf-3)' },
  { a: 100, s: 0.95, c: 'var(--leaf-2)', fly: true },
  { a: -96, s: 0.9, c: 'hsl(var(--primary))' },
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
          <svg viewBox="-1 -7 18 13" width="30" height="22">
            <path d={LEAF} fill={l.c} />
            <path d="M0.6 0.2C5 -1 9.5 -2.2 14.4 -4.4" stroke="rgb(0 0 0 / 0.28)" strokeWidth="0.6" fill="none" />
          </svg>
        </span>
      ))}
    </span>
  )
}
