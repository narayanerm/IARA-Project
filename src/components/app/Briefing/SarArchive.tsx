import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Folder, FolderOpen, Loader2 } from 'lucide-react'
import type { AsfPlatform } from '@/lib/asf'
import {
  closestScene,
  cropSize,
  drawScene,
  useSarArchive,
  type ArchiveMission,
  type ArchiveScene,
  type Bbox,
} from '@/lib/sarArchive'
import { useUi } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { takeSharedSar } from '@/lib/url-state'

/**
 * Ported from manaus-flood-case (SarArchiveCompare). Simplified:
 *   - Hardcoded pt/en strings (no i18n TKey extension)
 *   - `sites` map overlay dropped (requires CaseSite type we didn't port)
 *   - `prefer` prop optional
 *
 * Shows the full SAR archive (Sentinel-1 RTC from Planetary Computer, NISAR GCOV
 * from ASF) over the case bbox. User picks two dates, slider compares cropped
 * scenes pixel-aligned.
 */

const MISSIONS: Array<{ id: ArchiveMission; band: string; color: string }> = [
  { id: 'Sentinel-1', band: 'C', color: '#5AA7C9' },
  { id: 'NISAR', band: 'L', color: '#F07A45' },
]

type Slot = 'before' | 'after'

const COPY = {
  pt: {
    before: 'antes',
    after: 'depois',
    prev: 'anterior',
    next: 'próxima',
    badgeB: 'ANTES',
    badgeA: 'DEPOIS',
    loading: 'buscando arquivo SAR…',
    empty: 'nenhuma cena cobre este recorte',
    pickHint: (slot: string) => `toque numa data abaixo para definir "${slot}".`,
    aboutS1: 'Sentinel-1: C-band (5.6 cm), 10 m, revisita 6-12 d. Água lisa = pixel escuro.',
    aboutNisar: 'NISAR: L-band (24 cm), 180 m browse, revisita 12 d. Penetra copa.',
    count: (n: number) => `${n} cenas no arquivo (jun/2026+ para NISAR, 2014+ para Sentinel-1).`,
    noEventScene: 'sem cena próxima da data do evento; selecionamos o mais perto no arquivo.',
    loadingImage: 'carregando…',
    imageFailed: 'falha ao carregar',
    partial: (pct: number) => `cobertura parcial ${pct}%`,
  },
  en: {
    before: 'before',
    after: 'after',
    prev: 'previous',
    next: 'next',
    badgeB: 'BEFORE',
    badgeA: 'AFTER',
    loading: 'fetching SAR archive…',
    empty: 'no scenes cover this crop',
    pickHint: (slot: string) => `tap a date below to set "${slot}".`,
    aboutS1: 'Sentinel-1: C-band (5.6 cm), 10 m, 6-12 d revisit. Smooth water = dark pixel.',
    aboutNisar: 'NISAR: L-band (24 cm), 180 m browse, 12 d revisit. Penetrates canopy.',
    count: (n: number) => `${n} scenes in archive (Jun 2026+ for NISAR, 2014+ for Sentinel-1).`,
    noEventScene: 'no scene near the event date; picked the closest available.',
    loadingImage: 'loading…',
    imageFailed: 'load failed',
    partial: (pct: number) => `partial coverage ${pct}%`,
  },
} as const

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

interface Props {
  bbox: Bbox
  beforeDate: string
  afterDate: string
  prefer?: AsfPlatform
}

