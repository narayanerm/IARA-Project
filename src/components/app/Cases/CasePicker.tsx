import { useEffect, useRef, useState } from 'react'
import { CASES, CASE_ORDER, type CaseStudy } from '@/data/cases'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'
import type { RegionId } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useTr } from './shared'
import { SatCover } from './SatCover'
import { caseMedia } from './caseMedia'
import { CASE_REVEAL_MS } from '../Map/hooks/useMapCamera'
import './cases.css'


/**
 * Entry point and the only way between cases: three tall frames side by side, each showing the
 * satellite picture of its region. Pointing at one widens it, plays its video and slides up the details. Picking it
 * swallows the strip; the map underneath is already waiting at the same place, so the picture
 * simply dissolves into it.
 */
export function CasePicker({ introDone }: { introDone: boolean }) {
  const t = useT()
  const aoiActive = useApp((s) => s.aoiActive)
  const setActiveRegion = useApp((s) => s.setActiveRegion)
  const [chosen, setChosen] = useState<RegionId | null>(null)
  const [expanded, setExpanded] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  // The chosen frame takes the whole strip before the picker dissolves into the map; the camera
  // waits the same CASE_REVEAL_MS so the picture and the map meet at the same moment.
  // Back from a case: reset so the frames wipe in again.
  useEffect(() => {
    if (!aoiActive) {
      setChosen(null)
      setExpanded(false)
    }
  }, [aoiActive])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const choose = (id: RegionId) => {
    if (chosen) return
    setChosen(id)
    // The case opens right away so the map can jump there and load behind the picture.
    setActiveRegion(id)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    timer.current = window.setTimeout(() => setExpanded(true), reduce ? 0 : CASE_REVEAL_MS)
  }

  const hidden = aoiActive && (expanded || !chosen)
  return (
    <div
      className={cn('case-picker', introDone && 'is-ready', chosen && 'is-choosing', hidden && 'is-hidden')}
      aria-hidden={hidden}
      inert={hidden}
    >
      <h1 className="sr-only">{t('case.pickTitle')}</h1>

      <nav className="case-row" data-tour="cases" aria-label={t('case.switch')}>
        {CASE_ORDER.map((id, i) => (
          <CaseFrame
            key={id}
            c={CASES[id]}
            index={i}
            chosen={chosen === id}
            idle={!introDone || !!chosen}
            onChoose={() => choose(id)}
          />
        ))}
      </nav>

      <div className="case-hud" aria-hidden="true">
        <span className="case-hud-hint">{t('case.pickHint')}</span>
      </div>
      <p className="case-picker-credit">{t('case.coverCredit')}</p>
    </div>
  )
}

// Where each hub video comes from, credited on the frame while it plays.
const VIDEO_CREDIT: Record<CaseStudy['id'], { channel: string; title: string; url: string }> = {
  YANO: {
    channel: 'Nat Geo',
    title: 'Inside the Darkest Criminal Networks | Trafficked with Mariana van Zeller MEGA Episode',
    url: 'https://www.youtube.com/watch?v=uOfbEMNLIAg',
  },
  ENCH: {
    channel: 'Eliezio Amazonense',
    title: 'Enchente 2025 na cidade de Anamã-Amazonas: 70% da cidade está debaixo da água',
    url: 'https://www.youtube.com/watch?v=4TW4jGunjak',
  },
  SECA: {
    channel: 'Canção Nova Play',
    title: 'Seca extrema transforma a paisagem dos rios no Amazonas',
    url: 'https://www.youtube.com/watch?v=GsZo7ZLfTeg',
  },
}

// Photos rotate at this pace on hover when the case has no video.
const PHOTO_MS = 2600

