import { useEffect, useState } from 'react'
import {
  ExternalLink,
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
import type { L, PainIcon, Ref } from '@/data/cases'

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

/** A reference as shown on screen; `repeat` marks a source already linked higher up in the panel. */
export type ShownRef = Ref & { repeat?: boolean }

/** Returns a marker that flags every source after its first appearance, so each link shows only once. */
export function makeOnce(): { (refs?: Ref[]): ShownRef[] | undefined; seen: Set<string> } {
  const seen = new Set<string>()
  const once = (refs?: Ref[]): ShownRef[] | undefined =>
    refs?.map((r) => {
      const repeat = seen.has(r.url)
      seen.add(r.url)
      return repeat ? { ...r, repeat } : r
    })
  return Object.assign(once, { seen })
}

/** Sources shown right under the figure or paragraph they confirm; repeated ones are named without a link. */
export function Refs({ refs, className = '' }: { refs?: ShownRef[]; className?: string }) {
  const lang = useI18n((s) => s.lang)
  if (!refs || refs.length === 0) return null
  return (
    <p className={`case-refs text-[11px] leading-snug text-muted-foreground ${className}`}>
      <span>{lang === 'en' ? 'Source: ' : 'Fonte: '}</span>
      {refs.map((r, i) => (
        <span key={r.url + r.label}>
          {i > 0 && ' · '}
          {r.repeat ? (
            <span title={lang === 'en' ? 'Linked above' : 'Link acima'}>{r.label} ↑</span>
          ) : (
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-border underline-offset-2 transition-colors hover:text-foreground"
            >
              {r.label}
              <ExternalLink className="ml-0.5 inline h-2.5 w-2.5 align-[-1px]" />
            </a>
          )}
        </span>
      ))}
    </p>
  )
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground">{children}</h3>
}
