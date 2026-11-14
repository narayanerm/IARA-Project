import { useRef, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Center, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

interface AnimalProps {
  url: string
  position: [number, number, number]
  rotation?: [number, number, number]
  scale: number
  behavior: 'stalk' | 'flee' | 'hang' | 'perch' | 'fly' | 'swing' | 'coil' | 'breach'
}

function Animal({ url, position, rotation = [0, 0, 0], scale, behavior }: AnimalProps) {
  const gltf = useGLTF(url)
  const ref = useRef<THREE.Group>(null)
  const scene = gltf.scene.clone(true)

  // Normalize materials: ensure proper shading
  scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const m = o as THREE.Mesh
      m.castShadow = true
      m.receiveShadow = true
      const mat = m.material as THREE.MeshStandardMaterial
      if (mat && 'roughness' in mat) {
        mat.roughness = 0.75
        mat.metalness = 0.05
      }
    }
  })

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    const g = ref.current

    switch (behavior) {
      case 'stalk': {
        // slow prowl across x with subtle sway
        const span = 4
        const phase = ((t * 0.12) % 2) - 1 // -1..1
        g.position.x = position[0] + phase * span
        g.rotation.y = rotation[1] + (phase > 0 ? 0 : Math.PI)
        g.position.y = position[1] + Math.sin(t * 2) * 0.03
        break
      }
      case 'flee': {
        const span = 5
        const phase = ((t * 0.38 + 0.5) % 2) - 1
        g.position.x = position[0] + phase * span
        g.rotation.y = rotation[1]
        g.position.y = position[1] + Math.abs(Math.sin(t * 8)) * 0.15 // hopping bob
        break
      }
      case 'hang': {
        g.rotation.z = rotation[2] + Math.sin(t * 0.6) * 0.1
        g.position.y = position[1] + Math.sin(t * 0.4) * 0.05
        break
      }
      case 'perch': {
        g.rotation.y = rotation[1] + Math.sin(t * 1.5) * 0.3
        break
      }
      case 'fly': {
        // arc across top
        const loop = 12
        const phase = (t % loop) / loop
        g.position.x = position[0] + (phase - 0.5) * 16
        g.position.y = position[1] + Math.sin(phase * Math.PI) * 1.2
        g.position.z = position[2] + Math.cos(phase * Math.PI * 2) * 0.5
        g.rotation.y = rotation[1] + (phase < 0.5 ? 0 : Math.PI)
        g.rotation.z = Math.sin(t * 6) * 0.15 // wing flap tilt
        break
      }
      case 'swing': {
        const angle = Math.sin(t * 1.4) * 0.6
        g.rotation.z = rotation[2] + angle
        g.position.x = position[0] + Math.sin(t * 1.4) * 0.5
        break
      }
      case 'coil': {
        g.rotation.y = rotation[1] + Math.sin(t * 0.3) * 0.15
        g.scale.setScalar(scale * (1 + Math.sin(t * 0.8) * 0.02))
        break
      }
      case 'breach': {
        // dolphin swim + jump in a river lane
        const loop = 10
        const phase = (t % loop) / loop
        g.position.x = position[0] + (phase - 0.5) * 12
        const jumpPhase = phase > 0.45 && phase < 0.55 ? (phase - 0.45) / 0.1 : 0
        g.position.y = position[1] + Math.sin(jumpPhase * Math.PI) * 1.2
        g.rotation.z = jumpPhase > 0 ? Math.sin(jumpPhase * Math.PI) * 0.8 : 0
        break
      }
    }
  })

  return (
    <group ref={ref} position={position} rotation={rotation}>
      <Center disableY>
        <primitive object={scene} scale={scale} />
      </Center>
    </group>
  )
}

function CinematicCamera() {
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const cam = state.camera
    // Slow dolly + orbit
    const r = 14 - Math.min(t * 0.6, 4) // dolly in during first ~6s
    const theta = -0.35 + Math.sin(t * 0.08) * 0.25
    cam.position.x = Math.sin(theta) * r
    cam.position.z = Math.cos(theta) * r
    cam.position.y = 3.2 + Math.sin(t * 0.15) * 0.2
    cam.lookAt(0, 1.2, 0)
  })
  return null
}

