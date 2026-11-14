// Deterministic 31-bit PRNG (Park-Miller) used for layout jitter that must be stable across renders.
export function rnd(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}
