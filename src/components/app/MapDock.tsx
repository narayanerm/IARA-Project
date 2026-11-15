import { useEffect, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { useUi } from '@/lib/store'
import { useI18n, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { AskBar } from './Chatbot/AskBar'
import { Chatbot } from './Chatbot/Chatbot'

// Floating ask bar centred at the bottom of the map area of an open case; answers stack in a card above it.
export function MapDock() {
  const t = useT()
  const lang = useI18n((s) => s.lang)
  const askQueue = useUi((s) => s.askQueue)
  const [open, setOpen] = useState(false)

  // Any question sent through ui.ask (ask bar, case story) opens the conversation card.
  useEffect(() => {
    if (askQueue) setOpen(true)
  }, [askQueue])

  const closeLabel = lang === 'pt' ? 'Fechar conversa' : 'Close conversation'

  return (
    <div className="map-dock pointer-events-none absolute bottom-4 right-0 z-30 flex flex-col items-center gap-2 px-4">
      {/* Chatbot stays mounted so it keeps the history and consumes the ask queue; only its messages show. */}
      <div
        className={cn(
          'pointer-events-auto flex h-[min(46vh,420px)] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-border bg-card/90 shadow-2xl backdrop-blur-md',
          !open && 'hidden'
        )}
      >
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/60 pl-3 pr-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
          <span className="flex-1 text-[12px] font-semibold">{t('rp.chat')}</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={closeLabel}
            title={closeLabel}
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="dock-chat min-h-0 flex-1">
          <Chatbot />
        </div>
      </div>
      <AskBar className="pointer-events-auto max-w-[560px]" />
    </div>
  )
}
