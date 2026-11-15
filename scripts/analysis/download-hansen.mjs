#!/usr/bin/env node
// Downloads the Hansen GFC v1.11 lossyear GeoTIFF for the 10N/070W tile (which
// covers the whole TI Yanomami), masks pixels to the 2016-2023 window, downsamples
// to a manageable PNG + bounds JSON the static HTML can overlay with L.imageOverlay.
//
// Usage: npm run data:hansen

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { fromArrayBuffer } from 'geotiff'
import { PNG } from 'pngjs'

const OUT = 'public/analysis/data'
mkdirSync(OUT, { recursive: true })

const HANSEN_URL = 'https://storage.googleapis.com/earthenginepartners-hansen/GFC-2023-v1.11/Hansen_GFC-2023-v1.11_lossyear_10N_070W.tif'
const LOCAL_TIF = `${OUT}/.hansen-10N-070W.tif`

// Years 2016-2023 → raw pixel values 16-23 in the Hansen lossyear band.
const YEAR_START = 16
const YEAR_END = 23

// Yanomami bbox (from the FUNAI polygon).
const YANO = { minLon: -66.5, minLat: -0.4, maxLon: -61.3, maxLat: 4.3 }

// Target output resolution. The source is 30 m (~0.00027°), so a 5°×5° crop is
// ~18500×18500 px. 1800×1800 keeps it under 1 MB zipped PNG while preserving
// clearing-scale detail (~300 m per output pixel).
const OUT_W = 1800
const OUT_H = 1800

async function downloadIfMissing() {
  if (existsSync(LOCAL_TIF)) {
    console.log('[cache] using', LOCAL_TIF)
    return
  }
  console.log('[fetch] Hansen GeoTIFF', HANSEN_URL)
  const t0 = Date.now()
  const res = await fetch(HANSEN_URL)
  if (!res.ok) throw new Error('Hansen GeoTIFF: HTTP ' + res.status)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(LOCAL_TIF, buf)
  console.log(`  ${(buf.length / 1024 / 1024).toFixed(1)} MB in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
}

async function main() {
  await downloadIfMissing()
  const buffer = readFileSync(LOCAL_TIF)
  const tiff = await fromArrayBuffer(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
  const image = await tiff.getImage()
  const [minX, maxY] = image.getOrigin()
  const [resX, resY] = image.getResolution()
  const width = image.getWidth()
  const height = image.getHeight()
  console.log(`[tiff] ${width}x${height}, origin (${minX.toFixed(2)}, ${maxY.toFixed(2)}), res (${resX.toFixed(5)}, ${resY.toFixed(5)})`)

  // Map lon/lat → pixel columns/rows
  const col = (lon) => Math.round((lon - minX) / resX)
  const row = (lat) => Math.round((lat - maxY) / resY)
  const cL = Math.max(0, col(YANO.minLon))
  const cR = Math.min(width, col(YANO.maxLon))
  const rT = Math.max(0, row(YANO.maxLat))
  const rB = Math.min(height, row(YANO.minLat))
  const cropW = cR - cL
  const cropH = rB - rT
  console.log(`[crop] pixels [${cL}..${cR}] x [${rT}..${rB}] (${cropW}x${cropH})`)

  // Read the raw lossyear raster window. Hansen is uint8 single-band.
  console.log('[read] loading window…')
  const t0 = Date.now()
  const raster = await image.readRasters({ window: [cL, rT, cR, rB], interleave: true })
  console.log(`  ${(raster.length / 1024 / 1024).toFixed(1)} MB in ${((Date.now() - t0) / 1000).toFixed(1)}s`)

  // Downsample to OUT_W x OUT_H. For each output cell, average loss count inside the
  // source block and convert to opacity. Non-loss pixels contribute 0.
  const scaleX = cropW / OUT_W
  const scaleY = cropH / OUT_H
  console.log(`[downsample] scale ${scaleX.toFixed(1)}:1 x ${scaleY.toFixed(1)}:1`)

  const png = new PNG({ width: OUT_W, height: OUT_H })
  for (let oy = 0; oy < OUT_H; oy++) {
    const sy0 = Math.floor(oy * scaleY)
    const sy1 = Math.max(sy0 + 1, Math.floor((oy + 1) * scaleY))
    for (let ox = 0; ox < OUT_W; ox++) {
      const sx0 = Math.floor(ox * scaleX)
      const sx1 = Math.max(sx0 + 1, Math.floor((ox + 1) * scaleX))
      let hits = 0
      let total = 0
      for (let sy = sy0; sy < sy1; sy++) {
        const rowOff = sy * cropW
        for (let sx = sx0; sx < sx1; sx++) {
          const v = raster[rowOff + sx]
          total++
          if (v >= YEAR_START && v <= YEAR_END) hits++
        }
      }
      const pIdx = (oy * OUT_W + ox) << 2
      if (hits > 0) {
        // Paint with #F07A45. Opacity grows with the hit fraction so sparse pixels
        // still show up on the map but concentrated clearings pop.
        const frac = hits / total
        png.data[pIdx]     = 240 // F0
        png.data[pIdx + 1] = 122 // 7A
        png.data[pIdx + 2] = 69  // 45
        png.data[pIdx + 3] = Math.min(255, Math.round(140 + frac * 115))
      } else {
        png.data[pIdx + 3] = 0 // transparent
      }
    }
  }

  const pngBuf = PNG.sync.write(png, { colorType: 6, filterType: 4 })
  writeFileSync(`${OUT}/hansen-yanomami-2016-2023.png`, pngBuf)

  // Bounds the overlay will use. Output pixels are already aligned to the crop window.
  // Use the (slightly rounded) crop bounds, not the raw bbox, so the PNG sits on real data.
  const bounds = {
    north: maxY + rT * resY,
    south: maxY + rB * resY,
    west: minX + cL * resX,
    east: minX + cR * resX,
  }
  writeFileSync(`${OUT}/hansen-yanomami-2016-2023.bounds.json`, JSON.stringify(bounds, null, 2))

  console.log(`[write] ${OUT}/hansen-yanomami-2016-2023.png · ${(pngBuf.length / 1024).toFixed(0)} KB`)
  console.log(`[write] ${OUT}/hansen-yanomami-2016-2023.bounds.json`)
  console.log(`  bounds: [${bounds.south.toFixed(3)}, ${bounds.west.toFixed(3)}] → [${bounds.north.toFixed(3)}, ${bounds.east.toFixed(3)}]`)
}

main().catch((e) => { console.error(e); process.exit(1) })
