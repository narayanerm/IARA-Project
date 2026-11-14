/*
 * 3D loading screen in the IARA identity.
 * A stretch of river at night. The radar pass sweeps the scene from left to right:
 * ahead of it everything is the brand pixel mosaic (grid with 12% gap and 16% corner radius),
 * at its front a blue band, and behind it the forest and the animals appear in full 3D.
 */
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

/* brand guide palette, dark theme */
export const IARA = {
  bg: '#0a110e',
  superficie: '#13201a',
  tinta: '#e6eee8',
  mata1: '#2c5039',
  mata2: '#33593f',
  mata3: '#3b6447',
  mata: '#4f9a6a',
  agua: '#5aa7c9',
  aguaFunda: '#2b7ea6',
  laranja: '#f07a45',
  laranjaFundo: '#b9481a',
}

/* ---------- radar sweep, shared by all materials ---------- */
type Varredura = {
  uScan: { value: number }
  uCell: { value: number }
  uTime: { value: number }
  uPulse: { value: number }
  uMosaico: { value: THREE.Color }
  uFaixa: { value: THREE.Color }
}

function criarVarredura(): Varredura {
  return {
    uScan: { value: -30 },
    uCell: { value: 9 },
    uTime: { value: 0 },
    uPulse: { value: -99 },
    uMosaico: { value: new THREE.Color(IARA.mata2) },
    uFaixa: { value: new THREE.Color(IARA.agua) },
  }
}

const FRAG_VARREDURA = /* glsl */ `
  // fragment position on the brand pixel grid
  vec2 iaraCel = gl_FragCoord.xy / uCell;
  vec2 iaraL = fract(iaraCel) - 0.5;
  float iaraH = fract(sin(dot(floor(iaraCel), vec2(12.9898, 78.233))) * 43758.5453);
  float iaraR = 0.16 * 0.88;
  float iaraSd = length(max(abs(iaraL) - (0.44 - iaraR), 0.0)) - iaraR;
  // jagged edge: each pixel has its own delay, so the front is stepped like the mosaic
  float iaraFrente = uScan - iaraH * 0.9;
  float iaraAntes = step(iaraFrente, vIaraPos.x);          // 1 = the radar has not passed yet
  float iaraFaixa = (1.0 - iaraAntes) * (1.0 - smoothstep(0.0, 1.4, iaraFrente - vIaraPos.x));
  float iaraPulso = 1.0 - smoothstep(0.0, 0.9, abs(vIaraPos.x - uPulse));
  if (iaraAntes > 0.5) {
    if (iaraSd > 0.0) discard;
    float tom = 0.8 + 0.7 * iaraH;
    // keep the coat pattern (spots, stripes) readable inside the mosaic
    float iaraLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    gl_FragColor = vec4(uMosaico * tom * mix(1.0, mix(0.18, 1.25, iaraLum), uPadrao), 1.0);
  } else {
    float cel = 1.0 - step(0.0, iaraSd);
    vec3 faixa = mix(gl_FragColor.rgb, uFaixa, cel * 0.85);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, faixa, iaraFaixa);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uFaixa, iaraPulso * cel * 0.22);
  }
`

