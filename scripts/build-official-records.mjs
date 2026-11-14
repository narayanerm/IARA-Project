#!/usr/bin/env node
// Builds public/data/official-records.json: links every Indigenous Land and every
// riverside community on the map to an official government source, and fills the
// figures shown in the sidebar.
//
// Indigenous Lands (public/data/terras-indigenas-pontos.geojson):
//   FUNAI GeoServer, layer Funai:tis_poligonais_portarias -> land code, phase,
//     official area, homologation date, regional office (CR) and its gov.br page.
//   IBGE Census 2022, SIDRA table 9719 (level N125, Terra Indígena) -> residents.
// Riverside communities (public/data/comunidades-ribeirinhas.geojson):
//   IBGE localities API -> municipality code and UF, IBGE Cidades page.
//   IBGE Census 2022, SIDRA table 4714 -> municipal population and area.
//
// Usage (Node 18+, needs internet): node scripts/build-official-records.mjs

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import https from 'node:https'
import tls from 'node:tls'
import { X509Certificate } from 'node:crypto'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = resolve(ROOT, 'public/data')

const FUNAI_WFS = 'https://geoserver.funai.gov.br/geoserver/Funai/ows'
const FUNAI_LAYER = 'Funai:tis_poligonais_portarias'
const FUNAI_OFFICES =
  'https://www.gov.br/funai/pt-br/acesso-a-informacao/institucional/coordenacoes-regionais-funai/'
const IBGE = 'https://servicodados.ibge.gov.br/api'

// FUNAI regional office code -> page slug and place name on gov.br/funai.
const OFFICES = {
  'CR-ANP': ['cr-amapa-e-norte-do-para', 'Amapá e Norte do Pará'],
  'CR-APUR': ['cr-alto-purus', 'Alto Purus'],
  'CR-AS': ['cr-alto-solimoes', 'Alto Solimões'],
  'CR-ATO': ['cr-araguaia-tocantins', 'Araguaia Tocantins'],
  'CR-BTO': ['cr-baixo-tocantins', 'Baixo Tocantins'],
  'CR-CAC': ['cr-cacoal', 'Cacoal'],
  'CR-CGB': ['cr-cuiaba', 'Cuiabá'],
  'CR-CGR': ['cr-campo-grande', 'Campo Grande'],
  'CR-CLPA': ['cr-centro-leste-do-para', 'Centro Leste do Pará'],
  'CR-GJM': ['cr-guajara-mirim', 'Guajará-Mirim'],
  'CR-JPR': ['cr-ji-parana', 'Ji-Paraná'],
  'CR-JUR': ['cr-jurua', 'Juruá'],
  'CR-KSPA': ['cr-kayapo-sul-do-para', 'Kayapó Sul do Pará'],
  'CR-MA': ['cr-maranhao', 'Maranhão'],
  'CR-MAD': ['cr-madeira', 'Madeira'],
  'CR-MAO': ['cr-manaus', 'Manaus'],
  'CR-MJUR': ['cr-medio-jurua', 'Médio Juruá'],
  'CR-MPUR': ['cr-medio-purus', 'Médio Purus'],
  'CR-MS': ['cr-medio-solimoes', 'Médio Solimões'],
  'CR-NMT': ['cr-norte-mato-grosso', 'Norte do Mato Grosso'],
  'CR-NOMT': ['cr-noroeste-mato-grosso', 'Noroeste do Mato Grosso'],
  'CR-RC': ['cr-ribeirao-cascalheira', 'Ribeirão Cascalheira'],
  'CR-RNG': ['cr-rio-negro', 'Rio Negro'],
  'CR-TPJ': ['cr-tapajos', 'Tapajós'],
  'CR-VJ': ['cr-vale-do-javari', 'Vale do Javari'],
  'CR-XAV': ['cr-xavante', 'Xavante'],
  'CR-XIN': ['cr-xingu', 'Xingu'],
}

// FUNAI data still lists one "CR-RR"; since 2025 it is split. Roraima I keeps the
// former office (UTLs Normandia, Pacaraima, Uiramutã) and the Yanomami land;
// Roraima II serves the smaller lands elsewhere in the state.
const RORAIMA_I_MUNICIPALITIES = ['normandia', 'pacaraima', 'uiramuta']
function roraimaOffice(land) {
  const muns = list(land.municipio_nome).map(key)
  const roraimaI =
    key(land.terrai_nome) === 'yanomami' || muns.some((m) => RORAIMA_I_MUNICIPALITIES.includes(m))
  return roraimaI ? ['cr-roraima-i', 'Roraima I'] : ['cr-roraima-ii', 'Roraima II']
}

