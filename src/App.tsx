import { useEffect, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppLayout } from '@/components/app/AppLayout'
import { LoadingScreen } from '@/components/app/LoadingScreen/LoadingScreen'
import { useApp } from '@/lib/store'
import { readUrlState } from '@/lib/url-state'
import { loadCommunityIndex } from '@/lib/useCommunityIndex'

function useHydrateUrlState() {
  // Read during the first render, before any effect can rewrite the address bar.
  const [initial] = useState(() => readUrlState())
  useEffect(() => {
    const api = useApp.getState()
    if (initial.aoi) api.setActiveRegion(initial.aoi)
    if (initial.layer) api.setActiveLayer(initial.layer)
    if (initial.t !== undefined) api.setTimeIndex(initial.t)
    const key = initial.c
    if (!key) return
    loadCommunityIndex()
      .then((index) => {
        const entry = index.byKey.get(key)
        if (entry) useApp.getState().focusCommunity(entry.focus, initial.step)
      })
      .catch(() => undefined)
  }, [initial])
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
