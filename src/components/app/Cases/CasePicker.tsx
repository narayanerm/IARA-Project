import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { CASES, CASE_ORDER, type CaseStudy } from '@/data/cases'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'
import type { RegionId } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useTr } from './shared'
import { SatCover } from './SatCover'
import { caseMedia } from './caseMedia'
import { useAsfPair } from '@/lib/useAsfPair'
import { bandFor } from '@/lib/asf'
import { polygonBbox } from '@/lib/polygon-bbox'
import { CASE_REVEAL_MS } from '../Map/hooks/useMapCamera'
import './cases.css'


/**
 * Entry point and the only way between cases: three tall frames side by side, each showing the
 * radar (SAR) image of its region. Pointing at one widens it, plays its video and slides up the details. Picking it
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
        <span>{t('case.eyebrow')}</span>
        <span className="case-hud-hint">{t('case.pickHint')}</span>
      </div>
      <p className="case-picker-credit">{t('case.coverCredit')}</p>
    </div>
  )
}

interface SarCover {
  src: string
  label: string
  /** Where the case region sits inside the radar scene, as object-position percentages. */
  x: number
  y: number
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
  const [sar, setSar] = useState<SarCover | null>(null)
  const [sarFailed, setSarFailed] = useState(false)
  const [step, setStep] = useState(0)
  const video = useRef<HTMLVideoElement>(null)
  const playing = (live || chosen) && !idle
  const videoOn = playing && !!media.video
  const photo = playing && !media.video && media.images.length ? media.images[step % media.images.length] : null

  useEffect(() => {
    if (!photo || media.images.length < 2 || chosen) return
    const n = media.images.length
    const id = window.setTimeout(() => setStep((s) => (s + 1) % n), PHOTO_MS)
    return () => window.clearTimeout(id)
  }, [photo, step, media.images.length, chosen])

  // The video only runs while the frame is pointed at; it resumes where it stopped next time.
  useEffect(() => {
    const v = video.current
    if (!v) return
    if (videoOn) v.play().catch(() => {})
    else v.pause()
  }, [videoOn])

  const liveSar = !media.sarCover && !sarFailed ? sar : null
  const sarLabel = media.sarCover ? 'Radar · SAR' : liveSar?.label
  const onMedia = videoOn || !!photo
  return (
    <button
      type="button"
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
        {/* At rest: the radar image of the region. The satellite mosaic sits underneath until the
            radar scene answers, and stays if it never does. */}
        {!media.sarCover && (
          <SatCover center={c.cover.center} zoom={c.cover.zoom + 1} className="case-card-photo is-on" />
        )}
        {media.sarCover && (
          <img src={media.sarCover} alt="" draggable={false} decoding="async" className="case-card-photo is-on" />
        )}
        {liveSar && (
          <img
            src={liveSar.src}
            alt=""
            draggable={false}
            decoding="async"
            referrerPolicy="no-referrer"
            className="case-card-photo case-card-sar"
            style={{ objectPosition: `${liveSar.x}% ${liveSar.y}%`, transformOrigin: `${liveSar.x}% ${liveSar.y}%` }}
            onLoad={(e) => e.currentTarget.classList.add('is-on')}
            onError={() => setSarFailed(true)}
          />
        )}
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
            className={cn('case-card-video', videoOn && 'is-on')}
            src={media.video}
            muted
            loop
            playsInline
            preload={armed ? 'auto' : 'metadata'}
          />
        )}
      </span>
      {!media.sarCover && !sar && <SarProbe c={c} onReady={setSar} />}
      <span className="case-card-shade" aria-hidden="true" />

      <span className="case-card-top" aria-hidden="true">
        <span className="case-card-num">0{index + 1}</span>
        <span className="case-card-kicker">{tr(c.analysis)}</span>
        <span className="case-card-go">
          <span className="case-card-go-label">{t('case.explore')}</span>
          <ArrowUpRight className="h-4 w-4" strokeWidth={1.6} />
        </span>
      </span>
      {sarLabel && (
        <span className={cn('case-card-tag', onMedia && 'is-off')} aria-hidden="true">
          {sarLabel}
        </span>
      )}

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

/**
 * Looks up the radar scene the case panel shows for its latest year (ASF browse image over the
 * case's own bounding box) and hands it to the frame, with the spot where the region sits inside
 * the scene so the frame can centre on it. Renders nothing; if no scene answers, the frame keeps
 * the satellite picture.
 */
function SarProbe({ c, onReady }: { c: CaseStudy; onReady: (s: SarCover) => void }) {
  const t = useT()
  const point = [...c.series.points].reverse().find((p) => p.sar)
  const pair = useAsfPair(c.sarBbox, point?.sar?.before ?? '', point?.sar?.after ?? '', 45)
  const g = point ? pair.after : null
  const platform = pair.platform
  useEffect(() => {
    if (!g?.browseUrl || !platform) return
    const [w, s, e, n] = polygonBbox(g.footprint)
    const cx = (c.sarBbox[0] + c.sarBbox[2]) / 2
    const cy = (c.sarBbox[1] + c.sarBbox[3]) / 2
    const pct = (v: number) => Math.round(Math.min(100, Math.max(0, v * 100)))
    onReady({
      src: g.browseUrl,
      label: `Radar · ${platform} (${t('case.band', { band: bandFor(platform) })}) · ${g.startTime.slice(0, 10)}`,
      x: pct((cx - w) / (e - w || 1)),
      y: pct(1 - (cy - s) / (n - s || 1)),
    })
  }, [g, platform, c, onReady, t])
  return null
}
