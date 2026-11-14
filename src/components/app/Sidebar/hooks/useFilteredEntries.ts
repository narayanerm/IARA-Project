import { useMemo } from 'react'
import type { Entry, FilterKind } from '../types'

// Prefix-only match ranked: name starts > token starts.
export function useFilteredEntries(entries: Entry[], query: string, filter: FilterKind): Entry[] {
  return useMemo(() => {
    const q = query.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    let xs = entries
    if (filter !== 'all') xs = xs.filter((e) => e.kind === filter)
    if (!q) return xs
    const scored: Array<{ e: Entry; score: number }> = []
    for (const e of xs) {
      const nameNorm = e.nameLc.normalize('NFD').replace(/[̀-ͯ]/g, '')
      if (nameNorm.startsWith(q)) scored.push({ e, score: 2 })
      else if (e.tokens.some((t) => t.startsWith(q))) scored.push({ e, score: 1 })
    }
    scored.sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name, 'pt-BR'))
    return scored.map((s) => s.e)
  }, [entries, query, filter])
}
