#!/usr/bin/env node
// Composites every Sentinel-1 browse image into a single mosaic PNG covering the
// TI Yanomami bbox. Mirror of build-alos-mosaic.mjs — with the same alpha-mask
// trick that drops NODATA / border black pixels so neighbour scenes bleed through.
//
// Usage: npm run data:sentinel1:mosaic

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import sharp from 'sharp'

const OUT = 'public/analysis/data'
const CATALOG = `${OUT}/sentinel1-catalog.json`
const BROWSE_DIR = `${OUT}/sentinel1-browse`

const YANO = { minLon: -66.5, minLat: -0.5, maxLon: -61.0, maxLat: 4.5 }
const OUT_W = 3000
const OUT_H = 3000

function wktBbox(wkt) {
  const m = wkt.match(/^POLYGON\s*\(\((.+)\)\)$/i)
  if (!m) return null
  const pairs = m[1].split(/\),\s*\(/)[0].split(',').map((p) => p.trim().split(/\s+/).map(Number))
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  for (const [lon, lat] of pairs) {
    if (Number.isNaN(lon) || Number.isNaN(lat)) continue
    if (lon < w) w = lon
    if (lon > e) e = lon
    if (lat < s) s = lat
    if (lat > n) n = lat
  }
  return { w, s, e, n }
}

async function main() {
  if (!existsSync(CATALOG)) throw new Error(`run npm run data:sentinel1 first — ${CATALOG} missing`)
  const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'))
  console.log(`[input] ${catalog.length} scenes in catalog`)

  const lngSpan = YANO.maxLon - YANO.minLon
  const latSpan = YANO.maxLat - YANO.minLat
  const lngPx = OUT_W / lngSpan
  const latPx = OUT_H / latSpan

  // DESCENDING only. S1 over Amazônia is overwhelmingly DESC (65 vs 24 ASC), and
  // the ASC scenes that don't geographically overlap any DESC scene show up as
  // "orphan" patches with different look direction/texture — visually jarring.
  // Drop ASC entirely and accept coverage gaps at the bbox corners (outside TI).
  const ordered = catalog
    .filter((c) => c.flightDirection === 'DESCENDING')
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  console.log(`[filter] DESCENDING only: ${ordered.length}/${catalog.length}`)

  const composites = []
  let skipped = 0
  const t0 = Date.now()

  for (let i = 0; i < ordered.length; i++) {
    const c = ordered[i]
    const bbox = wktBbox(c.wkt)
    if (!bbox) { skipped++; continue }
    const clipW = Math.max(bbox.w, YANO.minLon)
    const clipE = Math.min(bbox.e, YANO.maxLon)
    const clipS = Math.max(bbox.s, YANO.minLat)
    const clipN = Math.min(bbox.n, YANO.maxLat)
    if (clipW >= clipE || clipS >= clipN) { skipped++; continue }

    const dx = Math.round((clipW - YANO.minLon) * lngPx)
    const dyTop = Math.round((YANO.maxLat - clipN) * latPx)
    const dWidth = Math.round((clipE - clipW) * lngPx)
    const dHeight = Math.round((clipN - clipS) * latPx)
    if (dWidth < 2 || dHeight < 2) { skipped++; continue }

    const fname = c.granuleName + (c.localBrowse?.endsWith('.png') ? '.png' : '.jpg')
    const path = c.localBrowse ? `${OUT}/${c.localBrowse}` : `${BROWSE_DIR}/${fname}`
    if (!existsSync(path)) { skipped++; continue }

    try {
      const meta = await sharp(path).metadata()
      const sw = meta.width, sh = meta.height
      const bLng = bbox.e - bbox.w, bLat = bbox.n - bbox.s
      const sxL = Math.round(((clipW - bbox.w) / bLng) * sw)
      const sxR = Math.round(((clipE - bbox.w) / bLng) * sw)
      const syT = Math.round(((bbox.n - clipN) / bLat) * sh)
      const syB = Math.round(((bbox.n - clipS) / bLat) * sh)
      const srcW = Math.max(1, sxR - sxL)
      const srcH = Math.max(1, syB - syT)

      // Desaturate + mild speckle blur, then normalize.
      const { data, info } = await sharp(path)
        .extract({ left: sxL, top: syT, width: srcW, height: srcH })
        .resize(dWidth, dHeight, { fit: 'fill', kernel: 'lanczos3' })
        .modulate({ saturation: 0 })
        .blur(0.8)
        .normalize({ lower: 2, upper: 98 })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })

      // S1 browse quicklook has dark fringes at swath edges; threshold kills them so
      // overlapping revisits of the same cell fill in cleanly.
      // Strict threshold — only pure-black NODATA borders get killed, not dark but
      // valid forest/shadow pixels. The grayscale+normalize step already pushed valid
      // data away from 0, so a tight threshold is enough to catch margins.
      for (let p = 0; p < data.length; p += 4) {
        const r = data[p], g = data[p + 1], b = data[p + 2]
        if (r < 6 && g < 6 && b < 6) data[p + 3] = 0
      }
      const buf = await sharp(data, { raw: info }).png().toBuffer()
      composites.push({ input: buf, left: dx, top: dyTop })
    } catch (e) {
      skipped++
      console.warn('  skip', c.granuleName, e.message)
    }

    if ((i + 1) % 25 === 0) process.stdout.write(`  ${i + 1}/${ordered.length}\r`)
  }
  process.stdout.write('\n')
  console.log(`[prep] ${composites.length} tiles ready · ${skipped} skipped · ${((Date.now() - t0) / 1000).toFixed(1)}s`)

  const BATCH = 60
  let canvas = sharp({
    create: { width: OUT_W, height: OUT_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
  for (let i = 0; i < composites.length; i += BATCH) {
    const chunk = composites.slice(i, i + BATCH)
    const buf = await canvas.composite(chunk).png().toBuffer()
    canvas = sharp(buf)
    process.stdout.write(`  composite batch ${Math.min(i + BATCH, composites.length)}/${composites.length}\r`)
  }
  process.stdout.write('\n')

  const outPng = `${OUT}/sentinel1-yanomami-mosaic.png`
  await canvas.png({ compressionLevel: 9 }).toFile(outPng)
  const size = (await sharp(outPng).metadata()).size || 0
  console.log(`[write] ${outPng} · ${OUT_W}x${OUT_H} · ${(size / 1024 / 1024).toFixed(1)} MB`)

  const bounds = { north: YANO.maxLat, south: YANO.minLat, west: YANO.minLon, east: YANO.maxLon }
  writeFileSync(`${OUT}/sentinel1-yanomami-mosaic.bounds.json`, JSON.stringify(bounds, null, 2))
  console.log(`[write] ${OUT}/sentinel1-yanomami-mosaic.bounds.json`)
}

main().catch((e) => { console.error(e); process.exit(1) })
