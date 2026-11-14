import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { hasWebGL2 } from '@/lib/webgl-support'
import { PIXELS, STORAGE_KEY, type Fase } from '../constants'

// Owns the landing state machine: capabilities probe, progress bar, phase (capa → cobrindo → revelando)
// and the handshake that fires `onReady` once the user clicks enter.
export function useLandingPhase(onReady: () => void) {
  const webgl = useMemo(() => hasWebGL2(), [])
  const reduz = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )
  const [pronto, setPronto] = useState(!webgl || reduz)
  const [progresso, setProgresso] = useState(!webgl || reduz ? 1 : 0)
  const [fase, setFase] = useState<Fase>('capa')
  const [grade, setGrade] = useState({ cols: 16, rows: 10 })
  const botao = useRef<HTMLButtonElement>(null)

  const terminar = useCallback(() => setPronto(true), [])

  // The pixel bar follows the scene radar; only update when a new pixel lights up.
  const ultimo = useRef(-1)
  const progredir = useCallback((p: number) => {
    if (ultimo.current === PIXELS) return
    const k = Math.round(p * PIXELS)
    if (k !== ultimo.current) {
      ultimo.current = k
      setProgresso(k / PIXELS)
    }
  }, [])

  // If the scene stalls or the models take too long, allow entering anyway.
  useEffect(() => {
    if (pronto) {
      ultimo.current = PIXELS
      setProgresso(1)
      return
    }
    const reserva = window.setTimeout(() => setPronto(true), 12000)
    return () => window.clearTimeout(reserva)
  }, [pronto])

  useEffect(() => {
    if (pronto) botao.current?.focus({ preventScroll: true })
  }, [pronto])

  const entrar = useCallback(() => {
    if (fase !== 'capa') return
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* storage blocked, continue without remembering */
    }
    if (reduz) {
      onReady()
      return
    }
    const lado = window.innerWidth < 760 ? 48 : 72
    setGrade({
      cols: Math.ceil(window.innerWidth / lado),
      rows: Math.ceil(window.innerHeight / lado),
    })
    setFase('cobrindo')
    window.setTimeout(() => setFase('revelando'), 820)
    window.setTimeout(onReady, 820 + 900)
  }, [fase, reduz, onReady])

  return {
    webgl,
    reduz,
    pronto,
    progresso,
    fase,
    grade,
    botao,
    terminar,
    progredir,
    entrar,
  }
}
