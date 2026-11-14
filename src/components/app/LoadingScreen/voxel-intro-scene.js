// Ported from the "Curupira Pixel Diorama" artifact (intro.js). Timeline, shaders and drawing are unchanged.
/*
 * IARA intro, "voxel diorama": the 2D pixel scene rebuilt out of solid blocks. Every pixel of
 * every drawing is a cube with real depth, standing on a block ground with the river cut into it.
 * A radar pass sweeps it, the camera rises until it looks straight down at the river, the river
 * bends into the IARA symbol and the symbol splits along the river to reveal the page underneath.
 */
import * as THREE from 'three'

const C = {
  bg: '#0a110e', surface: '#13201a', ink: '#e6eee8',
  f1: '#2c5039', f2: '#33593f', f3: '#3b6447', f: '#4f9a6a',
  water: '#5aa7c9', deep: '#2b7ea6', night: '#03080a',
  orange: '#f07a45', peach: '#f39a6c', ember: '#b9481a',
}
const cache = {}
const rgb = (h) => cache[h] || (cache[h] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)])

/* the IARA symbol: forest blocks, and a river with orange banks running top to bottom */
const LOGO = [
  'g g o r r o d g g', 'g d d p r r p l l', 'g g d d o r r p d', 'g g l g o r r o d', 'l l l o r r p d g',
  'g l o r r p d l g', 'l o r r o d d d l', 'g p r r p g d g g', 'd g p r r o d d l',
].map((r) => r.split(' '))
const TONE = { g: C.f2, d: C.f1, l: C.f3 }
const RIV = [4, 5, 6, 6, 5, 4, 3, 3, 4]
function rivX(v) {
  const y = v - 0.5
  const i = Math.max(0, Math.min(7, Math.floor(y)))
  const f = Math.max(-1, Math.min(2, y - i))
  const p0 = RIV[Math.max(0, i - 1)], p1 = RIV[i], p2 = RIV[Math.min(8, i + 1)], p3 = RIV[Math.min(8, i + 2)]
  return 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f)
}
const rivS = (v) => { const c = Math.max(0, Math.min(9, v)); return (rivX(c - 0.7) + rivX(c) * 2 + rivX(c + 0.7)) / 4 }

const hsh = (i) => { const s = Math.sin(i * 12.9898) * 43758.5453; return s - Math.floor(s) }
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const smooth = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u) }
const clamp01 = (x) => Math.max(0, Math.min(1, x))

/* timeline, in seconds */
export const INTRO_T = { sweep0: 0.5, sweep1: 3.9, fly0: 6.4, fly1: 9.0, morph1: 12.8, split0: 13.3, split1: 15.9 }

/**
 * Starts the intro on the given elements and returns a stop function that frees everything
 * (animation frame, listeners, WebGL renderer, geometries, materials, textures).
 * `onDone` runs once, when the split has fully revealed the page.
 */
