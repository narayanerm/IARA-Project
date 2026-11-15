import { useEffect, useState } from 'react'
import { Radar, Sparkles, X } from 'lucide-react'
import { useApp, useUi } from '@/lib/store'
import { useI18n, useT } from '@/lib/i18n'
import { useSarChunks } from '@/lib/sarChunks'
import { cn } from '@/lib/utils'
import { AskBar } from './Chatbot/AskBar'
import { Chatbot } from './Chatbot/Chatbot'

// Bottom dock over an open case: SAR on/off pill plus the floating ask bar, answers in a card above it.
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
          'pointer-events-auto flex h-[min(46vh,420px)] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-border bg-card/90 shadow-2xl backdrop-blur-md',
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
      <div className="pointer-events-auto flex w-full max-w-[760px] items-end justify-center gap-2">
        <SarButton />
        <AskBar className="max-w-[600px] flex-1" />
      </div>
    </div>
  )
}

function SarButton() {
  const lang = useI18n((s) => s.lang)
  const visible = useApp((s) => s.nisarVisible)
  const setVisible = useApp((s) => s.setNisarVisible)
  const activeRegion = useApp((s) => s.activeRegion)
  const { chunks } = useSarChunks(activeRegion)
  const hint =
    lang === 'pt'
      ? `Radar NISAR (banda L): ${chunks.length} imagens desta região`
      : `NISAR radar (L-band): ${chunks.length} images of this region`

  return (
    <button
      type="button"
      onClick={() => setVisible(!visible)}
      aria-pressed={visible}
      title={hint}
      className={cn(
        'inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold uppercase tracking-[0.06em] shadow-lg backdrop-blur-md transition-colors active:scale-[0.97]',
        visible
          ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
          : 'border-border bg-card/85 text-foreground hover:border-primary/60'
      )}
    >
      <Radar className="h-4 w-4" strokeWidth={1.9} />
      SAR
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', visible ? 'bg-primary-foreground' : 'bg-muted-foreground/60')} />
    </button>
  )
}
