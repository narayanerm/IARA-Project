import { useEffect, useRef, useState } from 'react'
import { hasWebGL2 } from '@/lib/webgl-support'

/**
 * Opening animation, in low poly 3D: a night river with a jaguar, capybaras, a pink river dolphin,
 * a monkey, a sloth, a toucan and macaws. A radar beam sweeps the forest, the camera rises to look
 * straight down, the scene turns into pixels, the river bends into the IARA symbol and the symbol
 * splits along the river to reveal the dashboard, which is already mounted underneath.
 * The scene is a self-contained page (public/intro/lowpoly-intro.html) shown in a transparent iframe;
 * it posts 'iara-intro:done' when it ends or is skipped. Only its "Skip intro" button skips it; reduced motion
 * or no WebGL skips it entirely.
 */
const DONE = 'iara-intro:done'
const MAX_MS = 20000

export function LowPolyIntro({ onDone, onLoaded }: { onDone: () => void; onLoaded?: () => void }) {
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
    let ended = false
    const end = () => {
      if (ended) return
      ended = true
      doneRef.current()
    }
    const onMsg = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data === DONE) end()
    }
    window.addEventListener('message', onMsg)
    const guard = window.setTimeout(end, MAX_MS)
    return () => {
      window.removeEventListener('message', onMsg)
      window.clearTimeout(guard)
    }
  }, [skip])

  if (skip) return null
  return (
    <iframe
      src={`${import.meta.env.BASE_URL}intro/lowpoly-intro.html`}
      title="IARA intro"
      aria-hidden="true"
      tabIndex={-1}
      onLoad={(e) => {
        e.currentTarget.contentWindow?.focus()
        onLoaded?.()
      }}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 0, zIndex: 100000, background: 'transparent', colorScheme: 'normal' }}
    />
  )
}
