import { Suspense, lazy, useEffect, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { LowPolyIntro } from '@/components/app/LoadingScreen/LowPolyIntro'
import { Tutorial, hasSeenTutorial, TUTORIAL_OPEN_EVENT, type TourStep } from '@/components/app/Tutorial/Tutorial'
import { useApp, useCaseVideo } from '@/lib/store'
import { applyUrlState, readUrlState, startUrlSync } from '@/lib/url-state'
import { useT } from '@/lib/i18n'

// The dashboard (map, cases, assistant) lives in its own chunks, so the entry script stays small and
// the intro iframe starts right away instead of waiting for the whole app to download and parse.
const AppLayout = lazy(() => import('@/components/app/AppLayout').then((m) => ({ default: m.AppLayout })))

function useHydrateUrlState() {
  useEffect(() => {
    // A shared link reopens the sender's screen; from then on the address bar follows the screen.
    applyUrlState(readUrlState())
    return startUrlSync()
  }, [])
}

export default function App() {
  const t = useT()
  const [ready, setReady] = useState(false)
  // The dashboard mounts once the intro page has arrived, so the intro gets the network to itself
  // first; a guard mounts it anyway if the intro is slow to load.
  const [introLoaded, setIntroLoaded] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setIntroLoaded(true), 4000)
    return () => window.clearTimeout(id)
  }, [])
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

  // While the tour runs it opens Mining by itself; the case video waits until the tour closes.
  useEffect(() => {
    useCaseVideo.getState().setTourRunning(tutorialOn)
  }, [tutorialOn])

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
        {/* the dashboard is mounted underneath once the intro page has loaded; the intro splits open to reveal it */}
        {!ready && <LowPolyIntro onLoaded={() => setIntroLoaded(true)} onDone={() => setReady(true)} />}
        {(introLoaded || ready) && (
          <Suspense fallback={null}>
            <AppLayout introDone={ready} />
          </Suspense>
        )}
        {tutorialOn && (
          <Tutorial
            key={`${tourInCase}-${tourRun}`}
            steps={tourInCase ? TOUR.slice(2) : TOUR}
            onClose={() => {
              setTutorialOn(false)
              // After the Mining tour, its voiced video plays, then the Mining case opens on the main map.
              useCaseVideo.getState().playCaseVideo('YANO')
            }}
          />
        )}
      </main>
    </TooltipProvider>
  )
}
