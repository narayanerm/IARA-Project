#!/usr/bin/env node
// Downloads every ALOS-1 PALSAR browse JPG that covers the TI Yanomami bbox (2006-2011)
// and writes a compact catalog JSON. Lets the HTML build a full L-band mosaic without
// hitting ASF on every page load.
//
// Usage: npm run data:alos

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'

const OUT = 'public/analysis/data'
const BROWSE_DIR = `${OUT}/alos-browse`
mkdirSync(BROWSE_DIR, { recursive: true })

const BBOX = '-66.5,-0.5,-61.0,4.5'
const YEARS = [2006, 2007, 2008, 2009, 2010, 2011]
const CONCURRENCY = 12

async function fetchYear(y) {
  const u = new URL('https://api.daac.asf.alaska.edu/services/search/param')
  u.searchParams.set('platform', 'ALOS')
  u.searchParams.set('processingLevel', 'L1.5')
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
  // Prefer the dual-pol (PLR) browse when present — it has HH+HV information
  // (orange+cyan tint), which shows forest structure. Fallback to anything.
  return (
    browse.find((u) => /_PLR_/.test(u)) ||
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

// Score a scene for the "best of cell" ranking. Higher is better.
// The relief in L-band SAR flips completely with look direction, so a mosaic that
// mixes ASCENDING and DESCENDING scenes shows discontinuous terrain brightness.
// We strongly prefer ASCENDING + dual-pol PLR to keep the mosaic consistent, with
// DESCENDING as a fallback only for cells with no ascending coverage.
function scoreScene(s) {
  const browseStr = JSON.stringify(s.browse || '')
  const dirScore = s.flightDirection === 'ASCENDING' ? 10000 : 0
  // PLR (polarimetric, HH+HV+VH+VV) → FBD (dual) → FBS (single-pol HH).
  const modeScore = /_PLR_/.test(browseStr) ? 300
                  : /_FBD_/.test(browseStr) ? 200
                  : /_FBS_/.test(browseStr) ? 100 : 0
  // Within those ties, newest wins.
  const dateScore = Number((s.startTime || '').replace(/[^0-9]/g, '').slice(0, 8)) || 0
  return dirScore + modeScore + dateScore / 1e4
}

// Keep the top N ASC scenes per (path, frame) cell so the mosaic has multiple revisits
// to fill NODATA triangles in each scene's bounding rect.
const PER_CELL = 3

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
  // Pick top PER_CELL per cell using scoreScene.
  for (const [key, bucket] of byCell) {
    bucket.sort((a, b) => scoreScene(b) - scoreScene(a))
    byCell.set(key, bucket.slice(0, PER_CELL))
  }
  const scenes = [...byCell.values()].flat()
  const breakdown = scenes.reduce((a, s) => ((a[s.flightDirection] = (a[s.flightDirection] || 0) + 1), a), {})
  console.log(`[catalog] ${byCell.size} cells · ${scenes.length} scenes picked (top ${PER_CELL}/cell) · breakdown:`, breakdown)

  // Download each scene's browse JPG locally.
  const tasks = scenes.map((s) => async () => {
    const url = pickBrowseUrl(s.browse)
    const fname = `${s.granuleName}.jpg`
    const dest = `${BROWSE_DIR}/${fname}`
    const outcome = await downloadIfMissing(url, dest)
    return { granule: s.granuleName, outcome, local: `alos-browse/${fname}` }
  })
  console.log(`[download] ${tasks.length} browse JPGs (concurrency ${CONCURRENCY})…`)
  const t0 = Date.now()
  const outcomes = await runConcurrent(tasks, CONCURRENCY, (done, total) => {
    if (done % 20 === 0 || done === total) {
      process.stdout.write(`  ${done}/${total}\r`)
    }
  })
  process.stdout.write('\n')
  const fails = outcomes.filter((o) => o?.error)
  console.log(`  done in ${((Date.now() - t0) / 1000).toFixed(1)}s · ${fails.length} failures`)

  // Write the catalog JSON the HTML will consume.
  const catalog = scenes.map((s, i) => ({
    granuleName: s.granuleName,
    startTime: s.startTime,
    path: s.path,
    frame: s.frame,
    flightDirection: s.flightDirection,
    wkt: s.wkt,
    localBrowse: outcomes[i]?.local,
    sourceBrowse: pickBrowseUrl(s.browse),
  }))
  writeFileSync(`${OUT}/alos-catalog.json`, JSON.stringify(catalog))
  console.log(`[write] ${OUT}/alos-catalog.json · ${catalog.length} scenes`)
}

main().catch((e) => { console.error(e); process.exit(1) })
