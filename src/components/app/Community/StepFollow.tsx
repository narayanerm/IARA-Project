import { useEffect, useState } from 'react'
import { Check, Link2 } from 'lucide-react'
import { useApp } from '@/lib/store'
import { focusKey, type Focus } from '@/lib/community'
import { useNeighbours } from '@/lib/useCommunityIndex'
import { buildPermalink } from '@/lib/url-state'
import { useT } from '@/lib/i18n'
import { KIND_COLOR } from '../Map/community-kind'
import { RISK_KEY } from '../Map/community-risk'

/** Acompanhar: the closest communities (one click away) and a link that reopens this exact view. */
export function StepFollow({ focus }: { focus: Focus }) {
  const t = useT()
  const focusCommunity = useApp((s) => s.focusCommunity)
  const neighbours = useNeighbours(focus)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 2500)
    return () => window.clearTimeout(id)
  }, [copied])

  const copyLink = () => {
    const url = buildPermalink({ c: focusKey(focus), step: 'follow' })
    navigator.clipboard
      ?.writeText(url)
      .then(() => setCopied(true))
      .catch(() => window.prompt(t('community.share'), url))
  }

  return (
    <div className="space-y-3">
      <section aria-labelledby="follow-neighbours" className="rounded-lg border border-border/60 bg-background/40 p-3">
        <h3 id="follow-neighbours" className="text-[14px] font-semibold text-foreground">
          {t('community.neighbours')}
        </h3>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{t('community.neighboursHint')}</p>
        <ul className="mt-2 grid gap-1">
          {neighbours.map(({ entry, km }) => (
            <li key={focusKey(entry.focus)}>
              <button
                type="button"
                onClick={() => focusCommunity(entry.focus)}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: KIND_COLOR[entry.focus.kind].fill }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-foreground">{entry.focus.name}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    {[
                      t(entry.focus.kind === 'indigenous' ? 'community.indigenous' : 'community.riverside'),
                      entry.focus.props.risco
                        ? `${t('community.fireRisk')}: ${t(RISK_KEY[entry.focus.props.risco])}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[12px] text-muted-foreground">
                  {t('community.distance', { km: km < 10 ? km.toFixed(1) : String(Math.round(km)) })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-border/60 bg-background/40 p-3">
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-primary/50 bg-primary/15 px-3 text-[13px] font-medium text-primary transition-colors hover:bg-primary/25"
        >
          {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
          {t('community.share')}
        </button>
        <p className="mt-1.5 text-[12px] text-muted-foreground" aria-live="polite">
          {copied ? t('community.shareDone') : t('community.shareHint')}
        </p>
      </section>
    </div>
  )
}
