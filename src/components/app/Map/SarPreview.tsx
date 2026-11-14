import { useEffect, useState } from 'react'
import { ChevronDown, ExternalLink, Image as ImageIcon } from 'lucide-react'
import { useMemo } from 'react'
import { REGIONS } from '@/lib/regions'
import { useApp } from '@/lib/store'
import { useAsfGranules } from '@/lib/useAsfGranules'
import { useNisarSelection } from '@/lib/useNisarCatalog'
import { useT } from '@/lib/i18n'

export function SarPreview() {
  const t = useT()
  const activeRegion = useApp((s) => s.activeRegion)
  const region = useMemo(() => REGIONS.find((r) => r.id === activeRegion)!, [activeRegion])
  const asf = useAsfGranules(region)
  const nisar = useNisarSelection(region)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const fallback = asf.data.find((x) => !!x.browseUrl) ?? asf.data[0]
  // Follow the NISAR image selected on the map (region, clicked spot, date); else the latest ASF granule.
  const g = nisar.scene
    ? {
        id: nisar.scene.id,
        dataset: `NISAR ${nisar.scene.product}`,
        startTime: nisar.scene.startTime,
        vertexUrl: nisar.scene.vertexUrl,
        browseUrl: nisar.scene.browsePng,
        thumbUrl: nisar.scene.browseThumb,
      }
    : fallback
  const gid = g?.id
  useEffect(() => {
    setLoaded(false)
    setFailed(false)
  }, [gid])
  if (!g) return null
  const src = g.browseUrl ?? g.thumbUrl

  return (
    <div className="glass rounded-lg overflow-hidden w-full">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-[13px] font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={expanded}
          aria-label={expanded ? t('community.hidePreview') : t('community.showPreview')}
        >
          <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate">{t('preview.title')}</span>
          <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        <a
          href={g.vertexUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Open on ASF"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {expanded && (
      <>
      <div className="relative aspect-[4/3] border-t border-border bg-background">
        {src && !failed ? (
          <>
            {!loaded && (
              <div className="absolute inset-0 grid place-items-center text-[12px] tabular-nums text-muted-foreground animate-pulse">
                {t('preview.loading')}
              </div>
            )}
            <img
              key={g.id}
              src={src}
              alt={`SAR preview ${g.id}`}
              loading="lazy"
              referrerPolicy="no-referrer"
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
              className="absolute inset-0 h-full w-full object-cover opacity-95"
              style={{ filter: 'contrast(1.1) brightness(0.95)' }}
            />
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center text-[12px] tabular-nums text-muted-foreground">
            {t('preview.na')}
          </div>
        )}
      </div>

      <div className="px-2.5 py-1.5 text-[12px] tabular-nums text-muted-foreground border-t border-border">
        <div className="flex justify-between gap-2">
          <span className="text-foreground truncate">{g.dataset}</span>
          <span>{g.startTime.slice(0, 10)}</span>
        </div>
        <div className="mt-0.5 opacity-70 truncate">{g.id}</div>
      </div>
      </>
      )}
    </div>
  )
}
