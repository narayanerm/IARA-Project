import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Scene3D } from './Scene3D'
import { hasWebGL2 } from '@/lib/webgl-support'
import './animations.css'

const STORAGE_KEY = 'curupira.seen-landing'
const PIXELS = 24

type Fase = 'capa' | 'cobrindo' | 'revelando'

function rnd(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export function LoadingScreen({ onReady }: { onReady: () => void }) {
  const webgl = useMemo(() => hasWebGL2(), [])
  const reduz = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )
  const [pronto, setPronto] = useState(!webgl || reduz)
  const [progresso, setProgresso] = useState(!webgl || reduz ? 1 : 0)
  const [fase, setFase] = useState<Fase>('capa')
  const [grade, setGrade] = useState({ cols: 16, rows: 10 })

  const terminar = useCallback(() => setPronto(true), [])

  /* the pixel bar follows the scene radar; it only updates when a new pixel lights up */
  const ultimo = useRef(-1)
  const progredir = useCallback((p: number) => {
    if (ultimo.current === PIXELS) return
    const k = Math.round(p * PIXELS)
    if (k !== ultimo.current) {
      ultimo.current = k
      setProgresso(k / PIXELS)
    }
  }, [])

  /* if the scene stalls or the models take too long, move on anyway */
  useEffect(() => {
    if (pronto) {
      ultimo.current = PIXELS
      setProgresso(1)
      return
    }
    const reserva = window.setTimeout(() => setPronto(true), 9000)
    return () => window.clearTimeout(reserva)
  }, [pronto])

  const saiu = useRef(false)
  const entrar = useCallback(() => {
    if (saiu.current) return
    saiu.current = true
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
    setGrade({ cols: Math.ceil(window.innerWidth / lado), rows: Math.ceil(window.innerHeight / lado) })
    setFase('cobrindo')
    window.setTimeout(() => setFase('revelando'), 820)
    window.setTimeout(onReady, 820 + 900)
  }, [onReady, reduz])

  /* once the radar pass is done, hold the finished scene for a moment, then open the dashboard on its own */
  useEffect(() => {
    if (!pronto) return
    const t = window.setTimeout(entrar, reduz ? 600 : 1300)
    return () => window.clearTimeout(t)
  }, [pronto, entrar, reduz])

  const celulas = useMemo(() => {
    const r = rnd(7)
    const out: { d: number }[] = []
    for (let y = 0; y < grade.rows; y++)
      for (let x = 0; x < grade.cols; x++) out.push({ d: (x / grade.cols) * 340 + r() * 90 })
    return out
  }, [grade])

  const acesos = Math.round(progresso * PIXELS)
  const titulo = ['Radar', 'sees', 'what', 'the', 'smoke', 'hides.']

  return (
    <div
      className={`iara-capa ${pronto ? 'pronta' : ''} ${fase === 'revelando' ? 'saindo' : ''}`}
      role="status"
      aria-busy={fase === 'capa'}
      aria-labelledby="iara-capa-titulo"
    >
      {fase !== 'revelando' && (
        <>
          <div className="iara-palco" aria-hidden="true">
            {webgl ? <Scene3D aoTerminar={terminar} aoProgredir={progredir} reduz={reduz} /> : <MosaicoEstatico />}
          </div>
          <div className="iara-veu" />

          <header className="iara-topo">
            <img src="/marca/iara-horizontal-escuro.svg" alt="IARA" width={160} height={40} />
            <p>
              NASA Space Apps 2026
              <br />
              Dancing with the SARs
            </p>
          </header>

          <section className="iara-texto">
            <div>
              <h1 id="iara-capa-titulo">
                {titulo.map((p, i) => (
                  <span key={i} className="iara-entra" style={{ ['--i' as string]: i }}>
                    {p === 'Radar' ? <em>{p}</em> : p}
                    {i < titulo.length - 1 ? ' ' : ''}
                  </span>
                ))}
              </h1>
              <p className="iara-lead iara-entra" style={{ ['--i' as string]: 6 }}>
                Curupira is our team's dashboard built on NISAR L-band radar, which sees through clouds, smoke
                and tree canopy. Illegal mining, floods and droughts across the Amazon, with Indigenous Lands
                highlighted.
              </p>
              {!webgl && (
                <p className="iara-aviso">
                  This browser has WebGL2 turned off, so the 3D scene and 3D map are disabled. Turn on hardware
                  acceleration in your browser settings or open the app in Firefox.
                </p>
              )}
            </div>

            <div className="iara-acao">
              <div className="iara-pixels" aria-hidden="true">
                {Array.from({ length: PIXELS }, (_, i) => (
                  <i key={i} className={i < acesos ? 'on' : i === acesos && !pronto ? 'frente' : ''} />
                ))}
              </div>
              <p className="iara-estado" aria-live="polite">
                {pronto
                  ? 'Scan complete. Opening the dashboard'
                  : progresso === 0
                    ? 'Loading the scene'
                    : `Radar sweeping the scene, ${Math.round(progresso * 100)}%`}
              </p>
            </div>

            <footer className="iara-creditos">
              <p>
                <span>Data: NISAR / ASF DAAC</span>
                <span>Narrative: Claude (Anthropic)</span>
              </p>
              <p>
                <span>3D models: Poly by Google and marioba, CC-BY 3.0 via Poly Pizza</span>
              </p>
            </footer>
          </section>
        </>
      )}

      {fase !== 'capa' && (
        <div
          className={`iara-saida ${fase === 'revelando' ? 'revela' : ''}`}
          style={{ ['--cols' as string]: grade.cols }}
          aria-hidden="true"
        >
          {celulas.map((c, i) => (
            <i key={i} style={{ ['--d' as string]: `${Math.round(c.d)}ms` }} />
          ))}
        </div>
      )}
    </div>
  )
}

/* no WebGL: the brand pixel mosaic, with the river cutting through the forest */
function MosaicoEstatico() {
  const cels = useMemo(() => {
    const r = rnd(2026)
    const tons = ['#2c5039', '#33593f', '#3b6447', '#13201a']
    const out: { x: number; y: number; c: string }[] = []
    const C = 48
    const L = 28
    for (let y = 0; y < L; y++) {
      for (let x = 0; x < C; x++) {
        const rio = Math.abs(y - (17 + Math.sin(x / 5.5) * 3.2 + Math.sin(x / 2.3) * 0.8))
        let c: string
        if (y < 9 - Math.sin(x / 3) * 1.5) c = r() < 0.06 ? '#13201a' : '#0a110e'
        else if (rio < 1.1) c = r() < 0.5 ? '#2b7ea6' : '#5aa7c9'
        else if (r() < 0.025) c = '#f07a45'
        else c = tons[Math.floor(r() * (y < 12 ? 4 : 3))]
        if (c !== '#0a110e') out.push({ x, y, c })
      }
    }
    return out
  }, [])
  return (
    <div className="iara-mosaico">
      <svg viewBox="0 0 48 28" preserveAspectRatio="xMidYMid slice">
        {cels.map((k, i) => (
          <rect key={i} x={k.x + 0.06} y={k.y + 0.06} width={0.88} height={0.88} rx={0.14} fill={k.c} />
        ))}
      </svg>
    </div>
  )
}
