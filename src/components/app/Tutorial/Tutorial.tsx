import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { useT } from '@/lib/i18n'

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

// Second tour, shown the first time a case panel opens (same look and controls as the home tour).
export const CASE_TOUR_KEY = 'iara.case-tour-seen'
export const CASE_TOUR_OPEN_EVENT = 'iara:case-tour:open'
export function hasSeenCaseTour(): boolean {
  try {
    return window.localStorage.getItem(CASE_TOUR_KEY) === '1'
  } catch {
    return false
  }
}
export function triggerCaseTour(): void {
  window.dispatchEvent(new CustomEvent(CASE_TOUR_OPEN_EVENT))
}

export type TourStep = Step

export function Tutorial({
  steps,
  onClose,
  storageKey = STORAGE_KEY,
}: {
  steps: Step[]
  onClose: () => void
  /** localStorage key that records the tour as seen. */
  storageKey?: string
}) {
  const t = useT()
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
      // Steps can point inside a scrolling panel: bring the target into view first.
      const r0 = el.getBoundingClientRect()
      if (r0.top < 0 || r0.bottom > window.innerHeight) el.scrollIntoView({ block: 'center' })
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
    // The highlighted area stays usable, so it can scroll: follow it (capture catches inner scrollers).
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = document.querySelector(`[data-tour="${step.anchor}"]`)
        if (!el) return
        const r = el.getBoundingClientRect()
        setRect({ x: r.left, y: r.top, width: r.width, height: r.height })
      })
    }
    window.addEventListener('scroll', onScroll, true)
    // Re-measure a few frames later; panels may slide in asynchronously.
    const t1 = window.setTimeout(measure, 120)
    const t2 = window.setTimeout(measure, 360)
    const t3 = window.setTimeout(measure, 900)
    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('scroll', onScroll, true)
      cancelAnimationFrame(raf)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }, [step])

  const finish = () => {
    try {
      window.localStorage.setItem(storageKey, '1')
    } catch {}
    onClose()
  }
  const next = () => (i < steps.length - 1 ? setI(i + 1) : finish())
  const back = () => setI(Math.max(0, i - 1))
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
    const tooltipH = 200
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
    <div className="pointer-events-none fixed inset-0 z-[9998]">
      {/* Only the dimmed area takes clicks; the highlighted element underneath stays fully usable. */}
      {hole ? (
        <>
          <div className="pointer-events-auto absolute inset-x-0 top-0" style={{ height: hole.y }} />
          <div className="pointer-events-auto absolute inset-x-0 bottom-0" style={{ top: hole.y + hole.height }} />
          <div className="pointer-events-auto absolute left-0" style={{ top: hole.y, height: hole.height, width: hole.x }} />
          <div
            className="pointer-events-auto absolute right-0"
            style={{ top: hole.y, height: hole.height, left: hole.x + hole.width }}
          />
        </>
      ) : (
        <div className="pointer-events-auto absolute inset-0" />
      )}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
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
        className="pointer-events-auto absolute w-[320px] rounded-xl border border-primary/40 bg-card/95 backdrop-blur-xl p-4 shadow-2xl"
        style={{ left: tooltip.left, top: tooltip.top }}
      >
        <button
          onClick={skip}
          className="absolute top-2 right-2 rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label={t('tutorial.skipLabel')}
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="text-[11px] font-mono uppercase tracking-wider text-primary">
          {t('tutorial.step', { current: String(i + 1), total: String(steps.length) })}
        </div>
        <div className="mt-1 text-[15px] font-semibold text-foreground leading-tight pr-6">
          {step.title}
        </div>
        <div className="mt-2 whitespace-pre-line text-[13px] text-foreground/85 leading-snug">
          {step.body}
        </div>
        <div className="mt-3 flex items-center">
          <button
            onClick={skip}
            className="text-[12px] font-mono text-muted-foreground hover:text-foreground"
          >
            {t('tutorial.skip')}
          </button>
          <span className="ml-auto" />
          {i > 0 && (
            <button
              onClick={back}
              className="mr-2 rounded-full px-2.5 py-1.5 text-[12px] font-mono text-muted-foreground hover:text-foreground"
            >
              {t('tutorial.back')}
            </button>
          )}
          <button
            onClick={next}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/15 px-3 py-1.5 text-[12px] font-mono font-semibold text-primary hover:bg-primary/25 transition-colors"
          >
            {t(i < steps.length - 1 ? 'tutorial.next' : 'tutorial.start')}
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
