import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useApp } from '@/lib/store'
import { CASES } from '@/data/cases'

export interface TourStep {
  anchor: string
  title: string
  body: string
  placement?: 'bottom' | 'top' | 'right' | 'left'
  // 'click': the step asks the user to click the highlighted element; the click goes through and
  // the tour moves on. Without it a click on the element just advances, without triggering it.
  action?: 'click'
  // Label for the main button on this step (defaults to next / start).
  cta?: string
  // Extra room around the element, for parts drawn outside its box (e.g. the capybara by the ask bar).
  pad?: { top?: number; right?: number; bottom?: number; left?: number }
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

// How long a step waits for its element to show up (the camera flight into a case takes a while).
const WAIT_MS = 25000
// An element that exists but is not displayed (e.g. hidden on phones) is skipped after this.
const HIDDEN_MS = 500

const findAnchor = (anchor: string) => document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`)

export function Tutorial({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const t = useT()
  const [i, setI] = useState(0)
  const step = steps[i]
  const last = i === steps.length - 1
  const [rect, setRect] = useState<Rect | null>(null)
  // Inside a case the tour takes the case colour (mining orange, flood blue, drought yellow).
  const aoiActive = useApp((s) => s.aoiActive)
  const activeRegion = useApp((s) => s.activeRegion)
  const accent = aoiActive ? CASES[activeRegion].color : 'hsl(var(--primary))'
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight })

  const finish = () => {
    markTutorialSeen()
    onClose()
  }
  const next = () => (i < steps.length - 1 ? setI(i + 1) : finish())

  // While the tour runs, freeze the case cards (see cases.css) so the highlighted card doesn't
  // grow and shrink with the pointer.
  useEffect(() => {
    document.documentElement.setAttribute('data-tour-lock', '')
    return () => document.documentElement.removeAttribute('data-tour-lock')
  }, [])

  // Follow the element while the step is open: panels slide in and cards widen on hover, so poll
  // its box instead of measuring once. Skip the step if the element never appears.
  useEffect(() => {
    setRect(null)
    const started = performance.now()
    let hiddenSince: number | null = null
    const measure = () => {
      setViewport((v) => (v.w === window.innerWidth && v.h === window.innerHeight ? v : { w: window.innerWidth, h: window.innerHeight }))
      const el = findAnchor(step.anchor)
      const r = el?.getBoundingClientRect()
      const visible = !!r && r.width > 2 && r.height > 2
      if (!visible) {
        setRect(null)
        const now = performance.now()
        if (el) hiddenSince ??= now
        if ((hiddenSince !== null && now - hiddenSince > HIDDEN_MS) || now - started > WAIT_MS) {
          window.clearInterval(id)
          if (i < steps.length - 1) setI(i + 1)
          else finish()
        }
        return
      }
      hiddenSince = null
      setRect((p) =>
        p && p.x === r.left && p.y === r.top && p.width === r.width && p.height === r.height
          ? p
          : { x: r.left, y: r.top, width: r.width, height: r.height },
      )
    }
    const id = window.setInterval(() => measure(), 120)
    measure()
    window.addEventListener('resize', measure)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('resize', measure)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, step.anchor])

  // Clicks on the highlighted element: let them through on 'click' steps, otherwise just advance.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = findAnchor(step.anchor)
      if (!el || !(e.target instanceof Node) || !el.contains(e.target)) return
      if (step.action !== 'click') {
        e.preventDefault()
        e.stopPropagation()
      }
      next()
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  const primary = () => {
    // On the last step the button just closes the tour; the element stays there to be clicked.
    if (step.action === 'click' && !last) findAnchor(step.anchor)?.click()
    else next()
  }

  const padding = 8
  const hole = useMemo(() => {
    if (!rect) return null
    const pad = step.pad ?? {}
    const x = Math.max(0, rect.x - (pad.left ?? padding))
    const y = Math.max(0, rect.y - (pad.top ?? padding))
    const right = Math.min(viewport.w, rect.x + rect.width + (pad.right ?? padding))
    const bottom = Math.min(viewport.h, rect.y + rect.height + (pad.bottom ?? padding))
    return { x, y, width: right - x, height: bottom - y }
  }, [rect, viewport, step.pad])

  // Real balloon size, so placement and clamping use what is actually rendered.
  const tipRef = useRef<HTMLDivElement>(null)
  const anchored = rect !== null
  const [tipSize, setTipSize] = useState({ w: 320, h: 160 })
  useLayoutEffect(() => {
    const el = tipRef.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      setTipSize((s) => (s.w === r.width && s.h === r.height ? s : { w: r.width, h: r.height }))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [i, anchored])

  const tooltip = useMemo(() => {
    const margin = 12
    const gap = 16
    const tooltipW = Math.min(tipSize.w, viewport.w - margin * 2)
    const tooltipH = Math.min(tipSize.h, viewport.h - margin * 2)
    const clamp = (left: number, top: number) => ({
      left: Math.max(margin, Math.min(viewport.w - tooltipW - margin, left)),
      top: Math.max(margin, Math.min(viewport.h - tooltipH - margin, top)),
    })
    if (!rect) return clamp(viewport.w / 2 - tooltipW / 2, viewport.h / 2 - tooltipH / 2)
    const centerX = rect.x + rect.width / 2 - tooltipW / 2
    const centerY = rect.y + rect.height / 2 - tooltipH / 2
    const below = rect.y + rect.height + gap
    const above = rect.y - tooltipH - gap
    const fitsBelow = below + tooltipH <= viewport.h - margin
    const fitsAbove = above >= margin
    const fitsRight = rect.x + rect.width + gap + tooltipW <= viewport.w - margin
    const fitsLeft = rect.x - tooltipW - gap >= margin

    const placement = step.placement ?? 'bottom'
    if (placement === 'bottom' && fitsBelow) return clamp(centerX, below)
    if (placement === 'top' && fitsAbove) return clamp(centerX, above)
    if (placement === 'right' && fitsRight) return clamp(rect.x + rect.width + gap, centerY)
    if (placement === 'left' && fitsLeft) return clamp(rect.x - tooltipW - gap, centerY)
    // Preferred side has no room: try the opposite side, then the others.
    if (fitsBelow && placement !== 'top') return clamp(centerX, below)
    if (fitsAbove) return clamp(centerX, above)
    if (fitsBelow) return clamp(centerX, below)
    if (fitsRight) return clamp(rect.x + rect.width + gap, centerY)
    if (fitsLeft) return clamp(rect.x - tooltipW - gap, centerY)
    // No side fits whole: lean toward the side with more free room, so it covers less of the element.
    const roomRight = viewport.w - (rect.x + rect.width)
    const roomLeft = rect.x
    if (Math.max(roomRight, roomLeft) > tooltipW * 0.4) {
      return roomRight >= roomLeft
        ? clamp(viewport.w - tooltipW - margin, centerY)
        : clamp(margin, centerY)
    }
    // Element fills the screen: keep the balloon in the middle.
    return clamp(viewport.w / 2 - tooltipW / 2, viewport.h / 2 - tooltipH / 2)
  }, [rect, step.placement, viewport, tipSize])

  // While the next element is on its way (camera flying into the case), step aside entirely.
  if (!hole) return null

  // Four blockers around the hole: the rest of the page is dimmed and inert, the highlighted
  // element stays usable (hover previews, the click a step asks for).
  const blockers = [
    { left: 0, top: 0, width: viewport.w, height: hole.y },
    { left: 0, top: hole.y + hole.height, width: viewport.w, height: Math.max(0, viewport.h - hole.y - hole.height) },
    { left: 0, top: hole.y, width: hole.x, height: hole.height },
    { left: hole.x + hole.width, top: hole.y, width: Math.max(0, viewport.w - hole.x - hole.width), height: hole.height },
  ]

  return (
    <div className="pointer-events-none fixed inset-0 z-[9998]">
      <svg className="absolute inset-0 h-full w-full">
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect x={hole.x} y={hole.y} width={hole.width} height={hole.height} rx="10" fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(5, 10, 20, 0.72)" mask="url(#tour-mask)" />
        <rect
          x={hole.x}
          y={hole.y}
          width={hole.width}
          height={hole.height}
          rx="10"
          fill="none"
          stroke={accent}
          strokeOpacity="0.9"
          strokeWidth="2"
          className={step.action === 'click' ? 'tour-ring-pulse' : undefined}
        />
      </svg>
      {blockers.map((b, k) => (
        <div key={k} className="pointer-events-auto absolute" style={b} />
      ))}

      <div
        ref={tipRef}
        key={i}
        role="dialog"
        aria-label={step.title}
        className="tour-tip pointer-events-auto absolute w-[320px] max-w-[calc(100vw-24px)] max-h-[calc(100vh-24px)] overflow-y-auto rounded-xl border bg-card/95 p-4 shadow-2xl backdrop-blur-xl"
        style={{ left: tooltip.left, top: tooltip.top, borderColor: `color-mix(in srgb, ${accent} 45%, transparent)`, '--tour-accent': accent } as React.CSSProperties}
      >
        <button
          onClick={finish}
          className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label={t('tutorial.skipLabel')}
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="font-mono text-[11px] uppercase tracking-wider" style={{ color: accent }}>
          {t('tutorial.step', { current: String(i + 1), total: String(steps.length) })}
        </div>
        <div className="mt-1 pr-6 text-[15px] font-semibold leading-tight text-foreground">{step.title}</div>
        <div className="mt-2 text-[13px] leading-snug text-foreground/85">{step.body}</div>
        <div className="mt-3 flex items-center justify-between">
          <button onClick={finish} className="font-mono text-[12px] text-muted-foreground hover:text-foreground">
            {t('tutorial.skip')}
          </button>
          <button
            onClick={primary}
            className="tour-cta inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[12px] font-semibold transition-colors"
          >
            {step.cta ?? t(last ? 'tutorial.start' : 'tutorial.next')}
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
