import { useEffect, useRef, useState } from 'react'
import { ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

import { AoiPills } from './AoiPills'
import { PanoramaStats } from './PanoramaStats'
import { CommunitySearch } from './CommunitySearch'
import { CommunityList } from './CommunityList'
import { SidebarFooter } from './SidebarFooter'
import { useCommunityData } from './hooks/useCommunityData'
import { useFilteredEntries } from './hooks/useFilteredEntries'
import type { FilterKind } from './types'

export function Sidebar() {
  const t = useT()
  const locale = useI18n((s) => (s.lang === 'en' ? 'en-US' : 'pt-BR'))
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterKind>('all')
  const [limit, setLimit] = useState(40)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { entries, panorama } = useCommunityData()
  const filtered = useFilteredEntries(entries, query, filter)

  useEffect(() => {
    setLimit(40)
    scrollRef.current?.scrollTo({ top: 0 })
  }, [query, filter])

  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => setScrolled(el.scrollTop > 280)
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [open])

  const shown = filtered.slice(0, limit)
  const dataLoading = !entries.length

  return (
    <aside
      data-tour="sidebar"
      className={cn(
        'relative z-10 h-full border-r border-border/60 bg-card/40 backdrop-blur-xl transition-[width] duration-300',
        open ? 'w-[300px] 2xl:w-[336px]' : 'w-10'
      )}
    >
      <div className="flex h-12 items-center justify-between border-b border-border/60 px-2">
        {open && (
          <div className="text-[12px] font-mono uppercase tracking-wider text-muted-foreground px-1">
            {t('sidebar.heading.amazon')}
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? t('sidebar.collapse') : t('sidebar.expand')}
        >
          {open ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>

      {open && scrolled && (
        <button
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="absolute left-1/2 top-16 z-20 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-card/95 backdrop-blur-md px-3 py-1.5 text-[11px] font-mono font-semibold text-primary shadow-lg hover:bg-primary/15 transition-colors"
          aria-label={t('sidebar.backToTop')}
        >
          <ArrowUp className="h-3.5 w-3.5" />
          {t('sidebar.top')}
        </button>
      )}

      {open && (
        <div ref={scrollRef} className="relative flex h-[calc(100%-3rem)] flex-col gap-3 overflow-y-auto p-3">
          <AoiPills />
          <PanoramaStats panorama={panorama} />
          <CommunitySearch
            query={query}
            onQueryChange={setQuery}
            filter={filter}
            onFilterChange={setFilter}
          />

          <div className="flex items-center justify-between px-1">
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              {query ? t('sidebar.results') : t('sidebar.allCommunities')}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground">
              {filtered.length.toLocaleString(locale)}
              {filtered.length > shown.length && (
                <span className="opacity-70">{t('sidebar.showingCount', { n: String(shown.length) })}</span>
              )}
            </div>
          </div>

          {dataLoading && (
            <div className="text-[12px] text-muted-foreground px-1">{t('sidebar.loadingData')}</div>
          )}

          <CommunityList
            shown={shown}
            totalFiltered={filtered.length}
            onShowAll={() => setLimit(filtered.length)}
          />

          {!dataLoading && filtered.length === 0 && (
            <div className="text-[12px] text-muted-foreground px-1 py-4 text-center">
              {t('sidebar.noResults', { q: query })}
            </div>
          )}

          <SidebarFooter />
        </div>
      )}
    </aside>
  )
}
