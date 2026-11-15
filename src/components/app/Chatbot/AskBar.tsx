import { useState } from 'react'
import { ArrowUp, X } from 'lucide-react'
import { useUi } from '@/lib/store'
import { useI18n, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useAssistant } from '@/lib/agent/useAssistant'
import { narrativeFor, SUGGESTIONS } from './intents'
import { AskBarLeaves } from './AskBarLeaves'
import { Capybara } from './Capybara'

/**
 * Floating ask bar at the bottom of the map. Enter (or the send button) opens the
 * Assistant tab on the right and hands it the question; suggestion chips show only
 * while the field is focused and empty. The capybara in the leaves is the assistant:
 * clicking her opens or closes the panel, and while it is open she repeats the latest
 * answer in a speech balloon.
 */
export function AskBar({ className, reveal = false }: { className?: string; reveal?: boolean }) {
  const t = useT()
  const lang = useI18n((s) => s.lang)
  const ask = useUi((s) => s.ask)
  const rightOpen = useUi((s) => s.rightOpen)
  const setRightOpen = useUi((s) => s.setRightOpen)
  const openRight = useUi((s) => s.openRight)
  const messages = useAssistant((s) => s.messages)
  const thinking = useAssistant((s) => s.thinking)
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState<string | null>(null)

  const submit = (q: string) => {
    const question = q.trim()
    if (!question) return
    ask(question)
    setText('')
    // let go of the field so the capybara's balloon can take the place of the suggestions
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }

  const last = messages[messages.length - 1]
  const reply = last && last.role === 'assistant' ? last : null
  const replyText = reply ? ('intent' in reply ? narrativeFor(reply.intent, lang) : reply.text) : t('capy.hi')
  const balloonId = thinking ? 'thinking' : reply ? reply.id : 'hi'
  const suggesting = focused && !text
  const showBalloon = rightOpen && !suggesting && dismissed !== balloonId

  return (
    <div className={cn('flex w-full max-w-[640px] flex-col items-stretch gap-2', reveal && 'ask-reveal', className)}>
      {suggesting && (
        <div className="flex flex-wrap justify-center gap-1.5" role="group" aria-label={t('ask.suggestions')}>
          {SUGGESTIONS.slice(0, 3).map((s) => (
            <button
              key={s}
              type="button"
              // mousedown keeps the field from blurring before the click lands
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => submit(t(s))}
              className="rounded-md border border-border bg-card/70 px-2.5 py-1 text-[12px] text-foreground backdrop-blur-sm transition-colors hover:bg-secondary"
            >
              {t(s)}
            </button>
          ))}
        </div>
      )}
      {showBalloon && (
        <div key={balloonId} className="capy-balloon" role="status" aria-live="polite">
          {thinking ? (
            <span className="capy-dots" aria-label={t('capy.thinking')}>
              <i />
              <i />
              <i />
            </span>
          ) : (
            <>
              <p className="capy-balloon-text">{plain(replyText)}</p>
              <button type="button" className="capy-balloon-close" onClick={() => setDismissed(balloonId)} aria-label={t('capy.dismiss')} title={t('capy.dismiss')}>
                <X className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      )}
      {reveal && <AskBarLeaves />}
      <button
        type="button"
        className={cn('ask-capy', reveal && 'is-reveal')}
        onClick={() => (rightOpen ? setRightOpen(false) : openRight('chat'))}
        aria-label={t('ask.label')}
        aria-expanded={rightOpen}
        title={t('rp.chat')}
      >
        <Capybara mood={thinking ? 'thinking' : showBalloon && reply ? 'talking' : 'idle'} />
        {/* two leaves in front, so she sits in the tuft instead of on top of it */}
        <svg className="ask-capy-front" viewBox="0 0 66 20" aria-hidden="true">
          <g transform="translate(20 17) rotate(-158) scale(1.15)">
            <path d="M0 0C3.2-4.4 9.6-6.2 15.6-4.9C13.9 1.2 8.6 4.9 3.1 4.4C1.8 4.3.8 2.8 0 0Z" fill="var(--leaf-2, #79c97a)" />
            <path d="M0.6 0.2C5 -1 9.5 -2.2 14.4 -4.4" stroke="rgb(0 0 0 / 0.28)" strokeWidth="0.6" fill="none" />
          </g>
          <g transform="translate(16 18) rotate(-22) scale(0.95)">
            <path d="M0 0C3.2-4.4 9.6-6.2 15.6-4.9C13.9 1.2 8.6 4.9 3.1 4.4C1.8 4.3.8 2.8 0 0Z" fill="var(--leaf-1, #3f9a5e)" />
            <path d="M0.6 0.2C5 -1 9.5 -2.2 14.4 -4.4" stroke="rgb(0 0 0 / 0.28)" strokeWidth="0.6" fill="none" />
          </g>
        </svg>
      </button>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit(text)
        }}
        className={cn('flex h-11 items-center gap-2 rounded-lg border border-border bg-card/70 pl-10 pr-1.5 backdrop-blur-sm focus-within:border-foreground/30', reveal && 'ask-unroll')}
      >
        <label htmlFor="ask-bar-input" className="sr-only">
          {t('ask.label')}
        </label>
        <input
          id="ask-bar-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={t('ask.placeholder')}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label={t('ask.send')}
          title={t('ask.send')}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:bg-secondary disabled:text-muted-foreground"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}

// The balloon shows plain text: drop the bold markers the chat renders.
const plain = (s: string) => s.replace(/\*\*/g, '')
