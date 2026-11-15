#!/usr/bin/env node
// Downloads Sentinel-1 GRD browse JPGs covering the TI Yanomami bbox (2016-2023)
// and writes a compact catalog JSON. Same pattern as download-alos.mjs.
//
// Usage: npm run data:sentinel1

import { writeFileSync, mkdirSync, existsSync, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const CASE = (process.env.CASE || 'YANO').toUpperCase()
const CASES = {
  YANO: { bbox: '-66.5,-0.5,-61.0,4.5', browseDir: 'sentinel1-browse', catalog: 'sentinel1-catalog.json' },
  ENCH: { bbox: '-60.5,-3.4,-59.6,-2.8', browseDir: 'sentinel1-browse-manaus', catalog: 'sentinel1-manaus-catalog.json' },
  SECA: { bbox: '-61.3,-4.3,-60.1,-3.2', browseDir: 'sentinel1-browse-manaquiri', catalog: 'sentinel1-manaquiri-catalog.json' },
}
if (!CASES[CASE]) { console.error(`unknown CASE=${CASE}`); process.exit(2) }
const _CFG = CASES[CASE]

const OUT = 'public/analysis/data'
const BROWSE_DIR = `${OUT}/${_CFG.browseDir}`
mkdirSync(BROWSE_DIR, { recursive: true })

const BBOX = _CFG.bbox
const YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023]
const CONCURRENCY = 12
// How many revisits to keep per (path, frame) cell so NODATA from one pass gets
// filled by another. Set high (6) because single-pass cells leave visible holes.
const PER_CELL = 6

async function fetchYear(y) {
  const u = new URL('https://api.daac.asf.alaska.edu/services/search/param')
  u.searchParams.set('platform', 'SENTINEL-1A,SENTINEL-1C')
  u.searchParams.set('processingLevel', 'GRD_HD')
  u.searchParams.set('bbox', BBOX)
  u.searchParams.set('start', `${y}-01-01T00:00:00Z`)
  u.searchParams.set('end', `${y}-12-31T23:59:59Z`)
  u.searchParams.set('maxResults', '2000')
  u.searchParams.set('output', 'jsonlite')
  const res = await fetch(u)
  if (!res.ok) throw new Error(`ASF ${y}: HTTP ${res.status}`)
  const body = await res.json()
  return (body.results || []).filter((r) => Array.isArray(r.browse) && r.browse.length && r.wkt)
}

function pickBrowseUrl(browse) {
  return (
    browse.find((u) => /\.png$/i.test(u)) ||
    browse.find((u) => /\.jpg$/i.test(u)) ||
    browse[0]
  )
}

async function downloadIfMissing(url, dest) {
  if (existsSync(dest)) return 'cached'
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
  return 'downloaded'
}

async function runConcurrent(tasks, limit, onProgress) {
  const results = new Array(tasks.length)
  let next = 0
  let done = 0
  async function worker() {
    while (true) {
      const i = next++
      if (i >= tasks.length) return
      try { results[i] = await tasks[i]() } catch (e) { results[i] = { error: e.message } }
      done++
      if (onProgress) onProgress(done, tasks.length)
    }
  }
  await Promise.all(Array.from({ length: limit }, worker))
  return results
}

async function main() {
  console.log('[fetch] ASF Search by year…')
  const byCell = new Map()
  for (const y of YEARS) {
    const list = await fetchYear(y)
    console.log(`  ${y}: ${list.length} scenes`)
    for (const s of list) {
      const key = `${s.path}/${s.frame}`
      const bucket = byCell.get(key) || []
      bucket.push(s)
      byCell.set(key, bucket)
    }
  }
  // Keep up to PER_CELL newest scenes per cell, regardless of direction. The mosaic
  // builder picks the dominant direction later. Downloading both directions lets us
  // measure the imbalance and pick the one with better coverage.
  const picked = []
  for (const bucket of byCell.values()) {
    bucket.sort((a, b) => b.startTime.localeCompare(a.startTime))
    picked.push(...bucket.slice(0, PER_CELL))
  }
  const dirBreakdown = picked.reduce((a, s) => ((a[s.flightDirection] = (a[s.flightDirection] || 0) + 1), a), {})
  console.log(`[catalog] ${byCell.size} cells · ${picked.length} scenes picked (top ${PER_CELL}/cell) · ${JSON.stringify(dirBreakdown)}`)

  // Download browse for each picked scene.
  const tasks = picked.map((s) => async () => {
    const url = pickBrowseUrl(s.browse)
    const ext = url.toLowerCase().endsWith('.png') ? '.png' : '.jpg'
    const fname = `${s.granuleName}${ext}`
    const dest = `${BROWSE_DIR}/${fname}`
    const outcome = await downloadIfMissing(url, dest)
    return { granule: s.granuleName, outcome, local: `${_CFG.browseDir}/${fname}` }
  })
  console.log(`[download] ${tasks.length} browse images (concurrency ${CONCURRENCY})…`)
  const t0 = Date.now()
  const outcomes = await runConcurrent(tasks, CONCURRENCY, (done, total) => {
    if (done % 20 === 0 || done === total) process.stdout.write(`  ${done}/${total}\r`)
  })
  process.stdout.write('\n')
  const fails = outcomes.filter((o) => o?.error)
  console.log(`  done in ${((Date.now() - t0) / 1000).toFixed(1)}s · ${fails.length} failures`)

  const catalog = picked.map((s, i) => ({
    granuleName: s.granuleName,
    startTime: s.startTime,
    path: s.path,
    frame: s.frame,
    flightDirection: s.flightDirection,
    polarization: s.polarization,
    wkt: s.wkt,
    localBrowse: outcomes[i]?.local,
    sourceBrowse: pickBrowseUrl(s.browse),
  }))
  writeFileSync(`${OUT}/${_CFG.catalog}`, JSON.stringify(catalog))
  console.log(`[write] ${OUT}/${_CFG.catalog} · ${catalog.length} scenes`)
}

main().catch((e) => { console.error(e); process.exit(1) })
