import { useEffect, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppLayout } from '@/components/app/AppLayout'
import { LowPolyIntro } from '@/components/app/LoadingScreen/LowPolyIntro'
import { Tutorial, hasSeenTutorial, TUTORIAL_OPEN_EVENT, type TourStep } from '@/components/app/Tutorial/Tutorial'
import { useApp } from '@/lib/store'
import { readUrlState } from '@/lib/url-state'
import { useT } from '@/lib/i18n'

function useHydrateUrlState() {
  useEffect(() => {
    const s = readUrlState()
    const api = useApp.getState()
    if (s.aoi) api.setActiveRegion(s.aoi)
    if (s.layer) api.setActiveLayer(s.layer)
    if (s.t !== undefined) api.setTimeIndex(s.t)
  }, [])
}

export default function App() {
  const t = useT()
  const [ready, setReady] = useState(false)
  const [tutorialOn, setTutorialOn] = useState(false)
  // Opened from inside a case, the tour skips the two steps about the cards.
  const [tourInCase, setTourInCase] = useState(false)
  // Bumped on every open, so the Tour button restarts a tour that is already running.
  const [tourRun, setTourRun] = useState(0)
  const TOUR: TourStep[] = [
    { anchor: 'case-YANO', title: t('tutorial.card.title'), body: t('tutorial.card.body'), placement: 'right' },
    { anchor: 'case-go-YANO', title: t('tutorial.open.title'), body: t('tutorial.open.body'), placement: 'right', action: 'click', cta: t('tutorial.open.cta') },
    { anchor: 'story', title: t('tutorial.panel.title'), body: t('tutorial.panel.body'), placement: 'right' },
    { anchor: 'case-tabs', title: t('tutorial.tabs.title'), body: t('tutorial.tabs.body'), placement: 'right' },
    { anchor: 'sar-layers', title: t('tutorial.layers.title'), body: t('tutorial.layers.body'), placement: 'top' },
    { anchor: 'ask', title: t('tutorial.ask.title'), body: t('tutorial.ask.body'), placement: 'top', action: 'click', pad: { left: 64, top: 28 } },
    { anchor: 'case-back', title: t('tutorial.back.title'), body: t('tutorial.back.body'), placement: 'right', action: 'click', cta: t('tutorial.done') },
  ]
  useHydrateUrlState()

  useEffect(() => {
    if (ready && !hasSeenTutorial()) {
      const t = window.setTimeout(() => {
        setTourInCase(useApp.getState().aoiActive)
        setTutorialOn(true)
      }, 500)
      return () => window.clearTimeout(t)
    }
  }, [ready])

  useEffect(() => {
    const onOpen = () => {
      setTourInCase(useApp.getState().aoiActive)
      setTourRun((n) => n + 1)
      setTutorialOn(true)
    }
    window.addEventListener(TUTORIAL_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(TUTORIAL_OPEN_EVENT, onOpen)
  }, [])

  return (
    <TooltipProvider delayDuration={120}>
      <main className="h-full bg-background text-foreground">
        {/* the dashboard is mounted underneath from the start; the intro splits open to reveal it */}
        {!ready && <LowPolyIntro onDone={() => setReady(true)} />}
        <AppLayout introDone={ready} />
        {tutorialOn && (
          <Tutorial
            key={`${tourInCase}-${tourRun}`}
            steps={tourInCase ? TOUR.slice(2) : TOUR}
            onClose={() => setTutorialOn(false)}
          />
        )}
      </main>
    </TooltipProvider>
  )
}
