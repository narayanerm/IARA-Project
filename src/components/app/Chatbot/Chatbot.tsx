import { useEffect, useRef, useState } from 'react'
import { Send, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n, useT, type Lang } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { narrativeFor, SUGGESTIONS } from './intents'
import { useAssistant, type AssistantMessage } from '@/lib/agent/useAssistant'
import { actionLabel, agentText } from '@/lib/agent/labels'
import type { AgentAction } from '@/lib/agent/agent'
import { Capybara } from './Capybara'
import { PanelFlora, Toucan } from './PanelFlora'

type Message = AssistantMessage

/**
 * Chat view of the assistant. The conversation and the AI agent live in `useAssistant`, so this
 * component only renders it and forwards what the person types.
 */
export function Chatbot() {
  const t = useT()
  const lang = useI18n((s) => s.lang)
  const messages = useAssistant((s) => s.messages)
  const thinking = useAssistant((s) => s.thinking)
  const liveActions = useAssistant((s) => s.liveActions)
  const sendToAssistant = useAssistant((s) => s.send)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, thinking, liveActions, lang])

  const send = (raw: string) => {
    if (!raw.trim() || thinking) return
    sendToAssistant(raw)
    setInput('')
  }

  return (
    <div className="chat-glass relative flex h-full flex-col">
      <PanelFlora />
      {/* header */}
      <div className="relative z-[1] flex h-14 items-center gap-2 border-b border-white/10 px-3">
        <div className="capy-avatar h-9 w-9">
          <Capybara mood={thinking ? 'thinking' : 'idle'} />
        </div>
        <div className="flex-1 leading-tight">
          <div className="text-[13px] font-bold">{t('rp.chat')}</div>
        </div>
        <Toucan className="mr-1 h-[58px] w-[85px] self-end" />
      </div>

      {/* messages */}
      <div ref={scrollRef} className="relative z-[1] flex-1 overflow-y-auto px-3 py-3 space-y-3">
        <MessageBubble role="assistant" text={t('assistant.welcome')} />
        {messages.map((m) => (
          <div key={m.id}>
            <MessageBubble
              role={m.role}
              text={m.role === 'user' ? m.text : 'intent' in m ? narrativeFor(m.intent, lang) : m.text}
            />
            {'actions' in m && m.actions.length > 0 && <ActionTrail actions={m.actions} lang={lang} />}
          </div>
        ))}
        {thinking && <ThinkingBubble />}
        {thinking && liveActions.length > 0 && <ActionTrail actions={liveActions} lang={lang} />}
      </div>

      {/* suggestions */}
      {messages.length === 0 && (
        <div className="relative z-[1] px-3 pb-3 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(t(s))}
              className="glass-chip rounded-full px-2.5 py-1 text-[12px] font-mono text-foreground/80 hover:text-foreground transition-colors"
            >
              {t(s)}
            </button>
          ))}
        </div>
      )}

      {/* input */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        className="relative z-[1] border-t border-white/10 p-2 flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('assistant.placeholder')}
          className="glass-field flex-1 rounded-md px-2.5 h-9 text-sm placeholder:text-foreground/45 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/40"
        />
        <Button type="submit" size="icon" className="h-9 w-9" aria-label={t('ask.send')}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  )
}

function MessageBubble({ role, text }: { role: Message['role']; text: string }) {
  const isUser = role === 'user'
  return (
    <div className={cn('flex gap-2', isUser && 'flex-row-reverse')}>
      {isUser ? (
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-foreground/70 ring-1 ring-white/15">
          <User className="h-3 w-3" />
        </div>
      ) : (
        <div className="capy-avatar h-7 w-7 shrink-0">
          <Capybara />
        </div>
      )}
      <div
        className={cn(
          'px-3 py-2 text-[13px] leading-snug max-w-[82%] whitespace-pre-wrap',
          isUser ? 'glass-bubble is-user text-foreground' : 'glass-bubble is-capy text-foreground/95'
        )}
      >
        {renderMarkdownLite(text)}
      </div>
    </div>
  )
}

/** What the assistant changed on the site, shown under its reply. */
function ActionTrail({ actions, lang }: { actions: AgentAction[]; lang: Lang }) {
  return (
    <ul className="ml-9 mt-1 flex flex-wrap gap-1" aria-label={agentText('actions', lang)}>
      {actions.map((a, i) => (
        <li
          key={i}
          className={cn(
            'rounded border px-1.5 py-0.5 font-mono text-[10.5px]',
            a.ok ? 'border-white/15 bg-white/5 text-foreground/65' : 'border-destructive/40 text-destructive/80 line-through'
          )}
        >
          {actionLabel(a, lang)}
        </li>
      ))}
    </ul>
  )
}

function ThinkingBubble() {
  return (
    <div className="flex gap-2">
      <div className="capy-avatar h-7 w-7 shrink-0">
        <Capybara mood="thinking" />
      </div>
      <div className="glass-bubble is-capy px-3 py-2.5 flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block h-1.5 w-1.5 rounded-full bg-foreground/60 animate-pulse"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </div>
    </div>
  )
}

function renderMarkdownLite(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <span key={i}>{part}</span>
  })
}
