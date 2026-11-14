import { Languages } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const lang = useI18n((s) => s.lang)
  const setLang = useI18n((s) => s.setLang)

  return (
    <div
      className={cn(
        'glass inline-flex items-center gap-0.5 rounded-md p-0.5 text-[13px] font-medium',
        compact && 'h-8'
      )}
    >
      <Languages className="h-3.5 w-3.5 text-muted-foreground ml-1.5" />
      <button
        onClick={() => setLang('pt')}
        className={cn(
          'rounded px-2 py-1 transition-colors',
          lang === 'pt'
            ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
            : 'text-muted-foreground hover:text-foreground'
        )}
        aria-pressed={lang === 'pt'}
      >
        PT
      </button>
      <button
        onClick={() => setLang('en')}
        className={cn(
          'rounded px-2 py-1 transition-colors',
          lang === 'en'
            ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
            : 'text-muted-foreground hover:text-foreground'
        )}
        aria-pressed={lang === 'en'}
      >
        EN
      </button>
    </div>
  )
}
