import { ChevronLeft, ChevronRight, MessageSquare, Fingerprint, Satellite, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RailButton } from '@/components/ui/rail-button'
import { cn } from '@/lib/utils'
import { useUi, type RightTab } from '@/lib/store'
import { useT, type TKey } from '@/lib/i18n'
import { markExplore } from '@/lib/story'
import { Chatbot } from '../Chatbot/Chatbot'
import { MetadataPanel } from '../MetadataPanel/MetadataPanel'
import { NisarPanel } from '../NisarPanel/NisarPanel'

const TABS: Array<{ id: RightTab; icon: LucideIcon; label: TKey }> = [
  { id: 'nisar', icon: Satellite, label: 'rp.nisar' },
  { id: 'chat', icon: MessageSquare, label: 'rp.chat' },
  { id: 'meta', icon: Fingerprint, label: 'rp.meta' },
]

export function RightPanel() {
  const t = useT()
  const open = useUi((s) => s.rightOpen)
  const tab = useUi((s) => s.rightTab)
  const setRightOpen = useUi((s) => s.setRightOpen)
  const openRight = useUi((s) => s.openRight)

  const openTab = (id: RightTab) => {
    openRight(id)
    markExplore()
  }

  return (
    <aside
      aria-label={t('panel.expandRight')}
      className={cn(
        'relative z-10 h-full shrink-0 border-l border-border bg-card transition-[width] duration-200 motion-reduce:transition-none',
        open ? 'w-[340px] 2xl:w-[380px]' : 'w-12'
      )}
    >
      <div className={cn('flex h-12 items-stretch border-b border-border', open ? 'pr-2' : 'justify-center')}>
        <div className="flex items-center px-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => {
              setRightOpen(!open)
              if (!open) markExplore()
            }}
            aria-label={open ? t('panel.collapseRight') : t('panel.expandRight')}
            aria-expanded={open}
            title={open ? t('panel.collapseRight') : t('panel.expandRight')}
          >
            {open ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
        {open && (
          <div role="tablist" className="flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto">
            {TABS.map((tb) => {
              const Icon = tb.icon
              const active = tab === tb.id
              return (
                <button
                  key={tb.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => openTab(tb.id)}
                  className={cn(
                    'relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 text-[13px] font-medium transition-colors',
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                    'after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full',
                    active ? 'after:bg-primary' : 'after:bg-transparent'
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {t(tb.label)}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {!open && (
        <nav className="flex flex-col items-center gap-1 py-2" aria-label={t('panel.expandRight')}>
          {TABS.map((tb) => (
            <RailButton key={tb.id} icon={tb.icon} label={t(tb.label)} side="left" onClick={() => openTab(tb.id)} />
          ))}
        </nav>
      )}

      {open && (
        <div className="h-[calc(100%-3rem)] animate-in fade-in duration-200 motion-reduce:animate-none">
          {tab === 'nisar' ? <NisarPanel /> : tab === 'chat' ? <Chatbot /> : <MetadataPanelEmbedded />}
        </div>
      )}
    </aside>
  )
}

// MetadataPanel includes its own <aside> wrapper. Render it inside this panel body
// by stripping its outer frame via a thin wrapper. The NISAR band note moved here from the top bar.
function MetadataPanelEmbedded() {
  const t = useT()
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-2 text-[12px] text-muted-foreground">{t('rp.band')}</div>
      <div className="min-h-0 flex-1 [&>aside]:!w-full [&>aside]:!border-l-0 [&>aside]:!bg-transparent">
        <MetadataPanel />
      </div>
    </div>
  )
}
