import { ExternalLink, MessageSquare } from 'lucide-react'
import type { CaseStudy } from '@/data/cases'
import { useUi } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { CASE_ICON, PAIN_ICON, SectionTitle, useTr } from './shared'

/** Who lives here, what happened and what hurts: the human side of the case. */
export function CaseStory({ c }: { c: CaseStudy }) {
  const t = useT()
  const tr = useTr()
  const ask = useUi((s) => s.ask)
  const Icon = CASE_ICON[c.id]

  return (
    <div className="space-y-5 p-4">
      <header>
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: c.color }}>
          <Icon className="h-4 w-4" />
          {tr(c.analysis)}
        </div>
        <h2 className="mt-2 text-[1.32rem] font-semibold leading-[1.18] tracking-[-0.015em] text-balance">
          {tr(c.headline)}
        </h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground">{tr(c.place)}</p>
      </header>

      <div
        className="rounded-xl border p-3.5"
        style={{
          borderColor: `color-mix(in srgb, ${c.color} 45%, transparent)`,
          background: `color-mix(in srgb, ${c.color} 11%, transparent)`,
        }}
      >
        <div className="text-[2.35rem] font-semibold leading-none tracking-[-0.03em] tabular-nums" style={{ color: c.color }}>
          {c.hero.value}
        </div>
        <p className="mt-2 text-[13.5px] leading-snug text-foreground/90">{tr(c.hero.label)}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{c.hero.source}</p>
      </div>

      <dl className="grid grid-cols-3 gap-2">
        {c.stats.map((s) => (
          <div key={s.value} className="rounded-lg border border-border/70 bg-background/40 p-2">
            <dd className="text-[15px] font-semibold leading-tight tabular-nums">{s.value}</dd>
            <dt className="mt-1 text-[11px] leading-snug text-muted-foreground">{tr(s.label)}</dt>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">{s.source}</div>
          </div>
        ))}
      </dl>

      <section className="space-y-2">
        <SectionTitle>{t('case.story')}</SectionTitle>
        <div className="space-y-2.5 text-[13.5px] leading-relaxed text-foreground/90">
          {c.story.map((p, i) => (
            <p key={i}>{tr(p)}</p>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <SectionTitle>{t('case.pains')}</SectionTitle>
        <ul className="grid gap-2">
          {c.pains.map((p) => {
            const PIcon = PAIN_ICON[p.icon]
            return (
              <li key={p.title.pt} className="flex gap-3 rounded-lg border border-border/70 bg-background/40 p-2.5">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                  style={{ color: c.color, background: `color-mix(in srgb, ${c.color} 14%, transparent)` }}
                >
                  <PIcon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold leading-tight">{tr(p.title)}</div>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{tr(p.body)}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="space-y-2">
        <SectionTitle>{t('case.ask')}</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {c.questions.map((q) => (
            <button
              key={q.pt}
              type="button"
              onClick={() => ask(tr(q))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/40 px-2.5 py-1.5 text-left text-[12.5px] transition-colors hover:bg-secondary"
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {tr(q)}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <SectionTitle>{t('case.sources')}</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {c.sources.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2.5 py-1 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {s.label}
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
