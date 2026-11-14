import { useEffect, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppLayout } from '@/components/app/AppLayout'
import { VoxelIntro } from '@/components/app/LoadingScreen/VoxelIntro'
import { Tutorial, hasSeenTutorial, TUTORIAL_OPEN_EVENT } from '@/components/app/Tutorial/Tutorial'
import { useApp } from '@/lib/store'
import { readUrlState } from '@/lib/url-state'

const TUTORIAL_STEPS = [
  {
    anchor: 'cases',
    title: 'Três regiões, três problemas',
    body:
      'Garimpo na Terra Yanomami, enchente em Manaus e seca nas comunidades de Manaquiri. Escolha um cartão e o mapa leva você até lá.',
    placement: 'top' as const,
  },
  {
    anchor: 'map',
    title: 'Dentro de cada recorte',
    body:
      'O mapa fica preso à região escolhida. O painel traz a história do lugar, a linha do tempo com imagens de radar e os alertas. Para ver outro problema, volte aos cartões.',
    placement: 'bottom' as const,
  },
]

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
        {!ready && <VoxelIntro onDone={() => setReady(true)} />}
        <AppLayout introDone={ready} />
        {tutorialOn && (
          <Tutorial steps={TUTORIAL_STEPS} onClose={() => setTutorialOn(false)} />
        )}
      </main>
    </TooltipProvider>
  )
}
