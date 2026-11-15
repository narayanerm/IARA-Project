import { mkdir, rename, writeFile } from 'node:fs/promises'
import { registerHooks } from 'node:module'

// Reuse the same GEOGLOWS calculations as the browser without a separate build.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const url = specifier.startsWith('@/') ? new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href : specifier
    return nextResolve(url, context)
  },
})

const { AMAZON_RIVER_SITES, findForecastReach, fetchFlowForecast, fetchFloodChance } =
  await import('../src/lib/predictive-models.ts')

const runDate = new Date().toISOString().slice(0, 10)
const forecasts = []
for (let start = 0; start < AMAZON_RIVER_SITES.length; start += 3) {
  const sites = AMAZON_RIVER_SITES.slice(start, start + 3)
  const batch = await Promise.allSettled(sites.map(async ({ name, point }) => {
    const riverId = await findForecastReach(point, AbortSignal.timeout(20_000))
    if (riverId === null) throw new Error('No modeled river reach')
    const [flow, chance] = await Promise.all([
      fetchFlowForecast(riverId, AbortSignal.timeout(30_000)),
      fetchFloodChance(riverId, AbortSignal.timeout(45_000)),
    ])
    if (flow.days[0]?.date !== runDate || typeof chance !== 'number') {
      throw new Error('Incomplete forecast for the current UTC day')
    }
    return { name, point, flow, chance }
  }))
  batch.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      forecasts.push(result.value)
      console.log(`${result.value.name}: ${result.value.chance}% (reach ${result.value.flow.riverId})`)
    } else {
      console.warn(`${sites[index].name}: ${result.reason.message}`)
    }
  })
}

const generatedAt = new Date().toISOString()
if (!forecasts.length || !generatedAt.startsWith(runDate)) {
  throw new Error('No current forecast snapshot was generated. The previous file was kept.')
}
const directory = new URL('../public/data/', import.meta.url)
const output = new URL('flood-forecasts.json', directory)
const temporary = new URL(`flood-forecasts.${process.pid}.tmp`, directory)
await mkdir(directory, { recursive: true })
await writeFile(temporary, `${JSON.stringify({ generatedAt, forecasts })}\n`)
await rename(temporary, output)
console.log(`Saved ${forecasts.length}/${AMAZON_RIVER_SITES.length} reaches to public/data/flood-forecasts.json`)
