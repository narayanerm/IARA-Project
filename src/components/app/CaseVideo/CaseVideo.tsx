import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMap } from 'react-map-gl/maplibre'
import { ArrowDown } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useCaseVideo, useCaseVideoActive } from '@/lib/store'
import type { RegionId } from '@/lib/types'
import './caseVideo.css'

// Original 1080p renders, copied without re-encoding by scripts/case-videos.sh.
const VIDEOS: Record<RegionId, { src: string; poster: string; title: string }> = {
  YANO: { src: '/case-video/yanomami.mp4', poster: '/case-video/yanomami-poster.jpg', title: 'Why Yanomami?' },
  ENCH: { src: '/case-video/enchente-manaus.mp4', poster: '/case-video/enchente-manaus-poster.jpg', title: 'Enchente em Manaus' },
  SECA: { src: '/case-video/seca-manaquiri.mp4', poster: '/case-video/seca-manaquiri-poster.jpg', title: 'Seca em Manaquiri' },
}

/** Scrolling away is allowed in the last seconds of the video (and after it ends). */
const SCROLL_EXIT_LAST_S = 3
/** How far the gesture has to pull the card up before it lets go and flies off. */
const PULL_COMMIT_PX = 140
const EXIT_MS = 650

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * A case's voiced explainer in a large liquid-glass card over the page, which stays visible (still) behind it.
 * It plays by itself when the case opens until the visitor has watched it once (remembered per case in
 * localStorage), then only from the "Video explanation" header button. Mining also plays it when the guided tour
 * closes, if unseen; while the tour runs (it opens Mining by itself) the video waits.
 * In the last seconds, or after it ends, scrolling down pushes the card up and reveals the page; "Skip video" does the
 * same at any time. Lives inside <Map> so it can keep the map still while the video plays.
 */
export function CaseVideo() {
  const region = useCaseVideoActive()
  if (!region) return null
  return <CaseVideoPlayer key={region} region={region} />
}

