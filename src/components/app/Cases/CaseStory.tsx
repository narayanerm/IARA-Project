import { ExternalLink, MessageSquare } from 'lucide-react'
import type { CaseStudy } from '@/data/cases'
import { useUi } from '@/lib/store'
import { useI18n, useT } from '@/lib/i18n'
import { useIbgePopulation } from '@/lib/useCaseOutline'
import { PAIN_ICON, Refs, SectionTitle, makeOnce, useTr } from './shared'
import { CaseNews } from '../Briefing/CaseNews'

/** Who lives here, what happened and what hurts: the human side of the case. */
export function CaseStory({ c }: { c: CaseStudy }) {
  const t = useT()
  const tr = useTr()
  const locale = useI18n((s) => (s.lang === 'en' ? 'en-US' : 'pt-BR'))
  const ask = useUi((s) => s.ask)
  const livePop = useIbgePopulation(c.ibgeCode)

  // The first stat of a municipal case is its census population, read live from IBGE when it answers.
  // Each source is linked the first time it appears; later mentions only name it.
  const once = makeOnce()

  const stats = c.stats.map((s, i) =>
    i === 0 && c.ibgeCode && livePop
      ? { ...s, value: livePop.toLocaleString(locale), source: t('case.ibgeLive') }
      : s
  )

  return (
    <div className="space-y-6 px-5 py-5">
      <p className="text-[16px] font-normal leading-snug text-balance [font-variation-settings:'wdth'_104]">{tr(c.headline)}</p>

      <div className="border-l-2 py-1 pl-4" style={{ borderColor: c.color }}>
        <div className="num-display text-[2.9rem] leading-none tabular-nums" style={{ color: c.color }}>
          {c.hero.value}
        </div>
        <p className="mt-2 text-[13.5px] leading-snug text-foreground/90">{tr(c.hero.label)}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{c.hero.source}</p>
        <Refs refs={once(c.hero.refs)} className="mt-0.5" />
      </div>

      <dl className="case-details">
        {c.meta.map((m) => (
          <div key={m.label.pt}>
            <dt>{tr(m.label)}</dt>
            <dd>
              {tr(m.value)}
              <Refs refs={once(m.refs)} className="mt-0.5" />
            </dd>
          </div>
        ))}
        {stats.map((s) => (
          <div key={s.label.pt}>
            <dt>{tr(s.label)}</dt>
            <dd>
              <span className="font-semibold tabular-nums">{s.value}</span>
              <span className="ml-1.5 text-[11px] text-muted-foreground">{s.source}</span>
              <Refs refs={once(s.refs)} className="mt-0.5" />
            </dd>
          </div>
        ))}
      </dl>

      <section className="space-y-2">
        <SectionTitle>{t('case.story')}</SectionTitle>
        <div className="space-y-2.5 text-[13.5px] leading-relaxed text-foreground/90">
          {c.story.map((p, i) => (
            <div key={i}>
              <p>{tr(p)}</p>
              <Refs refs={once(p.refs)} className="mt-1" />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <SectionTitle>{t('case.pains')}</SectionTitle>
        <ul className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-2 md:grid-cols-1">
          {c.pains.map((p) => {
            const PIcon = PAIN_ICON[p.icon]
            return (
              <li key={p.title.pt} className="flex gap-3 border-t border-border/80 pt-3">
                <span
                  className="mt-px shrink-0"
                  style={{ color: c.color }}
                >
                  <PIcon className="h-[18px] w-[18px]" strokeWidth={1.6} />
                </span>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold leading-tight">{tr(p.title)}</div>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{tr(p.body)}</p>
                  <Refs refs={once(p.refs)} className="mt-1 opacity-90" />
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
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 py-1.5 text-left text-[12.5px] transition-colors hover:bg-secondary"
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {tr(q)}
            </button>
          ))}
        </div>
      </section>

      {c.news && c.news.length > 0 && (
        <section className="space-y-2">
          <SectionTitle>{locale === 'en-US' ? 'In the press' : 'Na imprensa'}</SectionTitle>
          <CaseNews items={c.news} />
        </section>
      )}

      <section className="space-y-2">
        <SectionTitle>{t('case.sources')}</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {c.sources
            .filter((s) => !once.seen.has(s.url))
            .map((s) => (
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
