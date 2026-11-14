/*
 * Capa 3D na identidade IARA.
 * Um trecho de rio à noite. A passagem do radar varre a cena da esquerda para a direita:
 * antes dela tudo é mosaico de pixels da marca (grade com folga de 12% e canto de 16%),
 * na frente dela uma faixa azul, e depois dela a floresta e os bichos aparecem com volume.
 */
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

/* paleta do guia, tema escuro */
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

/* ---------- varredura do radar, compartilhada por todos os materiais ---------- */
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
  // posição do fragmento na grade de pixels da marca
  vec2 iaraCel = gl_FragCoord.xy / uCell;
  vec2 iaraL = fract(iaraCel) - 0.5;
  float iaraH = fract(sin(dot(floor(iaraCel), vec2(12.9898, 78.233))) * 43758.5453);
  float iaraR = 0.16 * 0.88;
  float iaraSd = length(max(abs(iaraL) - (0.44 - iaraR), 0.0)) - iaraR;
  // borda irregular: cada pixel tem um atraso próprio, a frente fica serrilhada como no mosaico
  float iaraFrente = uScan - iaraH * 0.9;
  float iaraAntes = step(iaraFrente, vIaraPos.x);          // 1 = o radar ainda não passou
  float iaraFaixa = (1.0 - iaraAntes) * (1.0 - smoothstep(0.0, 1.4, iaraFrente - vIaraPos.x));
  float iaraPulso = 1.0 - smoothstep(0.0, 0.9, abs(vIaraPos.x - uPulse));
  if (iaraAntes > 0.5) {
    if (iaraSd > 0.0) discard;
    float tom = 0.8 + 0.7 * iaraH;
    gl_FragColor = vec4(uMosaico * tom, 1.0);
  } else {
    float cel = 1.0 - step(0.0, iaraSd);
    vec3 faixa = mix(gl_FragColor.rgb, uFaixa, cel * 0.85);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, faixa, iaraFaixa);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uFaixa, iaraPulso * cel * 0.22);
  }