function CaseVideoPlayer({ region }: { region: RegionId }) {
  const t = useT()
  const close = useCaseVideo((s) => s.closeCaseVideo)
  const { current: mapRef } = useMap()
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  // Counts as watched only once it has actually started playing (then ended or was skipped).
  const playedRef = useRef(false)
  const exitingRef = useRef(false)
  const pullRef = useRef(0)
  const [ready, setReady] = useState(false)
  const [muted, setMuted] = useState(false)
  const [canExit, setCanExit] = useState(false)
  const video = VIDEOS[region]

  // Closing only closes: it never opens or switches a case, so whatever screen is behind the video stays as it was.
  // Idempotent: a double click on skip, Esc repeated, or ended/error right after a skip do nothing the second time.
  const closedRef = useRef(false)
  const finish = useCallback(
    (failed = false) => {
      if (closedRef.current) return
      closedRef.current = true
      close(region, !failed && playedRef.current)
    },
    [close, region]
  )

  /** Card flies up and the veil fades, revealing the page; then the video is closed. */
  const exit = useCallback(() => {
    if (exitingRef.current) return
    exitingRef.current = true
    videoRef.current?.pause()
    const frame = frameRef.current
    const root = rootRef.current
    const reduce = reducedMotion()
    if (frame) {
      frame.style.transition = reduce ? `opacity 200ms ease-out` : `transform ${EXIT_MS}ms cubic-bezier(0.7, 0, 0.2, 1), opacity ${EXIT_MS}ms ease-in`
      frame.style.transform = reduce ? '' : 'translateY(calc(-50vh - 110%))'
      frame.style.opacity = '0'
    }
    root?.classList.add('is-leaving')
    window.setTimeout(() => finish(), reduce ? 200 : EXIT_MS)
  }, [finish])

  // The page behind stays visible: the map just stops moving while the video plays (nothing repaints behind it).
  // The glass rim shows that page blurred. A live backdrop-filter would redo the blur on every video frame (half the
  // frames dropped in testing), so the still map is snapshotted once, blurred once here, and used as the rim's image.
  const [glass, setGlass] = useState<{ img: string; w: number; h: number } | null>(null)
  useEffect(() => {
    const m = mapRef?.getMap()
    if (!m) return
    m.stop()
    const grab = () => {
      try {
        const src = m.getCanvas()
        const w = src.clientWidth
        const h = src.clientHeight
        const c = document.createElement('canvas')
        c.width = Math.max(1, Math.round(w / 4))
        c.height = Math.max(1, Math.round(h / 4))
        const ctx = c.getContext('2d')
        if (!ctx) return
        ctx.filter = 'blur(4px) saturate(150%)'
        ctx.drawImage(src, 0, 0, c.width, c.height)
        setGlass({ img: c.toDataURL('image/jpeg', 0.7), w, h })
      } catch {
        /* no snapshot: the rim stays a plain tinted glass */
      }
    }
    m.once('render', grab)
    m.triggerRepaint()
    return () => {
      m.off('render', grab)
    }
  }, [mapRef])

  // Line the snapshot up with the page behind the rim (the map fills #app).
  const [glassPos, setGlassPos] = useState('0px 0px')
  useEffect(() => {
    const place = () => {
      const app = (document.getElementById('app') ?? document.body).getBoundingClientRect()
      const f = frameRef.current?.getBoundingClientRect()
      if (f) setGlassPos(`${Math.round(app.left - f.left)}px ${Math.round(app.top - f.top)}px`)
    }
    place()
    // Again once the card's entrance animation has settled.
    const id = window.setTimeout(place, 650)
    window.addEventListener('resize', place)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('resize', place)
    }
  }, [glass])

  // Start only once the browser can play through without stalling (the poster shows meanwhile). Autoplay with
  // sound; browsers that block it get a muted start and a "turn sound on" button.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    let started = false
    const play = () => {
      if (started) return
      started = true
      setReady(true)
      v.play().catch(() => {
        v.muted = true
        setMuted(true)
        v.play().catch(() => undefined)
      })
    }
    if (v.readyState >= 4) play()
    else v.addEventListener('canplaythrough', play, { once: true })
    return () => v.removeEventListener('canplaythrough', play)
  }, [])

  // Wheel, touch and keys: the map never sees them while the card is up. In the last seconds a downward gesture
  // pulls the card up with the finger/wheel; past a threshold it flies off, otherwise it springs back.
  useEffect(() => {
    const el = document.getElementById('app') ?? document.body
    let snapTimer = 0
    const setPull = (px: number) => {
      pullRef.current = Math.max(0, px)
      const frame = frameRef.current
      if (!frame || exitingRef.current) return
      frame.style.transition = 'none'
      frame.style.transform = `translateY(${-pullRef.current}px)`
    }
    const springBack = () => {
      const frame = frameRef.current
      if (!frame || exitingRef.current) return
      pullRef.current = 0
      frame.style.transition = 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)'
      frame.style.transform = ''
    }
    const pull = (dy: number) => {
      if (!canExit || exitingRef.current) return
      setPull(pullRef.current + dy)
      if (pullRef.current >= PULL_COMMIT_PX) return exit()
      window.clearTimeout(snapTimer)
      snapTimer = window.setTimeout(springBack, 180)
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY
      if (dy > 0) pull(dy * 0.6)
    }
    let touchY: number | null = null
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null
    }
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY
      if (touchY === null || y === undefined) return
      const dy = touchY - y
      touchY = y
      if (dy > 0) pull(dy)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return exit()
      if (canExit && (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ')) {
        e.preventDefault()
        exit()
      }
    }
    el.addEventListener('wheel', onWheel, { capture: true, passive: false })
    el.addEventListener('touchstart', onTouchStart, { capture: true, passive: true })
    el.addEventListener('touchmove', onTouchMove, { capture: true, passive: true })
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(snapTimer)
      el.removeEventListener('wheel', onWheel, { capture: true })
      el.removeEventListener('touchstart', onTouchStart, { capture: true })
      el.removeEventListener('touchmove', onTouchMove, { capture: true })
      window.removeEventListener('keydown', onKey)
    }
  }, [canExit, exit])

  // Unlock the scroll exit in the last seconds: timeupdate plus a light check, since timeupdate can lag after a seek.
  useEffect(() => {
    const v = videoRef.current
    if (!v || canExit) return
    const check = () => {
      if (Number.isFinite(v.duration) && v.duration - v.currentTime <= SCROLL_EXIT_LAST_S) setCanExit(true)
    }
    v.addEventListener('timeupdate', check)
    v.addEventListener('seeked', check)
    const id = window.setInterval(check, 250)
    return () => {
      v.removeEventListener('timeupdate', check)
      v.removeEventListener('seeked', check)
      window.clearInterval(id)
    }
  }, [canExit])

  return createPortal(
    <div ref={rootRef} className="case-video" role="dialog" aria-label={video.title}>
      <div ref={frameRef} className="case-video-frame">
        {/* Glass rim behind the video, painted with the pre-blurred snapshot of the page. */}
        <div
          className="case-video-glass"
          aria-hidden="true"
          style={
            glass
              ? { backgroundImage: `url(${glass.img})`, backgroundSize: `${glass.w}px ${glass.h}px`, backgroundPosition: glassPos }
              : undefined
          }
        />
        <video
          ref={videoRef}
          src={video.src}
          poster={video.poster}
          controls
          playsInline
          preload="auto"
          onPlaying={() => (playedRef.current = true)}
          // At the end it rests on the last frame with the scroll hint; it does not close by itself.
          onEnded={() => setCanExit(true)}
          onError={() => finish(true)}
        />
        {!ready && <span className="case-video-loading" aria-hidden="true" />}
        <div className="case-video-actions">
          {muted && (
            <button
              type="button"
              className="case-video-btn"
              onClick={() => {
                const v = videoRef.current
                if (v) v.muted = false
                setMuted(false)
              }}
            >
              {t('case.videoUnmute')}
            </button>
          )}
          <button type="button" className="case-video-btn" onClick={exit}>
            {t('case.videoSkip')}
          </button>
        </div>
      </div>
      {canExit && (
        <button type="button" className="case-video-cue" onClick={exit}>
          <ArrowDown className="case-video-cue-arrow h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
          {t('case.videoScroll')}
        </button>
      )}
    </div>,
    document.getElementById('app') ?? document.body
  )
}
