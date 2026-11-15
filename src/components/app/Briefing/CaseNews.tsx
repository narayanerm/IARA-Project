import { ExternalLink, Newspaper } from 'lucide-react'
import type { CaseNews as CaseNewsItem } from '@/data/cases'
import { useT } from '@/lib/i18n'

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return d ? `${d}.${m}.${y}` : m ? `${m}.${y}` : y
}

/** News reports and official documents on how the problem reaches the community, newest first. */
export function CaseNews({ items }: { items: CaseNewsItem[] }) {
  const t = useT()
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 bg-background/30 p-4 text-[13px] text-muted-foreground">
        {t('case.news.empty')}
      </div>
    )
  }
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        {t('case.news.count', { n: String(items.length) })}
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