function CaseFrame({
  c,
  index,
  chosen,
  idle,
  onChoose,
}: {
  c: CaseStudy
  index: number
  chosen: boolean
  idle: boolean
  onChoose: () => void
}) {
  const t = useT()
  const tr = useTr()
  const [media] = useState(() => caseMedia(c.id))
  const [live, setLive] = useState(false)
  const [armed, setArmed] = useState(false)
  const [step, setStep] = useState(0)
  const video = useRef<HTMLVideoElement>(null)
  const playing = (live || chosen) && !idle
  const [ready, setReady] = useState(false)
  const videoOn = playing && !!media.video
  const photo = playing && !media.video && media.images.length ? media.images[step % media.images.length] : null

  useEffect(() => {
    if (!photo || media.images.length < 2 || chosen) return
    const n = media.images.length
    const id = window.setTimeout(() => setStep((s) => (s + 1) % n), PHOTO_MS)
    return () => window.clearTimeout(id)
  }, [photo, step, media.images.length, chosen])

  // The frame must be on screen (on phones the strip can scroll) before its video is worth fetching.
  const frame = useRef<HTMLButtonElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = frame.current
    if (!el || !media.video) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '100px' })
    io.observe(el)
    return () => io.disconnect()
  }, [media.video])

  // Warm the videos up in the background once the hub is showing, one after the other, so the
  // first hover already has frames to play instead of waiting for the download. Before that the
  // video has no source at all, so nothing of it downloads while the intro plays.
  useEffect(() => {
    if (idle || armed || !visible || !media.video) return
    const id = window.setTimeout(() => setArmed(true), 300 + index * 700)
    return () => window.clearTimeout(id)
  }, [idle, armed, visible, media.video, index])

  // The video only runs while the frame is pointed at; it resumes where it stopped next time.
  useEffect(() => {
    const v = video.current
    if (!v) return
    if (videoOn) v.play().catch(() => {})
    else v.pause()
  }, [videoOn])

  return (
    <button
      ref={frame}
      type="button"
      data-tour={`case-${c.id}`}
      className={cn('case-card', chosen && 'is-chosen', live && 'is-live')}
      style={{ '--case': c.color, '--i': index } as React.CSSProperties}
      onPointerEnter={() => {
        setLive(true)
        setArmed(true)
      }}
      onPointerLeave={() => {
        setLive(false)
        setStep(0)
      }}
      onFocus={() => {
        setLive(true)
        setArmed(true)
      }}
      onBlur={() => {
        setLive(false)
        setStep(0)
      }}
      onClick={onChoose}
      aria-label={`${tr(c.analysis)}: ${tr(c.place)}`}
    >
      <span className="case-card-media" aria-hidden="true">
        {/* At rest: the satellite picture of the region. */}
        <SatCover center={c.cover.center} zoom={c.cover.zoom + 1} className="case-card-photo is-on" />
        {media.images.map((src) => (
          <img
            key={src}
            src={src}
            alt=""
            draggable={false}
            decoding="async"
            loading="lazy"
            className={cn('case-card-photo', photo === src && 'is-on')}
          />
        ))}
        {media.video && (
          <video
            ref={video}
            // Until its first frames arrive the satellite picture stays, instead of a black frame.
            className={cn('case-card-video', videoOn && ready && 'is-on')}
            onLoadedData={() => setReady(true)}
            // preload is set before src, so the download starts as soon as the source is attached
            preload={armed ? 'auto' : 'none'}
            src={armed ? media.video : undefined}
            muted
            loop
            playsInline
          />
        )}
      </span>
      <span className="case-card-shade" aria-hidden="true" />
      {media.video && (
        // The card is a button, so the credit opens the source itself instead of nesting a link.
        <span
          role="link"
          tabIndex={-1}
          title={`${VIDEO_CREDIT[c.id].title} · ${VIDEO_CREDIT[c.id].channel} (YouTube)`}
          className={cn('case-card-credit', videoOn && ready && 'is-on')}
          onClick={(e) => {
            e.stopPropagation()
            window.open(VIDEO_CREDIT[c.id].url, '_blank', 'noopener,noreferrer')
          }}
        >
          {t('case.videoCredit')}: {VIDEO_CREDIT[c.id].channel} · YouTube
        </span>
      )}

      <span className="case-card-top" aria-hidden="true">
        <span className="case-card-kicker">{tr(c.analysis)}</span>
        <span className="case-card-go" data-tour={`case-go-${c.id}`}>
          {t('case.explore')}
        </span>
      </span>

      <span className="case-card-body" aria-hidden="true">
        <span className="case-card-reveal">
          <span className="case-card-reveal-inner">
            <span className="case-card-place">{tr(c.place)}</span>
            <span className="case-card-meta">
              {c.meta.map((m) => (
                <span key={m.label.pt} className="case-card-meta-row">
                  <span className="case-card-meta-label">{tr(m.label)}</span>
                  <span>{tr(m.value)}</span>
                </span>
              ))}
            </span>
          </span>
        </span>
        <span className="case-card-word">{tr(c.theme)}</span>
      </span>
    </button>
  )
}
