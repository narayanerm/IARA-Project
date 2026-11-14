import { useMemo } from 'react'
import { rnd } from './utils'

// WebGL-less fallback: the brand pixel mosaic with a river cutting through the forest.
export function MosaicoEstatico() {
  const cels = useMemo(() => {
    const r = rnd(2026)
    const tons = ['#2c5039', '#33593f', '#3b6447', '#13201a']
    const out: { x: number; y: number; c: string }[] = []
    const C = 48
    const L = 28
    for (let y = 0; y < L; y++) {
      for (let x = 0; x < C; x++) {
        const rio = Math.abs(y - (17 + Math.sin(x / 5.5) * 3.2 + Math.sin(x / 2.3) * 0.8))
        let c: string
        if (y < 9 - Math.sin(x / 3) * 1.5) c = r() < 0.06 ? '#13201a' : '#0a110e'
        else if (rio < 1.1) c = r() < 0.5 ? '#2b7ea6' : '#5aa7c9'
        else if (r() < 0.025) c = '#f07a45'
        else c = tons[Math.floor(r() * (y < 12 ? 4 : 3))]
        if (c !== '#0a110e') out.push({ x, y, c })
      }
    }
    return out
  }, [])
  return (
    <div className="iara-mosaico">
      <svg viewBox="0 0 48 28" preserveAspectRatio="xMidYMid slice">
        {cels.map((k, i) => (
          <rect key={i} x={k.x + 0.06} y={k.y + 0.06} width={0.88} height={0.88} rx={0.14} fill={k.c} />
        ))}
      </svg>
    </div>
  )
}
