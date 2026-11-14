import { useEffect, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppLayout } from '@/components/app/AppLayout'
import { VoxelIntro } from '@/components/app/LoadingScreen/VoxelIntro'
import { Tutorial, hasSeenTutorial, TUTORIAL_OPEN_EVENT } from '@/components/app/Tutorial/Tutorial'
import { useApp } from '@/lib/store'
import { readUrlState } from '@/lib/url-state'

const TUTORIAL_STEPS = [
  {
    anchor: 'sidebar',
    title: 'Panorama Amazônia',
    body:
      'Estatísticas do bioma, 3 fenômenos âncora (garimpo, cheia, seca) e busca de TIs + comunidades ribeirinhas por nome, etnia ou município.',
    placement: 'right' as const,
  },
  {
    anchor: 'map',
    title: 'Mapa com camadas oficiais',
    body:
      'Pins laranjas = Terras Indígenas (FUNAI). Ciano = ribeirinhas (IBGE). Clique num pin pra ver etnias, acessibilidade e links FUNAI/ISA/IBGE originais.',
    placement: 'left' as const,
  },
  {
    anchor: 'nisar',
    title: 'NISAR ao vivo',
    body:
      'Clique em qualquer ponto do bioma — o painel busca na ASF DAAC todas as imagens NISAR daquele local. Toggle o olho pra ocultar o raster, chevron pra colapsar o painel.',
    placement: 'right' as const,
  },
  {
    anchor: 'share',
    title: 'Compartilhar com fonte',
    body:
      'Link permanente com a view atual, CSV da série temporal e GeoJSON da AOI. Pra jornalistas, ONGs e pesquisadores verificarem direto nas fontes.',
    placement: 'bottom' as const,
  },
  {
    anchor: 'chat',
    title: 'Assistente IARA',
    body:
      'Pergunte em linguagem natural: "mostra garimpo em Homoxi", "cheia de Manaus 2024", "como SAR funciona". O chat dispara ações no mapa.',
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
        <AppLayout />
        {tutorialOn && (
          <Tutorial steps={TUTORIAL_STEPS} onClose={() => setTutorialOn(false)} />
        )}
      </main>
    </TooltipProvider>
  )
}
