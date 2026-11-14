import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, X } from 'lucide-react'

interface Step {
  anchor: string
  title: string
  body: string
  placement?: 'bottom' | 'top' | 'right' | 'left'
  // Optional: run when step opens (e.g. open a panel the step points at).
  onEnter?: () => void
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

const STORAGE_KEY = 'iara.tutorial-seen'

export function hasSeenTutorial(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function markTutorialSeen(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1')
  } catch {}
}

export function resetTutorial(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

export const TUTORIAL_OPEN_EVENT = 'iara:tutorial:open'
export function triggerTutorial(): void {
  window.dispatchEvent(new CustomEvent(TUTORIAL_OPEN_EVENT))
}

export function Tutorial({ steps, onClose }: { steps: Step[]; onClose: () => void }) {
  const [i, setI] = useState(0)
  const step = steps[i]
  const [rect, setRect] = useState<Rect | null>(null)
  const [viewport, setViewport] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  })

  useEffect(() => {
    const measure = () => {
      const el = document.querySelector(`[data-tour="${step.anchor}"]`)
      if (!el) {
        setRect(null)
        return
      }
      const r = el.getBoundingClientRect()
      setRect({ x: r.left, y: r.top, width: r.width, height: r.height })
    }
    step.onEnter?.()
    measure()
    const resize = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight })
      measure()
    }
    window.addEventListener('resize', resize)
    // Re-measure a few frames later; panels may slide in asynchronously.
    const t1 = window.setTimeout(measure, 120)
    const t2 = window.setTimeout(measure, 360)
    return () => {
      window.removeEventListener('resize', resize)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [step])

  const finish = () => {
    markTutorialSeen()
    onClose()
  }
  const next = () => (i < steps.length - 1 ? setI(i + 1) : finish())
  const skip = () => finish()

  const padding = 8
  const hole = useMemo(() => {
    if (!rect) return null
    return {
      x: Math.max(0, rect.x - padding),
      y: Math.max(0, rect.y - padding),
      width: Math.min(viewport.w, rect.width + padding * 2),
      height: Math.min(viewport.h, rect.height + padding * 2),
    }
  }, [rect, viewport])

  const tooltip = useMemo(() => {
    const tooltipW = 320
    const tooltipH = 160
    if (!rect) {
      return {
        left: viewport.w / 2 - tooltipW / 2,
        top: viewport.h / 2 - tooltipH / 2,
      }
    }
    const placement = step.placement ?? 'bottom'
    const gap = 16
    let left = rect.x + rect.width / 2 - tooltipW / 2
    let top = rect.y + rect.height + gap
    if (placement === 'top') top = rect.y - tooltipH - gap
    if (placement === 'right') {
      left = rect.x + rect.width + gap
      top = rect.y + rect.height / 2 - tooltipH / 2
    }
    if (placement === 'left') {
      left = rect.x - tooltipW - gap
      top = rect.y + rect.height / 2 - tooltipH / 2
    }
    left = Math.max(12, Math.min(viewport.w - tooltipW - 12, left))
    top = Math.max(12, Math.min(viewport.h - tooltipH - 12, top))
    return { left, top }
  }, [rect, step.placement, viewport])

  return (
    <div className="fixed inset-0 z-[9998]">
      <svg className="absolute inset-0 w-full h-full pointer-events-auto">
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {hole && (
              <rect
                x={hole.x}
                y={hole.y}
                width={hole.width}
                height={hole.height}
                rx="10"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(5, 10, 20, 0.72)"
          mask="url(#tour-mask)"
          onClick={skip}
        />
        {hole && (
          <rect
            x={hole.x}
            y={hole.y}
            width={hole.width}
            height={hole.height}
            rx="10"
            fill="none"
            stroke="hsl(190 95% 70%)"
            strokeWidth="2"
            className="animate-pulse"
          />
        )}
      </svg>

      <div
        className="absolute w-[320px] rounded-xl border border-primary/40 bg-card/95 backdrop-blur-xl p-4 shadow-2xl"
        style={{ left: tooltip.left, top: tooltip.top }}
      >
        <button
          onClick={skip}
          className="absolute top-2 right-2 rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label="Pular tutorial"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="text-[11px] font-mono uppercase tracking-wider text-primary">
          passo {i + 1} / {steps.length}
        </div>
        <div className="mt-1 text-[15px] font-semibold text-foreground leading-tight pr-6">
          {step.title}
        </div>
        <div className="mt-2 text-[13px] text-foreground/85 leading-snug">
          {step.body}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={skip}
            className="text-[12px] font-mono text-muted-foreground hover:text-foreground"
          >
            pular
          </button>
          <button
            onClick={next}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/15 px-3 py-1.5 text-[12px] font-mono font-semibold text-primary hover:bg-primary/25 transition-colors"
          >
            {i < steps.length - 1 ? 'próximo' : 'começar'}
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
