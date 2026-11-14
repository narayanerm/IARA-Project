import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useApp } from '@/lib/store'
import { useT, type TKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  countMatches,
  loadCommunityIndex,
  searchCommunities,
  type CommunityEntry,
  type CommunityIndex,
  type KindFilter,
} from '@/lib/useCommunityIndex'
import { KIND_COLOR } from '../Map/community-kind'
import { RISK_KEY } from '../Map/community-risk'

export const SEARCH_INPUT_ID = 'community-search-input'
const MAX_RESULTS = 8

const FILTERS: Array<{ id: KindFilter; label: TKey }> = [
  { id: 'all', label: 'explore.filter.all' },
  { id: 'indigenous', label: 'explore.filter.indigenous' },
  { id: 'riverside', label: 'explore.filter.riverside' },
]

/** The magnifier of the explore mode: find a community by name, ethnic group, river or municipality. */
export function CommunitySearch() {
  const t = useT()
  const focusCommunity = useApp((s) => s.focusCommunity)
  const [index, setIndex] = useState<CommunityIndex | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<KindFilter>('all')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    let cancelled = false
    loadCommunityIndex()
      .then((i) => !cancelled && setIndex(i))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [])

  const searching = query.trim().length > 0 || filter !== 'all'
  const results = useMemo(
    () => (index && searching ? searchCommunities(index, query, filter, MAX_RESULTS) : []),
    [index, query, filter, searching]
  )
  const total = useMemo(
    () => (index && searching ? countMatches(index, query, filter) : 0),
    [index, query, filter, searching]
  )
  const counts = useMemo(() => {
    if (!index) return null
    const ti = index.entries.filter((e) => e.focus.kind === 'indigenous').length
    return { n: index.entries.length, ti, rib: index.entries.length - ti }
  }, [index])

  const showList = open && searching && index !== null
  const optionId = (i: number) => `${listId}-opt-${i}`

  const choose = (entry: CommunityEntry) => {
    focusCommunity(entry.focus)
    setQuery('')
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      const entry = results[active]
      if (showList && entry) {
        e.preventDefault()
        choose(entry)
      }
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      if (query) setQuery('')
      else setOpen(false)
    }
  }

  // Close the list when focus or a click lands outside the search card.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])

  return (
    <div
      ref={rootRef}
      className="pointer-events-auto glass w-[min(520px,calc(100vw-32px))] rounded-xl p-2.5"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
        {t('explore.searchLabel')}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={SEARCH_INPUT_ID}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results[active] ? optionId(active) : undefined}
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t('explore.searchPlaceholder')}
          className="h-11 w-full rounded-lg border border-border/70 bg-background/60 pl-9 pr-9 text-[15px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              document.getElementById(SEARCH_INPUT_ID)?.focus()
            }}
            className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
            aria-label={t('explore.clear')}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div role="group" aria-label={t('explore.filter')} className="mt-2 flex gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => {
              setFilter(f.id)
              setActive(0)
              setOpen(true)
            }}
            className={cn(
              'h-8 rounded-md border px-2.5 text-[13px] transition-colors',
              filter === f.id
                ? 'border-primary/50 bg-primary/15 text-foreground'
                : 'border-border/60 bg-background/40 text-muted-foreground hover:text-foreground'
            )}
          >
            {t(f.label)}
          </button>
        ))}
      </div>

      {showList ? (
        <div className="mt-2">
          {results.length > 0 ? (
            <ul id={listId} role="listbox" aria-label={t('explore.results')} className="grid gap-0.5">
              {results.map((entry, i) => (
                <li
                  key={`${entry.focus.kind}-${entry.focus.id}`}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  onPointerEnter={() => setActive(i)}
                  // Keep focus in the input so its blur does not close the list before the click lands.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(entry)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2',
                    i === active ? 'bg-secondary/80' : 'hover:bg-secondary/50'
                  )}
                >
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: KIND_COLOR[entry.focus.kind].fill }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-foreground">{entry.focus.name}</span>
                    <span className="block truncate text-[12px] text-muted-foreground">
                      {[t(entry.focus.kind === 'indigenous' ? 'community.indigenous' : 'community.riverside'), entry.detail]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  {entry.focus.props.risco && (
                    <span className="shrink-0 text-[12px] text-muted-foreground">
                      {t('community.fireRisk')}: {t(RISK_KEY[entry.focus.props.risco])}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p id={listId} role="status" className="px-1 py-2 text-[13px] text-muted-foreground">
              {t('explore.empty', { q: query.trim() })}
            </p>
          )}
          {total > results.length && (
            <p className="px-1 pt-1.5 text-[12px] text-muted-foreground">
              {t('explore.more', { shown: String(results.length), n: total.toLocaleString('pt-BR') })}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 px-1 text-[13px] leading-snug text-muted-foreground" aria-live="polite">
          {failed
            ? t('explore.loadError')
            : counts
            ? `${t('explore.count', {
                n: counts.n.toLocaleString('pt-BR'),
                ti: counts.ti.toLocaleString('pt-BR'),
                rib: counts.rib.toLocaleString('pt-BR'),
              })} ${t('explore.hint')}`
            : t('explore.loading')}
        </p>
      )}
    </div>
  )
}
