import { useEffect, useState } from 'react'
import { Check, FileCode2, ImageDown, Loader2, Package } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { CASES } from '@/data/cases'
import { useApp, useUi } from '@/lib/store'
import { useI18n, useT, type TKey } from '@/lib/i18n'
import { useCaseOutline, useIbgePopulation } from '@/lib/useCaseOutline'
import { downloadBlob } from '@/lib/zip'
import {
  exportGeoJson,
  exportMapImage,
  exportPackage,
  packageName,
  type ExportContext,
  type ExportStep,
} from './buildCasePackage'

type Kind = 'zip' | 'geojson' | 'png'

const STEP_KEY: Record<ExportStep, TKey> = {
  map: 'export.step.map',
  layers: 'export.step.layers',
  sar: 'export.step.sar',
  optical: 'export.step.optical',
  alerts: 'export.step.alerts',
  zip: 'export.step.zip',
}

/** Exports what the open case shows inside its boundary: full package, GeoJSON layers or the map image. */
export function ExportMenu() {
  const t = useT()
  const lang = useI18n((s) => s.lang)
  const activeRegion = useApp((s) => s.activeRegion)
  const caseYear = useApp((s) => s.caseYear)
  const sarBand = useUi((s) => s.yanomamiBand)
  const raddOn = useUi((s) => s.yanomamiRaddOn)
  const deterOn = useUi((s) => s.yanomamiDeterOn)
  const sarPick = useUi((s) => s.sarArchivePick)
  const c = CASES[activeRegion]
  // Both are cached, so they resolve at once when the case outline is already on the map.
  const outline = useCaseOutline(c.outline)
  const population = useIbgePopulation(c.ibgeCode)

  const [busy, setBusy] = useState<Kind | null>(null)
  const [step, setStep] = useState<ExportStep | null>(null)
  const [done, setDone] = useState<Kind | null>(null)
  const [error, setError] = useState<Kind | null>(null)

  useEffect(() => {
    if (!done) return
    const id = window.setTimeout(() => setDone(null), 2500)
    return () => window.clearTimeout(id)
  }, [done])

  const run = async (kind: Kind) => {
    if (busy) return
    setBusy(kind)
    setDone(null)
    setError(null)
    const latest = c.series.points[c.series.points.length - 1].year
    const ctx: ExportContext = {
      c,
      lang,
      outline,
      population,
      year: caseYear ?? latest,
      sarBand,
      raddOn,
      deterOn,
      sarPick,
      onStep: setStep,
    }
    const name = packageName(c)
    try {
      if (kind === 'zip') {
        downloadBlob(await exportPackage(ctx), `${name}.zip`)
      } else if (kind === 'geojson') {
        downloadBlob(await exportGeoJson(ctx), `${name}.geojson`)
      } else {
        const png = await exportMapImage(ctx)
        if (!png) throw new Error('no map')
        downloadBlob(png, `${name}-map.png`)
      }
      setDone(kind)
    } catch {
      setError(kind)
    } finally {
      setBusy(null)
      setStep(null)
    }
  }

  const item = (kind: Kind, Icon: typeof Package, title: TKey, sub: TKey, iconClass: string) => {
    const active = busy === kind
    return (
      <DropdownMenuItem
        disabled={!!busy && !active}
        onSelect={(e) => {
          // Keep the menu open so the progress stays visible.
          e.preventDefault()
          void run(kind)
        }}
        aria-busy={active}
      >
        {active ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : done === kind ? (
          <Check className="h-4 w-4 text-emerald-400" />
        ) : (
          <Icon className={`h-4 w-4 ${iconClass}`} />
        )}
        <div className="flex-1">
          <div className="text-sm">{t(title)}</div>
          <div className="text-[12px] text-muted-foreground" aria-live="polite">
            {active && step
              ? t(STEP_KEY[step])
              : done === kind
                ? t('export.done')
                : error === kind
                  ? <span className="text-destructive">{t('export.error')}</span>
                  : t(sub)}
          </div>
        </div>
      </DropdownMenuItem>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="default"
          size="sm"
          className="h-8 rounded-md px-3.5 font-sans text-[13px] font-bold tracking-[-0.005em] shadow-none active:scale-[0.97]"
        >
          {t('export.label')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-[12px] font-mono uppercase tracking-wider text-muted-foreground">
          {t('export.heading')}
        </DropdownMenuLabel>
        {item('zip', Package, 'export.zip', 'export.zipSub', 'text-primary')}
        {item('geojson', FileCode2, 'export.geojson', 'export.geojsonSub', 'text-primary')}
        {item('png', ImageDown, 'export.png', 'export.pngSub', 'text-primary')}
        <DropdownMenuSeparator />
        <p className="px-2 pb-1.5 pt-0.5 text-[11px] leading-snug text-muted-foreground">{t('export.disclaimer')}</p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
