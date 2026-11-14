import { forwardRef } from 'react'
import { useT } from '@/lib/i18n'
import { PIXELS } from './constants'

interface ProgressBarProps {
  progresso: number
  pronto: boolean
  onEnter: () => void
}

export const ProgressBar = forwardRef<HTMLButtonElement, ProgressBarProps>(
  function ProgressBar({ progresso, pronto, onEnter }, ref) {
    const t = useT()
    const acesos = Math.round(progresso * PIXELS)
    return (
      <div className="iara-acao">
        <div className="iara-pixels" aria-hidden="true">
          {Array.from({ length: PIXELS }, (_, i) => (
            <i key={i} className={i < acesos ? 'on' : i === acesos && !pronto ? 'frente' : ''} />
          ))}
        </div>
        <p className="iara-estado" aria-live="polite">
          {pronto
            ? t('loadingScreen.progressReady')
            : progresso === 0
              ? t('loadingScreen.progressStart')
              : t('loadingScreen.progressBusy', { pct: String(Math.round(progresso * 100)) })}
        </p>
        <button ref={ref} type="button" className="iara-botao" onClick={onEnter} disabled={!pronto}>
          {pronto ? t('loadingScreen.enter') : t('loadingScreen.loading')}
        </button>
      </div>
    )
  }
)
