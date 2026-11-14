import { useI18n } from '@/lib/i18n'
import type { FloodChance } from '@/lib/predictive-models'

export function FloodProbability({ chance }: { chance: FloodChance }) {
  const pt = useI18n((state) => state.lang === 'pt')
  const label = pt ? 'Chance de vazão alta em 7 dias' : '7-day chance of high river flow'
  if (chance === null) return null
  const color = typeof chance === 'number' ? `hsl(${120 * (1 - chance / 100)} 76% 70%)` : 'white'
  const value = typeof chance === 'number' ? `${chance}%` : chance === 'loading' ? '…' : '—'
  return (
    <span role="status" className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/45 bg-slate-950 px-2 py-1 text-center text-xs text-white shadow-lg">
      <span className="block font-bold tabular-nums" style={{ color }}>{value}</span>
      <span className="block text-[10px]">
        {chance === 'unavailable' ? (pt ? 'Chance indisponível' : 'Chance unavailable') : label}
      </span>
      <span aria-hidden="true" className="absolute left-1/2 top-full -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-slate-950" />
    </span>
  )
}
