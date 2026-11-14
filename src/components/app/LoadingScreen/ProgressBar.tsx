import { forwardRef } from 'react'
import { PIXELS } from './constants'

interface ProgressBarProps {
  progresso: number
  pronto: boolean
  onEnter: () => void
}

export const ProgressBar = forwardRef<HTMLButtonElement, ProgressBarProps>(
  function ProgressBar({ progresso, pronto, onEnter }, ref) {
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
            ? 'Cena varrida. O painel está pronto.'
            : progresso === 0
              ? 'Carregando os bichos da cena'
              : `Radar passando pela cena, ${Math.round(progresso * 100)}%`}
        </p>
        <button ref={ref} type="button" className="iara-botao" onClick={onEnter} disabled={!pronto}>
          {pronto ? 'Entrar no painel' : 'Carregando'}
        </button>
      </div>
    )
  }
)
