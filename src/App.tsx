import { useEffect, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppLayout } from '@/components/app/AppLayout'
import { LowPolyIntro } from '@/components/app/LoadingScreen/LowPolyIntro'
import { Tutorial, hasSeenTutorial, TUTORIAL_OPEN_EVENT } from '@/components/app/Tutorial/Tutorial'
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
        {/* the dashboard is mounted underneath from the start; the intro splits open to reveal it */}
        {!ready && <LowPolyIntro onDone={() => setReady(true)} />}
        <AppLayout introDone={ready} />
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