const LEGAL_AMAZON_UFS = [11, 12, 13, 14, 15, 16, 17, 21, 51]

/** Name key used to match records across sources: no accents, case or punctuation. */
export function key(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

const list = (s) =>
  String(s ?? '')
    .split(/\s+e\s+|\s*,\s*/)
    .map((x) => x.trim())
    .filter(Boolean)

function slug(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function levenshtein(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

// Some gov.br servers do not send their intermediate certificate. Browsers fetch it
// from the certificate's "CA Issuers" address (AIA); Node does not, so we do the same
// here and then verify the full chain normally (verification stays on).
const extraCa = new Map()

function peerCertificate(host) {
  return new Promise((ok, fail) => {
    // Only reads the certificate the server presents; no request is sent on this socket.
    const socket = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate(true)
      socket.end()
      ok(cert)
    })
    socket.on('error', fail)
  })
}

const issuerUrl = (infoAccess) => /CA Issuers - URI:(\S+)/.exec(infoAccess ?? '')?.[1] ?? null

function derToPem(der) {
  const b64 = der.toString('base64').match(/.{1,64}/g).join('\n')
  return `-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----\n`
}

/** Certificates inside a DER blob: a single certificate or a PKCS#7 (.p7c) bundle. */
function certificatesIn(buf) {
  const text = buf.toString('latin1')
  if (text.includes('BEGIN CERTIFICATE')) {
    return text.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? []
  }
  const found = []
  // A certificate is a DER SEQUENCE (30 82 len len) whose first element is another SEQUENCE.
  for (let i = 0; i + 8 < buf.length; i++) {
    if (buf[i] !== 0x30 || buf[i + 1] !== 0x82 || buf[i + 4] !== 0x30 || buf[i + 5] !== 0x82) continue
    const len = (buf[i + 2] << 8) + buf[i + 3] + 4
    if (i + len > buf.length) continue
    try {
      const pem = derToPem(buf.subarray(i, i + len))
      new X509Certificate(pem)
      found.push(pem)
      i += len - 1
    } catch {
      // not a certificate at this offset
    }
  }
  return found
}

async function missingChain(host) {
  const leaf = await peerCertificate(host)
  let url = leaf.infoAccess?.['CA Issuers - URI']?.[0] ?? null
  const pems = []
  for (let i = 0; url && i < 4; i++) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`CA issuer ${url}: ${res.status}`)
    const certs = certificatesIn(Buffer.from(await res.arrayBuffer()))
    if (!certs.length) throw new Error(`CA issuer ${url}: no certificate found`)
    pems.push(...certs)
    const last = new X509Certificate(certs[certs.length - 1])
    if (last.subject === last.issuer) break
    url = issuerUrl(last.infoAccess)
  }
  if (!pems.length) throw new Error(`${host}: certificate has no CA Issuers address`)
  console.log(`  ${host}: fetched ${pems.length} missing CA certificate(s) from the issuer address`)
  return pems
}

function httpsJson(url, ca) {
  return new Promise((ok, fail) => {
    https
      .get(url, { ca, headers: HEADERS }, (res) => {
        if (res.statusCode !== 200) {
          res.resume()
          return fail(new Error(`${res.statusCode} ${res.statusMessage}`))
        }
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          try {
            ok(JSON.parse(Buffer.concat(chunks).toString('utf8')))
          } catch (e) {
            fail(e)
          }
        })
      })
      .on('error', fail)
  })
}

const HEADERS = {
  accept: 'application/json',
  'user-agent': 'Mozilla/5.0 (compatible; IARA-data-builder/1.0; +https://github.com/narayanerm/IARA-Project)',
}

const CHAIN_ERRORS = /UNABLE_TO_VERIFY_LEAF_SIGNATURE|UNABLE_TO_GET_ISSUER_CERT/

async function getJson(url) {
  const host = new URL(url).host
  for (let attempt = 1; ; attempt++) {
    try {
      if (extraCa.has(host)) {
        return await httpsJson(url, [...tls.rootCertificates, ...(await extraCa.get(host))])
      }
      const r = await fetch(url, { headers: HEADERS })
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
      return await r.json()
    } catch (e) {
      const code = e.cause?.code ?? e.code ?? ''
      if (!extraCa.has(host) && CHAIN_ERRORS.test(code)) {
        extraCa.set(host, missingChain(host))
        attempt--
        continue
      }
      if (attempt >= 3) throw new Error(`${url}\n  -> ${e.message}${code ? ` (${code})` : ''}`)
      await new Promise((ok) => setTimeout(ok, 1500 * attempt))
    }
  }
}

