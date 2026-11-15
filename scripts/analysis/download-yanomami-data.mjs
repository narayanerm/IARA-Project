#!/usr/bin/env node
// Fetches PRODES + DETER polygons 2016-2023 inside the TI Yanomami bbox and writes
// compact GeoJSONs the static HTML can load instantly.
//
// Strategy: tight bbox on the server (fast CQL), no exact geometric clipping (turf
// booleanIntersects on 11 MB of multi-polygons against a 1 MB FUNAI boundary is O(n·m)
// and locks CPU for minutes). Features slightly outside the TI are kept in the output
// but Leaflet will mask them visually with the TI outline — close enough for the plot.
//
// Usage: npm run data:yanomami

import { writeFileSync, mkdirSync } from 'node:fs'

const OUT = 'public/analysis/data'
mkdirSync(OUT, { recursive: true })

const WFS = 'https://terrabrasilis.dpi.inpe.br/geoserver/ows'
const YEAR_START = 2016
const YEAR_END = 2023
// Bbox regional para DETER MINERACAO: Roraima + N. Amazonas + N. Pará.
// Permite ver o contexto de garimpo ao redor da TI Yanomami, não só dentro.
const DETER_MINING_BBOX = '-70,-5,-58,6'
const DETER_MINING_YEAR_START = 2019
const DETER_MINING_YEAR_END = 2026

const roundCoords = (geom, precision = 5) => {
  const p = 10 ** precision
  const r = (c) => Array.isArray(c[0]) ? c.map(r) : [Math.round(c[0] * p) / p, Math.round(c[1] * p) / p]
  return { ...geom, coordinates: r(geom.coordinates) }
}

function featureBbox(geom) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      if (c[0] < minX) minX = c[0]
      if (c[1] < minY) minY = c[1]
      if (c[0] > maxX) maxX = c[0]
      if (c[1] > maxY) maxY = c[1]
    } else {
      for (const inner of c) walk(inner)
    }
  }
  walk(geom.coordinates)
  return [minX, minY, maxX, maxY]
}

async function wfsGet(typeName, cql) {
  const url = new URL(WFS)
  url.searchParams.set('service', 'WFS')
  url.searchParams.set('version', '2.0.0')
  url.searchParams.set('request', 'GetFeature')
  url.searchParams.set('typeName', typeName)
  url.searchParams.set('outputFormat', 'application/json')
  url.searchParams.set('CQL_FILTER', cql)
  console.log(`[fetch] ${typeName}`)
  const t0 = Date.now()
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${typeName}: HTTP ${res.status}`)
  const body = await res.json()
  console.log(`  ${body.features.length} features in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  return body
}

function thin(fc, pickProps) {
  const kept = []
  for (const f of fc.features) {
    if (!f.geometry) continue
    kept.push({
      type: 'Feature',
      properties: pickProps(f.properties),
      geometry: roundCoords(f.geometry),
    })
  }
  return { type: 'FeatureCollection', features: kept }
}

function writeOut(name, fc) {
  const path = `${OUT}/${name}.geojson`
  const text = JSON.stringify(fc)
  writeFileSync(path, text)
  console.log(`[write] ${path} · ${fc.features.length} features · ${(text.length / 1024).toFixed(0)} KB`)
}

async function main() {
  // 1. Yanomami polygon from FUNAI (used by the HTML for the AOI outline + for its bbox).
  console.log('[fetch] Yanomami polygon from FUNAI')
  const funaiRes = await fetch(
    `${WFS}?service=WFS&version=2.0.0&request=GetFeature` +
    `&typeName=prodes-legal-amz:indigenous_area_legal_amazon` +
    `&outputFormat=application/json&count=1` +
    `&CQL_FILTER=` + encodeURIComponent("terrai_nom ILIKE 'Yanomami%'")
  )
  const funaiBody = await funaiRes.json()
  const yano = funaiBody.features[0]
  if (!yano) throw new Error('Yanomami polygon not found on FUNAI WFS')
  const [minLon, minLat, maxLon, maxLat] = featureBbox(yano.geometry)
  console.log(`  bbox: ${minLon.toFixed(2)},${minLat.toFixed(2)} → ${maxLon.toFixed(2)},${maxLat.toFixed(2)}`)
  const thinYano = {
    type: 'Feature',
    properties: {
      terrai_nom: yano.properties.terrai_nom,
      terrai_cod: yano.properties.terrai_cod,
      etnia_nome: yano.properties.etnia_nome,
      fase_ti: yano.properties.fase_ti,
    },
    geometry: roundCoords(yano.geometry),
  }
  writeOut('yanomami-polygon', { type: 'FeatureCollection', features: [thinYano] })

  const bbox = `${minLon},${minLat},${maxLon},${maxLat}`

  // 2. PRODES corte-raso 2016-2023 inside the TI bbox
  const prodes = await wfsGet(
    'prodes-amazon-nb:yearly_deforestation_biome',
    `year>=${YEAR_START} AND year<=${YEAR_END} AND BBOX(geom,${bbox},'EPSG:4326')`
  )
  writeOut('prodes-yanomami-2016-2023', thin(prodes, (p) => ({
    year: p.year,
    class_name: p.class_name,
    area_km: p.area_km,
  })))

  // 3a. DETER-Amz alerts 2016-2023 inside the TI bbox (all classes) — used by yanomami.html
  const deter = await wfsGet(
    'deter-amz:deter_amz',
    `view_date>='${YEAR_START}-01-01' AND view_date<='${YEAR_END}-12-31' AND BBOX(geom,${bbox},'EPSG:4326')`
  )
  writeOut('deter-yanomami-2016-2023', thin(deter, (p) => ({
    classname: p.classname,
    view_date: p.view_date,
    areamunkm: p.areamunkm,
    municipality: p.municipality,
  })))

  // 3b. DETER-Amz MINERACAO classe apenas, bbox regional 2019-2026 — usado pela narrativa
  // "revelação" do yanomami-nisar.html. Garimpo ao redor da TI dá contexto espacial
  // que a visão só-dentro-do-polígono esconde.
  const deterMining = await wfsGet(
    'deter-amz:deter_amz',
    `classname='MINERACAO' AND view_date>='${DETER_MINING_YEAR_START}-01-01' ` +
      `AND view_date<='${DETER_MINING_YEAR_END}-12-31' ` +
      `AND BBOX(geom,${DETER_MINING_BBOX},'EPSG:4326')`
  )
  writeOut(
    `deter-mineracao-regional-${DETER_MINING_YEAR_START}-${DETER_MINING_YEAR_END}`,
    thin(deterMining, (p) => ({
      classname: p.classname,
      view_date: p.view_date,
      areamunkm: p.areamunkm,
      municipality: p.municipality,
    }))
  )

  console.log('\n[done] all files in', OUT)
}

main().catch((e) => { console.error(e); process.exit(1) })
