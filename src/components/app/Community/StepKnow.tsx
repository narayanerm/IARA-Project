import { BookOpen } from 'lucide-react'
import { useApp } from '@/lib/store'
import { REGIONS } from '@/lib/regions'
import { BRIEFINGS } from '@/data/phenomena-briefing'
import { bboxesIntersect } from '@/lib/polygon-bbox'
import type { Focus } from '@/lib/community'
import { useT } from '@/lib/i18n'
import { RiversideFacts, TiFacts } from '../Map/CommunityLayers'

/** Conhecer: who lives here and where, plus the curated case when the area overlaps one. */
export function StepKnow({ focus }: { focus: Focus }) {
  const t = useT()
  const openCase = useApp((s) => s.openCase)
  const caseRegion = useApp((s) => s.caseRegion)
  const cases = REGIONS.filter((r) => bboxesIntersect(focus.bbox, r.bbox))

  return (
    <div className="space-y-2.5">
      {focus.kind === 'indigenous' ? <TiFacts props={focus.props} /> : <RiversideFacts props={focus.props} />}

      {cases.map((r) => {
        const briefing = BRIEFINGS[r.id]
        return (
          <section
            key={r.id}
            aria-labelledby={`case-${r.id}`}
            className="rounded-lg border border-primary/40 bg-primary/10 p-3"
          >
            <div className="text-[11px] font-mono uppercase tracking-wider text-primary">
              {t('community.documentedCase')}
            </div>
            <h3 id={`case-${r.id}`} className="mt-1 text-[14px] font-semibold text-foreground">
              {briefing.title}
            </h3>
            <p className="mt-0.5 text-[13px] leading-snug text-foreground/75">{briefing.tagline}</p>
            <button
              type="button"
              onClick={() => openCase(r.id)}
              disabled={caseRegion === r.id}
              className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-md border border-primary/50 bg-primary/15 px-3 text-[13px] font-medium text-primary transition-colors hover:bg-primary/25 disabled:opacity-60"
            >
              <BookOpen className="h-4 w-4" />
              {t('community.openCase')} · {briefing.period}
            </button>
          </section>
        )
      })}
    </div>
  )
}
