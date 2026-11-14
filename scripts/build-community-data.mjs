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
// Source lists come as "A,B,C"; show them as "A, B, C".
const listText = (s) => (s ? String(s).split(/\s*,\s*/).filter(Boolean).join(', ') : null)

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

function bbox(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const p of polys)
    for (const [x, y] of p[0]) {
      w = Math.min(w, x)
      s = Math.min(s, y)
      e = Math.max(e, x)
      n = Math.max(n, y)
    }
  return [w, s, e, n].map((v) => round(v, 4))
}

// Legal phase order, most consolidated first.
const PHASE_RANK = { Regularizada: 6, Homologada: 5, Declarada: 4, Delimitada: 3, 'Encaminhada RI': 2, 'Em Estudo': 1 }

// TerraBrasilis lists some lands twice: the regularized area and a boundary revision in progress.
// Keep one entry per land: the consolidated phase for the record, the larger outline for the map.
function mergeRevisions(features) {
  const groups = new Map()
  for (const f of features) {
    const key = norm(f.properties.nome)
    groups.set(key, [...(groups.get(key) ?? []), f])
  }
  const merged = []
  for (const group of groups.values()) {
    if (group.length === 1) {
      merged.push({ main: group[0], outline: group[0], revision: null })
      continue
    }
    const byPhase = [...group].sort((a, b) => (PHASE_RANK[b.properties.fase] ?? 0) - (PHASE_RANK[a.properties.fase] ?? 0))
    const byArea = [...group].sort((a, b) => (b.properties.area_km2 ?? 0) - (a.properties.area_km2 ?? 0))
    merged.push({ main: byPhase[0], outline: byArea[0], revision: byPhase[1] })
  }
  return merged
}

// Web Mercator pixel position at a MapLibre zoom (512 px tiles).
function project([lon, lat], z) {
  const size = 512 * 2 ** z
  const sin = Math.sin((lat * Math.PI) / 180)
  return [((lon + 180) / 360) * size, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size]
}

// Progressive disclosure: walk zoom levels and reveal points in priority order while they keep a
// pin-sized gap from points already shown. Both pin layers go through one pass so an Indigenous Land
// pin and a riverside pin never stack in the overview. Each item is visible from its own maxZoom on.
function assignMinZoom(items, spacing) {
  const RX = 30
  const RY = 42
  const first = Math.min(...items.map((it) => it.minZoom))
  const last = Math.max(...items.map((it) => it.maxZoom))
  for (let z = first; z <= last; z++) {
    const k = spacing(z)
    const rx = RX * k
    const ry = RY * k
    const grid = new Map()
    const cellKey = (cx, cy) => `${cx},${cy}`
    const place = (p) => {
      const key = cellKey(Math.floor(p[0] / rx), Math.floor(p[1] / ry))
      grid.set(key, [...(grid.get(key) ?? []), p])
    }
    const fits = (p) => {
      const cx = Math.floor(p[0] / rx)
      const cy = Math.floor(p[1] / ry)
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (const q of grid.get(cellKey(cx + dx, cy + dy)) ?? [])
            if (((p[0] - q[0]) / rx) ** 2 + ((p[1] - q[1]) / ry) ** 2 < 1) return false
      return true
    }
    for (const it of items) if (it.minzoom !== undefined) place(project(it.coord, z))
    // Points due at this level go in first; the greedy pass then fills the gaps around them.
    for (const it of items) {
      if (it.minzoom === undefined && it.maxZoom === z) {
        it.minzoom = z
        place(project(it.coord, z))
      }
    }
    for (const it of items) {
      if (it.minzoom !== undefined || z < it.minZoom) continue
      const p = project(it.coord, z)
      if (fits(p)) {
        it.minzoom = z
        place(p)
      }
    }
  }
}

function nearestNeighbourKm(coords) {
  const toRad = (d) => (d * Math.PI) / 180
  const km = ([a, b], [c, d]) => {
    const h = Math.sin(toRad(d - b) / 2) ** 2 + Math.cos(toRad(b)) * Math.cos(toRad(d)) * Math.sin(toRad(c - a) / 2) ** 2
    return 12742 * Math.asin(Math.sqrt(h))
  }
  return coords.map((p, i) => {
    let best = Infinity
    for (let j = 0; j < coords.length; j++) if (j !== i) best = Math.min(best, km(p, coords[j]))
    return best
  })
}

