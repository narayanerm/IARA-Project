import { useMemo } from 'react'
import { rnd } from './utils'
import type { Fase } from './constants'

export function ReleaseAnimation({ fase, cols, rows }: { fase: Fase; cols: number; rows: number }) {
  const celulas = useMemo(() => {
    const r = rnd(7)
    const out: { d: number }[] = []
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) out.push({ d: (x / cols) * 340 + r() * 90 })
    return out
  }, [cols, rows])

  return (
    <div
      className={`iara-saida ${fase === 'revelando' ? 'revela' : ''}`}
      style={{ ['--cols' as string]: cols }}
      aria-hidden="true"
    >
      {celulas.map((c, i) => (
        <i key={i} style={{ ['--d' as string]: `${Math.round(c.d)}ms` }} />
      ))}
    </div>
  )
}
