import { useState } from 'react'
import { ArrowUp, MessageSquare } from 'lucide-react'
import { useUi } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { markExplore } from '@/lib/story'
import { cn } from '@/lib/utils'
import { SUGGESTIONS } from './intents'

/**
 * Floating ask bar at the bottom of the map. Enter (or the send button) opens the
 * Assistant tab on the right and hands it the question; suggestion chips show only
 * while the field is focused and empty.
 */
export function AskBar({ className }: { className?: string }) {
  const t = useT()
  const ask = useUi((s) => s.ask)
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)

  const submit = (q: string) => {
    const question = q.trim()
    if (!question) return
    ask(question)
    markExplore()
    setText('')
  }

  return (
    <div className={cn('flex w-full max-w-[640px] flex-col items-stretch gap-2', className)}>
      {focused && !text && (
        <div className="flex flex-wrap justify-center gap-1.5" role="group" aria-label={t('ask.suggestions')}>
          {SUGGESTIONS.slice(0, 3).map((s) => (
            <button
              key={s}
              type="button"
              // mousedown keeps the field from blurring before the click lands
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => submit(s)}
              className="rounded-md border border-border bg-card/70 px-2.5 py-1 text-[12px] text-foreground backdrop-blur-sm transition-colors hover:bg-raised"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit(text)
        }}
        className="flex h-11 items-center gap-2 rounded-lg border border-border bg-card/70 pl-3 pr-1.5 backdrop-blur-sm focus-within:border-foreground/30"
      >
        <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
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
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:bg-raised disabled:text-muted-foreground"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}
