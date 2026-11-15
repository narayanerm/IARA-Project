import { House } from 'lucide-react'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'

/** Sits next to the map's "i": puts the camera back on the case framing after exploring. */
export function HomeButton() {
  const t = useT()
  const show = useApp((s) => s.aoiActive && s.caseArrived)
  const requestHome = useApp((s) => s.requestHome)
  if (!show) return null
  return (
    <button type="button" className="map-home" onClick={requestHome} aria-label={t('map.home')} title={t('map.home')}>
      <House className="h-[15px] w-[15px]" strokeWidth={1.75} />
    </button>
  )
}