export function startVoxelIntro({ glc, cv, topo, hud, estado, barra }, onDone) {
const PIX = 24
barra.replaceChildren()
for (let i = 0; i < PIX; i++) barra.appendChild(document.createElement('i'))

/* timeline, in seconds */
const T = INTRO_T
/* world: 1 unit = one pixel cell of the standing layers; the ground uses 2-unit cells */
const RZ0 = -28, RZ1 = 32 // the river, along z
const Z0 = -40           // what the camera looks at when it is straight above

/* ---------- pixel layers ---------- */
let cur, cols, rows, gy, VW = 110
const Z = 2
const mosC = [rgb(C.f1), rgb(C.f2), rgb(C.f3), rgb(C.surface), rgb(C.f2)]

const VERT = `
attribute vec3 aOff; attribute float aDep; attribute vec3 aCol;
uniform vec3 uS; uniform float uFold; uniform vec3 uShade;
varying vec3 vC; varying vec2 vUv; varying float vD;
void main() {
  vec3 p = position * uS * vec3(1.0, 1.0, aDep) + aOff;
  p.y *= uFold;
  float sh = normal.y > 0.5 ? uShade.x : normal.z > 0.5 ? uShade.y : normal.y < -0.5 ? 0.4 : normal.z < -0.5 ? 0.5 : uShade.z;
  vC = aCol * sh; vUv = uv;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vD = -mv.z;
  gl_Position = projectionMatrix * mv;
}`
const FRAG = `
precision mediump float;
uniform vec3 uBg; uniform float uFog;
varying vec3 vC; varying vec2 vUv; varying float vD;
void main() {
  // the dark seam between blocks, the same one the 2D pixels have
  float fw = max(fwidth(vUv.x), fwidth(vUv.y));
  float seam = ((vUv.x > 0.84 || vUv.y < 0.16) ? 0.5 : 0.0) * (1.0 - smoothstep(0.2, 0.42, fw));
  vec3 c = mix(vC, uBg, seam);
  c = mix(c, uBg, uFog * smoothstep(260.0, 900.0, vD));
  gl_FragColor = vec4(c, 1.0);
}`
const BG = new THREE.Vector3(10 / 255, 17 / 255, 14 / 255)
const box = new THREE.BoxGeometry(1, 1, 1)
const blocks = []
/* a drawing surface whose every opaque pixel becomes one block */
function layer(w, h, g, opt = {}) {
  const n = w * h
  const d = new Uint8ClampedArray(n * 4)
  const geo = new THREE.InstancedBufferGeometry()
  geo.index = box.index
  geo.setAttribute('position', box.attributes.position)
  geo.setAttribute('normal', box.attributes.normal)
  geo.setAttribute('uv', box.attributes.uv)
  const aOff = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)
  const aDep = new THREE.InstancedBufferAttribute(new Float32Array(n), 1)
  const aCol = new THREE.InstancedBufferAttribute(new Uint8Array(n * 3), 3, true)
  for (const a of [aOff, aDep, aCol]) a.setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('aOff', aOff); geo.setAttribute('aDep', aDep); geo.setAttribute('aCol', aCol)
  geo.instanceCount = 0
  const s = opt.s || 1
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: {
      uS: { value: opt.ground ? new THREE.Vector3(2, 2, 2) : new THREE.Vector3(s, s, 1) },
      uFold: { value: 1 }, uFog: { value: 0.7 }, uBg: { value: BG },
      uShade: { value: opt.ground ? new THREE.Vector3(1, 0.7, 0.55) : new THREE.Vector3(1.18, 1, 0.6) },
    },
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.frustumCulled = false
  mesh.position.z = opt.z || 0
  const L = { w, h, g, d, s, geo, aOff, aDep, aCol, mat, mesh, dist: new Uint8Array(n), opaque: !!opt.ground, ground: !!opt.ground, u: opt.ground ? 2 : s, seed: opt.seed || 0, grow: opt.grow || 2, maxT: opt.maxT || 8, placed: false }
  blocks.push(L)
  return L
}
function pick(L) { cur = L; cols = L.w; rows = L.h; gy = L.g; if (!L.opaque) L.d.fill(0) }
function flush(L, front) {
  const d = L.d, w = L.w, h = L.h
  if (front !== undefined) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (d[i + 3] === 0) continue
      const wx = (x - w / 2) * L.u
      const hh = hsh(i * 0.25 + 1 + L.seed)
      const fr = front - hh * 4
      if (wx > fr) {
        // ahead of the radar: the brand mosaic, the forest as orbit sees it under cloud
        const hb = hsh((y >> 2) * 977 + (x >> 2) + L.seed * 31 + 7)
        const c = mosC[(hb * 5) | 0], dim = 0.45 + hb * 0.35
        d[i] = c[0] * dim; d[i + 1] = c[1] * dim; d[i + 2] = c[2] * dim
        if (hb > 0.985) { d[i] = 168; d[i + 1] = 85; d[i + 2] = 48 }
      } else if (fr - wx < 6) {
        const a = (1 - (fr - wx) / 6) * 0.85
        d[i] += (90 - d[i]) * a; d[i + 1] += (167 - d[i + 1]) * a; d[i + 2] += (201 - d[i + 2]) * a
      }
    }
  }
  const col = L.aCol.array
  if (L.ground) {
    if (!L.placed) {
      const off = L.aOff.array, dep = L.aDep.array
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const k = y * w + x, wz = -220 + y * 2 + 1
        off[k * 3] = (x - w / 2) * 2 + 1; off[k * 3 + 1] = wz >= RZ0 && wz < RZ1 ? -2.6 : -1; off[k * 3 + 2] = wz
        dep[k] = 1
      }
      L.aOff.needsUpdate = true; L.aDep.needsUpdate = true; L.geo.instanceCount = w * h; L.placed = true
    }
    for (let k = 0, i = 0, j = 0; k < w * h; k++, i += 4, j += 3) { col[j] = d[i]; col[j + 1] = d[i + 1]; col[j + 2] = d[i + 2] }
    L.aCol.needsUpdate = true
    return
  }
  // how far each pixel is from the outline: the middle of a shape is thicker than its rim
  const dist = L.dist, CAPD = 40
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x
    if (d[k * 4 + 3] === 0) { dist[k] = 0; continue }
    const a = x > 0 ? dist[k - 1] : 0, b = y > 0 ? dist[k - w] : 0
    dist[k] = Math.min(a, b, CAPD) + 1
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const k = y * w + x
    if (dist[k] === 0) continue
    const a = x < w - 1 ? dist[k + 1] : 0, b = y < h - 1 ? dist[k + w] : CAPD
    const m = Math.min(a, b) + 1
    if (m < dist[k]) dist[k] = m
  }
  const off = L.aOff.array, dep = L.aDep.array, s = L.s
  let n = 0
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x, i = k * 4
    if (d[i + 3] === 0) continue
    off[n * 3] = (x + 0.5 - w / 2) * s; off[n * 3 + 1] = (L.g - y - 0.5) * s; off[n * 3 + 2] = 0
    dep[n] = Math.min(L.maxT, 1 + (dist[k] - 1) * L.grow) * s
    col[n * 3] = d[i]; col[n * 3 + 1] = d[i + 1]; col[n * 3 + 2] = d[i + 2]
    n++
  }
  L.geo.instanceCount = n
  L.aOff.needsUpdate = true; L.aDep.needsUpdate = true; L.aCol.needsUpdate = true
}

