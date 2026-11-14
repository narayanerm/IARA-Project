import { useMemo, useState } from 'react'
import { Marker, Popup } from 'react-map-gl/maplibre'
import { Crosshair, ExternalLink, MapPin, Users } from 'lucide-react'
import { INDIGENOUS_LANDS, polygonCentroid, type TiProps } from '@/data/layers/indigenous-lands'
import { cn } from '@/lib/utils'

interface TiTarget {
  id: number
  lng: number
  lat: number
  props: TiProps
}

export function TiTargets() {
  const targets = useMemo<TiTarget[]>(
    () =>
      INDIGENOUS_LANDS.features.map((f, i) => {
        const [lng, lat] = polygonCentroid(f.geometry)
        return { id: i, lng, lat, props: f.properties }
      }),
    []
  )

  const [openId, setOpenId] = useState<number | null>(null)
  const openTarget = targets.find((t) => t.id === openId) ?? null

  return (
    <>
      {targets.map((t) => (
        <Marker
          key={t.id}
          longitude={t.lng}
          latitude={t.lat}
          anchor="center"
          onClick={(e) => {
            e.originalEvent.stopPropagation()
            setOpenId(t.id)
          }}
        >
          <TargetReticle active={openId === t.id} />
        </Marker>
      ))}
      {openTarget && (
        <Popup
          longitude={openTarget.lng}
          latitude={openTarget.lat}
          anchor="bottom"
          offset={18}
          onClose={() => setOpenId(null)}
          closeOnClick={false}
          closeButton={false}
          className="ti-popup"
          maxWidth="320px"
        >
          <TiPopupBody props={openTarget.props} onClose={() => setOpenId(null)} />
        </Popup>
      )}
    </>
  )
}

function TargetReticle({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        'relative grid place-items-center cursor-pointer transition-transform',
        active ? 'scale-110' : ''
      )}
      style={{ width: 32, height: 32 }}
    >
      <div
        className={cn(
          'absolute inset-0 rounded-md border',
          active ? 'border-foreground/90' : 'border-foreground/60'
        )}
      />
      <div
        className={cn(
          'absolute rounded-md border',
          active ? 'border-foreground/90' : 'border-foreground/50'
        )}
        style={{ inset: 7 }}
      />
      <Crosshair
        className={cn(
          'relative',
          active ? 'text-foreground' : 'text-foreground/80'
        )}
        style={{ width: 14, height: 14 }}
      />
    </div>
  )
}

function TiPopupBody({ props, onClose }: { props: TiProps; onClose: () => void }) {
  const funaiHref = `https://sistemas.funai.gov.br/sici/busca.php?nome=${encodeURIComponent(
    props.name.replace(/^TI\s+/, '')
  )}`

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden min-w-[280px]">
      <div className="px-3 py-2 border-b border-border flex items-start gap-2">
        <MapPin className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground leading-tight">{props.name}</div>
          <div className="text-[13px] tabular-nums text-muted-foreground mt-0.5">
            {props.state}, {props.year}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-sm"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <StatBlock label="Area" value={`${props.area_km2.toLocaleString('en-US')} km²`} />
          <StatBlock label="Status" value={props.status} />
        </div>
        {props.population && (
          <div className="flex items-center gap-2 bg-raised border border-border rounded-md px-2.5 py-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex-1 text-[13px] text-foreground">
              {props.population.toLocaleString('en-US')} inhabitants
            </div>
          </div>
        )}
        {props.ethnicities && props.ethnicities.length > 0 && (
          <div>
            <div className="text-[12px] font-medium text-muted-foreground mb-1">
              Ethnic groups
            </div>
            <div className="flex flex-wrap gap-1">
              {props.ethnicities.map((e) => (
                <span
                  key={e}
                  className="rounded-sm bg-raised border border-border px-2 py-0.5 text-[12px] text-foreground/90"
                >
                  {e}
                </span>
              ))}
            </div>
          </div>
        )}

        <a
          href={funaiHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-md border border-border hover:bg-raised px-2.5 py-1.5 text-[13px] text-foreground tabular-nums transition-colors"
        >
          <span>View on FUNAI</span>
          <ExternalLink className="h-3 w-3" />
        </a>
        <div className="text-[12px] text-muted-foreground/70 leading-snug">
          Simplified outline for display. Official source: FUNAI Indigenous GIS.
        </div>
      </div>
    </div>
  )
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-raised border border-border px-2 py-1.5">
      <div className="text-[12px] font-medium text-muted-foreground">
        {label}
      </div>
      <div className="text-[13px] text-foreground mt-0.5 capitalize">{value}</div>
    </div>
  )
}
