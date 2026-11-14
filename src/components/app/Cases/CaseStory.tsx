import { ExternalLink, MessageSquare } from 'lucide-react'
import type { CaseStudy } from '@/data/cases'
import { useUi } from '@/lib/store'
import { useI18n, useT } from '@/lib/i18n'
import { useIbgePopulation } from '@/lib/useCaseOutline'
import { PAIN_ICON, SectionTitle, useTr } from './shared'

/** Who lives here, what happened and what hurts: the human side of the case. */
export function CaseStory({ c }: { c: CaseStudy }) {
  const t = useT()
  const tr = useTr()
  const locale = useI18n((s) => (s.lang === 'en' ? 'en-US' : 'pt-BR'))
  const ask = useUi((s) => s.ask)
  const livePop = useIbgePopulation(c.ibgeCode)

  // The first stat of a municipal case is its census population, read live from IBGE when it answers.
  const stats = c.stats.map((s, i) =>
    i === 0 && c.ibgeCode && livePop
      ? { ...s, value: livePop.toLocaleString(locale), source: t('case.ibgeLive') }
      : s
  )

  return (
    <div className="space-y-6 p-4">
      <p className="text-[15px] font-semibold leading-snug text-balance">{tr(c.headline)}</p>

      <div
        className="rounded-2xl border p-4"
        style={{
          borderColor: `color-mix(in srgb, ${c.color} 45%, transparent)`,
          background: `color-mix(in srgb, ${c.color} 10%, transparent)`,
        }}
      >
        <div className="text-[2.6rem] font-bold leading-none tracking-[-0.035em] tabular-nums" style={{ color: c.color }}>
          {c.hero.value}
        </div>
        <p className="mt-2 text-[13.5px] leading-snug text-foreground/90">{tr(c.hero.label)}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{c.hero.source}</p>
      </div>

      <dl className="case-details">
        {c.meta.map((m) => (
          <div key={m.label.pt}>
            <dt>{tr(m.label)}</dt>
            <dd>{tr(m.value)}</dd>
          </div>
        ))}
        {stats.map((s) => (
          <div key={s.label.pt}>
            <dt>{tr(s.label)}</dt>
            <dd>
              <span className="font-semibold tabular-nums">{s.value}</span>
              <span className="ml-1.5 text-[11px] text-muted-foreground">{s.source}</span>
            </dd>
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
        <ul className="grid grid-cols-1 gap-2 min-[440px]:grid-cols-2 md:grid-cols-1">
          {c.pains.map((p) => {
            const PIcon = PAIN_ICON[p.icon]
            return (
              <li key={p.title.pt} className="flex gap-3 rounded-xl border border-border/70 bg-background/40 p-2.5">
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
              key={s.url + s.label}
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