async function readGeojson(name) {
  return JSON.parse(await readFile(resolve(DATA, name), 'utf8')).features.map((f) => f.properties)
}

async function funaiLands() {
  const props = [
    'terrai_codigo',
    'terrai_nome',
    'municipio_nome',
    'uf_sigla',
    'superficie_perimetro_ha',
    'fase_ti',
    'modalidade_ti',
    'data_declarada',
    'data_homologada',
    'data_regularizada',
    'undadm_sigla',
  ].join(',')
  const out = []
  for (let start = 0; ; start += 200) {
    const q = new URLSearchParams({
      service: 'WFS',
      version: '2.0.0',
      request: 'GetFeature',
      typeNames: FUNAI_LAYER,
      outputFormat: 'application/json',
      count: '200',
      startIndex: String(start),
      sortBy: 'terrai_codigo',
      propertyName: props,
    })
    const page = await getJson(`${FUNAI_WFS}?${q}`)
    out.push(...page.features.map((f) => f.properties))
    if (page.features.length < 200) return out
  }
}

/** Residents of each Indigenous Land (IBGE Census 2022), summed across its UF parts. */
async function ibgeLandPopulation() {
  const url = `${IBGE}/v3/agregados/9719/periodos/2022/variaveis/576|1432?localidades=N125[all]&classificacao=1714[60024]`
  const data = await getJson(url)
  const byVar = Object.fromEntries(data.map((v) => [v.id, v.resultados[0].series]))
  const out = new Map()
  for (const [varId, field] of [
    ['576', 'residents'],
    ['1432', 'indigenous'],
  ]) {
    for (const s of byVar[varId] ?? []) {
      const name = s.localidade.nome.replace(/ - [A-Z]{2}$/, '')
      const k = key(name)
      const e = out.get(k) ?? { residents: 0, indigenous: 0 }
      e[field] += Number(s.serie['2022']) || 0
      out.set(k, e)
    }
  }
  return out
}

const isoDate = (d) => (d ? String(d).slice(0, 10) : null)

function pickFunai(candidates, areaKm2) {
  if (candidates.length <= 1) return candidates[0] ?? null
  // Same name twice = original land + boundary revision: keep the closest area.
  return [...candidates].sort(
    (a, b) =>
      Math.abs(a.superficie_perimetro_ha / 100 - (areaKm2 ?? 0)) -
      Math.abs(b.superficie_perimetro_ha / 100 - (areaKm2 ?? 0))
  )[0]
}

async function buildLands(points) {
  const [funai, population] = await Promise.all([funaiLands(), ibgeLandPopulation()])
  const byName = new Map()
  for (const f of funai) {
    const k = key(f.terrai_nome)
    byName.set(k, [...(byName.get(k) ?? []), f])
  }
  const popKeys = [...population.keys()]

  const lands = {}
  const missing = { funai: [], ibge: [] }
  for (const p of points) {
    const k = key(p.nome)
    let candidates = byName.get(k) ?? []
    if (!candidates.length) {
      // Small spelling differences ("Uty-Xunaty" vs "Uty-Xunati").
      const near = [...byName.keys()].filter((n) => n.length > 5 && levenshtein(n, k) <= 2)
      if (near.length === 1) candidates = byName.get(near[0])
    }
    const f = pickFunai(candidates, p.area_km2)
    let pop = population.get(k)
    if (!pop) {
      const near = popKeys.filter((n) => n.length > 5 && levenshtein(n, k) <= 2)
      if (near.length === 1) pop = population.get(near[0])
    }
    if (!f) missing.funai.push(p.nome)
    if (!pop) missing.ibge.push(p.nome)

    let office = null
    if (f?.undadm_sigla) {
      const code = f.undadm_sigla.toUpperCase()
      const [officeSlug, place] = code === 'CR-RR' ? roraimaOffice(f) : (OFFICES[code] ?? [])
      office = officeSlug
        ? { code: f.undadm_sigla, name: place, url: FUNAI_OFFICES + officeSlug }
        : { code: f.undadm_sigla, name: null, url: null }
    }

    lands[k] = {
      name: p.nome,
      isaId: p.isaId ?? null,
      funai: f
        ? {
            code: f.terrai_codigo,
            name: f.terrai_nome,
            phase: f.fase_ti ?? null,
            modality: f.modalidade_ti ?? null,
            areaKm2: f.superficie_perimetro_ha != null ? Math.round(f.superficie_perimetro_ha / 100) : null,
            declared: isoDate(f.data_declarada),
            homologated: isoDate(f.data_homologada),
            regularized: isoDate(f.data_regularizada),
          }
        : null,
      office,
      census2022: pop ? { residents: pop.residents, indigenous: pop.indigenous } : null,
    }
  }
  return { lands, missing }
}

