import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function MapToggle({
  icon: Icon,
  label,
  hint,
  on,
  onToggle,
}: {
  icon: LucideIcon
  label: string
  hint?: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      title={hint}
      className={cn(
        'flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[12px] font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        on
          ? 'border-sar-cyan/60 bg-sar-cyan/15 text-foreground'
          : 'border-border/70 text-foreground/70 hover:bg-muted/60 hover:text-foreground'
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
      <span className={cn('ml-auto h-1.5 w-1.5 shrink-0 rounded-full', on ? 'bg-sar-cyan' : 'bg-foreground/25')} />
    </button>
  )
}
