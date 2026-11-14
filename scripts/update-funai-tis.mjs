#!/usr/bin/env node
// Atualiza src/data/layers/funai-tis.ts com os registros oficiais das Terras
// Indígenas mostradas no mapa, lidos da base aberta da FUNAI (GeoServer WFS).
//
// Por que um arquivo local? O GeoServer da FUNAI não libera CORS, então o
// navegador não consegue ler os dados direto de dentro do app. Node não tem essa
// restrição: rode este script para trazer a versão mais recente.
//
// Uso:  node scripts/update-funai-tis.mjs
//       node scripts/update-funai-tis.mjs --from snapshot.json   (offline)
//       snapshot.json = { "attrs": [...properties], "bbox": { "<codigo>": [w,s,e,n] } }

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const WFS = 'https://geoserver.funai.gov.br/geoserver/Funai/ows'
const LAYER = 'Funai:tis_poligonais'

// Nome usado no app (src/data/layers/indigenous-lands.ts) → terrai_codigo oficial.
const TIS = {
  'TI Yanomami': 50901,
  'TI Raposa Serra do Sol': 37901,
  'TI Vale do Javari': 48701,
  'Parque Indígena do Xingu': 33801,
  'TI Kayapó': 23001,
  'TI Trombetas-Mapuera': 46401,
  'TI Alto Rio Negro': 1101,
  'TI Munduruku': 29801,
  'TI Apyterewa': 3002,
  'TI Araribóia': 3601,
  'TI Alto Turiaçu': 1501,
  'TI Kaxinawá do Rio Humaitá': 22501,
  'TI Mamoadate': 26201,
  'TI Uru-Eu-Wau-Wau': 48201,
  'TI Waimiri-Atroari': 49501,
}

const FIELDS = [
  'terrai_codigo',
  'terrai_nome',
  'etnia_nome',
  'municipio_nome',
  'uf_sigla',
  'superficie_perimetro_ha',
  'fase_ti',
  'modalidade_ti',
  'reestudo_ti',
  'undadm_nome',
  'undadm_sigla',
  'faixa_fronteira',
  'data_atualizacao',
]

function wfsUrl(propertyName) {
  const codes = Object.values(TIS).join(',')
  const q = new URLSearchParams({
    service: 'WFS',
    version: '1.0.0',
    request: 'GetFeature',
    typeName: LAYER,
    outputFormat: 'application/json',
    propertyName,
    CQL_FILTER: `terrai_codigo IN (${codes})`,
  })
  return `${WFS}?${q}`
}

async function getJson(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`FUNAI respondeu ${r.status} para ${url}`)
  return r.json()
}

function bboxOf(geometry) {
  const b = [180, 90, -180, -90]
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      b[0] = Math.min(b[0], c[0])
      b[1] = Math.min(b[1], c[1])
      b[2] = Math.max(b[2], c[0])
      b[3] = Math.max(b[3], c[1])
    } else c.forEach(walk)
  }
  walk(geometry.coordinates)
  return b.map((v) => +v.toFixed(4))
}

async function fetchLive() {
  const attrs = (await getJson(wfsUrl(FIELDS.join(',')))).features.map((f) => f.properties)
  const geo = await getJson(wfsUrl('terrai_codigo,the_geom'))
  const bbox = {}
  for (const f of geo.features) bbox[f.properties.terrai_codigo] = bboxOf(f.geometry)
  return { attrs, bbox }
}

const clean = (v) => {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function toRecord(p, bbox) {
  return {
    codigo: Number(p.terrai_codigo),
    nome: clean(p.terrai_nome) ?? '',
    etnias: clean(p.etnia_nome),
    municipios: clean(p.municipio_nome),
    uf: clean(p.uf_sigla),
    areaHa: p.superficie_perimetro_ha == null ? null : +Number(p.superficie_perimetro_ha).toFixed(2),
    fase: clean(p.fase_ti),
    modalidade: clean(p.modalidade_ti),
    reestudo: clean(p.reestudo_ti),
    cr: clean(p.undadm_nome),
    crSigla: clean(p.undadm_sigla),
    faixaFronteira: clean(p.faixa_fronteira),
    atualizadoEm: clean(p.data_atualizacao),
    bbox: bbox ?? null,
  }
}

function render(records, fetchedAt) {
  const lit = (v) => JSON.stringify(v)
  const body = Object.entries(records)
    .map(([name, r]) => {
      const lines = Object.entries(r).map(([k, v]) => `    ${k}: ${lit(v)},`)
      return `  ${lit(name)}: {\n${lines.join('\n')}\n  },`
    })
    .join('\n')
  return `// Gerado por scripts/update-funai-tis.mjs. Não editar à mão: rode o script de novo.
// Fonte: FUNAI, GeoServer ${LAYER} (dados abertos, SIRGAS 2000).

export interface FunaiTiRecord {
  codigo: number
  nome: string
  etnias: string | null
  municipios: string | null
  uf: string | null
  areaHa: number | null
  fase: string | null
  modalidade: string | null
  reestudo: string | null
  cr: string | null
  crSigla: string | null
  faixaFronteira: string | null
  atualizadoEm: string | null
  /** [oeste, sul, leste, norte] do polígono oficial, em graus. */
  bbox: [number, number, number, number] | null
}

/** Data (AAAA-MM-DD) em que os registros foram copiados da FUNAI. */
export const FUNAI_TIS_FETCHED_AT = ${lit(fetchedAt)}

/** Registro oficial por nome da TI usado no app. */
export const FUNAI_TIS: Record<string, FunaiTiRecord> = {
${body}
}
`
}

async function main() {
  const i = process.argv.indexOf('--from')
  const snap = i > 0 ? JSON.parse(await readFile(process.argv[i + 1], 'utf8')) : await fetchLive()
  const byCode = new Map(snap.attrs.map((p) => [Number(p.terrai_codigo), p]))
  const records = {}
  const missing = []
  for (const [name, code] of Object.entries(TIS)) {
    const p = byCode.get(code)
    if (!p) {
      missing.push(`${name} (${code})`)
      continue
    }
    records[name] = toRecord(p, snap.bbox?.[code])
  }
  const fetchedAt = new Date().toISOString().slice(0, 10)
  const here = dirname(fileURLToPath(import.meta.url))
  const out = resolve(here, '../src/data/layers/funai-tis.ts')
  await writeFile(out, render(records, fetchedAt))
  console.log(`OK: ${Object.keys(records).length} TIs gravadas em ${out}`)
  if (missing.length) console.warn(`Sem registro na FUNAI: ${missing.join(', ')}`)
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
