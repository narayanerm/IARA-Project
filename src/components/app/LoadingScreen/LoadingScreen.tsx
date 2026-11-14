import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, Radar } from 'lucide-react'
import { Scene3D } from './Scene3D'
import { hasWebGL2 } from '@/lib/webgl-support'
import './animations.css'

const STORAGE_KEY = 'curupira.seen-landing'

export function LoadingScreen({ onReady }: { onReady: () => void }) {
  const [fading, setFading] = useState(false)
  const [assetsReady, setAssetsReady] = useState(false)
  const timerRef = useRef<number | null>(null)
  const webgl = useMemo(() => hasWebGL2(), [])

  useEffect(() => {
    timerRef.current = window.setTimeout(
      () => setAssetsReady(true),
      webgl ? 2600 : 200
    )
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [webgl])

  const enter = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // storage denied; proceed anyway
    }
    setFading(true)
    window.setTimeout(onReady, 700)
  }

  return (
    <div
      className={`fixed inset-0 z-[9999] overflow-hidden select-none ${fading ? 'anim-fadeout' : ''}`}
      style={{
        background:
          'linear-gradient(180deg, #0a1428 0%, #0d2130 28%, #0f2a22 55%, #0a1a1c 78%, #06111a 100%)',
      }}
    >
      {webgl ? (
        <div className="absolute inset-0">
          <Scene3D />
        </div>
      ) : (
        <StaticBackdrop />
      )}

      {!webgl && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto max-w-md rounded-lg border border-amber-400/40 bg-amber-950/80 backdrop-blur-sm px-4 py-2.5 text-[12px] text-amber-100 leading-snug shadow-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">WebGL2 indisponível no navegador</div>
              <div className="opacity-80 mt-0.5">
                Animação 3D e mapa 3D desativados. Habilite aceleração de
                hardware em <code>chrome://settings/system</code> ou teste em
                Firefox.
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)',
        }}
      />

      <div
        className="absolute pointer-events-none"
        style={{ right: '6%', top: '5%', width: 220, height: 220, opacity: 0.22 }}
      >
        <div className="absolute inset-0 rounded-full border border-cyan-400/40" />
        <div className="absolute inset-4 rounded-full border border-cyan-400/30" />
        <div className="absolute inset-8 rounded-full border border-cyan-400/20" />
        <div className="absolute inset-0 anim-radar">
          <div
            className="absolute left-1/2 top-1/2 origin-left h-[2px]"
            style={{
              width: '50%',
              background:
                'linear-gradient(90deg, hsla(190,95%,60%,0.9), hsla(190,95%,60%,0))',
            }}
          />
        </div>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="grid h-14 w-14 place-items-center rounded-xl bg-primary/20 ring-1 ring-primary/40 backdrop-blur-sm">
            <Radar className="h-7 w-7 text-primary" />
          </div>
          <div className="text-left">
            <div className="text-3xl md:text-5xl font-semibold text-white tracking-tight drop-shadow-[0_2px_16px_rgba(0,0,0,0.7)]">
              Curupira
            </div>
            <div className="text-sm md:text-base font-mono text-cyan-300/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
              NISAR · L-band · Amazônia
            </div>
          </div>
        </div>

        <p className="text-base md:text-lg text-white/85 max-w-xl text-center text-balance leading-relaxed drop-shadow-[0_1px_10px_rgba(0,0,0,0.9)]">
          Radar que atravessa nuvem, fumaça e dossel. Mapeando garimpo, enchente
          e seca na Amazônia — com Terras Indígenas em destaque.
        </p>

        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          <StatBadge label="AOIs" value="3" />
          <StatBadge label="Terras Indígenas" value="15" />
          <StatBadge label="Bandas" value="L · HH+HV" />
          <StatBadge label="Dados" value="NISAR · ASF" />
        </div>

        <button
          onClick={enter}
          disabled={!assetsReady}
          className={`mt-10 pointer-events-auto group inline-flex items-center gap-3 rounded-full border px-6 py-3 text-base font-semibold backdrop-blur-sm transition-all ${
            assetsReady
              ? 'border-primary/50 bg-primary/15 text-primary hover:bg-primary/25 hover:scale-105 shadow-[0_0_32px_-8px_hsl(var(--primary))]'
              : 'border-white/20 bg-white/5 text-white/40 cursor-wait'
          }`}
        >
          {assetsReady ? (
            <>
              Entrar no Dashboard
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </>
          ) : (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
              Carregando mosaicos…
            </>
          )}
        </button>

        <div className="mt-4 text-[11px] font-mono text-white/40 uppercase tracking-widest drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
          ASF DAAC · MapBiomas · FUNAI · ANA
        </div>
      </div>

      <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between pointer-events-none">
        <div className="text-[11px] font-mono text-white/45 leading-relaxed drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          <div>Dados: NISAR / ASF DAAC · Narrativa: Claude (Anthropic)</div>
          <div className="opacity-75">
            Modelos 3D: Poly by Google, marioba · CC-BY 3.0 via Poly Pizza
          </div>
        </div>
        <div className="text-[11px] font-mono text-white/45 text-right drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          NASA Space Apps 2026
          <br />
          Dancing with the SARs
        </div>
      </div>
    </div>
  )
}

function StaticBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{
        background:
          'radial-gradient(ellipse at 70% 15%, hsla(50, 80%, 85%, 0.08) 0%, transparent 40%), radial-gradient(ellipse at 20% 80%, hsla(145, 50%, 20%, 0.4) 0%, transparent 60%)',
      }} />
      {STAR_POSITIONS.map((s, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white/80"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.r,
            height: s.r,
            opacity: 0.4 + Math.random() * 0.5,
          }}
        />
      ))}
      <div
        className="absolute rounded-full"
        style={{
          right: '8%',
          top: '7%',
          width: 48,
          height: 48,
          background: 'radial-gradient(circle at 30% 30%, #fff7d0, #c2b78a 70%, #7f7656)',
          boxShadow: '0 0 40px hsla(50, 85%, 80%, 0.3)',
        }}
      />
      <svg
        viewBox="0 0 1200 400"
        preserveAspectRatio="none"
        className="absolute bottom-0 left-0 right-0 w-full"
        style={{ height: '55%', opacity: 0.75 }}
      >
        <path
          d="M0,400 L0,280 Q60,180 120,250 Q180,140 240,230 Q300,120 360,210 Q420,150 480,220 Q540,100 600,200 Q660,180 720,230 Q780,120 840,210 Q900,140 960,230 Q1020,150 1080,220 Q1140,170 1200,240 L1200,400 Z"
          fill="#0a1510"
        />
        <path
          d="M0,400 L0,330 Q80,250 160,310 Q240,220 320,290 Q400,200 480,280 Q560,220 640,290 Q720,230 800,290 Q880,210 960,280 Q1040,240 1120,290 Q1160,260 1200,300 L1200,400 Z"
          fill="#061008"
        />
      </svg>
    </div>
  )
}

const STAR_POSITIONS = [
  { x: 8, y: 6, r: 2 },
  { x: 14, y: 12, r: 1 },
  { x: 22, y: 5, r: 1.5 },
  { x: 31, y: 10, r: 1 },
  { x: 42, y: 4, r: 2 },
  { x: 48, y: 14, r: 1.2 },
  { x: 56, y: 7, r: 1 },
  { x: 64, y: 12, r: 1.8 },
  { x: 72, y: 5, r: 1.2 },
  { x: 80, y: 10, r: 1 },
  { x: 88, y: 14, r: 1.6 },
  { x: 94, y: 6, r: 1 },
  { x: 18, y: 22, r: 1 },
  { x: 38, y: 24, r: 1.2 },
  { x: 58, y: 20, r: 1 },
  { x: 76, y: 22, r: 1.4 },
]

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full bg-white/8 border border-white/15 px-3 py-1 backdrop-blur-sm text-white/90 text-[12px] font-mono drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
      <span className="text-white/60 mr-1.5">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}
