import type { LucideIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'
import { cn } from '@/lib/utils'

/** Icon button for a collapsed side panel: aria-label + tooltip + visible focus ring. */
export function RailButton({
  icon: Icon,
  label,
  onClick,
  active = false,
  side = 'right',
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  active?: boolean
  side?: 'left' | 'right'
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-current={active ? 'true' : undefined}
          className={cn(
            'grid h-9 w-9 place-items-center rounded-md transition-colors',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
            active ? 'bg-raised text-foreground' : 'text-muted-foreground hover:bg-raised hover:text-foreground'
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}
