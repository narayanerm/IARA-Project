import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Send, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApp, useUi } from '@/lib/store'
import { cn } from '@/lib/utils'
import { routeIntent, narrativeFor, SUGGESTIONS, type Intent } from './intents'

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  intent?: Intent
}

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  text:
    'Hi, I am the **IARA** assistant. Tell me a phenomenon or a place and I will zoom the map and pull up its time series.\n\nTry one of the suggestions below.',
}

export function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const setActiveRegion = useApp((s) => s.setActiveRegion)
  const setTimeIndex = useApp((s) => s.setTimeIndex)
  const toggleNasaOverlay = useApp((s) => s.toggleNasaOverlay)
  const toggleTrueColorOverlay = useApp((s) => s.toggleTrueColorOverlay)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, thinking])

  const send = (raw: string) => {
    const text = raw.trim()
    if (!text) return
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text }
    const intent = routeIntent(text)
    setMessages((m) => [...m, userMsg])
    setInput('')
    setThinking(true)

    window.setTimeout(() => {
      applyIntentSideEffects(intent)
      const reply: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: narrativeFor(intent),
        intent,
      }
      setMessages((m) => [...m, reply])
      setThinking(false)
    }, 600)
  }

  // A question typed in the floating ask bar arrives through the UI store.
  const askQueue = useUi((s) => s.askQueue)
  const clearAsk = useUi((s) => s.clearAsk)
  const sendRef = useRef(send)
  useEffect(() => {
    sendRef.current = send
  })
  // ts of the last question taken, so a double-run effect (StrictMode) never sends it twice
  const takenRef = useRef(0)
  useEffect(() => {
    if (!askQueue || askQueue.ts === takenRef.current) return
    takenRef.current = askQueue.ts
    clearAsk()
    sendRef.current(askQueue.text)
  }, [askQueue, clearAsk])

  const applyIntentSideEffects = (intent: Intent) => {
    switch (intent.kind) {
      case 'focus':
        setActiveRegion(intent.region)
        break
      case 'timeline':
        if (intent.action === 'start') setTimeIndex(0)
        if (intent.action === 'end') setTimeIndex(23)
        if (intent.action === 'play') {
          // slide through frames 0 → 23
          let i = 0
          const int = window.setInterval(() => {
            setTimeIndex(i)
            i += 1
            if (i > 23) window.clearInterval(int)
          }, 180)
        }
        break
      case 'layer':
        if (intent.action === 'toggle-nasa') toggleNasaOverlay()
        if (intent.action === 'toggle-truecolor') toggleTrueColorOverlay()
        break
      default:
        break
    }
  }

  return (
    <div className="flex h-full flex-col bg-card">
      {/* header */}
      <div className="flex h-12 items-center gap-2 border-b border-border px-3">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-raised">
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="flex-1 leading-tight">
          <div className="text-xs font-semibold">IARA assistant</div>
          <div className="text-[13px] text-muted-foreground">
            Questions about the three study regions
          </div>
        </div>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.map((m) => (
          <MessageBubble key={m.id} msg={m} />
        ))}
        {thinking && <ThinkingBubble />}
      </div>

      {/* suggestions */}
      {messages.length <= 1 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-md border border-border bg-transparent px-2.5 py-1 text-[12px] text-muted-foreground hover:text-foreground hover:bg-raised transition-colors"
            >
              {s}
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
        className="border-t border-border p-2 flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about mining, floods, drought…"
          className="flex-1 bg-transparent border border-border rounded-md px-2.5 h-9 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/40"
        />
        <Button type="submit" size="icon" className="h-9 w-9" aria-label="Send">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  )
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div className={cn('flex gap-2', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'grid h-6 w-6 shrink-0 place-items-center rounded-md ring-1',
          isUser
            ? 'bg-muted ring-border text-muted-foreground'
            : 'bg-raised ring-border text-foreground'
        )}
      >
        {isUser ? <User className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
      </div>
      <div
        className={cn(
          'rounded-lg px-3 py-2 text-[13px] leading-snug max-w-[82%] whitespace-pre-wrap',
          isUser
            ? 'bg-raised text-foreground border border-transparent'
            : 'bg-transparent text-foreground/90 border border-border'
        )}
      >
        {renderMarkdownLite(msg.text)}
      </div>
    </div>
  )
}

function ThinkingBubble() {
  return (
    <div className="pl-8 text-[12px] text-muted-foreground">Looking that up…</div>
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
