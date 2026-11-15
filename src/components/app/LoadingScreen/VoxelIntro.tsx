import { useEffect, useRef, useState } from 'react'
import { hasWebGL2 } from '@/lib/webgl-support'
import { startVoxelIntro } from './voxel-intro-scene'
import './voxel-intro.css'

/**
 * Opening animation: a voxel forest swept by radar, the camera rises to look straight down,
 * the river bends into the IARA symbol and the symbol splits along the river to reveal the
 * dashboard, which is already mounted and loading underneath. Click or any key skips it;
 * reduced motion or no WebGL skips it entirely.
 */
export function VoxelIntro({ onDone }: { onDone: () => void }) {
  const glRef = useRef<HTMLCanvasElement>(null)
  const cvRef = useRef<HTMLCanvasElement>(null)
  const topoRef = useRef<HTMLElement>(null)
  const hudRef = useRef<HTMLDivElement>(null)
  const estadoRef = useRef<HTMLParagraphElement>(null)
  const barraRef = useRef<HTMLDivElement>(null)
  const [skip] = useState(
    () => !hasWebGL2() || (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  )
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  })

  useEffect(() => {
    if (skip) {
      doneRef.current()
      return
    }
    const els = {
      glc: glRef.current!,
      cv: cvRef.current!,
      topo: topoRef.current!,
      hud: hudRef.current!,
      estado: estadoRef.current!,
      barra: barraRef.current!,
    }
    let ended = false
    const end = () => {
      if (ended) return
      ended = true
      doneRef.current()
    }
    let stop = () => {}
    try {
      stop = startVoxelIntro(els, end)
    } catch {
      end()
      return
    }
    const skipNow = () => {
      stop()
      end()
    }
    window.addEventListener('pointerdown', skipNow)
    window.addEventListener('keydown', skipNow)
    return () => {
      window.removeEventListener('pointerdown', skipNow)
      window.removeEventListener('keydown', skipNow)
      stop()
    }
  }, [skip])

  if (skip) return null
  return (
    <>
      <canvas ref={glRef} className="pxz-gl" aria-hidden="true" />
      <canvas ref={cvRef} className="pxz-c" aria-hidden="true" />
      <header ref={topoRef} className="pxz-topo">
        <b>IARA</b>
      </header>
      <div ref={hudRef} className="pxz-hud">
        <div ref={barraRef} className="pxz-barra" />
        <p ref={estadoRef} className="pxz-estado" aria-live="polite">
          Waking the forest
        </p>
      </div>
    </>
  )
}
