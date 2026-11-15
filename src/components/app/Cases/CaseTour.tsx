import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CaseStudy } from '@/data/cases'
import { useApp } from '@/lib/store'
import { useT, type TKey } from '@/lib/i18n'
import {
  CASE_TOUR_KEY,
  CASE_TOUR_OPEN_EVENT,
  Tutorial,
  hasSeenCaseTour,
  type TourStep,
} from '../Tutorial/Tutorial'

/**
 * Guided tour of a case, modelled on the home tour: short (one idea per step), anchored to the real
 * controls, skippable at any point and replayable from the panel header. It opens by itself the first
 * time any case panel lands, and switches tabs as it goes so every step points at something visible.
 */
export function CaseTour({ c }: { c: CaseStudy }) {
  const t = useT()
  const setTab = useApp((s) => s.setCaseTab)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (hasSeenCaseTour()) return
    // Let the panel finish sliding in before the first highlight is measured.
    const id = window.setTimeout(() => setOpen(true), 900)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(CASE_TOUR_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(CASE_TOUR_OPEN_EVENT, onOpen)
  }, [])

  const steps = useMemo<TourStep[]>(() => {
    const kind = c.id === 'ENCH' ? 'Flood' : c.id === 'YANO' ? 'Mining' : 'Drought'
    const step = (anchor: string, key: string, placement: TourStep['placement'], onEnter?: () => void): TourStep => ({
      anchor,
      title: t(`caseTour.${key}.title` as TKey),
      body: t(`caseTour.${key}.body` as TKey),
      placement,
      onEnter,
    })
    const overview = () => setTab('overview')
    const timeline = () => setTab('timeline')
    const alerts = () => setTab('alerts')
    return [
      step('story', 'panel', 'right', overview),
      step('case-tabs', 'tabs', 'right', overview),
      step('case-compare', `compare${kind}`, 'right', timeline),
      step('case-chart', `chart${kind}`, 'right', timeline),
      step('case-sar', 'sar', 'right', timeline),
      step('case-alerts', `alerts${kind}`, 'right', alerts),
      step('sar-bands', 'bands', 'left'),
      step('ask', 'ask', 'top'),
    ]
  }, [c.id, setTab, t])

  if (!open) return null
  // Portal: the case panel is transformed while it slides, which would trap a fixed overlay inside it.
  return createPortal(
    <Tutorial
      steps={steps}
      storageKey={CASE_TOUR_KEY}
      onClose={() => {
        setOpen(false)
        setTab('overview')
      }}
    />,
    document.body
  )
}
