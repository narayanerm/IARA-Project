import { INDIGENOUS_LANDS } from '@/data/layers/indigenous-lands'

export function tokensOf(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`
  return n.toLocaleString('pt-BR')
}

export function buildAsfVertexUrl([lon, lat]: [number, number]): string {
  const params = new URLSearchParams({
    zoom: '8',
    center: `${lon.toFixed(3)},${lat.toFixed(3)}`,
    dataset: 'SENTINEL-1',
    start: '2023-01-01T00:00:00Z',
    productTypes: 'GRD_HD',
  })
  return `https://search.asf.alaska.edu/#/?${params}`
}

// Map of enriched (ISA) TI properties keyed by lowercase name without "TI " / "Parque Indígena do " prefix.
export const ENRICHED_TI_PROPS = new Map(
  INDIGENOUS_LANDS.features.map((f) => [
    f.properties.name.replace(/^TI\s+/i, '').replace(/^Parque Indígena do\s+/i, '').toLowerCase(),
    f.properties,
  ])
)
