import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMap } from 'react-map-gl/maplibre'
import { useI18n } from '@/lib/i18n'
import { useApp, useCaseVideo, useCaseVideoActive } from '@/lib/store'
import type { RegionId } from '@/lib/types'
import './caseVideo.css'

// Original 1080p renders, copied without re-encoding by scripts/case-videos.sh.
const VIDEOS: Record<RegionId, { src: string; poster: string; title: string }> = {
  YANO: { src: '/case-video/yanomami.mp4', poster: '/case-video/yanomami-poster.jpg', title: 'Why Yanomami?' },
  ENCH: { src: '/case-video/enchente-manaus.mp4', poster: '/case-video/enchente-manaus-poster.jpg', title: 'Enchente em Manaus' },
  SECA: { src: '/case-video/seca-manaquiri.mp4', poster: '/case-video/seca-manaquiri-poster.jpg', title: 'Seca em Manaquiri' },
}

const T = {
  skip: { pt: 'Pular vídeo', en: 'Skip video' },
  unmute: { pt: 'Ativar som', en: 'Turn sound on' },
}

/**
 * A case's voiced explainer, full screen, with a skip button that is always visible. Mining plays it when the guided
 * tour closes and then opens the Mining case; Flood and Drought play theirs when the case opens and then show the
 * map with the overview panel. Lives inside <Map> so it can pause and hide the map while the video plays.
 */
export function CaseVideo() {
  const region = useCaseVideoActive()
  if (!region) return null
  return <CaseVideoPlayer key={region} region={region} />
}

function CaseVideoPlayer({ region }: { region: RegionId }) {
  const lang = useI18n((s) => s.lang) as 'pt' | 'en'
  const finish = useCaseVideo((s) => s.finishCaseVideo)
  const { current: mapRef } = useMap()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [muted, setMuted] = useState(false)
  const video = VIDEOS[region]

  const done = useCallback(() => {
    // Asked for after the tour (Mining): continue into that case. Otherwise the case is already open.
    const app = useApp.getState()
    const wasRequested = useCaseVideo.getState().requested === region
    finish(region)
    if (wasRequested && !(app.aoiActive && app.activeRegion === region)) app.setActiveRegion(region)
  }, [finish, region])

  // Nothing competes with the video for the GPU: the map behind stops moving and is not painted while it plays.
  useEffect(() => {
    const m = mapRef?.getMap()
    if (!m) return
    m.stop()
    const el = m.getCanvasContainer()
    el.style.visibility = 'hidden'
    return () => {
      el.style.visibility = ''
    }
  }, [mapRef])

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

  // Esc skips too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') done()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [done])

  return createPortal(
    <div className="case-video" role="dialog" aria-label={video.title}>
      <video
        ref={videoRef}
        src={video.src}
        poster={video.poster}
        controls
        playsInline
        preload="auto"
        onEnded={done}
        onError={done}
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
            {T.unmute[lang]}
          </button>
        )}
        <button type="button" className="case-video-btn" onClick={done}>
          {T.skip[lang]}
        </button>
      </div>
    </div>,
    document.getElementById('app') ?? document.body
  )
}
