import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Eye, EyeOff, Loader2, MapPin, MousePointerClick, Pause, Play, Satellite } from 'lucide-react'
import { REGIONS } from '@/lib/regions'
import { useApp } from '@/lib/store'
import { useNisarSelection } from '@/lib/useNisarCatalog'
import { ALL_TRACKS, brandDate, trackKey, trackLabel, type NisarProduct } from '@/lib/nisar'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const PLAY_MS = 1400

// Floating map control: pick product / track / date of the live NISAR imagery and animate it.
export function NisarControl() {
  const t = useT()
  const activeRegion = useApp((s) => s.activeRegion)
  const visible = useApp((s) => s.nisarVisible)
  const opacity = useApp((s) => s.nisarOpacity)
  const setVisible = useApp((s) => s.setNisarVisible)
  const setOpacity = useApp((s) => s.setNisarOpacity)
  const setTrack = useApp((s) => s.setNisarTrack)
  const setScene = useApp((s) => s.setNisarScene)
  const setProduct = useApp((s) => s.setNisarProduct)
  const setPoint = useApp((s) => s.setNisarPoint)
  const notice = useApp((s) => s.nisarNotice)
  const region = useMemo(() => REGIONS.find((r) => r.id === activeRegion)!, [activeRegion])
  const sel = useNisarSelection(region)
  const [playing, setPlaying] = useState(false)
  const [collapsed, setCollapsed] = useState(true)

  const scenes = sel.track?.scenes ?? []
  const n = scenes.length

  useEffect(() => {
    if (!playing || n < 2) return
    const id = window.setInterval(() => {
      const st = useApp.getState()
      const cur = scenes.findIndex((s) => s.id === st.nisarSceneId)
      const next = cur < 0 ? 0 : (cur + 1) % n
      st.setNisarScene(scenes[next].id)
    }, PLAY_MS)
    return () => window.clearInterval(id)
  }, [playing, scenes, n])

  useEffect(() => setPlaying(false), [activeRegion, sel.product])

  const step = (d: number) => {
    if (!n) return
    const i = (sel.index + d + n) % n
    setScene(scenes[i].id)
  }

  const scene = sel.scene
  const dateLabel = scene
    ? scene.product === 'GUNW'
      ? `${scene.date} → ${scene.date2}`
      : scene.date
    : '—'

  return (
    <div className="glass rounded-lg w-[300px] p-2.5 text-[12px] shadow-xl border border-border/60">
      <div className="flex items-center gap-2">
        <Satellite className="h-3.5 w-3.5 text-primary" />
        <div className="font-semibold text-[14px] text-foreground">{t('nisar.title')}</div>
        {sel.loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        <button
          onClick={() => setVisible(!visible)}
          className={cn(
            'ml-auto rounded p-1 transition-colors',
            visible
              ? 'text-primary hover:text-foreground'
              : 'text-muted-foreground/60 hover:text-foreground'
          )}
          aria-label={t('nisar.show')}
          title={visible ? t('nisarControl.hide') : t('nisarControl.show')}
        >
          {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label={collapsed ? t('nisarControl.expand') : t('nisarControl.collapse')}
          aria-expanded={!collapsed}
          title={collapsed ? t('nisarControl.expand') : t('nisarControl.collapse')}
        >
          {collapsed ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {collapsed ? null : (
      <>
      <div className="mt-2 grid grid-cols-2 gap-1">
        {(['GCOV', 'GUNW'] as NisarProduct[]).map((p) => (
          <button
            key={p}
            onClick={() => setProduct(p)}
            className={cn(
              'rounded-md border px-2 py-1 text-left font-medium transition-colors',
              sel.product === p
                ? 'border-primary/50 bg-primary/10 text-foreground'
                : 'border-border/60 bg-background/40 text-muted-foreground hover:text-foreground'
            )}
          >
            {t(p === 'GCOV' ? 'nisar.gcov.label' : 'nisar.gunw.label')}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-start gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2 py-1.5 leading-snug text-foreground">
        <MousePointerClick className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <span>{t('nisar.clickHint')}</span>
      </div>
      {notice && <div className="mt-1.5 leading-snug text-sar-amber">{notice}</div>}
      <div className="mt-1.5 flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
        <span className="flex-1">
          {sel.point
            ? `${t('nisar.pointMode')} ${formatPoint(sel.point)}`
            : t(`region.${activeRegion}.name`)}{' '}
          · {sel.tracks[0]?.scenes.length ?? 0} {t('nisar.images')}
        </span>
        {sel.point && (
          <button
            onClick={() => setPoint(null)}
            className="rounded p-0.5 hover:text-foreground"
            title={t('nisar.backToRegion')}
            aria-label={t('nisar.backToRegion')}
          >
            <MapPin className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {sel.error && <div className="mt-2 text-destructive">{t('nisar.error')}: {sel.error}</div>}
      {!sel.loading && !sel.error && sel.tracks.length === 0 && (
        <div className="mt-2 text-muted-foreground">{t('nisar.empty')}</div>
      )}

      {sel.tracks.length > 0 && (
        <>
          <label className="mt-2 block text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            {t('nisar.track')}
          </label>
          <select
            value={sel.track?.key ?? ''}
            onChange={(e) => setTrack(e.target.value)}
            className="mt-1 w-full rounded-md border border-border/60 bg-background/60 px-2 py-1 font-mono text-foreground"
          >
            {sel.tracks.map((tr) =>
              tr.key === ALL_TRACKS ? (
                <option key={tr.key} value={tr.key}>
                  {t('nisar.allTracks')} · {tr.scenes.length} {t('nisar.images')}
                </option>
              ) : (
                <option key={tr.key} value={tr.key}>
                  {trackLabel(tr.key)} · {tr.scenes.length} {t('nisar.dates')}
                  {tr.dualPol ? ` · ${t('nisar.dualpol')}` : ''} · {Math.round(tr.coverage * 100)}%
                </option>
              )
            )}
          </select>

          <div className="mt-2 flex items-center gap-1">
            <button
              onClick={() => step(-1)}
              className="rounded-md border border-border/60 p-1 hover:bg-secondary/60"
              aria-label={t('nisarControl.previous')}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setPlaying((v) => !v)}
              className="rounded-md border border-primary/50 bg-primary/15 p-1 text-primary"
              aria-label={t('nisar.play')}
              title={t('nisar.play')}
            >
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => step(1)}
              className="rounded-md border border-border/60 p-1 hover:bg-secondary/60"
              aria-label={t('nisarControl.next')}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <div className="ml-2 font-mono text-foreground">{dateLabel}</div>
            <div className="ml-auto font-mono text-muted-foreground">
              {sel.index + 1}/{n}
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={Math.max(0, n - 1)}
            value={Math.max(0, sel.index)}
            onChange={(e) => setScene(scenes[Number(e.target.value)]?.id ?? null)}
            className="mt-1.5 w-full accent-primary"
            aria-label={t('nisar.scene')}
          />

          <div className="mt-1 flex items-center gap-2">
            <span className="text-muted-foreground">{t('nisar.opacity')}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
          </div>

          {scene && (
            <div className="mt-1.5 text-[13px] text-foreground">
              {scene.product === 'GUNW'
                ? t('nisar.captionPair', { date: brandDate(scene.date), date2: brandDate(scene.date2) })
                : t('nisar.caption', { date: brandDate(scene.date) })}
              <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                {trackLabel(trackKey(scene))}
                {scene.beta ? ' · BETA' : ''}
              </span>
            </div>
          )}
          <div className="mt-1 leading-snug text-muted-foreground">
            {t(sel.product === 'GCOV' ? 'nisar.gcov.legend' : 'nisar.gunw.legend')}
          </div>
        </>
      )}
      </>
      )}
    </div>
  )
}

function formatPoint([lon, lat]: [number, number]): string {
  const ns = lat < 0 ? 'S' : 'N'
  const ew = lon < 0 ? 'O' : 'L'
  return `${Math.abs(lat).toFixed(2)}°${ns} ${Math.abs(lon).toFixed(2)}°${ew}`
}
