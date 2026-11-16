#!/usr/bin/env node
// Builds a Sentinel-1 C-band mosaic for a case by compositing server-side RTC crops
// from Microsoft Planetary Computer. True 10 m/px resolution (vs. ~270 m/px of
// the ASF browse JPGs we used before).
//
// Pipeline:
//  1. STAC search on PC for sentinel-1-rtc scenes over the case bbox
//  2. Pick N latest scenes (dedup by date)
//  3. For each, GET the server-cropped PNG at the case bbox (vv backscatter in dB)
//  4. Composite with sharp (newest wins)
//
// Usage: CASE=ENCH node scripts/analysis/build-sentinel1-mosaic.mjs

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { Readable } from 'node:stream'
import sharp from 'sharp'

const CASE = (process.env.CASE || 'YANO').toUpperCase()
const CASES = {
  YANO: {
    bbox: { minLon: -66.5, minLat: -0.5, maxLon: -61.0, maxLat: 4.5 },
    outStem: 'sentinel1-yanomami-mosaic',
    datetime: '2024-01-01/2026-11-15',
    cropWidth: 4000, // bbox is 5.5° → 150 m/px; 2000 would be 305 m/px (too coarse for garimpo)
  },
  ENCH: {
    bbox: { minLon: -60.9, minLat: -3.3, maxLon: -59.1, maxLat: -1.85 },
    outStem: 'sentinel1-manaus-mosaic',
    datetime: '2023-01-01/2026-11-15',
    cropWidth: 2000,
  },
  SECA: {
    bbox: { minLon: -61.2, minLat: -4.2, maxLon: -60.2, maxLat: -3.3 },
    outStem: 'sentinel1-manaquiri-mosaic',
    datetime: '2023-01-01/2026-11-15',
    cropWidth: 2000,
  },
}
if (!CASES[CASE]) {
  console.error(`unknown CASE=${CASE}`)
  process.exit(2)
}
const _CFG = CASES[CASE]

const PC_STAC = 'https://planetarycomputer.microsoft.com/api/stac/v1/search'
const PC_DATA = 'https://planetarycomputer.microsoft.com/api/data/v1'

const OUT = 'public/analysis/data'
const CACHE_DIR = `/tmp/s1_rtc_cache_${CASE.toLowerCase()}`
mkdirSync(CACHE_DIR, { recursive: true })

const PER_ORBIT_MAX = 30 // newest scenes to keep per sat:relative_orbit — guarantees every track contributes
const SEARCH_HARD_CAP = 3000 // upper bound on paginated STAC results

function cropSize(bbox, width) {
  const { minLon: w, minLat: s, maxLon: e, maxLat: n } = bbox
  const k = Math.cos((((s + n) / 2) * Math.PI) / 180)
  return { width, height: Math.round((width * (n - s)) / ((e - w) * k)) }
}

