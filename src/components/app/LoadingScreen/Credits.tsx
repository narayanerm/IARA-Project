import { useT } from '@/lib/i18n'

export function Credits() {
  const t = useT()
  return (
    <footer className="iara-creditos">
      <p>
        <span>{t('loadingScreen.credits.data')}</span>
        <span>{t('loadingScreen.credits.narrative')}</span>
      </p>
      <p>
        <span>{t('loadingScreen.credits.models')}</span>
      </p>
    </footer>
  )
}
