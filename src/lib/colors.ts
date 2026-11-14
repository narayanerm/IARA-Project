export function displacementColor(mmPerYear: number): string {
  const clamped = Math.max(-20, Math.min(10, mmPerYear))
  if (clamped < 0) {
    const t = Math.abs(clamped) / 20
    const h = 348
    const l = 60 - t * 20
    return `hsl(${h} 85% ${l}%)`
  }
  if (clamped > 0) {
    const t = clamped / 10
    const h = 190
    const l = 60 - t * 10
    return `hsl(${h} 85% ${l}%)`
  }
  return 'hsl(220 10% 55%)'
}

export const DISPLACEMENT_STOPS = [
  { value: -20, label: '−20 mm/yr', color: 'hsl(348 85% 40%)' },
  { value: -10, label: '−10', color: 'hsl(348 85% 50%)' },
  { value: -5, label: '−5', color: 'hsl(348 85% 58%)' },
  { value: 0, label: '0', color: 'hsl(220 10% 55%)' },
  { value: 5, label: '+5', color: 'hsl(190 85% 55%)' },
  { value: 10, label: '+10 mm/yr', color: 'hsl(190 85% 50%)' },
]
