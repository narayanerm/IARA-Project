import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles, User } from 'lucide-react'
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
    'Oi. Sou o assistente do **IARA**. Me diz um fenômeno ou lugar e eu dou zoom no mapa + puxo a série temporal.\n\nTente uma das sugestões abaixo.',
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
  const setFocusedTi = useApp((s) => s.setFocusedTi)
  const requestFlyTo = useApp((s) => s.requestFlyTo)
  const setActiveLayer = useApp((s) => s.setActiveLayer)
  const setNisarVisible = useApp((s) => s.setNisarVisible)
  const setNisarOpacity = useApp((s) => s.setNisarOpacity)

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
      case 'focus-ti':
        setFocusedTi(intent.tiName)
        requestFlyTo(intent.center, intent.zoom)
        break
      case 'timeline':
        if (intent.action === 'start') setTimeIndex(0)
        if (intent.action === 'end') setTimeIndex(23)
        if (intent.action === 'play') {
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
      case 'layer-set':
        setActiveLayer(intent.layer)
        break
      case 'nisar': {
        const current = useApp.getState()
        switch (intent.action) {
          case 'show':
            setNisarVisible(true)
            break
          case 'hide':
            setNisarVisible(false)
            break
          case 'toggle':
            setNisarVisible(!current.nisarVisible)
            break
          case 'opacity-up':
            setNisarOpacity(Math.min(1, current.nisarOpacity + 0.15))
            break
          case 'opacity-down':
            setNisarOpacity(Math.max(0.1, current.nisarOpacity - 0.15))
            break
        }
        break
      }
      default:
        break
    }
  }

  return (
    <div className="flex h-full flex-col bg-card/40 backdrop-blur-xl">
      {/* header */}
      <div className="flex h-12 items-center gap-2 border-b border-border/60 px-3">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-primary/15 ring-1 ring-primary/40">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex-1 leading-tight">
          <div className="text-xs font-semibold">Assistente IARA</div>
          <div className="text-[13px] font-mono text-muted-foreground uppercase tracking-wider">
            roteador determinístico · stub Claude
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
              className="rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-[12px] font-mono text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
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
        className="border-t border-border/60 p-2 flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte sobre garimpo, enchente, seca…"
          className="flex-1 bg-background/40 border border-border rounded-md px-2.5 h-9 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/40"
        />
        <Button type="submit" size="icon" className="h-9 w-9" aria-label="Enviar">
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
          'grid h-6 w-6 shrink-0 place-items-center rounded-full ring-1',
          isUser
            ? 'bg-muted ring-border text-muted-foreground'
            : 'bg-primary/15 ring-primary/40 text-primary'
        )}
      >
        {isUser ? <User className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
      </div>
      <div
        className={cn(
          'rounded-lg px-3 py-2 text-[13px] leading-snug max-w-[82%] whitespace-pre-wrap',
          isUser
            ? 'bg-primary/15 text-foreground border border-primary/30'
            : 'bg-background/40 text-foreground/90 border border-border/60'
        )}
      >
        {renderMarkdownLite(msg.text)}
      </div>
    </div>
  )
}

function ThinkingBubble() {
  return (
    <div className="flex gap-2">
      <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 ring-1 ring-primary/40 text-primary">
        <Sparkles className="h-3 w-3" />
      </div>
      <div className="rounded-lg bg-background/40 border border-border/60 px-3 py-2 flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-pulse"
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
