import { useState } from 'react'
import { ChevronLeft, ChevronRight, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { RegionList } from './RegionList'
import { useT } from '@/lib/i18n'

export function Sidebar() {
  const t = useT()
  const [open, setOpen] = useState(true)

  return (
    <aside
      className={cn(
        'relative z-10 h-full border-r border-border/60 bg-card/40 backdrop-blur-xl transition-[width] duration-300',
        open ? 'w-[336px]' : 'w-12'
      )}
    >
      <div className="flex h-12 items-center justify-between border-b border-border/60 px-3">
        {open && (
          <div className="text-[13px] font-mono uppercase tracking-wider text-muted-foreground">
            {t('sidebar.title')}
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          {open ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>

      {open && (
        <div className="flex h-[calc(100%-3rem)] flex-col gap-4 overflow-y-auto p-3">
          <RegionList />

          <div className="mt-auto rounded-lg border border-border/60 bg-background/40 p-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              <div className="text-[13px] text-muted-foreground leading-relaxed">
                {t('sidebar.hint')}
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