function Fireflies({ count = 40 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null)
  const positions = new Float32Array(count * 3)
  const speeds = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 18
    positions[i * 3 + 1] = Math.random() * 4 + 0.5
    positions[i * 3 + 2] = (Math.random() - 0.5) * 12
    speeds[i] = Math.random() * 0.5 + 0.2
  }

  useFrame((state) => {
    if (!ref.current) return
    const p = ref.current.geometry.attributes.position as THREE.BufferAttribute
    const t = state.clock.elapsedTime
    for (let i = 0; i < count; i++) {
      p.array[i * 3 + 1] =
        positions[i * 3 + 1] + Math.sin(t * speeds[i] + i) * 0.4
      p.array[i * 3] =
        positions[i * 3] + Math.cos(t * speeds[i] * 0.5 + i * 2) * 0.3
    }
    p.needsUpdate = true
    ref.current.rotation.y = t * 0.02
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        color="#f5e18a"
        transparent
        opacity={0.9}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

function Ground() {
  return (
    <>
      {/* forest floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0a1510" roughness={1} />
      </mesh>
      {/* river lane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, -4]}>
        <planeGeometry args={[40, 3]} />
        <meshStandardMaterial
          color="#0a2838"
          roughness={0.2}
          metalness={0.6}
          emissive="#042030"
          emissiveIntensity={0.3}
        />
      </mesh>
    </>
  )
}

function FogSphere() {
  return <fogExp2 attach="fog" args={['#0a1420', 0.055]} />
}

function Scene() {
  return (
    <>
      <FogSphere />
      <color attach="background" args={['#06111a']} />

      <ambientLight intensity={0.25} color="#5a7fa0" />
      <directionalLight
        position={[6, 10, 3]}
        intensity={0.9}
        color="#f5d090"
        castShadow
      />
      <pointLight position={[-4, 2, 2]} intensity={1.2} color="#89f0ff" distance={10} />
      <pointLight position={[4, 1.5, -3]} intensity={0.8} color="#ffb060" distance={8} />

      <Ground />
      <Fireflies />
      <CinematicCamera />

      <Suspense fallback={null}>
        {/* Foreground floor — jaguar stalks across */}
        <Animal
          url="/models/jaguar.glb"
          position={[-1.5, 0.05, 2]}
          rotation={[0, Math.PI / 2, 0]}
          scale={0.9}
          behavior="stalk"
        />
        {/* Capybara fleeing */}
        <Animal
          url="/models/capybara.glb"
          position={[2.5, 0.05, 1.5]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={0.8}
          behavior="flee"
        />
        {/* Anaconda coiled in grass */}
        <Animal
          url="/models/anaconda.glb"
          position={[-3.5, 0.02, -0.5]}
          rotation={[0, 0.6, 0]}
          scale={1.6}
          behavior="coil"
        />
        {/* Sloth hanging up in canopy */}
        <Animal
          url="/models/sloth.glb"
          position={[-2.8, 3.2, -1]}
          rotation={[Math.PI, 0.3, 0]}
          scale={0.8}
          behavior="hang"
        />
        {/* Toucan perched */}
        <Animal
          url="/models/toucan.glb"
          position={[3.2, 2.8, -0.5]}
          rotation={[0, -0.5, 0]}
          scale={0.7}
          behavior="perch"
        />
        {/* Spider monkey swinging */}
        <Animal
          url="/models/spider-monkey.glb"
          position={[-0.5, 2.5, -2]}
          rotation={[0, 0.2, 0]}
          scale={0.9}
          behavior="swing"
        />
        {/* Macaw flying overhead */}
        <Animal
          url="/models/macaw.glb"
          position={[0, 4.5, -1]}
          rotation={[0, 0, 0]}
          scale={0.7}
          behavior="fly"
        />
        {/* Dolphin breaching in river */}
        <Animal
          url="/models/dolphin.glb"
          position={[0, 0.4, -4]}
          rotation={[0, Math.PI / 2, 0]}
          scale={0.9}
          behavior="breach"
        />
        <Environment preset="night" background={false} />
      </Suspense>
    </>
  )
}

// Preload GLB models in parallel on first import
useGLTF.preload('/models/jaguar.glb')
useGLTF.preload('/models/capybara.glb')
useGLTF.preload('/models/anaconda.glb')
useGLTF.preload('/models/sloth.glb')
useGLTF.preload('/models/toucan.glb')
useGLTF.preload('/models/spider-monkey.glb')
useGLTF.preload('/models/macaw.glb')
useGLTF.preload('/models/dolphin.glb')

export function Scene3D() {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 3, 14], fov: 42, near: 0.1, far: 100 }}
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    >
      <Scene />
    </Canvas>
  )
}
