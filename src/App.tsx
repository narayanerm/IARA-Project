import { Suspense, lazy, useEffect, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { LowPolyIntro } from '@/components/app/LoadingScreen/LowPolyIntro'
import { Tutorial, hasSeenTutorial, TUTORIAL_OPEN_EVENT } from '@/components/app/Tutorial/Tutorial'
import { useApp } from '@/lib/store'
import { readUrlState } from '@/lib/url-state'
import { useT } from '@/lib/i18n'

// The dashboard (map, cases, assistant) lives in its own chunks, so the entry script stays small and
// the intro iframe starts right away instead of waiting for the whole app to download and parse.
const AppLayout = lazy(() => import('@/components/app/AppLayout').then((m) => ({ default: m.AppLayout })))

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
  // The dashboard mounts once the intro page has arrived, so the intro gets the network to itself
  // first; a guard mounts it anyway if the intro is slow to load.
  const [introLoaded, setIntroLoaded] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setIntroLoaded(true), 4000)
    return () => window.clearTimeout(id)
  }, [])
  const [tutorialOn, setTutorialOn] = useState(false)
  useHydrateUrlState()

  useEffect(() => {
    if (ready && !hasSeenTutorial()) {
      const t = window.setTimeout(() => setTutorialOn(true), 500)
      return () => window.clearTimeout(t)
    }
  }, [ready])

  useEffect(() => {
    const onOpen = () => setTutorialOn(true)
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
            steps={[
              { anchor: 'cases', title: t('tutorial.cases.title'), body: t('tutorial.cases.body'), placement: 'top' },
              { anchor: 'map', title: t('tutorial.map.title'), body: t('tutorial.map.body'), placement: 'bottom' },
            ]}
            onClose={() => setTutorialOn(false)}
          />
        )}
      </main>
    </TooltipProvider>
  )
}
