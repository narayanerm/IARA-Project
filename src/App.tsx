import { useEffect, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppLayout } from '@/components/app/AppLayout'
import { VoxelIntro } from '@/components/app/LoadingScreen/VoxelIntro'
import { useApp } from '@/lib/store'
import { readUrlState } from '@/lib/url-state'
import { showRadar } from '@/lib/story'

function useHydrateUrlState() {
  useEffect(() => {
    const s = readUrlState()
    const api = useApp.getState()
    if (s.aoi) api.setActiveRegion(s.aoi)
    if (s.layer) api.setActiveLayer(s.layer)
    if (s.t !== undefined) api.setTimeIndex(s.t)
    // A deep link already names a case: skip the case picker and land in the radar state.
    if (s.aoi || s.layer || s.t !== undefined) showRadar({ keepLayer: !!s.layer })
  }, [])
}

export default function App() {
  const [ready, setReady] = useState(false)
  useHydrateUrlState()

  return (
    <TooltipProvider delayDuration={120}>
      <main className="h-full bg-background text-foreground">
        {/* the dashboard is mounted underneath from the start; the intro splits open to reveal it */}
        {!ready && <VoxelIntro onDone={() => setReady(true)} />}
        <AppLayout />
      </main>
    </TooltipProvider>
  )
}
