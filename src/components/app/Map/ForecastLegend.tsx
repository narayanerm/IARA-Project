import { FLOOD_LAYER, FLOOD_EXTENT_LAYER, GLOFAS_SWATCHES, isObservedFlood, type WaterLayer } from '@/lib/predictive-models'

type LegendRow = { label: string; colors: readonly string[] }

export function ForecastLegend({ layer, pt }: { layer: WaterLayer | 'fire'; pt: boolean }) {
  let columns: string[] = []
  let rows: LegendRow[]
  if (layer === 'fire') {
    rows = [
      { label: pt ? 'Baixo (<11,2)' : 'Low (<11.2)', colors: ['#9cffc0'] },
      { label: pt ? 'Moderado (11,2–21,3)' : 'Moderate (11.2–21.3)', colors: ['#cde24e'] },
      { label: pt ? 'Alto (21,3–38)' : 'High (21.3–38)', colors: ['#e6ac00'] },
      { label: pt ? 'Muito alto (38–50)' : 'Very high (38–50)', colors: ['#d97010'] },
      { label: pt ? 'Extremo (50–70)' : 'Extreme (50–70)', colors: ['#ad060e'] },
      { label: pt ? 'Muito extremo (>70)' : 'Very extreme (>70)', colors: ['#3a0015'] },
    ]
  } else if (isObservedFlood(layer)) {
    rows = [
      { label: pt ? 'Água superficial' : 'Surface water', colors: ['#32d2f5'] },
      { label: pt ? 'Inundação recorrente' : 'Recurring flood', colors: ['#ffff00'] },
      { label: pt ? 'Inundação' : 'Flood', colors: ['#fa1e24'] },
    ]
  } else if (layer === FLOOD_LAYER) {
    columns = ['30–50%', '50–75%', '75–100%']
    rows = GLOFAS_SWATCHES.map(({ threshold, colors }) => ({
      label: pt ? `Limiar de ${threshold} anos` : `${threshold}-year threshold`,
      colors: colors.map(([r, g, b]) => `rgb(${r}, ${g}, ${b})`),
    }))
  } else if (layer === FLOOD_EXTENT_LAYER) {
    rows = [{ label: pt ? 'Área de inundação estimada' : 'Estimated inundation area', colors: ['#728584'] }]
  } else {
    columns = pt ? ['Baixa', 'Média', 'Alta'] : ['Low', 'Medium', 'High']
    rows = [
      { label: pt ? 'Vazão extremamente baixa' : 'Extremely low flow', colors: ['#c90317', '#ed3b4c', '#f57b87'] },
      { label: pt ? 'Vazão baixa' : 'Low flow', colors: ['#d8aa02', '#efc737', '#f3de8f'] },
      { label: pt ? 'Vazão próxima do normal' : 'Near-normal flow', colors: ['#797979', '#aaaaaa', '#dddddd'] },
      { label: pt ? 'Vazão alta' : 'High flow', colors: ['#03b5cd', '#50d2e7', '#a0e5ef'] },
      { label: pt ? 'Vazão extremamente alta' : 'Extremely high flow', colors: ['#1802dc', '#7764fa', '#a2afff'] },
    ]
  }

  const title = pt ? 'Legenda' : 'Legend'
  const columnLabel = layer === FLOOD_LAYER
    ? (pt ? 'Probabilidade de excedência' : 'Exceedance probability')
    : (pt ? 'Incerteza da previsão' : 'Forecast uncertainty')

  return columns.length ? (
    <table aria-label={title} className="mt-2 w-full text-left text-xs">
      <caption className="mb-1 text-left text-muted-foreground">{columnLabel}</caption>
      <thead>
        <tr>
          <th scope="col" className="sr-only">{pt ? 'Categoria' : 'Category'}</th>
          {columns.map((column) => <th key={column} scope="col" className="px-1 text-center font-medium">{column}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ label, colors }) => (
          <tr key={label}>
            <th scope="row" className="py-1 pr-1 font-normal">{label}</th>
            {colors.map((color, index) => (
              <td key={color} className="px-1">
                <span aria-hidden="true" className="block h-2.5 w-full rounded-sm border border-white/20" style={{ backgroundColor: color }} />
                <span className="sr-only">{columns[index]}</span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <ul aria-label={title} className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {rows.map(({ label, colors }) => (
        <li key={label} className="flex items-center gap-1">
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm border border-white/20" style={{ backgroundColor: colors[0] }} />
          {label}
        </li>
      ))}
    </ul>
  )
}