function px(x, y, c, a = 1) {
  x = Math.round(x); y = Math.round(y)
  if (x < 0 || y < 0 || x >= cols || y >= rows) return
  const i = (y * cols + x) * 4, k = rgb(c), d = cur.d
  if (d[i + 3] === 0) {
    if (a < 0.5) return
    d[i] = k[0]; d[i + 1] = k[1]; d[i + 2] = k[2]; d[i + 3] = 255
  } else if (a >= 1) { d[i] = k[0]; d[i + 1] = k[1]; d[i + 2] = k[2] }
  else { d[i] += (k[0] - d[i]) * a; d[i + 1] += (k[1] - d[i + 1]) * a; d[i + 2] += (k[2] - d[i + 2]) * a }
}
function ell(cx, cy, rx, ry, c, rot = 0, a = 1) {
  const m = Math.max(rx, ry) + 1, cs = Math.cos(rot), sn = Math.sin(rot)
  for (let y = Math.floor(cy - m); y <= cy + m; y++) for (let x = Math.floor(cx - m); x <= cx + m; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy
    const u = (dx * cs + dy * sn) / rx, v = (-dx * sn + dy * cs) / ry
    if (u * u + v * v <= 1) px(x, y, c, a)
  }
}
function cap(x1, y1, x2, y2, r, c, a = 1) {
  const minx = Math.floor(Math.min(x1, x2) - r - 1), maxx = Math.ceil(Math.max(x1, x2) + r + 1)
  const miny = Math.floor(Math.min(y1, y2) - r - 1), maxy = Math.ceil(Math.max(y1, y2) + r + 1)
  const vx = x2 - x1, vy = y2 - y1, L = vx * vx + vy * vy || 1
  for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
    const p0 = x + 0.5 - x1, q0 = y + 0.5 - y1
    const h = Math.max(0, Math.min(1, (p0 * vx + q0 * vy) / L))
    const dx = p0 - vx * h, dy = q0 - vy * h
    if (dx * dx + dy * dy <= r * r) px(x, y, c, a)
  }
}
/* x position as a fraction of what the camera sees */
const X = (f) => cols / 2 + (f - 0.5) * 2 * VW

/* ---------- what is drawn on each layer ---------- */
function drawFar() {
  for (let x = 0; x < cols; x++) {
    const h1 = 44 + Math.sin(x * 0.05) * 6 + Math.sin(x * 0.19 + 2) * 3.5 + Math.sin(x * 0.61) * 1.6
    for (let y = Math.round(rows - h1); y < rows; y++) px(x, y, C.surface)
    const h2 = 28 + Math.sin(x * 0.08 + 1) * 5 + Math.sin(x * 0.27) * 2.5 + Math.sin(x * 0.9 + 3) * 1.2
    for (let y = Math.round(rows - h2); y < rows; y++) px(x, y, y === Math.round(rows - h2) ? C.f2 : C.f1)
  }
}

function drawTrees(t) {
  for (let k = 0; k < Math.ceil(cols / 46) + 1; k++) {
    const x0 = Math.round(k * 46 + hsh(k + 300) * 18), h = Math.round(34 + hsh(k + 77) * 22)
    cap(x0, gy, x0 + 1, gy - h, 1.7, '#1d2e25')
    const sway = Math.sin(t * 0.8 + k) * 0.7
    for (let b = 0; b < 5; b++) {
      const bx = x0 + (hsh(k * 9 + b) - 0.5) * 18 + sway, by = gy - h + (hsh(k * 5 + b + 50) - 0.6) * 8
      const r = 5 + hsh(k * 3 + b) * 4
      ell(bx, by, r * 1.25, r, C.f1)
      ell(bx - r * 0.25, by - r * 0.25, r * 0.95, r * 0.7, C.f2)
      ell(bx - r * 0.45, by - r * 0.45, r * 0.5, r * 0.35, C.f3)
    }
  }
  const branch = (x0, x1, y) => { for (let x = x0; x <= x1; x++) { const yy = y + Math.sin(x * 0.2) * 0.8; cap(x, yy, x + 1, yy, 1.3, '#4a3a2a') } }
  const bx0 = Math.round(X(0.5)), bx1 = bx0 + Math.round(Math.min(96, VW * 0.9)), by = gy - 56
  branch(bx0, bx1, by)
  const tb0 = Math.round(X(0.08)), tby = gy - 44
  branch(tb0, tb0 + 44, tby)
  sloth(t, bx0, bx0 + Math.round((bx1 - bx0) * 0.62), by)
  monkey(t, bx1 - 12, by + 1)
  toucan(t, tb0 + 18, tby)
  macaw(t)
  for (let k = 0; k < 24; k++) {
    const x = hsh(k + 500) * cols + Math.sin(t * 0.5 + k) * 6
    const y = gy - 6 - hsh(k + 600) * 34 + Math.cos(t * 0.7 + k) * 4
    if (Math.sin(t * 2 + k * 3) > 0.4) px(x, y, '#d8f0a0')
  }
}