async function searchPC(bbox, datetime, hardCap = SEARCH_HARD_CAP) {
  const { minLon: w, minLat: s, maxLon: e, maxLat: n } = bbox
  const body = {
    collections: ['sentinel-1-rtc'],
    intersects: {
      type: 'Polygon',
      coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
    },
    datetime,
    limit: 1000,
  }
  const all = []
  let token
  while (all.length < hardCap) {
    const req = token ? { ...body, token } : body
    const res = await fetch(PC_STAC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
    if (!res.ok) throw new Error(`PC STAC ${res.status}`)
    const j = await res.json()
    all.push(...(j.features || []))
    const next = (j.links || []).find((l) => l.rel === 'next')
    const nextToken = next?.body?.token
    if (!nextToken || nextToken === token) break
    token = nextToken
  }
  return all
}

function cropUrl(itemId, bbox, width) {
  const { height } = cropSize(bbox, width)
  const { minLon: w, minLat: s, maxLon: e, maxLat: n } = bbox
  const q = new URLSearchParams({
    collection: 'sentinel-1-rtc',
    item: itemId,
    assets: 'vv',
    expression: '10*log10(vv)',
    asset_as_band: 'True',
    rescale: '-22,0',
  })
  return `${PC_DATA}/item/bbox/${w},${s},${e},${n}/${width}x${height}.png?${q}`
}

async function downloadCrop(scene, bbox) {
  const cache = `${CACHE_DIR}/${scene.id}.png`
  if (existsSync(cache) && readFileSync(cache).length > 10 * 1024) return cache
  const url = cropUrl(scene.id, bbox, _CFG.cropWidth)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`crop ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(cache, buf)
  return cache
}

// PC crops come as LA (Luminance + Alpha) with alpha=0 where the scene footprint
// doesn't cover the bbox. Trust that alpha channel — our old RGB threshold was
// nuking genuinely-dark water pixels (Rio Negro ~-22 dB) as NODATA.
async function tileWithAlpha(path) {
  return sharp(path).ensureAlpha().toColorspace('srgb').png().toBuffer()
}

async function main() {
  console.log(`[case ${CASE}] bbox ${JSON.stringify(_CFG.bbox)}  (${_CFG.datetime})`)
  const scenes = await searchPC(_CFG.bbox, _CFG.datetime)
  console.log(`[search] ${scenes.length} S1 RTC scenes on Planetary Computer`)
  if (!scenes.length) throw new Error('no scenes')

  // Dedupe by (s1:datatake_id, slice_number). Covers all orbits — using
  // sat:relative_orbit as the dedup key collapses the catalog to ~3 tracks and
  // misses scenes that cover specific bbox corners.
  const byKey = new Map()
  for (const f of scenes) {
    const dt = f.properties['s1:datatake_id'] ?? f.id
    const slice = f.properties['s1:slice_number'] ?? ''
    const key = `${dt}|${slice}`
    if (!byKey.has(key)) byKey.set(key, f)
  }
  // Group by relative_orbit and keep the newest PER_ORBIT_MAX of each.
  // Picking globally-newest biases toward the last 1-2 months, which for a
  // bbox wider than a single S1 swath leaves tracks that didn't revisit
  // recently completely missing — the symptom was the SE/NE corners of the
  // YANO bbox showing up nearly empty.
  const byOrbit = new Map()
  for (const f of byKey.values()) {
    const o = f.properties['sat:relative_orbit']
    const bucket = byOrbit.get(o) || []
    bucket.push(f)
    byOrbit.set(o, bucket)
  }
  const ordered = []
  for (const bucket of byOrbit.values()) {
    bucket.sort((a, b) => a.properties.datetime.localeCompare(b.properties.datetime))
    ordered.push(...bucket.slice(-PER_ORBIT_MAX))
  }
  ordered.sort((a, b) => a.properties.datetime.localeCompare(b.properties.datetime))
  const perOrbit = [...byOrbit.entries()].map(([o, b]) => `${o}:${Math.min(b.length, PER_ORBIT_MAX)}`).join(' ')
  console.log(`[pick] ${ordered.length} scenes across ${byOrbit.size} relative_orbits (${perOrbit})`)

  const { width: outW, height: outH } = cropSize(_CFG.bbox, _CFG.cropWidth)
  console.log(`[canvas] ${outW}x${outH} (10 m/px nominal)`)

  // Download crops. PC Data API crops server-side so each PNG is already in our target bbox.
  const composites = []
  let ok = 0, fail = 0
  for (let i = 0; i < ordered.length; i++) {
    const s = ordered[i]
    try {
      const path = await downloadCrop(s, _CFG.bbox)
      const buf = await tileWithAlpha(path)
      composites.push({ input: buf, left: 0, top: 0 })
      ok++
    } catch (e) {
      fail++
    }
    if ((i + 1) % 10 === 0 || i === ordered.length - 1) {
      process.stdout.write(`  ${i + 1}/${ordered.length}  (ok=${ok} fail=${fail})\r`)
    }
  }
  process.stdout.write('\n')

  // Batch composite so sharp doesn't allocate the whole stack.
  const BATCH = 20
  let canvas = sharp({
    create: { width: outW, height: outH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
  for (let i = 0; i < composites.length; i += BATCH) {
    const chunk = composites.slice(i, i + BATCH)
    const buf = await canvas.composite(chunk).png().toBuffer()
    canvas = sharp(buf)
    process.stdout.write(`  composite ${Math.min(i + BATCH, composites.length)}/${composites.length}\r`)
  }
  process.stdout.write('\n')

  const outPng = `${OUT}/${_CFG.outStem}.png`
  await canvas.png({ compressionLevel: 9 }).toFile(outPng)
  const size = (await sharp(outPng).metadata()).size || 0
  console.log(`[write] ${outPng} · ${outW}x${outH} · ${(size / 1024 / 1024).toFixed(1)} MB`)

  const b = _CFG.bbox
  const bounds = { north: b.maxLat, south: b.minLat, west: b.minLon, east: b.maxLon }
  writeFileSync(`${OUT}/${_CFG.outStem}.bounds.json`, JSON.stringify(bounds, null, 2))
  console.log(`[write] ${OUT}/${_CFG.outStem}.bounds.json`)

  const dateRange = [
    ordered[0].properties.datetime.slice(0, 10),
    ordered.at(-1).properties.datetime.slice(0, 10),
  ]
  writeFileSync(
    `${OUT}/${_CFG.outStem}.meta.json`,
    JSON.stringify({
      bbox: [b.minLon, b.minLat, b.maxLon, b.maxLat],
      width: outW,
      height: outH,
      scenesComposited: ok,
      dateRange,
      source: 'Sentinel-1 RTC · Microsoft Planetary Computer (10 m/px σ⁰ in dB)',
    }, null, 2)
  )
}

main().catch((e) => { console.error(e); process.exit(1) })
