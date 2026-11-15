#!/usr/bin/env node
// Composites every ALOS browse JPG (downloaded by download-alos.mjs) into a single
// master PNG covering the TI Yanomami bbox. Each scene is placed into its WKT bbox,
// newest overpaints older. The output goes straight into a Leaflet imageOverlay.
//
// Usage: npm run data:alos:mosaic

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import sharp from 'sharp'

const OUT = 'public/analysis/data'
const CATALOG = `${OUT}/alos-catalog.json`
const BROWSE_DIR = `${OUT}/alos-browse`

// Master canvas covers the Yanomami bbox. 3000x3000 at ~5° span → ~170 m/px.
// The source JPGs are ~2500x2500 at ~30 m/px, so we're downsampling ~5x.
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
  if (!existsSync(CATALOG)) throw new Error(`run npm run data:alos first — ${CATALOG} missing`)
  const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'))
  console.log(`[input] ${catalog.length} scenes in catalog`)

  const lngSpan = YANO.maxLon - YANO.minLon
  const latSpan = YANO.maxLat - YANO.minLat
  const lngPx = OUT_W / lngSpan
  const latPx = OUT_H / latSpan

  // ASCENDING + ALPSRP only. ALPSRS = ScanSAR (coarse 100 m, visible sub-swath striping),
  // ALPSRP = Polarimetric/Fine Beam (~30 m, sharp). Mixing them creates "scratched"
  // texture patches in the mosaic. Drop ScanSAR entirely; resolution has to be uniform.
  const asc = catalog
    .filter((c) => c.flightDirection === 'ASCENDING')
    .filter((c) => c.granuleName.startsWith('ALPSRP'))
  const ordered = asc.sort((a, b) => a.startTime.localeCompare(b.startTime))
  const pathCount = {}
  for (const c of ordered) pathCount[c.path] = (pathCount[c.path] || 0) + 1
  console.log(`[filter] ASC + ALPSRP: ${ordered.length} scenes across ${Object.keys(pathCount).length} paths`)

  const composites = []
  let skipped = 0
  const t0 = Date.now()

  for (let i = 0; i < ordered.length; i++) {
    const c = ordered[i]
    const bbox = wktBbox(c.wkt)
    if (!bbox) { skipped++; continue }
    // Clip the scene footprint to the master extent.
    const clipW = Math.max(bbox.w, YANO.minLon)
    const clipE = Math.min(bbox.e, YANO.maxLon)
    const clipS = Math.max(bbox.s, YANO.minLat)
    const clipN = Math.min(bbox.n, YANO.maxLat)
    if (clipW >= clipE || clipS >= clipN) { skipped++; continue }

    // Target rectangle on the master, in integer pixels.
    const dx = Math.round((clipW - YANO.minLon) * lngPx)
    const dyTop = Math.round((YANO.maxLat - clipN) * latPx)
    const dWidth = Math.round((clipE - clipW) * lngPx)
    const dHeight = Math.round((clipN - clipS) * latPx)
    if (dWidth < 2 || dHeight < 2) { skipped++; continue }

    const jpgPath = `${BROWSE_DIR}/${c.granuleName}.jpg`
    if (!existsSync(jpgPath)) { skipped++; continue }

    try {
      // Read the source JPG, extract the clipped portion at target resolution.
      const meta = await sharp(jpgPath).metadata()
      const sw = meta.width, sh = meta.height
      const bLng = bbox.e - bbox.w, bLat = bbox.n - bbox.s
      const sxL = Math.round(((clipW - bbox.w) / bLng) * sw)
      const sxR = Math.round(((clipE - bbox.w) / bLng) * sw)
      const syT = Math.round(((bbox.n - clipN) / bLat) * sh)
      const syB = Math.round(((bbox.n - clipS) / bLat) * sh)
      const srcW = Math.max(1, sxR - sxL)
      const srcH = Math.max(1, syB - syT)

      // Decode to raw RGBA so we can mask out ALOS's border / NODATA black pixels.
      // Browse JPGs show the swath as a rotated parallelogram inside a bounding
      // rectangle — the two off-swath triangles are always black. Threshold-to-alpha
      // kills those plus the inner NODATA pockets, so neighbour scenes bleed through.
      // Desaturate + mild blur before normalize. SAR speckle (fine-grained noise from
      // coherent radar) looks like "scratches" when the 30-m browse is downsampled to
      // ~170 m/px. Gaussian blur sigma=0.8 kills the worst speckle without smearing
      // detectable features (clearings, rivers stay readable).
      const { data, info } = await sharp(jpgPath)
        .extract({ left: sxL, top: syT, width: srcW, height: srcH })
        .resize(dWidth, dHeight, { fit: 'fill', kernel: 'lanczos3' })
        .modulate({ saturation: 0 })
        .blur(0.8)
        .normalize({ lower: 2, upper: 98 })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })

      for (let p = 0; p < data.length; p += 4) {
        const r = data[p], g = data[p + 1], b = data[p + 2]
        // Strictly dark pixel → NODATA or image border.
        if (r < 18 && g < 18 && b < 18) {
          data[p + 3] = 0
        }
      }
      const buf = await sharp(data, { raw: info }).png().toBuffer()
      composites.push({ input: buf, left: dx, top: dyTop })
    } catch (e) {
      skipped++
      console.warn('  skip', c.granuleName, e.message)
    }

    if ((i + 1) % 25 === 0) {
      process.stdout.write(`  ${i + 1}/${ordered.length}\r`)
    }
  }
  process.stdout.write('\n')
  console.log(`[prep] ${composites.length} tiles ready · ${skipped} skipped · ${((Date.now() - t0) / 1000).toFixed(1)}s`)

  // Composite in batches so sharp doesn't allocate the whole stack at once.
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

  const outPng = `${OUT}/alos-yanomami-mosaic.png`
  await canvas.png({ compressionLevel: 9 }).toFile(outPng)
  const size = (await sharp(outPng).metadata()).size || 0
  console.log(`[write] ${outPng} · ${OUT_W}x${OUT_H} · ${(size / 1024 / 1024).toFixed(1)} MB`)

  const bounds = { north: YANO.maxLat, south: YANO.minLat, west: YANO.minLon, east: YANO.maxLon }
  writeFileSync(`${OUT}/alos-yanomami-mosaic.bounds.json`, JSON.stringify(bounds, null, 2))
  console.log(`[write] ${OUT}/alos-yanomami-mosaic.bounds.json`)
}

main().catch((e) => { console.error(e); process.exit(1) })