function aplicarVarredura<T extends THREE.Material>(mat: T, v: Varredura, mosaico?: string, padrao = 0): T {
  const local = mosaico ? { value: new THREE.Color(mosaico) } : v.uMosaico
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uScan = v.uScan
    sh.uniforms.uCell = v.uCell
    sh.uniforms.uTime = v.uTime
    sh.uniforms.uPulse = v.uPulse
    sh.uniforms.uMosaico = local
    sh.uniforms.uFaixa = v.uFaixa
    sh.uniforms.uPadrao = { value: padrao }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vIaraPos;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 iaraW = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          iaraW = instanceMatrix * iaraW;
        #endif
        vIaraPos = (modelMatrix * iaraW).xyz;`
      )
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vIaraPos;\nuniform float uScan;\nuniform float uCell;\nuniform float uTime;\nuniform float uPulse;\nuniform vec3 uMosaico;\nuniform vec3 uFaixa;\nuniform float uPadrao;'
      )
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + FRAG_VARREDURA)
  }
  mat.customProgramCacheKey = () => 'iara-varredura-' + (mosaico || 'base') + (padrao ? '-p' + padrao : '')
  return mat
}

/* ---------- animals ---------- */
// the sloth model is in a T-pose with no skeleton: rotate each arm up around its shoulder
// so it hangs from the branch by its paws instead of looking like a stiff cross
function dobrarBracos(c: THREE.Group) {
  const caixa = new THREE.Box3().setFromObject(c)
  const dim = caixa.getSize(new THREE.Vector3())
  const cx = (caixa.min.x + caixa.max.x) / 2
  const ombroX = dim.x * 0.13
  const ombroY = caixa.min.y + dim.y * 0.56
  const ang = THREE.MathUtils.degToRad(78)
  c.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i) - cx
      const py = pos.getY(i)
      if (Math.abs(px) <= ombroX || py < caixa.min.y + dim.y * 0.35) continue
      const lado = Math.sign(px)
      const dx = px - lado * ombroX
      const dy = py - ombroY
      const a = lado * ang
      pos.setXY(i, cx + lado * ombroX + dx * Math.cos(a) - dy * Math.sin(a), ombroY + dx * Math.sin(a) + dy * Math.cos(a))
    }
    pos.needsUpdate = true
    m.geometry.computeVertexNormals()
  })
}

type Comportamento = 'andar' | 'pastar' | 'enrolar' | 'saltar' | 'voar' | 'pousar' | 'pendurar' | 'balancar' | 'sentar'

interface BichoProps {
  url: string
  tamanho: number // largest dimension, in scene meters
  posicao: [number, number, number]
  giro?: [number, number, number]
  jeito: Comportamento
  mosaico: string
  padrao?: number // 0..1: how much of the coat pattern shows inside the mosaic
  v: Varredura
}

function Bicho({ url, tamanho, posicao, giro = [0, 0, 0], jeito, mosaico, padrao = 0.5, v }: BichoProps) {
  const { scene } = useGLTF(url)
  const ref = useRef<THREE.Group>(null)
  const modelo = useMemo(() => {
    // bake every mesh into one flat group so the geometry can be reshaped safely
    scene.updateMatrixWorld(true)
    const c = new THREE.Group()
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const geo = m.geometry.clone()
      geo.applyMatrix4(m.matrixWorld)
      c.add(new THREE.Mesh(geo, m.material))
    })
    if (jeito === 'pendurar') dobrarBracos(c)
    c.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const orig = m.material as THREE.MeshStandardMaterial
      const novo = new THREE.MeshStandardMaterial({
        map: orig.map ?? null,
        color: orig.color ? orig.color.clone() : new THREE.Color('#ffffff'),
        roughness: 0.85,
        metalness: 0,
        flatShading: true,
      })
      m.material = aplicarVarredura(novo, v, mosaico, padrao)
    })
    // normalize the size and rest it on the ground
    const caixa = new THREE.Box3().setFromObject(c)
    const dim = caixa.getSize(new THREE.Vector3())
    const k = tamanho / Math.max(dim.x, dim.y, dim.z)
    c.scale.setScalar(k)
    const caixa2 = new THREE.Box3().setFromObject(c)
    const centro = caixa2.getCenter(new THREE.Vector3())
    // hanging animals hang from their highest point (the paws on the branch)
    c.position.set(-centro.x, jeito === 'pendurar' ? -caixa2.max.y : -caixa2.min.y, -centro.z)
    const g = new THREE.Group()
    g.add(c)
    return g
  }, [scene, tamanho, v, mosaico, padrao, jeito])

  useFrame((st) => {
    const g = ref.current
    if (!g) return
    const t = st.clock.elapsedTime
    const [x, y, z] = posicao
    switch (jeito) {
      case 'andar': {
        // stands on the bank: slow breathing and an occasional look toward the river
        g.position.set(x, y, z)
        g.scale.set(1, 1 + Math.sin(t * 1.1) * 0.012, 1)
        const olhar = Math.max(0, Math.sin(t * 0.22)) ** 3
        g.rotation.y = giro[1] + olhar * 0.45
        break
      }
      case 'pastar': {
        // grazes: head down for a while, then up to look around
        const baixa = Math.max(0, Math.sin(t * 0.35)) ** 2
        g.rotation.x = baixa * 0.07
        g.rotation.y = giro[1] + Math.sin(t * 0.12) * 0.18
        g.position.set(x, y, z)
        break
      }
      case 'enrolar':
        g.rotation.y = giro[1] + Math.sin(t * 0.3) * 0.12
        g.scale.setScalar(1 + Math.sin(t * 0.9) * 0.015)
        break
      case 'saltar': {
        // river dolphin: swims under the water and jumps every cycle
        const ciclo = 7
        const f = (t % ciclo) / ciclo
        const pulo = f > 0.62 && f < 0.82 ? (f - 0.62) / 0.2 : -1
        g.position.x = x + (f - 0.5) * 7
        g.position.z = z + Math.sin(f * Math.PI * 2) * 0.3
        g.position.y = pulo >= 0 ? y + Math.sin(pulo * Math.PI) * 0.9 : y - 0.6
        g.rotation.z = pulo >= 0 ? (0.5 - pulo) * 1.4 : 0
        g.rotation.y = giro[1]
        break
      }
      case 'voar': {
        const ciclo = 14
        const f = (t % ciclo) / ciclo
        g.position.set(x + (f - 0.5) * 22, y + Math.sin(f * Math.PI) * 1.4 + Math.sin(t * 5) * 0.05, z + Math.cos(f * Math.PI) * 1.5)
        g.rotation.y = giro[1]
        g.rotation.z = Math.sin(t * 7) * 0.12
        break
      }
      case 'pousar': {
        // perched bird: smooth head turns and a small bob now and then
        const fase = t * 0.5 + x
        g.rotation.y = giro[1] + Math.sin(fase) * 0.35 + Math.sin(fase * 2.3) * 0.08
        g.position.set(x, y + Math.max(0, Math.sin(t * 1.7 + x)) ** 8 * 0.05, z)
        break
      }
      case 'pendurar':
        // sloth: hangs from its paws, slow sway, inching along the branch
        g.position.set(x + Math.sin(t * 0.06) * 0.5, y, z)
        g.rotation.z = giro[2] + Math.sin(t * 0.4) * 0.05
        g.rotation.x = giro[0] + Math.sin(t * 0.27) * 0.03
        break
      case 'sentar':
        // sits on the branch: breathing, looks around
        g.position.set(x, y + Math.sin(t * 1.2) * 0.008, z)
        g.rotation.y = giro[1] + Math.sin(t * 0.3) * 0.5
        break
      case 'balancar':
        g.rotation.z = giro[2] + Math.sin(t * 0.6) * 0.15
        g.position.x = x
        break
    }
  })

  return (
    <group ref={ref} position={posicao} rotation={giro}>
      {jeito === 'balancar' ? (
        // the pivot sits on the branch, above the animal
        <group position={[0, -tamanho * 0.95, 0]}>
          <primitive object={modelo} />
        </group>
      ) : (
        <primitive object={modelo} />
      )}
    </group>
  )
}

/* ---------- pixel forest: simple instanced trees ---------- */
function rnd(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 100000) / 100000
  }
}

function Floresta({ v }: { v: Varredura }) {
  const { troncos, copas } = useMemo(() => {
    const r = rnd(2026)
    const troncos: THREE.Matrix4[] = []
    const copas: { m: THREE.Matrix4; c: THREE.Color }[] = []
    const tons = [IARA.mata1, IARA.mata2, IARA.mata3, IARA.mata1, IARA.mata]
    const plantar = (x: number, z: number, h: number) => {
      troncos.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h * 0.5, z), new THREE.Quaternion(), new THREE.Vector3(0.12 + h * 0.012, h, 0.12 + h * 0.012)))
      const n = 2 + Math.floor(r() * 3)
      for (let k = 0; k < n; k++) {
        const s = (0.9 + r() * 1.1) * (h / 5)
        const p = new THREE.Vector3(x + (r() - 0.5) * 1.2, h * (0.78 + r() * 0.3), z + (r() - 0.5) * 1.2)
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(r(), r() * 3, r()))
        copas.push({ m: new THREE.Matrix4().compose(p, q, new THREE.Vector3(s * 1.3, s * 0.85, s * 1.3)), c: new THREE.Color(tons[Math.floor(r() * tons.length)]) })
      }
    }
    // far bank: dense forest
    for (let i = 0; i < 170; i++) plantar(-24 + r() * 48, -6.6 - r() * 15, 3.2 + r() * 4.2)
    // near bank: a few trees framing the view
    for (let i = 0; i < 8; i++) {
      const lado = r() < 0.5 ? -1 : 1
      plantar(lado * (9.5 + r() * 6), 1.5 + r() * 3, 4 + r() * 3)
    }
    return { troncos, copas }
  }, [])

  const refT = useRef<THREE.InstancedMesh>(null)
  const refC = useRef<THREE.InstancedMesh>(null)
  const matT = useMemo(() => aplicarVarredura(new THREE.MeshStandardMaterial({ color: '#1c2a22', roughness: 1, flatShading: true }), v, '#16261d'), [v])
  const matC = useMemo(() => aplicarVarredura(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, flatShading: true }), v), [v])

  useEffect(() => {
    troncos.forEach((m, i) => refT.current?.setMatrixAt(i, m))
    copas.forEach((c, i) => {
      refC.current?.setMatrixAt(i, c.m)
      refC.current?.setColorAt(i, c.c)
    })
    if (refT.current) refT.current.instanceMatrix.needsUpdate = true
    if (refC.current) {
      refC.current.instanceMatrix.needsUpdate = true
      if (refC.current.instanceColor) refC.current.instanceColor.needsUpdate = true
    }
  }, [troncos, copas])

  return (
    <>
      <instancedMesh ref={refT} args={[undefined, undefined, troncos.length]} material={matT}>
        <cylinderGeometry args={[0.6, 1, 1, 6]} />
      </instancedMesh>
      <instancedMesh ref={refC} args={[undefined, undefined, copas.length]} material={matC}>
        <icosahedronGeometry args={[1, 0]} />
      </instancedMesh>
    </>
  )
}

/* ---------- river and banks ---------- */
function Rio({ v }: { v: Varredura }) {
  const geo = useMemo(() => {
    // strip of water winding from left to right
    const g = new THREE.PlaneGeometry(60, 4.6, 120, 1)
    const p = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      p.setY(i, p.getY(i) + Math.sin(x * 0.18) * 1.1)
    }
    g.rotateX(-Math.PI / 2)
    g.translate(0, 0.02, -1.4)
    return g
  }, [])
  const matAgua = useMemo(
    () =>
      aplicarVarredura(
        new THREE.MeshStandardMaterial({ color: '#0e2a33', roughness: 0.18, metalness: 0.55, emissive: new THREE.Color('#0b2a38'), emissiveIntensity: 0.6 }),
        v,
        '#2b6f8f'
      ),
    [v]
  )
  const matChao = useMemo(() => aplicarVarredura(new THREE.MeshStandardMaterial({ color: '#0f1c15', roughness: 1 }), v, '#13241a'), [v])
  return (
    <>
      <mesh geometry={geo} material={matAgua} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={matChao}>
        <planeGeometry args={[80, 60]} />
      </mesh>
    </>
  )
}

function Galho({ de, ate, v }: { de: [number, number, number]; ate: [number, number, number]; v: Varredura }) {
  const { pos, quat, len } = useMemo(() => {
    const a = new THREE.Vector3(...de)
    const b = new THREE.Vector3(...ate)
    const d = b.clone().sub(a)
    return {
      pos: a.clone().add(b).multiplyScalar(0.5),
      quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()),
      len: d.length(),
    }
  }, [de, ate])
  const mat = useMemo(() => aplicarVarredura(new THREE.MeshStandardMaterial({ color: '#24342a', roughness: 1, flatShading: true }), v, '#16261d'), [v])
  return (
    <mesh position={pos} quaternion={quat} material={mat}>
      <cylinderGeometry args={[0.07, 0.11, len, 6]} />
    </mesh>
  )
}

/* ---------- particles: ash and ember pixels rising ---------- */
function Brasas({ n = 70 }: { n?: number }) {
  const ref = useRef<THREE.Points>(null)
  const { pos, vel } = useMemo(() => {
    const r = rnd(7)
    const pos = new Float32Array(n * 3)
    const vel = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (r() - 0.5) * 30
      pos[i * 3 + 1] = r() * 7
      pos[i * 3 + 2] = -3 - r() * 12
      vel[i] = 0.15 + r() * 0.35
    }
    return { pos, vel }
  }, [n])
  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    const p = g.geometry.attributes.position as THREE.BufferAttribute
    const a = p.array as Float32Array
    for (let i = 0; i < n; i++) {
      a[i * 3 + 1] += vel[i] * dt
      a[i * 3] += Math.sin(a[i * 3 + 1] * 0.8 + i) * dt * 0.2
      if (a[i * 3 + 1] > 8) a[i * 3 + 1] = 0.3
    }
    p.needsUpdate = true
  })
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.07} color={IARA.laranja} transparent opacity={0.8} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  )
}

/* ---------- sky: dark above, wildfire glow on the horizon ---------- */
function Ceu() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { cTopo: { value: new THREE.Color(IARA.bg) }, cMeio: { value: new THREE.Color('#13201a') }, cFogo: { value: new THREE.Color('#4a2312') } },
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader:
          'uniform vec3 cTopo,cMeio,cFogo; varying vec3 vP; void main(){ float h = vP.y; vec3 c = mix(cMeio, cTopo, smoothstep(0.02, 0.45, h)); c = mix(c, cFogo, (1.0 - smoothstep(-0.02, 0.16, h)) * 0.55 * smoothstep(-0.6, 0.4, -vP.z)); gl_FragColor = vec4(c, 1.0); }',
      }),
    []
  )
  return (
    <mesh material={mat} scale={80}>
      <sphereGeometry args={[1, 32, 16]} />
    </mesh>
  )
}

/* ---------- camera and sweep clock ---------- */
type Avisos = { aoTerminar: () => void; aoProgredir?: (p: number) => void; reduz: boolean }

function Direcao({ v, aoTerminar, aoProgredir, reduz }: Avisos & { v: Varredura }) {
  const { camera, gl, size } = useThree()
  const mouse = useRef({ x: 0, y: 0 })
  const fim = useRef(false)
  const relogio = useRef(0)
  useEffect(() => {
    const f = (e: PointerEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('pointermove', f)
    return () => window.removeEventListener('pointermove', f)
  }, [])
  useEffect(() => {
    v.uCell.value = (size.width < 700 ? 6 : 8) * gl.getPixelRatio()
  }, [size.width, gl, v])

  const INICIO = 0.35
  const DURACAO = 4.2
  useFrame((_, dt) => {
    // the clock only starts once the animals have finished loading (this component sits in the same Suspense)
    // and advances at most 1/20 s per frame, so the pass does not skip ahead when the first frame is slow
    relogio.current += Math.min(dt, 0.05)
    const t = relogio.current
    v.uTime.value = t
    // main pass: left to right, once
    const f = reduz ? 1 : Math.min(1, Math.max(0, (t - INICIO) / DURACAO))
    const e = f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2
    v.uScan.value = -24 + e * 50
    aoProgredir?.(e)
    if (f >= 1 && !fim.current) {
      fim.current = true
      aoTerminar()
    }
    // afterwards, a faint radar echo every 9 s
    if (!reduz && f >= 1) {
      const k = ((t - INICIO - DURACAO) % 9) / 9
      v.uPulse.value = -24 + k * 50
    }
    // camera: slow drift over the river, with slight cursor parallax
    const estreita = size.width < 700
    const drift = reduz ? 0 : Math.sin(t * 0.07) * 0.8
    const alvoX = drift + mouse.current.x * 0.6 + (estreita ? 0.6 : 0)
    const alvoY = 3.4 - mouse.current.y * 0.25
    camera.position.x += (alvoX - camera.position.x) * 0.03
    camera.position.y += (alvoY - camera.position.y) * 0.03
    camera.position.z = estreita ? 15 : 11
    camera.lookAt(camera.position.x * 0.4, estreita ? 0.2 : 0.9, -2.5)
  })
  return null
}

/* positions: far bank of the river (z near -4.5), the dolphin mid-river, and the tree animals on the back branches */
const BICHOS: Omit<BichoProps, 'v'>[] = [
  { url: '/models/jaguar.glb', tamanho: 2.3, posicao: [-3.4, 0, -4.3], giro: [0, Math.PI / 2, 0], jeito: 'andar', mosaico: '#d9a441', padrao: 1 },
  { url: '/models/capybara.glb', tamanho: 1.7, posicao: [5.4, 0, -4.9], giro: [0, -0.9, 0], jeito: 'pastar', mosaico: '#c08d5c', padrao: 0.6 },
  { url: '/models/anaconda.glb', tamanho: 2.6, posicao: [-6.4, 0.02, -2.9], giro: [0, 0.5, 0], jeito: 'enrolar', mosaico: '#8fb35a', padrao: 1 },
  { url: '/models/dolphin.glb', tamanho: 1.6, posicao: [1.5, 0.05, -2.0], giro: [0, Math.PI / 2, 0], jeito: 'saltar', mosaico: '#e58aa6' },
  { url: '/models/macaw.glb', tamanho: 1.1, posicao: [4.0, 3.42, -5.62], giro: [0, -0.3, 0], jeito: 'pousar', mosaico: '#f07a45' },
  { url: '/models/toucan.glb', tamanho: 0.95, posicao: [6.3, 2.62, -5.3], giro: [0, -0.6, 0], jeito: 'pousar', mosaico: '#f07a45' },
  { url: '/models/sloth.glb', tamanho: 1.35, posicao: [-1.8, 3.27, -5.4], giro: [0, 0.4, 0], jeito: 'pendurar', mosaico: '#c9b48a', padrao: 0.8 },
  { url: '/models/spider-monkey.glb', tamanho: 1.6, posicao: [2.4, 3.5, -5.6], giro: [0, 0.3, 0], jeito: 'sentar', mosaico: '#9cc79a', padrao: 0 },
]

function Cena(props: Avisos) {
  const v = useMemo(criarVarredura, [])
  return (
    <>
      <color attach="background" args={[IARA.bg]} />
      <fogExp2 attach="fog" args={[IARA.bg, 0.036]} />
      <hemisphereLight args={['#5aa7c9', '#0a110e', 0.6]} />
      <directionalLight position={[-6, 9, 6]} intensity={1.3} color="#cfe6ff" />
      <pointLight position={[7, 2.2, -10]} intensity={30} distance={22} color={IARA.laranja} />
      <pointLight position={[0, 3, 2]} intensity={10} distance={16} color={IARA.agua} />
      <pointLight position={[1, 5.5, -2.5]} intensity={9} distance={9} color="#cfe6ff" />
      <Ceu />
      <Rio v={v} />
      <Floresta v={v} />
      <Galho de={[-3.6, 3.25, -5.4]} ate={[0.2, 3.2, -5.45]} v={v} />
      <Galho de={[0.8, 3.45, -5.6]} ate={[4.4, 3.4, -5.65]} v={v} />
      <Galho de={[5.0, 2.6, -5.3]} ate={[7.8, 2.7, -5.35]} v={v} />
      <Brasas />
      <Suspense fallback={null}>
        {BICHOS.map((b) => (
          <Bicho key={b.url} {...b} v={v} />
        ))}
        <Direcao v={v} {...props} />
      </Suspense>
    </>
  )
}

BICHOS.forEach((b) => useGLTF.preload(b.url))

export function Scene3D(props: Avisos) {
  return (
    <Canvas
      camera={{ position: [0, 3.4, 11], fov: 40, near: 0.1, far: 200 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    >
      <Cena {...props} />
    </Canvas>
  )
}
