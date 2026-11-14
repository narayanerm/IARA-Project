import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Flame, MessageSquare } from 'lucide-react'
import { useApp } from '@/lib/store'
import { STEPS, type Focus, type Step } from '@/lib/community'
import { useT, type TKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CommunityPin } from '../Map/CommunityPin'
import { RISK_KEY, RISK_TONE } from '../Map/community-risk'
import { Chatbot } from '../Chatbot/Chatbot'
import { StepKnow } from './StepKnow'
import { StepWatch } from './StepWatch'
import { StepFollow } from './StepFollow'

const STEP_LABEL: Record<Step, TKey> = {
  know: 'community.step.know',
  watch: 'community.step.watch',
  follow: 'community.step.follow',
}

const tabId = (s: Step) => `community-tab-${s}`
const panelId = (s: Step) => `community-panel-${s}`

function subtitle(focus: Focus, t: ReturnType<typeof useT>): string {
  if (focus.kind === 'indigenous') return [t('community.indigenous'), focus.props.fase].filter(Boolean).join(' · ')
  return [t('community.riverside'), focus.props.municipio].filter(Boolean).join(' · ')
}

/**
 * The community mode: one community, three steps (know, watch, follow). Replaces every other panel.
 * Rendered with `key={focusKey(focus)}`, so switching community starts it fresh.
 */
export function CommunityPanel({ focus }: { focus: Focus }) {
  const t = useT()
  const step = useApp((s) => s.step)
  const setStep = useApp((s) => s.setStep)
  const clearFocus = useApp((s) => s.clearFocus)
  const [chatOpen, setChatOpen] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const tabRefs = useRef<Partial<Record<Step, HTMLButtonElement | null>>>({})

  // Entering a community moves keyboard focus to its name.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  const onTabKey = (e: React.KeyboardEvent) => {
    const i = STEPS.indexOf(step)
    const next =
      e.key === 'ArrowRight' ? STEPS[(i + 1) % STEPS.length]
      : e.key === 'ArrowLeft' ? STEPS[(i - 1 + STEPS.length) % STEPS.length]
      : e.key === 'Home' ? STEPS[0]
      : e.key === 'End' ? STEPS[STEPS.length - 1]
      : null
    if (!next) return
    e.preventDefault()
    setStep(next)
    tabRefs.current[next]?.focus()
  }

  const risk = focus.props.risco

  return (
    <aside
      id="community-sheet"
      aria-labelledby="community-name"
      className={cn(
        'z-20 flex flex-col border-border/60 bg-card shadow-2xl',
        'md:relative md:h-full md:w-[380px] md:shrink-0 md:border-r',
        'max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[55svh] max-md:rounded-t-2xl max-md:border-t'
      )}
    >
      <header className="border-b border-border/60 px-3 pb-3 pt-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={clearFocus}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('community.back')}
          </button>
          <button
            type="button"
            onClick={() => setChatOpen((v) => !v)}
            aria-pressed={chatOpen}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors',
              chatOpen
                ? 'border-primary/50 bg-primary/15 text-primary'
                : 'border-border/60 text-muted-foreground hover:text-foreground'
            )}
          >
            <MessageSquare className="h-4 w-4" />
            {t('community.chat')}
          </button>
        </div>

        <div className="mt-2.5 flex items-start gap-2.5">
          <CommunityPin kind={focus.kind} size={30} />
          <div className="min-w-0 flex-1">
            <h2
              id="community-name"
              ref={headingRef}
              tabIndex={-1}
              className="text-[17px] font-semibold leading-snug text-foreground focus:outline-none"
            >
              {focus.name}
            </h2>
            <p className="mt-0.5 text-[13px] text-foreground/70">{subtitle(focus, t)}</p>
          </div>
        </div>
        {risk && (
          <span
            className={cn(
              'mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium',
              RISK_TONE[risk]
            )}
          >
            <Flame className="h-3.5 w-3.5" />
            {t('community.fireRisk')}: {t(RISK_KEY[risk])}
          </span>
        )}
      </header>

      {chatOpen ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <button
            type="button"
            onClick={() => setChatOpen(false)}
            className="flex h-9 items-center gap-1.5 border-b border-border/60 px-3 text-[13px] text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('community.chatBack')}
          </button>
          <div className="min-h-[320px] flex-1">
            <Chatbot />
          </div>
        </div>
      ) : (
        <>
          <div
            role="tablist"
            aria-label={t('community.steps')}
            onKeyDown={onTabKey}
            className="grid grid-cols-3 gap-1 border-b border-border/60 p-2"
          >
            {STEPS.map((s, i) => (
              <button
                key={s}
                ref={(el) => {
                  tabRefs.current[s] = el
                }}
                id={tabId(s)}
                type="button"
                role="tab"
                aria-selected={step === s}
                aria-controls={panelId(s)}
                tabIndex={step === s ? 0 : -1}
                onClick={() => setStep(s)}
                className={cn(
                  'flex h-10 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  step === s
                    ? 'bg-primary/15 text-foreground ring-1 ring-primary/40'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'grid h-5 w-5 place-items-center rounded-full font-mono text-[11px]',
                    step === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                  )}
                >
                  {i + 1}
                </span>
                {t(STEP_LABEL[s])}
              </button>
            ))}
          </div>

          <div
            id={panelId(step)}
            role="tabpanel"
            aria-labelledby={tabId(step)}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3"
          >
            <p className="mb-2.5 text-[13px] text-muted-foreground">{t(`${STEP_LABEL[step]}.hint` as TKey)}</p>
            {step === 'know' && <StepKnow focus={focus} />}
            {step === 'watch' && <StepWatch focus={focus} />}
            {step === 'follow' && <StepFollow focus={focus} />}
          </div>
        </>
      )}
    </aside>
  )
}
