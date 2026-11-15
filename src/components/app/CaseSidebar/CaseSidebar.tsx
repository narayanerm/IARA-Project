import { useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Quote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CASES } from '@/data/cases'
import { CaseNews } from '../Briefing/CaseNews'
import { useApp, useUi } from '@/lib/store'
import { useT, type TKey } from '@/lib/i18n'

/**
 * Left panel of the MVP: everything about the community of the chosen case
 * (headline figures, a resident's account, local news). It can be collapsed to a thin rail.
 */
export function CaseSidebar() {
  const t = useT()
  const aoiActive = useApp((s) => s.aoiActive)
  const activeRegion = useApp((s) => s.activeRegion)
  const setCaseSelectOpen = useUi((s) => s.setCaseSelectOpen)
  const c = CASES[activeRegion]

  const [open, setOpen] = useState(true)

  return (
    <aside
      className={cn(
        'relative z-10 flex h-full shrink-0 flex-col border-r border-border/60 bg-card/40 backdrop-blur-xl transition-[width] duration-200 motion-reduce:transition-none',
        open ? 'w-[320px] 2xl:w-[360px]' : 'w-12'
      )}
    >
      <div className={cn('flex h-12 shrink-0 items-center border-b border-border/60 px-1.5', open ? 'justify-end' : 'justify-center')}>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => setOpen(!open)}
          aria-label={open ? t('caseSidebar.collapse') : t('caseSidebar.expand')}
          aria-expanded={open}
          title={open ? t('caseSidebar.collapse') : t('caseSidebar.expand')}
        >
          {open ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>

      {!open ? null : !aoiActive ? (
        <div className="p-4 text-[13px] text-muted-foreground">
          {t('caseSidebar.none')}{' '}
          <button className="text-primary underline-offset-4 hover:underline" onClick={() => setCaseSelectOpen(true)}>
            {t('caseSelect.open')}
          </button>
        </div>
      ) : (
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <header>
            <div className="text-[11px] font-mono uppercase tracking-wider text-primary">
              {t(`region.${activeRegion}.phen` as TKey)}
            </div>
            <h2 className="mt-1 text-xl font-semibold leading-tight tracking-[-0.02em]">{c.community}</h2>
            <div className="text-[12px] font-mono text-muted-foreground">{c.place}</div>
            {c.intro && <p className="mt-2 text-[13px] leading-relaxed text-foreground/85">{c.intro}</p>}
          </header>

          {c.story && (
            <a
              href={c.story.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg border border-primary/40 bg-primary/10 p-3 hover:bg-primary/15"
            >
              <Quote className="h-4 w-4 text-primary" />
              <p className="mt-1 text-[15px] font-semibold leading-snug">{c.story.text}</p>
              <div className="mt-1.5 text-[12px] text-foreground/80">{c.story.who}</div>
              <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {c.story.source}
                <ExternalLink className="h-2.5 w-2.5" />
              </div>
            </a>
          )}

          {c.facts.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {c.facts.map((f) => (
                <a
                  key={f.label}
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-border/60 bg-background/40 p-2.5 hover:border-primary/40"
                >
                  <div className="text-lg font-semibold leading-tight text-primary">{f.value}</div>
                  <div className="mt-0.5 text-[12px] leading-snug text-foreground/85">{f.label}</div>
                  <div className="mt-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/80">
                    {f.source}
                  </div>
                </a>
              ))}
            </div>
          )}

          <section>
            <h3 className="mb-2 text-[13px] font-semibold">{t('caseSidebar.news')}</h3>
            <CaseNews items={c.news} />
          </section>
        </div>
      )}
    </aside>
  )
}