const ROS = [[-5, -1.2], [-2.4, -2], [0.4, -1.4], [3, -2.1], [-3.8, 0.8], [-1, 0.6], [1.8, 0.9], [4.6, 0], [-6.4, 0.4]]
function jaguar(t) {
  // walks in once from the left, then stops on the bank and looks around
  const z = Z
  const stopX = X(0.3)
  const x = Math.min(stopX, X(0) - 14 * z + t * 6.5 * z * (VW / 110 + 0.4) / 1.4)
  const walking = x < stopX
  const y = gy - 0.2
  const coat = '#d99a3e', dark = '#2a1a0c', inner = '#b9702a', belly = '#f2d9a8'
  const ph = t * 7
  const bob = walking ? Math.sin(ph * 2) * 0.25 * z : Math.sin(t * 1.6) * 0.12 * z
  const bx = x, by = y - 5.4 * z + bob
  const leg = (hx, phase, near) => {
    const sw = walking ? Math.sin(ph + phase) * 0.55 : 0
    const kx = hx + Math.sin(sw) * 2.2 * z, ky = by + 2.6 * z
    const fx = hx + Math.sin(sw) * 3.2 * z, fy = y - 0.4 * z - (walking && Math.cos(ph + phase) > 0.6 ? 0.7 * z : 0)
    cap(hx, by + 0.8 * z, kx, ky, 1.0 * z, near ? coat : inner)
    cap(kx, ky, fx, fy, 0.75 * z, near ? coat : inner)
    ell(fx + 0.4 * z, fy, 1.0 * z, 0.55 * z, near ? coat : inner)
  }
  leg(bx - 5 * z, Math.PI, false); leg(bx + 4.6 * z, 0, false)
  const tf = Math.sin(t * (walking ? 4 : 1.6))
  let tx = bx - 7.5 * z, ty = by - 0.6 * z
  for (let s = 0; s < 6; s++) {
    const nx = tx - 1.3 * z, ny = ty + (s < 3 ? 1.1 : 0.2 - tf * 0.6) * z
    cap(tx, ty, nx, ny, 0.6 * z, s > 3 ? dark : s % 2 ? coat : inner)
    tx = nx; ty = ny
  }
  ell(bx, by, 8 * z, 3.3 * z, coat)
  ell(bx + 4.2 * z, by - 0.3 * z, 3.6 * z, 3.4 * z, coat)
  ell(bx - 0.5 * z, by + 2.1 * z, 6.6 * z, 1.2 * z, belly)
  for (const [rx, ry] of ROS) { const cx = bx + rx * z, cy = by + ry * z; ell(cx, cy, 1.05 * z, 0.9 * z, dark); ell(cx, cy, 0.5 * z, 0.42 * z, inner) }
  leg(bx - 5.6 * z, 0, true); leg(bx + 5.2 * z, Math.PI, true)
  const look = !walking && Math.sin(t * 0.7) > -0.3
  const hx = bx + 9.2 * z, hy = by - 2.2 * z + (walking ? Math.sin(ph * 2 + 1) * 0.3 * z : 0)
  cap(bx + 6 * z, by - 1 * z, hx - 0.5 * z, hy + 0.4 * z, 2.1 * z, coat)
  ell(hx, hy, 2.7 * z, 2.3 * z, coat)
  ell(hx - 1.3 * z, hy - 2 * z, 0.75 * z, 0.75 * z, dark); ell(hx + 0.9 * z, hy - 2.1 * z, 0.75 * z, 0.75 * z, dark)
  if (look) {
    ell(hx, hy + 1.1 * z, 1.4 * z, 1.0 * z, belly)
    px(hx - 1 * z, hy - 0.4 * z, '#f2e86a'); px(hx + 1 * z, hy - 0.4 * z, '#f2e86a'); px(hx, hy + 0.6 * z, dark)
  } else {
    ell(hx + 2 * z, hy + 0.7 * z, 1.4 * z, 1.0 * z, belly)
    px(hx + 1 * z, hy - 0.5 * z, '#f2e86a'); px(hx + 3.1 * z, hy + 0.3 * z, dark)
  }
  ell(hx - 1.5 * z, hy + 0.2 * z, 0.45 * z, 0.45 * z, dark)
}

