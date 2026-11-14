import { useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  Check,
  Copy,
  Download,
  FileJson,
  Link as LinkIcon,
  Share2,
  TableProperties,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useApp } from '@/lib/store'
import { REGIONS } from '@/lib/regions'
import { YANO_MINING } from '@/data/mocks/yanomami-mining'
import { buildPermalink } from '@/lib/url-state'
import { cn } from '@/lib/utils'

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ShareDialog() {
  const [open, setOpen] = useState(false)
  const activeRegion = useApp((s) => s.activeRegion)
  const activeLayer = useApp((s) => s.activeLayer)
  const timeIndex = useApp((s) => s.timeIndex)
  const selectedPolygon = useApp((s) => s.selectedPolygon)

  const region = useMemo(() => REGIONS.find((r) => r.id === activeRegion)!, [activeRegion])

  const permalink = useMemo(
    () =>
      buildPermalink({
        aoi: activeRegion,
        layer: activeLayer,
        t: timeIndex,
        polygon: selectedPolygon?.id,
      }),
    [activeRegion, activeLayer, timeIndex, selectedPolygon]
  )

  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(permalink)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // clipboard denied; fall back to no-op
    }
  }

  const downloadCsv = () => {
    const source = selectedPolygon ?? (activeRegion === 'YANO' ? YANO_MINING[0] : null)
    if (!source) return
    const rows = [
      ['date', 'value', 'unit', 'polygon_id', 'polygon_name', 'aoi'],
      ...source.series.map((pt) => [
        pt.date,
        String(pt.displacementMm),
        'dB',
        source.id,
        source.name,
        region.id,
      ]),
    ]
    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n')
    const fname = `${region.id.toLowerCase()}-${source.id}-timeseries.csv`
    download(fname, csv, 'text/csv;charset=utf-8')
  }

  const downloadGeojson = () => {
    const [w, s, e, n] = region.bbox
    const fc = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            aoi: region.id,
            name: region.name,
            phenomenon: region.phenomenon,
            anchor_city: region.anchorCity,
            source: 'IARA · AmazonSAR Explorer',
            note: 'AOI bounding box for GIS tools (QGIS, ArcGIS).',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [w, s],
                [e, s],
                [e, n],
                [w, n],
                [w, s],
              ],
            ],
          },
          bbox: region.bbox,
        },
      ],
    }
    const fname = `${region.id.toLowerCase()}-aoi.geojson`
    download(fname, JSON.stringify(fc, null, 2), 'application/geo+json')
  }

  const csvDisabled = activeRegion !== 'YANO' && !selectedPolygon

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border border-sar-amber/40 bg-sar-amber/10 px-2.5 h-8 text-[13px] font-mono text-sar-amber hover:bg-sar-amber/20 transition-colors'
          )}
          aria-label="Compartilhar e exportar"
        >
          <Share2 className="h-3.5 w-3.5" />
          Compartilhar
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[9999] w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl">
          <div className="flex items-start justify-between border-b border-border/60 p-4">
            <div>
              <Dialog.Title className="text-base font-semibold">
                Compartilhar e exportar
              </Dialog.Title>
              <Dialog.Description className="text-[13px] text-muted-foreground mt-0.5">
                Para jornalistas, pesquisadores, ONGs e órgãos públicos.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="p-4 space-y-4">
            <Badge variant="outline" className="font-mono text-[12px]">
              AOI atual · {region.name} · {region.phenomenonLabel}
            </Badge>

            <ExportCard
              icon={<LinkIcon className="h-4 w-4" />}
              title="Link de citação permanente"
              description="URL com AOI, camada e frame temporal codificados. Compartilhe por e-mail, Slack, redes sociais. Quem abre vê exatamente a mesma visão."
            >
              <div className="flex gap-2">
                <input
                  readOnly
                  value={permalink}
                  className="flex-1 rounded-md border border-border/60 bg-background/60 px-2.5 h-9 text-[12px] font-mono text-foreground truncate"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button onClick={copy} size="sm" className="h-9 shrink-0">
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copiar
                    </>
                  )}
                </Button>
              </div>
            </ExportCard>

            <ExportCard
              icon={<TableProperties className="h-4 w-4" />}
              title="Série temporal (CSV)"
              description={
                csvDisabled
                  ? 'Selecione um polígono no mapa (AOI Yanomami) para baixar a série temporal daquele ponto.'
                  : 'Para abrir em Excel, Google Sheets, pandas. Inclui data, valor, unidade, ID do polígono.'
              }
            >
              <Button
                onClick={downloadCsv}
                variant="outline"
                size="sm"
                className="w-full justify-start h-9"
                disabled={csvDisabled}
              >
                <Download className="h-3.5 w-3.5" /> Baixar CSV
              </Button>
            </ExportCard>

            <ExportCard
              icon={<FileJson className="h-4 w-4" />}
              title="AOI (GeoJSON)"
              description="Bounding box da AOI atual. Abra em QGIS, ArcGIS, geopandas. Útil pra sobrepor com camadas próprias de desmatamento, hidrografia, etc."
            >
              <Button
                onClick={downloadGeojson}
                variant="outline"
                size="sm"
                className="w-full justify-start h-9"
              >
                <Download className="h-3.5 w-3.5" /> Baixar GeoJSON
              </Button>
            </ExportCard>

            <div className="text-[11px] text-muted-foreground/70 leading-relaxed">
              Todos os dados exportados carregam origem, unidade e incerteza quando aplicável.
              Não rotulamos pixel bruto como garimpo / enchente / seca confirmados.
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ExportCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-border/60 bg-background/40 p-3 space-y-2.5">
      <header className="flex items-center gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 ring-1 ring-primary/30 text-primary">
          {icon}
        </div>
        <div className="text-sm font-semibold">{title}</div>
      </header>
      <p className="text-[12px] text-muted-foreground leading-relaxed">{description}</p>
      {children}
    </section>
  )
}

function csvCell(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}
