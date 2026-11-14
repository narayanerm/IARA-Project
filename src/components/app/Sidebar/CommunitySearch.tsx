import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FilterKind } from './types'

export function CommunitySearch({
  query,
  onQueryChange,
  filter,
  onFilterChange,
}: {
  query: string
  onQueryChange: (q: string) => void
  filter: FilterKind
  onFilterChange: (f: FilterKind) => void
}) {
  return (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Buscar TI, etnia, município, rio…"
          className="w-full rounded-md border border-border/60 bg-background/40 pl-7 pr-7 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/40"
        />
        {query && (
          <button
            onClick={() => onQueryChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpar busca"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex gap-1">
        {(['all', 'ti', 'riverside'] as FilterKind[]).map((k) => (
          <button
            key={k}
            onClick={() => onFilterChange(k)}
            className={cn(
              'flex-1 rounded-md border px-2 py-1 text-[11px] font-mono transition-colors',
              filter === k
                ? 'border-primary/40 bg-primary/15 text-primary'
                : 'border-border/60 bg-background/40 text-muted-foreground hover:text-foreground'
            )}
          >
            {k === 'all' ? 'todas' : k === 'ti' ? 'TI (FUNAI)' : 'Ribeirinhas'}
          </button>
        ))}
      </div>
    </>
  )
}