// Wider gaps when zoomed out so the overview stays readable (multiples of the pin footprint).
const SPACING = { 3: 3, 4: 3, 5: 2.6, 6: 2.1, 7: 1.6, 8: 1.25 }
const spacing = (z) => SPACING[z] ?? 1

async function main() {
  await mkdir(OUT, { recursive: true })
  const isa = await fetchIsaIds()

  const tis = await read('terras_indigenas.geojson')
  const lands = mergeRevisions(tis.features)
  let matched = 0
  const tiAreas = []
  const tiPoints = []
  lands.forEach(({ main, outline, revision }, id) => {
    const isaId = isa.get(norm(main.properties.nome)) ?? null
    if (isaId) matched++
    const [bw, bs, be, bn] = bbox(outline.geometry)
    const props = {
      id,
      nome: main.properties.nome,
      etnia: listText(main.properties.etnia),
      fase: main.properties.fase ?? null,
      area_km2: main.properties.area_km2 ?? null,
      revisao_fase: revision?.properties.fase ?? null,
      revisao_area_km2: revision?.properties.area_km2 ?? null,
      focos_2026: outline.properties.focos_2026 ?? 0,
      risco: outline.properties.risco ?? null,
      isaId,
      bw,
      bs,
      be,
      bn,
    }
    tiAreas.push({ type: 'Feature', id, properties: { id, nome: props.nome, risco: props.risco }, geometry: outline.geometry })
    tiPoints.push({ type: 'Feature', id, properties: props, geometry: { type: 'Point', coordinates: centroid(outline.geometry) } })
  })

  // Largest lands first.
  const tiItems = tiPoints
    .map((f) => ({ f, coord: f.geometry.coordinates, minZoom: 3, maxZoom: 9, area: f.properties.area_km2 ?? 0 }))
    .sort((a, b) => b.area - a.area)

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

  // Villages first, then the most isolated communities, so dense river stretches fill in last.
  const isolation = nearestNeighbourKm(riverside.map((f) => f.geometry.coordinates))
  const rsItems = riverside
    .map((f, i) => ({
      f,
      coord: f.geometry.coordinates,
      minZoom: 4,
      maxZoom: 11,
      vila: f.properties.tipo === 'vila',
      iso: isolation[i],
    }))
    .sort((a, b) => Number(b.vila) - Number(a.vila) || b.iso - a.iso)

  // Interleave the two rankings by relative position so each kind keeps its share of the overview.
  const ranked = [
    ...tiItems.map((it, i) => ({ it, rank: i / tiItems.length })),
    ...rsItems.map((it, i) => ({ it, rank: i / rsItems.length })),
  ]
    .sort((a, b) => a.rank - b.rank)
    .map(({ it }) => it)
  assignMinZoom(ranked, spacing)
  for (const it of ranked) it.f.properties.minzoom = it.minzoom

  await write('terras-indigenas.geojson', fc(tiAreas))
  await write('terras-indigenas-pontos.geojson', fc(tiPoints))
  await write('territorios-tradicionais.geojson', fc(reserveAreas))
  await write('comunidades-ribeirinhas.geojson', fc(riverside))

  const merges = lands.filter((l) => l.revision).map((l) => l.main.properties.nome)
  const histogram = (items) =>
    Object.entries(items.reduce((h, it) => ({ ...h, [it.minzoom]: (h[it.minzoom] ?? 0) + 1 }), {}))
      .map(([z, n]) => `z${z}:${n}`)
      .join(' ')
  console.log(`TIs: ${tiPoints.length} from ${tis.features.length} source features (${matched} linked to ISA)`)
  console.log(`  merged boundary revisions: ${merges.join(', ') || 'none'}`)
  console.log(`  pins revealed per zoom: ${histogram(tiItems)}`)
  console.log(`RESEX/RDS: ${reserveAreas.length}`)
  console.log(`riverside communities: ${riverside.length} of ${communities.features.length}`)
  console.log(`  pins revealed per zoom: ${histogram(rsItems)}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
