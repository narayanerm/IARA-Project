import { Radar } from 'lucide-react'
import { useApp } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { useSarChunks } from '@/lib/sarChunks'
import { cn } from '@/lib/utils'

// SAR on/off pill in the bottom-right corner of the map; shows every pre-built chunk of the case at once.
export function SarButton() {
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
        'sar-button inline-flex h-11 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold uppercase tracking-[0.06em] shadow-lg backdrop-blur-md transition-colors active:scale-[0.97]',
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