function macaw(t) {
  const z = Z
  const span = 2 * VW + 60 * z
  const u = (t * 11 * z + 10 * z) % span
  const x = X(0) + u - 30 * z, y = gy - 78 + Math.sin(u * 0.015) * 6 * z
  const flap = Math.sin(t * 9)
  cap(x - 2 * z, y + 0.6 * z, x - 8 * z, y + 2.4 * z, 0.6 * z, C.ember)
  cap(x - 2 * z, y + 0.4 * z, x - 7 * z, y + 1.4 * z, 0.5 * z, C.water)
  ell(x, y, 3 * z, 1.3 * z, C.orange, -0.15)
  cap(x - 0.5 * z, y, x - 1.5 * z, y - flap * 4.5 * z, 1.1 * z, C.deep)
  cap(x - 0.5 * z, y, x - 1.2 * z, y - flap * 3.6 * z, 0.9 * z, C.water)
  ell(x + 3 * z, y - 0.6 * z, 1.4 * z, 1.2 * z, C.orange)
  px(x + 3.3 * z, y - 0.9 * z, C.ink)
  ell(x + 4.4 * z, y - 0.2 * z, 0.8 * z, 0.6 * z, '#e8e0d0')
  cap(x - 1.5 * z, y + 0.3 * z, x + 1 * z, y + 0.3 * z, 0.45 * z, '#f2c45a')
}
function toucan(t, x, y) {
  const z = Z
  const hop = t % 2.6 < 0.2 ? 1.2 * z : 0
  const f = Math.floor(t / 5.2) % 2 ? -1 : 1
  const by = y - 3.2 * z - hop
  cap(x - f * 1.6 * z, by + 1.5 * z, x - f * 3.2 * z, by + 4.5 * z, 0.7 * z, C.night)
  ell(x, by, 2 * z, 2.8 * z, C.night)
  ell(x + f * 0.8 * z, by - 1 * z, 1.1 * z, 1.4 * z, C.ink)
  ell(x + f * 0.4 * z, by - 2.6 * z, 1.4 * z, 1.3 * z, C.night)
  ell(x + f * 3 * z, by - 2.4 * z, 2.2 * z, 0.9 * z, C.orange, f * 0.15)
  px(x + f * 4.8 * z, by - 2.2 * z, C.night)
  px(x + f * 0.8 * z, by - 2.9 * z, C.water)
  cap(x, by + 2.6 * z, x, y, 0.35 * z, '#8a6a40')
}
function monkey(t, x, y) {
  const z = Z
  const a = Math.sin(t * 1.7) * 0.55
  const L = 5 * z
  const ex = x + Math.sin(a) * L, ey = y + Math.cos(a) * L
  for (let k = 0; k <= 10; k++) { const s = k / 10; px(x + Math.sin(a * s) * L * s + Math.sin(s * 3) * 0.6, y + Math.cos(a * s) * L * s, '#6b4a2e') }
  ell(ex, ey + 2.2 * z, 1.8 * z, 2.6 * z, '#8a5a32', -a)
  const hx = ex - Math.sin(a) * 5 * z, hy = ey + Math.cos(a) * 5 * z
  ell(hx, hy, 1.7 * z, 1.6 * z, '#8a5a32')
  ell(hx, hy + 0.4 * z, 1.1 * z, 0.9 * z, '#e0c49a')
  px(hx - 0.4 * z, hy, C.night); px(hx + 0.4 * z, hy, C.night)
  const sw = Math.sin(t * 3.4) * 1.5 * z
  cap(ex - 1 * z, ey + 2 * z, ex - 3 * z, ey + 5 * z + sw, 0.55 * z, '#8a5a32')
  cap(ex + 1 * z, ey + 2 * z, ex + 3 * z, ey + 5 * z - sw, 0.55 * z, '#8a5a32')
}
function sloth(t, x0, x1, y) {
  const z = Z
  const span = Math.max(4, x1 - x0 - 10 * z)
  const u = (t * 0.6 * z) % (span * 2)
  const x = x0 + 4 * z + (u < span ? u : span * 2 - u)
  const reach = Math.sin(t * 1.3) * 1.2 * z
  const by = y + 4.2 * z
  const fur = '#8c7a5c', shade = '#6e604a', face = '#e2d4b4', mask = '#3c3226'
  cap(x - 3 * z, by - 1 * z, x - 3.5 * z + reach, y, 0.65 * z, shade)
  cap(x + 3 * z, by - 1 * z, x + 3.5 * z - reach, y, 0.65 * z, shade)
  cap(x - 2 * z, by + 1 * z, x - 2.6 * z, y + 0.4 * z, 0.6 * z, shade)
  ell(x, by, 4.4 * z, 2.2 * z, fur)
  ell(x - 0.5 * z, by + 1 * z, 3.4 * z, 1.1 * z, shade)
  ell(x + 4 * z, by + 0.6 * z, 1.7 * z, 1.5 * z, fur)
  ell(x + 4.2 * z, by + 0.8 * z, 1.2 * z, 1.0 * z, face)
  cap(x + 3.5 * z, by + 0.5 * z, x + 4.8 * z, by + 1 * z, 0.3 * z, mask)
  px(x + 4.6 * z, by + 1.4 * z, C.night)
}
function capybara(t, x, y, s) {
  const z = Z * s
  const down = (Math.sin(t * 0.8 + x) + 1) / 2
  const fur = '#9a6a3e', shade = '#6e4a2a'
  cap(x - 3 * z, y - 1 * z, x - 3 * z, y, 0.7 * z, shade); cap(x + 2 * z, y - 1 * z, x + 2 * z, y, 0.7 * z, shade)
  ell(x, y - 3 * z, 4.6 * z, 2.6 * z, fur)
  ell(x - 0.5 * z, y - 1.6 * z, 3.6 * z, 1 * z, shade)
  const hx = x + 4.6 * z, hy = y - 3.6 * z + down * 1.8 * z
  ell(hx, hy, 2.3 * z, 1.5 * z, fur, 0.3 * down)
  ell(hx - 1 * z, hy - 1.4 * z, 0.5 * z, 0.5 * z, shade)
  px(hx, hy - 0.4 * z, C.night)
  cap(x - 2.4 * z, y - 1 * z, x - 2.4 * z, y, 0.7 * z, fur); cap(x + 3 * z, y - 1 * z, x + 3 * z, y, 0.7 * z, fur)
}
function grass(t, seed, n) {
  for (let k = 0; k < n; k++) {
    const x = hsh(k + seed) * cols
    const hgt = 3 + Math.floor(hsh(k + seed + 77) * 4), bend = Math.sin(t * 1.5 + x * 0.2) * 1.5
    cap(x, gy, x + bend, gy - hgt, 0.5, hsh(k + seed + 9) > 0.5 ? C.f3 : C.f2)
  }
}
function boto(t) {
  // the pink river dolphin jumps every few seconds
  const z = Z
  const P2 = 4.2
  const k = Math.floor(t / P2), u = (t % P2) / 1.5
  const x0 = X(0.2 + hsh(k + 40) * 0.55)
  if (u > 1) {
    if (u < 1.4) for (let i = -3; i <= 3; i++) px(x0 + 9 * z + i * 2 * z, gy - 1 - Math.abs(i) * 0.3, C.water)
    return
  }
  const x = x0 + u * 18 * z, y = gy + 3 * z - Math.sin(u * Math.PI) * 9 * z
  const ang = -Math.cos(u * Math.PI) * 0.9
  const cs = Math.cos(ang), sn = Math.sin(ang)
  cap(x - cs * 3.5 * z, y - sn * 3.5 * z, x + cs * 3.5 * z, y + sn * 3.5 * z, 1.3 * z, C.peach)
  cap(x + cs * 3.5 * z, y + sn * 3.5 * z, x + cs * 5.6 * z, y + sn * 5.6 * z, 0.45 * z, C.peach)
  cap(x - cs * 3.5 * z, y - sn * 3.5 * z, x - cs * 5 * z - sn * 1.2 * z, y - sn * 5 * z + cs * 1.2 * z, 0.5 * z, '#e08a68')
  // only what is above the water line shows
  const d = cur.d
  for (let yy = gy; yy < rows; yy++) for (let xx = 0; xx < cols; xx++) d[(yy * cols + xx) * 4 + 3] = 0
  if (u < 0.15 || u > 0.85) for (let i = 0; i < 4; i++) px(x + (i - 1.5) * 2 * z, gy - 1, C.water)
}

