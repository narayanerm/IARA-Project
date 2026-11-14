import { useEffect, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppLayout } from '@/components/app/AppLayout'
import { LoadingScreen } from '@/components/app/LoadingScreen/LoadingScreen'
import { useApp } from '@/lib/store'
import { readUrlState } from '@/lib/url-state'

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
  useHydrateUrlState()

  return (
    <TooltipProvider delayDuration={120}>
      <main className="h-full bg-background text-foreground">
        {!ready && <LoadingScreen onReady={() => setReady(true)} />}
        <AppLayout />
      </main>
    </TooltipProvider>
  )
}
