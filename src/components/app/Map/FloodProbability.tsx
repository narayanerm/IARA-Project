import { useI18n } from '@/lib/i18n'
import { FLOOD_EXTENT_LAYER, floodChanceColor, type FloodChance } from '@/lib/predictive-models'

export function FloodProbability({ chance }: { chance: FloodChance }) {
  const pt = useI18n((state) => state.lang === 'pt')
  if (chance === null) return null
  const glofas = typeof chance === 'object' ? chance : null
  const label = glofas?.band
    ? (pt ? `GloFAS · 15 dias · limiar de ${glofas.band.threshold} anos` : `GloFAS · 15 days · ${glofas.band.threshold}-year threshold`)
    : glofas?.layer === FLOOD_EXTENT_LAYER
      ? (pt ? 'GloFAS · inundação estimada' : 'GloFAS · estimated inundation')
      : glofas
        ? (pt ? 'GloFAS · sinal de cheia' : 'GloFAS · flood signal')
        : (pt ? 'GEOGLOWS · chance em 7 dias' : 'GEOGLOWS · 7-day high-flow chance')
  const color = floodChanceColor(chance)
  const loading = chance === 'loading'
  const value = typeof chance === 'number' ? `${chance}%` : glofas?.band?.range
  return (
    <span className="relative grid size-7 place-items-center rounded-full border-2 border-cyan-300 shadow-[0_0_0_2px_#172033]" style={{ borderColor: color }}>
      {loading && (
        <span aria-hidden="true" className="absolute -inset-2 rounded-full border-[3px] border-slate-950/90 border-t-cyan-200 border-r-cyan-300 shadow-[0_0_0_1px_#172033] motion-safe:animate-spin" />
      )}
      {color && (
        <span aria-hidden="true" className="size-3.5 rounded-full border-2 border-white" style={{ backgroundColor: color }} />
      )}
      <span role="status" className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/45 bg-slate-950 px-2 py-1 text-center text-xs text-white shadow-lg" style={{ borderColor: color }}>
        {value && <span className="block font-bold tabular-nums" style={{ color }}>{value}</span>}
        <span className="block text-[10px]">
          {loading ? (pt ? 'Calculando previsão…' : 'Calculating forecast…')
            : chance === 'unavailable' ? (pt ? 'Chance indisponível' : 'Chance unavailable') : label}
        </span>
        <span aria-hidden="true" className="absolute left-1/2 top-full -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-slate-950" />
      </span>
    </span>
  )
}