/* the ground, seen from anywhere: far bank, river, near bank (wx, wz in world units) */
function ground(wx, wz, t, out) {
  if (wz >= RZ0 && wz < RZ1) {
    const dd = (wz - RZ0) / (RZ1 - RZ0)
    const w = Math.sin(wx * 0.09 - t * 1.6 + wz * 0.35) * Math.sin(wx * 0.0175 + t * 0.4 + wz * 0.025)
    if (w > 0.86) { out[0] = 72; out[1] = 134; out[2] = 161 }
    else if (dd < 0.08) { out[0] = 22; out[1] = 70; out[2] = 92 }
    else { out[0] = 6 + dd * 6; out[1] = 22 + dd * 8; out[2] = 34 + dd * 6 }
    return
  }
  const edge = wz < RZ0 ? RZ0 - wz : wz - RZ1
  const h = hsh(Math.floor(wx / 2) * 157.3 + Math.floor(wz / 2) * 31.7)
  const c = edge < 4 ? rgb(C.f1) : h < 0.05 ? rgb(C.f1) : rgb(C.surface)
  out[0] = c[0]; out[1] = c[1]; out[2] = c[2]
}
const gOut = [0, 0, 0]
function drawGround(t) {
  const d = cur.d, w = cur.w, h = cur.h
  for (let y = 0; y < h; y++) {
    const wz = -220 + y * 2 + 1
    for (let x = 0; x < w; x++) {
      ground((x - w / 2) * 2 + 1, wz, t, gOut)
      const i = (y * w + x) * 4
      d[i] = gOut[0]; d[i + 1] = gOut[1]; d[i + 2] = gOut[2]; d[i + 3] = 255
    }
  }
}

/* ---------- the diorama ---------- */
const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, alpha: false, powerPreference: 'high-performance' })
renderer.setClearColor(C.bg)
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(30, 1, 1, 4000)

const Lfar = layer(360, 70, 70, { seed: 1, s: 1.7, z: -170, grow: 5, maxT: 46 })
const Ltree = layer(360, 124, 122, { seed: 2, s: 1.12, z: -72, grow: 2.4, maxT: 13 })
const Lbank = layer(360, 44, 42, { seed: 3, z: -31, grow: 2.6, maxT: 11 })
const Lriv = layer(360, 44, 30, { seed: 4, z: -6, grow: 2.2, maxT: 7 })
const Lnear = layer(360, 34, 32, { seed: 5, z: 52, grow: 2.6, maxT: 10 })
const Lgr = layer(320, 180, 0, { ground: true, seed: 6 })
const standing = [Lfar, Ltree, Lbank, Lriv, Lnear]
for (const L of blocks) scene.add(L.mesh)
Lriv.mesh.position.y = -1.6

/* night sky behind everything, with the glow of the fires low on the right */
{
  const sk = document.createElement('canvas'); sk.width = 256; sk.height = 256
  const g = sk.getContext('2d')
  const lin = g.createLinearGradient(0, 0, 0, 256)
  lin.addColorStop(0, '#0a110e'); lin.addColorStop(1, '#101c17')
  g.fillStyle = lin; g.fillRect(0, 0, 256, 256)
  const tex = new THREE.CanvasTexture(sk)
  scene.background = tex
}
/* the radar front: a thin sheet of light crossing the whole depth of the scene */
const beam = new THREE.Mesh(new THREE.PlaneGeometry(420, 150), new THREE.MeshBasicMaterial({ color: 0x5aa7c9, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }))
beam.rotation.y = Math.PI / 2
beam.position.set(0, 74, -70)
scene.add(beam)

/* the far canopy never changes: draw it once */
pick(Lfar); drawFar()
const farBase = new Uint8ClampedArray(Lfar.d)

/* ---------- 2D finale: river into symbol, then the split ---------- */
const ctx = cv.getContext('2d')
const low = document.createElement('canvas')
const lctx = low.getContext('2d')
const grid2 = document.createElement('canvas')
let W, H, S, c2, r2, dpr, img, img2, hash2, F = 1
function size() {
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  W = window.innerWidth; H = window.innerHeight
  S = W < 700 ? 4 : W < 1200 ? 5 : 6
  c2 = Math.ceil(W / S); r2 = Math.ceil(H / S)
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
  low.width = c2; low.height = r2
  img = lctx.createImageData(c2, r2); img2 = lctx.createImageData(c2, r2)
  hash2 = new Float32Array(c2 * r2)
  for (let i = 0; i < hash2.length; i++) hash2[i] = hsh(i + 1)
  grid2.width = cv.width; grid2.height = cv.height
  const g = grid2.getContext('2d')
  g.fillStyle = 'rgba(10,17,14,0.55)'
  const lw = Math.max(1, Math.round(dpr * 0.75))
  for (let x = 0; x <= c2; x++) g.fillRect(Math.round(x * S * dpr) - lw, 0, lw, grid2.height)
  for (let y = 0; y <= r2; y++) g.fillRect(0, Math.round(y * S * dpr) - lw, grid2.width, lw)
  renderer.setPixelRatio(Math.min(dpr, 1.25))
  renderer.setSize(W, H, false)
  camera.aspect = W / H
  // on tall screens the camera steps back so the whole scene still fits across
  F = camera.aspect < 1 ? 1.9 : camera.aspect < 1.4 ? 1.3 : 1
  camera.updateProjectionMatrix()
  VW = Math.min(170, 273 * F * Math.tan((15 * Math.PI) / 180) * camera.aspect * 0.9)
}

