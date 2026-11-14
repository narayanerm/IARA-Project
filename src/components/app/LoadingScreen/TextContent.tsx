import { useT } from '@/lib/i18n'
import { TITULO } from './constants'

export function TextContent({ webgl }: { webgl: boolean }) {
  const t = useT()
  return (
    <div>
      <h1 id="iara-capa-titulo">
        {TITULO.map((p, i) => (
          <span key={i} className="iara-entra" style={{ ['--i' as string]: i }}>
            {p === 'radar' ? <em>{p}</em> : p}
            {i < TITULO.length - 1 ? ' ' : ''}
          </span>
        ))}
      </h1>
      <p className="iara-lead iara-entra" style={{ ['--i' as string]: 8 }}>
        {t('loadingScreen.lead')}
      </p>
      {!webgl && (
        <p className="iara-aviso">
          {t('loadingScreen.webglWarning')}
        </p>
      )}
    </div>
  )
}
