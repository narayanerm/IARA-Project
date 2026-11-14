import { DISPLACEMENT_STOPS } from '@/lib/colors'
import { useT } from '@/lib/i18n'

export function Legend() {
  const t = useT()
  return (
    <div className="glass rounded-lg p-3 min-w-[240px]">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[13px] font-medium text-muted-foreground">
          {t('legend.title')}
        </div>
        <div className="text-[12px] font-mono text-muted-foreground">
          {t('legend.unit')}
        </div>
      </div>
      <div className="relative h-2 rounded-full overflow-hidden ring-1 ring-border/60">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to right, ${DISPLACEMENT_STOPS.map((s) => s.color).join(', ')})`,
          }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[12px] font-mono text-muted-foreground">
        <span>{t('legend.lowLabel')}</span>
        <span>0</span>
        <span>{t('legend.highLabel')}</span>
      </div>
      <div className="mt-2 pt-2 border-t border-border/60 text-[12px] text-muted-foreground leading-snug">
        {t('legend.convention')}
      </div>
    </div>
  )
}