function finale(t) {
  const m = ease(clamp01((t - T.fly1) / (T.morph1 - T.fly1)))
  const L = Math.floor(Math.min(r2 * 0.7, c2 * 0.62))
  const lx = Math.floor((c2 - L) / 2), ly = Math.floor((r2 - L) / 2)
  const k = L / 9
  const lcx = lx + L / 2, lcy = ly + L / 2, corner = k * 0.9
  // rows of the screen where the river lies when seen from straight above (2 world units per cell)
  const rMid = r2 / 2 + ((RZ0 + RZ1) / 2 - Z0) / 2, rHalf = (RZ1 - RZ0) / 4
  const NP = 72, cx = new Float32Array(NP), cy = new Float32Array(NP)
  for (let q = 0; q < NP; q++) {
    const s = q / (NP - 1)
    const sx = -0.25 * c2 + s * 1.5 * c2, sy = rMid
    const vv = -2.5 + s * 14
    const w = smooth(Math.abs(s - 0.5) * 0.9, Math.abs(s - 0.5) * 0.9 + 0.55, m)
    cx[q] = sx + (lx + rivS(vv) * k - sx) * w; cy[q] = sy + (ly + vv * k - sy) * w
  }
  const half = rHalf + (k - rHalf) * m
  const d = img.data
  for (let y = 0; y < r2; y++) for (let x = 0; x < c2; x++) {
    const i = y * c2 + x, h = hash2[i]
    ground((x - c2 / 2) * 2 + 1, Z0 + (y - r2 / 2) * 2 + 1, t, gOut)
    let r = gOut[0], g = gOut[1], b = gOut[2]
    if (m > 0) {
      const u = (x - lx) / k, v = (y - ly) / k
      const qx = Math.max(Math.abs(x + 0.5 - lcx) - (L / 2 - corner), 0), qy = Math.max(Math.abs(y + 0.5 - lcy) - (L / 2 - corner), 0)
      const inside = Math.hypot(qx, qy) <= corner
      let best = 1e9
      for (let q = 0; q < NP - 1; q++) {
        const ax = cx[q], ay = cy[q], vx = cx[q + 1] - ax, vy = cy[q + 1] - ay
        const hh = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1)))
        const ex = x - ax - vx * hh, ey = y - ay - vy * hh, dd = ex * ex + ey * ey
        if (dd < best) best = dd
      }
      const dist = Math.sqrt(best) - half
      const bankW = k * (0.35 + 0.65 * m)
      let tr, tg, tb
      const bu = Math.max(0, Math.min(8, Math.floor(u))), bv = Math.max(0, Math.min(8, Math.floor(v)))
      if (dist < 0) {
        const flow = Math.sin(v * 3.2 - t * 2.2 + u * 0.8) * Math.sin(u * 1.7 + t * 0.6)
        if (flow > 0.88) { tr = 63; tg = 117; tb = 141 } else { tr = 3 + (1 - m) * 6; tg = 8 + (1 - m) * 16; tb = 10 + (1 - m) * 26 }
      } else if (dist < bankW) {
        const c = rgb((bu + bv) % 2 ? C.orange : C.peach); tr = c[0]; tg = c[1]; tb = c[2]
      } else {
        const c = rgb(TONE[LOGO[bv][bu]] || C.f2)
        const seam = (u - bu < 0.045 || v - bv < 0.045) && inside
        tr = seam ? 12 : c[0]; tg = seam ? 20 : c[1]; tb = seam ? 16 : c[2]
      }
      const delay = Math.min(1, Math.abs(dist) / (L * 0.55)) * 0.62 + h * 0.12
      if (inside) {
        const a = smooth(delay, delay + 0.26, m)
        r += (tr - r) * a; g += (tg - g) * a; b += (tb - b) * a
      } else {
        const keep = dist < 0 ? 0.5 : 0
        const fa = smooth(delay * 0.8 + 0.12 + keep * 0.2, delay * 0.8 + 0.42 + keep * 0.3, m)
        r += (10 - r) * fa; g += (17 - g) * fa; b += (14 - b) * fa
      }
    }
    const o = i * 4
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255
  }
  // the symbol splits down the middle of its river and the two banks slide apart
  const sp = clamp01((t - T.split0) / (T.split1 - T.split0))
  if (sp > 0) {
    const gapW = Math.round(ease(sp) * c2 * 0.85)
    const out = img2.data
    for (let y = 0; y < r2; y++) {
      const c = lx + rivS((y - ly) / k) * k
      for (let x = 0; x < c2; x++) {
        let sx = -1
        if (x + gapW < c) sx = x + gapW
        else if (x - gapW >= c) sx = x - gapW
        const o = (y * c2 + x) * 4
        if (sx < 0 || sx >= c2) { out[o + 3] = 0; continue }
        const q = (y * c2 + sx) * 4
        out[o] = d[q]; out[o + 1] = d[q + 1]; out[o + 2] = d[q + 2]; out[o + 3] = 255
      }
    }
    lctx.putImageData(img2, 0, 0)
  } else lctx.putImageData(img, 0, 0)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, cv.width, cv.height)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(low, 0, 0, c2 * S * dpr, r2 * S * dpr)
  ctx.globalCompositeOperation = 'source-atop'
  ctx.drawImage(grid2, 0, 0)
}

