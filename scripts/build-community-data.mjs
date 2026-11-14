// Converts the team's community data package into lean GeoJSON served from public/data.
// Usage: node scripts/build-community-data.mjs <path-to>/dados_comunidades_amazonia
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'data')
const ISA_HOME = 'https://terrasindigenas.org.br/'

const src = process.argv[2]
if (!src) {
  console.error('usage: node scripts/build-community-data.mjs <dados_comunidades_amazonia dir>')
  process.exit(1)
}

const read = async (name) => JSON.parse(await readFile(join(src, 'mapas_geojson', name), 'utf8'))
const write = (name, fc) => writeFile(join(OUT, name), JSON.stringify(fc) + '\n')
const fc = (features) => ({ type: 'FeatureCollection', features })
const round = (n, d = 5) => (typeof n === 'number' ? Math.round(n * 10 ** d) / 10 ** d : n)

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^(terra indigena|parque indigena|ti)\s+/, '')
    .replace(/[^a-z0-9]/g, '')

function ringArea(ring) {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1])
  }
  return Math.abs(a / 2)
}

function centroid(geometry) {
  const rings = geometry.type === 'Polygon' ? [geometry.coordinates[0]] : geometry.coordinates.map((p) => p[0])
  const ring = rings.reduce((best, r) => (ringArea(r) > ringArea(best) ? r : best))
  let x = 0
  let y = 0
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
    x += (ring[j][0] + ring[i][0]) * f
    y += (ring[j][1] + ring[i][1]) * f
    a += f
  }
  return a === 0 ? ring[0] : [round(x / (3 * a)), round(y / (3 * a))]
}

async function fetchIsaIds() {
  try {
    const html = await (await fetch(ISA_HOME, { signal: AbortSignal.timeout(60_000) })).text()
    const ids = new Map()
    for (const m of html.matchAll(/href="\/pt-br\/terras-indigenas\/(\d+)"[^>]*>([^<]+)</g)) {
      const key = norm(m[2])
      if (!ids.has(key)) ids.set(key, Number(m[1]))
    }
    return ids
  } catch (err) {
    console.warn(`ISA index unavailable (${err.message}); TI popups will link to FUNAI only`)
    return new Map()
  }
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const isa = await fetchIsaIds()

  const tis = await read('terras_indigenas.geojson')
  let matched = 0
  const tiAreas = []
  const tiPoints = []
  tis.features.forEach((f, id) => {
    const isaId = isa.get(norm(f.properties.nome)) ?? null
    if (isaId) matched++
    const props = {
      id,
      nome: f.properties.nome,
      etnia: f.properties.etnia ?? null,
      fase: f.properties.fase ?? null,
      area_km2: f.properties.area_km2 ?? null,
      focos_2026: f.properties.focos_2026 ?? 0,
      risco: f.properties.risco ?? null,
      isaId,
    }
    tiAreas.push({ type: 'Feature', id, properties: { id, nome: props.nome, risco: props.risco }, geometry: f.geometry })
    tiPoints.push({ type: 'Feature', id, properties: props, geometry: { type: 'Point', coordinates: centroid(f.geometry) } })
  })

  const reserves = await read('territorios_tradicionais.geojson')
  const reserveAreas = reserves.features.map((f, id) => ({
    type: 'Feature',
    id,
    properties: {
      id,
      nome: f.properties.nome,
      classe: f.properties.classe,
      esfera: f.properties.esfera ?? null,
      ano_criacao: f.properties.ano_criacao ?? null,
      area_km2: f.properties.area_km2 ?? null,
      risco: f.properties.risco ?? null,
    },
    geometry: f.geometry,
  }))

  const communities = await read('comunidades_ribeirinhas.geojson')
  const riverside = communities.features
    .filter((f) => f.properties.ribeirinha === 'sim')
    .map((f, id) => {
      const p = f.properties
      return {
        type: 'Feature',
        id,
        properties: {
          id,
          nome: p.nome,
          tipo: p.tipo,
          municipio: p.municipio,
          rio: p.rio ?? null,
          cidade_prox: p.cidade_prox ?? null,
          dist_cidade_km: p.dist_cidade_km ?? null,
          focos_10km: p.focos_10km ?? 0,
          risco: p.risco ?? null,
          dificuldade: p.dificuldade ?? null,
          atividade_principal_mun: p.atividade_principal_mun ?? null,
        },
        geometry: { type: 'Point', coordinates: f.geometry.coordinates.map((n) => round(n)) },
      }
    })

  await write('terras-indigenas.geojson', fc(tiAreas))
  await write('terras-indigenas-pontos.geojson', fc(tiPoints))
  await write('territorios-tradicionais.geojson', fc(reserveAreas))
  await write('comunidades-ribeirinhas.geojson', fc(riverside))

  console.log(`TIs: ${tiPoints.length} (${matched} linked to ISA)`)
  console.log(`RESEX/RDS: ${reserveAreas.length}`)
  console.log(`riverside communities: ${riverside.length} of ${communities.features.length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
