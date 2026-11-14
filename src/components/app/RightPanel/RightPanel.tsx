import { useState } from 'react'
import { ChevronLeft, ChevronRight, MessageSquare, Fingerprint } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Chatbot } from '../Chatbot/Chatbot'
import { MetadataPanel } from '../MetadataPanel/MetadataPanel'

type Tab = 'chat' | 'meta'

export function RightPanel() {
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1536)
  const [tab, setTab] = useState<Tab>('chat')

  return (
    <aside
      className={cn(
        'relative z-10 h-full border-l border-border/60 bg-card/40 backdrop-blur-xl transition-[width] duration-300',
        open ? 'w-[340px] 2xl:w-[380px]' : 'w-12'
      )}
    >
      <div className="flex h-12 items-center justify-between border-b border-border/60 px-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Colapsar painel' : 'Expandir painel'}
        >
          {open ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
        {open && (
          <div className="flex gap-1">
            <TabButton
              active={tab === 'chat'}
              onClick={() => setTab('chat')}
              icon={<MessageSquare className="h-3.5 w-3.5" />}
              label="Conversar"
            />
            <TabButton
              active={tab === 'meta'}
              onClick={() => setTab('meta')}
              icon={<Fingerprint className="h-3.5 w-3.5" />}
              label="Metadata"
            />
          </div>
        )}
      </div>

      {open && (
        <div className="h-[calc(100%-3rem)]">
          {tab === 'chat' ? <Chatbot /> : <MetadataPanelEmbedded />}
        </div>
      )}
    </aside>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 h-7 text-[13px] font-mono transition-colors',
        active
          ? 'bg-primary/15 border-primary/40 text-primary'
          : 'bg-background/40 border-border text-muted-foreground hover:text-foreground'
      )}
    >
      {icon}
      {label}
    </button>
  )
}

// MetadataPanel includes its own <aside> wrapper. Render it inside this panel body
// by stripping its outer frame via a thin wrapper.
function MetadataPanelEmbedded() {
  return (
    <div className="h-full [&>aside]:!w-full [&>aside]:!border-l-0 [&>aside]:!bg-transparent [&>aside]:!backdrop-blur-none">
      <MetadataPanel />
    </div>
  )
}