/* ---------- loop ---------- */
const P0 = new THREE.Vector3(), P1 = new THREE.Vector3(), A0 = new THREE.Vector3(), A1 = new THREE.Vector3(0, 0, Z0)
const up = new THREE.Vector3(), tgt = new THREE.Vector3()
const mouse = { x: 0, y: 0 }
const onMove = (e) => { mouse.x = (e.clientX / window.innerWidth - 0.5) * 2; mouse.y = (e.clientY / window.innerHeight - 0.5) * 2 }
window.addEventListener('pointermove', onMove)

let t0 = performance.now(), last = -1, phase = 0, glOn = true, farDone = false, shownAt = 0, tick = 0
let raf = 0, stopped = false, done = false
function stop() {
  if (stopped) return
  stopped = true
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', size)
  window.removeEventListener('pointermove', onMove)
  for (const L of blocks) { L.geo.dispose(); L.mat.dispose() }
  box.dispose()
  beam.geometry.dispose(); beam.material.dispose()
  if (scene.background && scene.background.dispose) scene.background.dispose()
  renderer.dispose()
}
function finish() {
  stop()
  if (!done) { done = true; onDone() }
}
function frame(now) {
  if (stopped) return
  let t = (now - t0) / 1000
  if (t > T.split1) { finish(); return }
  const sw = clamp01((t - T.sweep0) / (T.sweep1 - T.sweep0))
  const beamX = -VW - 30 + ease(sw) * (2 * VW + 70)
  const sweepX = sw >= 1 ? undefined : beamX

  if (glOn) {
    const e = ease(clamp01((t - T.fly0) / (T.fly1 - T.fly0)))
    const sy = Math.max(0, 1 - smooth(0.1, 0.8, e))
    const up3 = sy > 0.02
    tick++
    // while the camera rises the animals are redrawn every other frame, and not at all once flattened
    const redraw = up3 && (e === 0 || tick % 2 === 0)
    if (!farDone) { Lfar.d.set(farBase); flush(Lfar, sweepX); farDone = sw >= 1 }
    if (redraw) {
      pick(Ltree); drawTrees(t); flush(Ltree, sweepX)
      pick(Lbank); jaguar(Math.max(0, t - 0.3)); grass(t, 1234, 60); flush(Lbank, sweepX)
      pick(Lriv); boto(t); flush(Lriv, sweepX)
      pick(Lnear); capybara(t, X(0.64), gy, 1); capybara(t + 1.3, X(0.64) + 30, gy, 0.62); grass(t, 4321, 70); flush(Lnear, sweepX)
    }
    pick(Lgr); drawGround(t); flush(Lgr, sweepX)

    // camera: a slow drift with a little cursor parallax, then it rises until it looks straight down
    const drift = Math.sin(t * 0.22) * 26 + mouse.x * 12
    P0.set(drift, 30 + 110 * F - mouse.y * 6, -20 + 250 * F)
    A0.set(drift * 0.25, 30, -20)
    P1.set(0, (H / S) / Math.tan((15 * Math.PI) / 180), Z0 + 0.01)
    camera.position.lerpVectors(P0, P1, e)
    tgt.lerpVectors(A0, A1, e)
    up.set(0, 1 - e, -e).normalize()
    camera.up.copy(up)
    camera.lookAt(tgt)
    // the standing layers fold down into the ground as the camera goes up
    for (const L of standing) { L.mesh.visible = up3; L.mat.uniforms.uFold.value = sy; L.mat.uniforms.uFog.value = 0.7 * (1 - e) }
    Lgr.mat.uniforms.uFog.value = 0.7 * (1 - e)
    beam.visible = sw > 0 && sw < 1
    beam.position.x = beamX
    beam.scale.y = sy
    renderer.render(scene, camera)
  }
  if (t > T.fly1 - 0.25) {
    finale(Math.max(t, T.fly1))
    if (phase === 0) { phase = 1; shownAt = now; cv.style.opacity = 1 }
    // the block scene stays underneath until the flat one has fully faded in, however slow the device
    if (glOn && t > T.fly1 + 0.35 && now - shownAt > 450) { glOn = false; glc.style.display = 'none' }
  }

  const p = Math.round(ease(sw) * PIX)
  if (p !== last) { last = p; [...barra.children].forEach((el, j) => el.classList.toggle('on', j < p)) }
  estado.textContent = t < T.sweep0 ? 'Waking the forest' : sw < 1 ? `Radar sweeping the forest, ${Math.round(ease(sw) * 100)}%` : t < T.fly0 ? 'Forest scanned' : 'Opening the dashboard'
  const end = t > T.fly0
  topo.style.opacity = end ? 0 : 1
  hud.style.opacity = end ? 0 : 1
  raf = requestAnimationFrame(frame)
}

size()
window.addEventListener('resize', size)
raf = requestAnimationFrame(frame)
return stop
}
