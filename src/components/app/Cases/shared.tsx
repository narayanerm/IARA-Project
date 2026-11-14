import { useEffect, useState } from 'react'
import {
  Droplets,
  Fish,
  Flame,
  HeartPulse,
  Home,
  Pickaxe,
  Sailboat,
  Sun,
  TrafficCone,
  Trees,
  Users,
  Utensils,
  Waves,
  type LucideIcon,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { RegionId } from '@/lib/types'
import type { L, PainIcon } from '@/data/cases'

export const CASE_ICON: Record<RegionId, LucideIcon> = {
  YANO: Pickaxe,
  ENCH: Waves,
  SECA: Sun,
}

export const PAIN_ICON: Record<PainIcon, LucideIcon> = {
  health: HeartPulse,
  water: Droplets,
  forest: Trees,
  home: Home,
  boat: Sailboat,
  food: Utensils,
  fish: Fish,
  fire: Flame,
  road: TrafficCone,
  people: Users,
}

/** Picks the current language out of a bilingual string. */
export function useTr(): (l: L) => string {
  const lang = useI18n((s) => s.lang)
  return (l) => l[lang]
}

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatch(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{children}</h3>
}
