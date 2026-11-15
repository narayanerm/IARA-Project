import { useT } from '@/lib/i18n'

export function TextContent({ webgl }: { webgl: boolean }) {
  const t = useT()
  const words = t('loadingScreen.title').split(' ')
  return (
    <div>
      <h1 id="iara-capa-titulo">
        {words.map((p, i) => (
          <span key={i} className="iara-entra" style={{ ['--i' as string]: i }}>
            {/^radar$/i.test(p) ? <em>{p}</em> : p}
            {i < words.length - 1 ? ' ' : ''}
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
