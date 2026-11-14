import { useEffect, useRef } from 'react'
import { Radar } from 'lucide-react'
import { SarMap } from './Map/SarMap'
import { PhenomenonBriefing } from './Briefing/PhenomenonBriefing'
import { CommunitySearch, SEARCH_INPUT_ID } from './Explore/CommunitySearch'
import { CommunityPanel } from './Community/CommunityPanel'
import { useApp } from '@/lib/store'
import { focusKey } from '@/lib/community'
import { buildPermalink } from '@/lib/url-state'
import { useT } from '@/lib/i18n'
import { LanguageToggle } from '@/components/common/LanguageToggle'

// Two modes: explore (map + search) and community (one community, three steps).
export function AppLayout() {
  const t = useT()
  const focus = useApp((s) => s.focus)
  const step = useApp((s) => s.step)
  const caseRegion = useApp((s) => s.caseRegion)
  const clearFocus = useApp((s) => s.clearFocus)

  // Esc leaves the community, unless the key belongs to a field or an open dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || !useApp.getState().focus) return
      const el = e.target as HTMLElement | null
      if (el?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
      clearFocus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clearFocus])

  // Back in explore mode, keyboard focus returns to the search.
  const wasFocused = useRef(false)
  useEffect(() => {
    if (wasFocused.current && !focus) {
      requestAnimationFrame(() => document.getElementById(SEARCH_INPUT_ID)?.focus({ preventScroll: true }))
    }
    if (focus) wasFocused.current = true
  }, [focus])

  // The address bar always points at the current community and step, so it can be shared as is.
  // It is left alone until the first community opens, so a shared link survives the initial load.
  useEffect(() => {
    if (!wasFocused.current && !focus) return
    const url = buildPermalink(focus ? { c: focusKey(focus), step } : {})
    if (url !== window.location.href) window.history.replaceState(null, '', url)
  }, [focus, step])

  return (
    <section id="app" className="h-[100svh] w-full flex flex-col bg-background">
      <header className="flex h-12 items-center justify-between gap-3 border-b border-border/60 bg-card/40 backdrop-blur-xl px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/15 ring-1 ring-primary/30">
            <Radar className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold">{t('app.name')}</div>
            <div className="hidden truncate text-[12px] text-muted-foreground sm:block">{t('explore.tagline')}</div>
          </div>
        </div>
        <LanguageToggle compact />
      </header>

      <div className="flex-1 flex min-h-0">
        {focus && <CommunityPanel key={focusKey(focus)} focus={focus} />}
        <div className="relative flex-1 min-w-0">
          <SarMap />
          {!focus && (
            <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 flex md:right-auto">
              <CommunitySearch />
            </div>
          )}
          {focus && caseRegion && <PhenomenonBriefing />}
        </div>
      </div>
    </section>
  )
}