`

function aplicarVarredura<T extends THREE.Material>(mat: T, v: Varredura, mosaico?: string): T {
  const local = mosaico ? { value: new THREE.Color(mosaico) } : v.uMosaico
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uScan = v.uScan
    sh.uniforms.uCell = v.uCell
    sh.uniforms.uTime = v.uTime
    sh.uniforms.uPulse = v.uPulse
    sh.uniforms.uMosaico = local
    sh.uniforms.uFaixa = v.uFaixa
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
        '#include <common>\nvarying vec3 vIaraPos;\nuniform float uScan;\nuniform float uCell;\nuniform float uTime;\nuniform float uPulse;\nuniform vec3 uMosaico;\nuniform vec3 uFaixa;'
      )
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + FRAG_VARREDURA)
  }
  mat.customProgramCacheKey = () => 'iara-varredura-' + (mosaico || 'base')
  return mat
}

/* ---------- bichos ---------- */
type Comportamento = 'andar' | 'pastar' | 'enrolar' | 'saltar' | 'voar' | 'pousar' | 'pendurar' | 'balancar'

interface BichoProps {
  url: string
  tamanho: number // maior dimensão, em metros da cena
  posicao: [number, number, number]
  giro?: [number, number, number]
  jeito: Comportamento
  mosaico: string
  v: Varredura
}

function Bicho({ url, tamanho, posicao, giro = [0, 0, 0], jeito, mosaico, v }: BichoProps) {
  const { scene } = useGLTF(url)
  const ref = useRef<THREE.Group>(null)
  const modelo = useMemo(() => {
    const c = scene.clone(true)
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
      m.material = aplicarVarredura(novo, v, mosaico)
    })
    // normaliza o tamanho e assenta no chão
    const caixa = new THREE.Box3().setFromObject(c)
    const dim = caixa.getSize(new THREE.Vector3())
    const k = tamanho / Math.max(dim.x, dim.y, dim.z)
    c.scale.setScalar(k)
    const caixa2 = new THREE.Box3().setFromObject(c)
    const centro = caixa2.getCenter(new THREE.Vector3())
    c.position.set(-centro.x, -caixa2.min.y, -centro.z)
    const g = new THREE.Group()
    g.add(c)
    return g
  }, [scene, tamanho, v, mosaico])

  useFrame((st) => {
    const g = ref.current
    if (!g) return
    const t = st.clock.elapsedTime
    const [x, y, z] = posicao
    switch (jeito) {
      case 'andar': {
        // vai e volta pela margem, devagar
        const f = Math.sin(t * 0.18)
        g.position.set(x + f * 2.6, y + Math.abs(Math.sin(t * 2.4)) * 0.025, z)
        g.rotation.y = giro[1] + (Math.cos(t * 0.18) > 0 ? 0 : Math.PI)
        break
      }
      case 'pastar':
        g.rotation.x = Math.max(0, Math.sin(t * 0.9)) * 0.12
        g.rotation.y = giro[1] + Math.sin(t * 0.25) * 0.25
        break
      case 'enrolar':
        g.rotation.y = giro[1] + Math.sin(t * 0.3) * 0.12
        g.scale.setScalar(1 + Math.sin(t * 0.9) * 0.015)
        break
      case 'saltar': {
        // boto: nada sob a água e salta a cada ciclo
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
      case 'pousar':
        g.rotation.y = giro[1] + Math.round(Math.sin(t * 0.7) * 2) * 0.35
        break
      case 'pendurar':
        g.rotation.z = giro[2] + Math.sin(t * 0.5) * 0.06
        break
      case 'balancar':
        g.rotation.z = giro[2] + Math.sin(t * 1.3) * 0.55
        g.position.x = x
        break
    }
  })

  return (
    <group ref={ref} position={posicao} rotation={giro}>
      {jeito === 'pendurar' ? (
        // preguiça: patas no galho, corpo de cabeça para baixo
        <group rotation={[0, 0, Math.PI]}>
          <primitive object={modelo} />
        </group>
      ) : jeito === 'balancar' ? (
        // o ponto de giro fica no galho, acima do bicho
        <group position={[0, -tamanho * 0.95, 0]}>
          <primitive object={modelo} />
        </group>
      ) : (
        <primitive object={modelo} />
      )}
    </group>
  )
}

/* ---------- floresta em pixels: árvores simples, instanciadas ---------- */
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
    // margem do fundo: mata fechada
    for (let i = 0; i < 170; i++) plantar(-24 + r() * 48, -6.6 - r() * 15, 3.2 + r() * 4.2)
    // margem da frente: poucas árvores emoldurando
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

/* ---------- rio e margens ---------- */
function Rio({ v }: { v: Varredura }) {
  const geo = useMemo(() => {
    // faixa de água que serpenteia da esquerda para a direita
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

/* ---------- partículas: pixels de cinza e brasa subindo ---------- */
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

/* ---------- céu: escuro em cima, brilho de queimada no horizonte ---------- */
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

/* ---------- câmera e relógio da varredura ---------- */
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
    // o relógio só começa quando os bichos terminaram de carregar (este componente fica no mesmo Suspense)
    // e anda no máximo 1/20 s por quadro, para a passagem não pular quando o primeiro quadro demora
    relogio.current += Math.min(dt, 0.05)
    const t = relogio.current
    v.uTime.value = t
    // passagem principal: da esquerda para a direita, uma vez
    const f = reduz ? 1 : Math.min(1, Math.max(0, (t - INICIO) / DURACAO))
    const e = f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2
    v.uScan.value = -24 + e * 50
    aoProgredir?.(e)
    if (f >= 1 && !fim.current) {
      fim.current = true
      aoTerminar()
    }
    // depois, um eco fraco do radar a cada 9 s
    if (!reduz && f >= 1) {
      const k = ((t - INICIO - DURACAO) % 9) / 9
      v.uPulse.value = -24 + k * 50
    }
    // câmera: deriva lenta sobre o rio, com leve paralaxe do cursor
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

/* posições: margem de lá do rio (z perto de -4,5), o boto no meio da água, e os bichos de árvore nos galhos do fundo */
const BICHOS: Omit<BichoProps, 'v'>[] = [
  { url: '/models/jaguar.glb', tamanho: 2.3, posicao: [-3.4, 0, -4.3], giro: [0, Math.PI / 2, 0], jeito: 'andar', mosaico: '#b9481a' },
  { url: '/models/capybara.glb', tamanho: 1.7, posicao: [5.4, 0, -4.9], giro: [0, -0.9, 0], jeito: 'pastar', mosaico: '#3b6447' },
  { url: '/models/anaconda.glb', tamanho: 2.6, posicao: [-6.4, 0.02, -2.9], giro: [0, 0.5, 0], jeito: 'enrolar', mosaico: '#33593f' },
  { url: '/models/dolphin.glb', tamanho: 1.6, posicao: [1.5, 0.05, -2.0], giro: [0, Math.PI / 2, 0], jeito: 'saltar', mosaico: '#2b7ea6' },
  { url: '/models/macaw.glb', tamanho: 1.1, posicao: [4.0, 3.42, -5.62], giro: [0, -0.3, 0], jeito: 'pousar', mosaico: '#f07a45' },
  { url: '/models/toucan.glb', tamanho: 0.95, posicao: [6.3, 2.62, -5.3], giro: [0, -0.6, 0], jeito: 'pousar', mosaico: '#f07a45' },
  { url: '/models/sloth.glb', tamanho: 1.35, posicao: [-1.8, 3.2, -5.4], giro: [0, 0.4, 0], jeito: 'pendurar', mosaico: '#4f9a6a' },
  { url: '/models/spider-monkey.glb', tamanho: 1.6, posicao: [2.4, 3.4, -5.6], giro: [0, 0.3, 0], jeito: 'balancar', mosaico: '#3b6447' },
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
