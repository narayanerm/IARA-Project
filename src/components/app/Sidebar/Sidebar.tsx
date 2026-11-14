import { useEffect, useMemo, useRef } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RailButton } from '@/components/ui/rail-button'
import { cn } from '@/lib/utils'
import { REGIONS } from '@/lib/regions'
import type { RegionId } from '@/lib/types'
import { useApp, useAoiPopup, useUi } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { markExplore, openCase } from '@/lib/story'
import { INDIGENOUS_LANDS } from '@/data/layers/indigenous-lands'
import { AFFECTED_AREAS } from '@/data/layers/affected-areas'
import { ICON_BY_PHENOMENON } from '../Map/CaseMarkers'
import { CommunityList } from './CommunityList'

export function Sidebar() {
  const t = useT()
  const open = useUi((s) => s.leftOpen)
  const section = useUi((s) => s.leftSection)
  const setLeftOpen = useUi((s) => s.setLeftOpen)
  const openLeft = useUi((s) => s.openLeft)
  const stage = useUi((s) => s.stage)
  const activeRegion = useApp((s) => s.activeRegion)
  const setActiveRegion = useApp((s) => s.setActiveRegion)
  const openPopup = useAoiPopup((s) => s.openPopup)
  const tiRef = useRef<HTMLElement | null>(null)

  const panorama = useMemo(() => {
    const tiCount = INDIGENOUS_LANDS.features.length
    const tiAreaKm2 = INDIGENOUS_LANDS.features.reduce((s, f) => s + (f.properties.area_km2 ?? 0), 0)
    const tiPopulation = INDIGENOUS_LANDS.features.reduce((s, f) => s + (f.properties.population ?? 0), 0)
    const miningKm2 = AFFECTED_AREAS.YANO.features
      .filter((f) => f.properties.kind === 'mining')
      .reduce((s, f) => s + f.properties.area_km2, 0)
    return { tiCount, tiAreaKm2, tiPopulation, miningKm2 }
  }, [])

  // Opening the panel from the rail's Communities icon scrolls to that section.
  useEffect(() => {
    if (open && section === 'communities') tiRef.current?.scrollIntoView({ block: 'start' })
  }, [open, section])

  const inCase = stage !== 'overview'

  const pickCase = (id: RegionId) => {
    if (!inCase) {
      openCase(id)
      return
    }
    setActiveRegion(id)
    openPopup()
  }

  return (
    <aside
      aria-label={t('side.title')}
      className={cn(
        'relative z-10 h-full shrink-0 border-r border-border bg-card transition-[width] duration-200 motion-reduce:transition-none',
        open ? 'w-[300px]' : 'w-12'
      )}
    >
      <div className={cn('flex h-12 items-center border-b border-border px-1.5', open ? 'justify-between' : 'justify-center')}>
        {open && (
          <h2 className="min-w-0 truncate px-1.5 text-[13px] font-semibold text-foreground">{t('side.title')}</h2>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => {
            setLeftOpen(!open)
            if (!open) markExplore()
          }}
          aria-label={open ? t('panel.collapseLeft') : t('panel.expandLeft')}
          aria-expanded={open}
          title={open ? t('panel.collapseLeft') : t('panel.expandLeft')}
        >
          {open ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>

      {!open && (
        <nav className="flex flex-col items-center gap-1 py-2" aria-label={t('side.title')}>
          {REGIONS.map((r) => (
            <RailButton
              key={r.id}
              icon={ICON_BY_PHENOMENON[r.phenomenon]}
              label={`${t(`region.${r.id}.phen`)} · ${t(`region.${r.id}.name`)}`}
              active={inCase && r.id === activeRegion}
              onClick={() => {
                openLeft('cases')
                markExplore()
                pickCase(r.id)
              }}
            />
          ))}
          <div className="my-1 h-px w-6 bg-border" />
          <RailButton
            icon={Users}
            label={t('side.communities')}
            onClick={() => {
              openLeft('communities')
              markExplore()
            }}
          />
        </nav>
      )}

      {open && (
        <div className="flex h-[calc(100%-3rem)] flex-col overflow-y-auto animate-in fade-in duration-200 motion-reduce:animate-none">
          <section className="px-3 pt-3 pb-2">
            <h3 className="px-1 pb-1.5 text-[12px] font-medium text-muted-foreground">{t('side.cases')}</h3>
            <ul className="flex flex-col">
              {REGIONS.map((r) => {
                const Icon = ICON_BY_PHENOMENON[r.phenomenon]
                const isActive = inCase && r.id === activeRegion
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => pickCase(r.id)}
                      aria-current={isActive ? 'true' : undefined}
                      className={cn(
                        'flex w-full min-w-0 items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors',
                        isActive ? 'bg-raised text-foreground' : 'text-muted-foreground hover:bg-raised/60 hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-foreground">
                          {t(`region.${r.id}.phen`)}
                        </span>
                        <span className="block truncate text-[12px] text-muted-foreground">
                          {t(`region.${r.id}.name`)} · {t(`region.${r.id}.city`)}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="border-t border-border px-4 py-3">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <Stat value={`${panorama.tiCount}`} label={t('side.statTi')} />
              <Stat value={`${(panorama.tiAreaKm2 / 1000).toFixed(0)}k`} label={t('side.statKm2')} />
              <Stat value={`${(panorama.tiPopulation / 1000).toFixed(0)}k`} label={t('side.statPop')} />
              <Stat value={`${panorama.miningKm2}`} label={t('side.statMining')} />
            </dl>
          </section>

          <section ref={tiRef} className="border-t border-border px-3 pt-3 pb-2">
            <h3 className="px-1 pb-1.5 text-[12px] font-medium text-muted-foreground">{t('side.communities')}</h3>
            <CommunityList locked={false} />
          </section>

          <p className="mt-auto border-t border-border px-4 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
            {t('side.footer')}{' '}
            <a
              href="https://sistemas.funai.gov.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              FUNAI SIG
              <ExternalLink className="ml-0.5 inline h-3 w-3" />
            </a>
          </p>
        </div>
      )}
    </aside>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-col-reverse">
      <dt className="text-[12px] leading-snug text-muted-foreground">{label}</dt>
      <dd className="text-[17px] font-semibold leading-tight tabular-nums text-foreground">{value}</dd>
    </div>
  )
}
