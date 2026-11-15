import { ExternalLink, Newspaper } from 'lucide-react'
import type { CaseNews as CaseNewsItem } from '@/data/cases'
import { useI18n } from '@/lib/i18n'

/** Ported from manaus-flood-case: news/reports grounding the data in human experience. */

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return d ? `${d}.${m}.${y}` : m ? `${m}.${y}` : y
}

const COPY = {
  pt: (n: number) => `${n} reportagem${n === 1 ? '' : 's'} e documento${n === 1 ? '' : 's'}`,
  en: (n: number) => `${n} article${n === 1 ? '' : 's'} and document${n === 1 ? '' : 's'}`,
}

export function CaseNews({ items }: { items: CaseNewsItem[] }) {
  const lang = useI18n((s) => s.lang)
  if (!items.length) return null
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date))
  const copy = COPY[lang] ?? COPY.pt
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        {copy(items.length)}
      </div>
      <ul className="space-y-2">
        {sorted.map((n) => (
          <li key={n.url}>
            <a
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-lg border border-border/60 bg-background/40 p-2.5 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                <Newspaper className="h-3 w-3 shrink-0" />
                <span className="truncate">{n.outlet}</span>
                <span className="ml-auto shrink-0">{fmtDate(n.date)}</span>
              </div>
              <div className="mt-1 text-[13px] font-semibold leading-snug group-hover:text-primary transition-colors">
                {n.title}
                <ExternalLink className="ml-1 inline h-3 w-3 align-baseline opacity-60" />
              </div>
              <div className="mt-0.5 text-[12px] text-foreground/80 leading-snug">{n.summary}</div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
