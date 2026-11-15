import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** PT ⟷ EN slider switch: knob on the left = Portuguese, on the right = English. */
export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const lang = useI18n((s) => s.lang)
  const setLang = useI18n((s) => s.setLang)
  const isEn = lang === 'en'

  const label = (code: 'pt' | 'en') =>
    cn(
      'select-none px-1 text-[12px] font-medium uppercase tracking-wider transition-colors',
      lang === code ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
    )

  return (
    <div className={cn('inline-flex items-center gap-1.5 px-1', compact && 'h-8')}>
      <button type="button" onClick={() => setLang('pt')} className={label('pt')} aria-pressed={!isEn}>
        PT
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={isEn}
        aria-label={isEn ? 'Language: English. Switch to Portuguese' : 'Idioma: português. Mudar para inglês'}
        onClick={() => setLang(isEn ? 'pt' : 'en')}
        className="relative inline-flex h-[26px] w-[46px] shrink-0 cursor-pointer items-center rounded-full bg-primary p-[2px] shadow-inner transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span
          aria-hidden="true"
          className={cn(
            'block h-[22px] w-[22px] rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.35)] transition-transform duration-200 ease-out',
            isEn ? 'translate-x-[20px]' : 'translate-x-0'
          )}
        />
      </button>
      <button type="button" onClick={() => setLang('en')} className={label('en')} aria-pressed={isEn}>
        EN
      </button>
    </div>
  )
}
