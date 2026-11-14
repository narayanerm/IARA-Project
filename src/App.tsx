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
    title: 'Três recortes',
    body:
      'Garimpo na Terra Yanomami, enchente em Manaus e seca em Manaquiri. Escolha um e o mapa leva você até lá; dá para trocar a qualquer momento.',
    placement: 'bottom' as const,
  },
  {
    anchor: 'map',
    title: 'Mapa da região',
    body:
      'Os pontos pulsando são as zonas de atenção. No topo você liga ou desliga a imagem de satélite, o relevo 3D e o radar NISAR.',
    placement: 'left' as const,
  },
  {
    anchor: 'share',
    title: 'Compartilhar com fonte',
    body:
      'Link permanente com a tela atual, CSV da série temporal e GeoJSON da área, para qualquer pessoa conferir direto nas fontes.',
    placement: 'bottom' as const,
  },
  {
    anchor: 'chat',
    title: 'Assistente IARA',
    body:
      'Pergunte em linguagem natural: "como o radar enxerga a enchente?", "onde o garimpo mais cresceu?". O assistente também move o mapa.',
    placement: 'left' as const,
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