async function buildMunicipalities(riverside) {
  const wanted = new Set(riverside.map((r) => key(r.municipio)).filter(Boolean))
  const all = []
  for (const uf of LEGAL_AMAZON_UFS) {
    const muns = await getJson(`${IBGE}/v1/localidades/estados/${uf}/municipios`)
    for (const m of muns) {
      const ufSigla = m.microrregiao?.mesorregiao?.UF?.sigla ?? m['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla
      if (wanted.has(key(m.nome))) all.push({ id: m.id, name: m.nome, uf: ufSigla })
    }
  }
  const ids = all.map((m) => m.id).join(',')
  const stats = new Map()
  if (ids) {
    const data = await getJson(`${IBGE}/v3/agregados/4714/periodos/2022/variaveis/93|6318?localidades=N6[${ids}]`)
    for (const v of data) {
      for (const s of v.resultados[0].series) {
        const e = stats.get(s.localidade.id) ?? {}
        if (v.id === '93') e.population = Number(s.serie['2022']) || null
        if (v.id === '6318') e.areaKm2 = Math.round(Number(s.serie['2022'])) || null
        stats.set(s.localidade.id, e)
      }
    }
  }

  // A municipality name can repeat across UFs: keep the UF with the most communities' points
  // inside the Amazonas-centric data; ties keep the first (logged for review).
  const byKey = new Map()
  for (const m of all) byKey.set(key(m.name), [...(byKey.get(key(m.name)) ?? []), m])
  const municipalities = {}
  const ambiguous = []
  const missing = []
  for (const k of wanted) {
    const options = byKey.get(k) ?? []
    if (!options.length) {
      missing.push(k)
      continue
    }
    if (options.length > 1) ambiguous.push(options.map((o) => `${o.name}/${o.uf}`).join(' | '))
    const m = options.find((o) => o.uf === 'AM') ?? options[0]
    const s = stats.get(String(m.id)) ?? {}
    municipalities[k] = {
      name: m.name,
      ibgeCode: m.id,
      uf: m.uf,
      url: `https://cidades.ibge.gov.br/brasil/${m.uf.toLowerCase()}/${slug(m.name)}/panorama`,
      population: s.population ?? null,
      areaKm2: s.areaKm2 ?? null,
    }
  }
  return { municipalities, ambiguous, missing }
}

async function main() {
  const [points, riverside] = await Promise.all([
    readGeojson('terras-indigenas-pontos.geojson'),
    readGeojson('comunidades-ribeirinhas.geojson'),
  ])
  console.log(`Read ${points.length} Indigenous Lands and ${riverside.length} riverside communities.`)

  const { lands, missing } = await buildLands(points)
  const muni = await buildMunicipalities(riverside)

  const out = {
    generatedAt: new Date().toISOString().slice(0, 10),
    sources: {
      funai: `FUNAI GeoServer, ${FUNAI_LAYER}`,
      landPopulation: 'IBGE, Censo Demográfico 2022, SIDRA tabela 9719 (Terras Indígenas)',
      municipalities: 'IBGE, Censo Demográfico 2022, SIDRA tabela 4714; IBGE Localidades API',
    },
    lands,
    municipalities: muni.municipalities,
  }
  await writeFile(resolve(DATA, 'official-records.json'), JSON.stringify(out))

  const count = (f) => Object.values(lands).filter(f).length
  console.log(`Lands: ${points.length}`)
  console.log(`  FUNAI record:        ${count((l) => l.funai)}`)
  console.log(`  regional office page: ${count((l) => l.office?.url)}`)
  console.log(`  homologation date:   ${count((l) => l.funai?.homologated)}`)
  console.log(`  IBGE 2022 residents: ${count((l) => l.census2022)}`)
  if (missing.funai.length) console.log(`  no FUNAI match: ${missing.funai.join(', ')}`)
  if (missing.ibge.length) console.log(`  no IBGE population: ${missing.ibge.join(', ')}`)
  const offices = new Set(Object.values(lands).filter((l) => l.office && !l.office.url).map((l) => l.office.code))
  if (offices.size) console.log(`  offices without page: ${[...offices].join(', ')}`)
  console.log(`Municipalities: ${Object.keys(muni.municipalities).length}`)
  if (muni.missing.length) console.log(`  not found in IBGE: ${muni.missing.join(', ')}`)
  if (muni.ambiguous.length) console.log(`  same name in several UFs: ${muni.ambiguous.join('; ')}`)
  console.log('Wrote public/data/official-records.json')
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