export function SarArchive({ bbox, beforeDate, afterDate, prefer }: Props) {
  const lang = useI18n((s) => s.lang)
  const copy = COPY[lang] ?? COPY.pt
  const { scenes, loading, error } = useSarArchive(bbox)
  const [ids, setIds] = useState<Record<Slot, string | null>>({ before: null, after: null })
  const [slot, setSlot] = useState<Slot>('after')
  const [mission, setMission] = useState<ArchiveMission>('NISAR')
  const [year, setYear] = useState<string>('')
  const [missing, setMissing] = useState(false)
  // True once the pair differs from the automatic pick (chosen by hand or opened from a link).
  const [custom, setCustom] = useState(false)
  const setSarMapPickId = useUi((s) => s.setSarMapPickId)
  const setSarPair = useUi((s) => s.setSarPair)

  const byId = useMemo(() => new Map(scenes.map((s) => [s.id, s])), [scenes])
  const before = ids.before ? (byId.get(ids.before) ?? null) : null
  const after = ids.after ? (byId.get(ids.after) ?? null) : null

  useEffect(() => {
    if (!scenes.length) return
    const shared = takeSharedSar()
    const sb = shared && scenes.find((s) => s.id === shared[0])
    const sa = shared && scenes.find((s) => s.id === shared[1])
    if (sb && sa) {
      setMissing(false)
      setIds({ before: sb.id, after: sa.id })
      setMission(sa.mission)
      setYear(sa.date.slice(0, 4))
      setSlot('after')
      setCustom(true)
      return
    }
    setCustom(false)
    const m: ArchiveMission | undefined = prefer === 'NISAR' ? 'NISAR' : undefined
    const pick = (iso: string) => (m ? closestScene(scenes, iso, m, 45) : null) ?? closestScene(scenes, iso)
    const b = pick(beforeDate)
    const a = pick(afterDate)
    setMissing(!b || !a)
    setIds((cur) => ({ before: b?.id ?? cur.before, after: a?.id ?? cur.after }))
    const focus = a ?? b
    if (focus) {
      setMission(focus.mission)
      setYear(focus.date.slice(0, 4))
    }
    setSlot('after')
  }, [scenes, beforeDate, afterDate, prefer])

  useEffect(() => {
    setSarMapPickId(after?.id ?? null)
  }, [after, setSarMapPickId])

  // A hand-picked pair goes into shared links.
  useEffect(() => {
    setSarPair(custom && before && after ? [before.id, after.id] : null)
  }, [custom, before, after, setSarPair])
  useEffect(() => () => setSarPair(null), [setSarPair])

  const inMission = useMemo(() => scenes.filter((s) => s.mission === mission), [scenes, mission])
  const years = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of inMission) m.set(s.date.slice(0, 4), (m.get(s.date.slice(0, 4)) ?? 0) + 1)
    return [...m.entries()]
  }, [inMission])
  const shownYear = years.some(([y]) => y === year) ? year : (years[years.length - 1]?.[0] ?? '')
  const inYear = inMission.filter((s) => s.date.startsWith(shownYear))

  const monthDay = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-GB', {
      day: '2-digit',
      month: 'short',
    })

  const assign = (sc: ArchiveScene) => {
    setIds((cur) => ({ ...cur, [slot]: sc.id }))
    setCustom(true)
    setSlot(slot === 'before' ? 'after' : 'before')
  }

  const step = (which: Slot, dir: -1 | 1) => {
    const cur = which === 'before' ? before : after
    if (!cur) return
    const list = scenes.filter((s) => s.mission === cur.mission)
    const next = list[list.findIndex((s) => s.id === cur.id) + dir]
    if (next) {
      setIds((c) => ({ ...c, [which]: next.id }))
      setCustom(true)
      setYear(next.date.slice(0, 4))
    }
  }

  if (loading) {
    return (
      <div className="grid aspect-[3/2] w-full place-items-center rounded-lg border border-border/60 bg-background/40">
        <div className="flex items-center gap-2 text-[13px] font-mono text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {copy.loading}
        </div>
      </div>
    )
  }

  if (!scenes.length) {
    return (
      <div className="rounded-lg border border-border/60 bg-background/40 p-4 text-[13px] text-muted-foreground">
        {copy.empty} {error && <span className="font-mono">({error})</span>}
      </div>
    )
  }

  const slotCard = (which: Slot, sc: ArchiveScene | null) => (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        setSlot(which)
        if (sc) {
          setMission(sc.mission)
          setYear(sc.date.slice(0, 4))
        }
      }}
      onKeyDown={(e) => e.key === 'Enter' && setSlot(which)}
      className={cn(
        'flex min-w-0 flex-1 cursor-pointer items-center gap-1 rounded-lg border px-1.5 py-1.5 transition-colors',
        slot === which ? 'border-primary bg-primary/10' : 'border-border/60 bg-background/40 hover:border-primary/50'
      )}
    >
      <button
        onClick={(e) => {
          e.stopPropagation()
          step(which, -1)
        }}
        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={copy.prev}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1 text-center leading-tight">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {which === 'before' ? copy.before : copy.after}
        </div>
        <div className="truncate text-[13px] font-semibold">{sc ? fmtDate(sc.date) : '—'}</div>
        <div className="truncate text-[10px] font-mono text-muted-foreground">
          {sc ? `${sc.mission} · ${sc.band}-band` : ''}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          step(which, 1)
        }}
        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={copy.next}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )

  return (
    <div className="space-y-2.5">
      <CropCompare bbox={bbox} before={before} after={after} copy={copy} />

      <div className="flex gap-2">
        {slotCard('before', before)}
        {slotCard('after', after)}
      </div>
      <div className="text-[11px] text-muted-foreground">
        {copy.pickHint(slot === 'before' ? copy.before : copy.after)}
      </div>

      <div className="rounded-lg border border-border/60 bg-background/40">
        <div role="tablist" className="flex border-b border-border/60">
          {MISSIONS.map((m) => {
            const n = scenes.filter((s) => s.mission === m.id).length
            const active = mission === m.id
            const Icon = active ? FolderOpen : Folder
            return (
              <button
                key={m.id}
                role="tab"
                aria-selected={active}
                disabled={!n}
                onClick={() => {
                  setMission(m.id)
                  setYear('')
                }}
                className={cn(
                  'relative flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-[13px] font-medium transition-colors disabled:opacity-40',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" style={{ color: m.color }} />
                {m.id}
                <span className="rounded-full bg-muted px-1.5 text-[11px] font-mono">{n}</span>
                {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full" style={{ background: m.color }} />}
              </button>
            )
          })}
        </div>

        <div className="space-y-2 p-2">
          <div className="text-[11px] text-muted-foreground">
            {mission === 'Sentinel-1' ? copy.aboutS1 : copy.aboutNisar}
          </div>
          <div className="flex flex-wrap gap-1">
            {years.map(([y, n]) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={cn(
                  'rounded-md border px-2 py-0.5 text-[12px] font-mono transition-colors',
                  y === shownYear
                    ? 'border-primary/60 bg-primary/15 text-primary'
                    : 'border-border/60 text-muted-foreground hover:text-foreground'
                )}
              >
                {y} <span className="opacity-60">{n}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-1 sm:grid-cols-6">
            {inYear.map((sc) => {
              const isB = sc.id === before?.id
              const isA = sc.id === after?.id
              return (
                <button
                  key={sc.id}
                  onClick={() => assign(sc)}
                  title={`${fmtDate(sc.date)} · ${sc.mission}`}
                  className={cn(
                    'relative rounded-md border px-1 py-1 text-[12px] font-mono transition-colors',
                    isA || isB
                      ? 'border-primary bg-primary/20 text-foreground'
                      : 'border-border/50 text-foreground/80 hover:border-primary/50 hover:bg-primary/5'
                  )}
                >
                  {monthDay(sc.date)}
                  {(isA || isB) && (
                    <span className="absolute -right-1 -top-1.5 rounded bg-primary px-0.5 text-[8px] font-bold leading-tight text-primary-foreground">
                      {isB ? copy.badgeB : copy.badgeA}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="text-[11px] leading-snug text-muted-foreground">
        {copy.count(scenes.length)}
        {missing && <span className="block text-primary">{copy.noEventScene}</span>}
        {error && <span className="block font-mono opacity-70">{error}</span>}
      </div>
      <div className="flex flex-wrap gap-x-3 text-[10px] font-mono text-muted-foreground/80">
        {[before, after]
          .filter((x): x is ArchiveScene => !!x)
          .map((sc) => (
            <a
              key={sc.id}
              href={sc.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 hover:text-foreground"
            >
              {sc.id.slice(0, 30)}…
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          ))}
      </div>
    </div>
  )
}

function useSceneCanvas(scene: ArchiveScene | null, bbox: Bbox, width: number, height: number) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'ok' | 'fail'; coverage: number }>({
    status: 'idle',
    coverage: 1,
  })
  useEffect(() => {
    const c = ref.current
    if (!c) return
    c.width = width
    c.height = height
    if (!scene) {
      const ctx = c.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#06100C'
        ctx.fillRect(0, 0, width, height)
      }
      setState({ status: 'idle', coverage: 1 })
      return
    }
    let cancelled = false
    setState((s) => ({ ...s, status: 'loading' }))
    drawScene(c, scene, bbox)
      .then((d) => !cancelled && setState({ status: 'ok', coverage: d.coverage }))
      .catch(() => !cancelled && setState({ status: 'fail', coverage: 0 }))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.id, bbox.join(','), width, height])
  return { ref, ...state }
}

function CropCompare({
  bbox,
  before,
  after,
  copy,
}: {
  bbox: Bbox
  before: ArchiveScene | null
  after: ArchiveScene | null
  copy: (typeof COPY)[keyof typeof COPY]
}) {
  const { width, height } = cropSize(bbox)
  const [pos, setPos] = useState(50)
  const [dragging, setDragging] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const b = useSceneCanvas(before, bbox, width, height)
  const a = useSceneCanvas(after, bbox, width, height)

  const onMove = (clientX: number) => {
    const el = box.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos(Math.max(2, Math.min(98, ((clientX - r.left) / r.width) * 100)))
  }

  const note = (st: ReturnType<typeof useSceneCanvas>) =>
    st.status === 'loading'
      ? copy.loadingImage
      : st.status === 'fail'
        ? copy.imageFailed
        : st.coverage < 0.97
          ? copy.partial(Math.round(st.coverage * 100))
          : null

  const label = (which: Slot, sc: ArchiveScene | null, st: ReturnType<typeof useSceneCanvas>) => {
    const extra = note(st)
    return `${which === 'before' ? copy.before : copy.after} · ${sc ? `${fmtDate(sc.date)} · ${sc.mission}` : '—'}${extra ? ` · ${extra}` : ''}`
  }

  return (
    <div
      ref={box}
      className="relative w-full select-none overflow-hidden rounded-lg border border-border/60 bg-[#06100C]"
      style={{ aspectRatio: `${width} / ${height}` }}
      onMouseMove={(ev) => dragging && onMove(ev.clientX)}
      onMouseUp={() => setDragging(false)}
      onMouseLeave={() => setDragging(false)}
      onTouchMove={(ev) => onMove(ev.touches[0].clientX)}
    >
      <canvas ref={a.ref} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <canvas ref={b.ref} className="absolute inset-0 h-full w-full" />
      </div>

      <span className="absolute left-2 top-2 z-10 max-w-[47%] truncate rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-mono text-white">
        {label('before', before, b)}
      </span>
      <span className="absolute right-2 top-2 z-10 max-w-[47%] truncate rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-mono text-white">
        {label('after', after, a)}
      </span>

      <div
        className="pointer-events-none absolute bottom-0 top-0 z-10 w-[2px] bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.6)]"
        style={{ left: `calc(${pos}% - 1px)` }}
      />
      <button
        onMouseDown={() => setDragging(true)}
        onTouchStart={() => setDragging(true)}
        className="absolute top-1/2 z-10 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full bg-white shadow-lg"
        aria-label="drag"
        style={{ left: `${pos}%` }}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-black" fill="none">
          <path d="M8 6L4 12L8 18M16 6L20 12L16 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
