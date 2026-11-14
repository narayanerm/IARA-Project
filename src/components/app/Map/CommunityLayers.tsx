import { useEffect, useState } from 'react'
import { Layer, Popup, Source, useMap } from 'react-map-gl/maplibre'
import type { GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl'
import { ExternalLink, Flame, MapPin as MapPinIcon, Navigation, Users, X } from 'lucide-react'
import { COMMUNITY_DATA, type Risk, type RiversideProps, type TiPointProps } from '@/data/layers/communities'
import { FUNAI_TI_URL, tiProfileUrl } from '@/lib/links'
import { useT, type TKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CommunityPin } from './CommunityPin'
import { KIND_COLOR, type CommunityKind } from './community-kind'
import { loadPinImage } from './pin-image'

const PIN_CSS_SIZE = 40
const PIN_IMAGE: Record<CommunityKind, string> = { indigenous: 'pin-indigenous', riverside: 'pin-riverside' }
const SOURCE: Record<CommunityKind, string> = { indigenous: 'ti-points', riverside: 'riverside-points' }
const PIN_LAYER: Record<CommunityKind, string> = { indigenous: 'ti-pins', riverside: 'riverside-pins' }
const CLUSTER_LAYER: Record<CommunityKind, string> = { indigenous: 'ti-clusters', riverside: 'riverside-clusters' }

type Selected =
  | { kind: 'indigenous'; lngLat: [number, number]; props: TiPointProps }
  | { kind: 'riverside'; lngLat: [number, number]; props: RiversideProps }

const pinImages = new Map<CommunityKind, HTMLImageElement>()

function usePinImages() {
  const { current: ref } = useMap()
  useEffect(() => {
    const map = ref?.getMap()
    if (!map) return
    const ratio = Math.min(Math.ceil(window.devicePixelRatio || 1), 3)
    const add = (kind: CommunityKind) => {
      const img = pinImages.get(kind)
      if (img && !map.hasImage(PIN_IMAGE[kind])) map.addImage(PIN_IMAGE[kind], img, { pixelRatio: ratio })
    }
    let cancelled = false
    Promise.all(
      (Object.keys(PIN_IMAGE) as CommunityKind[]).map(async (kind) => {
        if (!pinImages.has(kind)) pinImages.set(kind, await loadPinImage(kind, PIN_CSS_SIZE, ratio))
        if (!cancelled) add(kind)
      })
    ).catch(() => undefined)
    const onMissing = (e: { id: string }) => {
      const kind = (Object.keys(PIN_IMAGE) as CommunityKind[]).find((k) => PIN_IMAGE[k] === e.id)
      if (kind) add(kind)
    }
    map.on('styleimagemissing', onMissing)
    return () => {
      cancelled = true
      map.off('styleimagemissing', onMissing)
    }
  }, [ref])
}

export function CommunityAreas() {
  return (
    <>
      <Source id="reserves" type="geojson" data={COMMUNITY_DATA.reserves}>
        <Layer
          id="reserves-fill"
          type="fill"
          paint={{ 'fill-color': KIND_COLOR.riverside.fill, 'fill-opacity': 0.07 }}
        />
        <Layer
          id="reserves-line"
          type="line"
          paint={{
            'line-color': KIND_COLOR.riverside.fill,
            'line-opacity': 0.75,
            'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.7, 10, 1.8],
            'line-dasharray': [2, 1.5],
          }}
        />
      </Source>
      <Source id="ti-areas" type="geojson" data={COMMUNITY_DATA.tiAreas}>
        <Layer
          id="ti-fill"
          type="fill"
          paint={{ 'fill-color': KIND_COLOR.indigenous.fill, 'fill-opacity': 0.1 }}
        />
        <Layer
          id="ti-line"
          type="line"
          paint={{
            'line-color': KIND_COLOR.indigenous.fill,
            'line-opacity': 0.8,
            'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.7, 10, 2],
          }}
        />
      </Source>
    </>
  )
}

function PointLayers({ kind, labelZoom }: { kind: CommunityKind; labelZoom: number }) {
  const { fill, ink } = KIND_COLOR[kind]
  return (
    <>
      <Layer
        id={CLUSTER_LAYER[kind]}
        source={SOURCE[kind]}
        type="circle"
        filter={['has', 'point_count']}
        paint={{
          'circle-color': fill,
          'circle-opacity': 0.92,
          'circle-radius': ['step', ['get', 'point_count'], 15, 10, 19, 50, 24, 200, 30],
          'circle-stroke-color': ink,
          'circle-stroke-width': 2,
        }}
      />
      <Layer
        id={`${CLUSTER_LAYER[kind]}-count`}
        source={SOURCE[kind]}
        type="symbol"
        filter={['has', 'point_count']}
        layout={{
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 13,
          'text-allow-overlap': true,
        }}
        paint={{ 'text-color': ink }}
      />
      <Layer
        id={PIN_LAYER[kind]}
        source={SOURCE[kind]}
        type="symbol"
        filter={['!', ['has', 'point_count']]}
        layout={{
          'icon-image': PIN_IMAGE[kind],
          'icon-anchor': 'bottom',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 9, 1, 13, 1.15],
          'icon-allow-overlap': true,
          'text-field': ['step', ['zoom'], '', labelZoom, ['get', 'nome']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], labelZoom, 12, 13, 14],
          'text-anchor': 'top',
          'text-offset': [0, 0.35],
          'text-max-width': 10,
          'text-optional': true,
        }}
        paint={{
          'text-color': 'hsl(0 0% 96%)',
          'text-halo-color': 'hsl(222 47% 6% / 0.95)',
          'text-halo-width': 1.6,
        }}
      />
    </>
  )
}

export function CommunityPoints() {
  usePinImages()
  const { current: ref } = useMap()
  const [selected, setSelected] = useState<Selected | null>(null)

  useEffect(() => {
    const map = ref?.getMap()
    if (!map) return
    const kinds = Object.keys(PIN_LAYER) as CommunityKind[]
    const pointer = () => (map.getCanvas().style.cursor = 'pointer')
    const reset = () => (map.getCanvas().style.cursor = '')

    const onPin = (kind: CommunityKind) => (e: MapLayerMouseEvent) => {
      const f = e.features?.[0]
      if (!f || f.geometry.type !== 'Point') return
      const lngLat = f.geometry.coordinates as [number, number]
      setSelected({ kind, lngLat, props: f.properties } as Selected)
    }
    const onCluster = (kind: CommunityKind) => async (e: MapLayerMouseEvent) => {
      const f = e.features?.[0]
      if (!f || f.geometry.type !== 'Point') return
      const source = map.getSource(SOURCE[kind]) as GeoJSONSource | undefined
      if (!source) return
      const zoom = await source.getClusterExpansionZoom(f.properties.cluster_id as number)
      map.easeTo({ center: f.geometry.coordinates as [number, number], zoom: zoom + 0.5, duration: 700 })
    }

    const handlers = kinds.flatMap((kind) => [
      [PIN_LAYER[kind], onPin(kind)] as const,
      [CLUSTER_LAYER[kind], onCluster(kind)] as const,
    ])
    for (const [layer, fn] of handlers) {
      map.on('click', layer, fn)
      map.on('mouseenter', layer, pointer)
      map.on('mouseleave', layer, reset)
    }
    return () => {
      for (const [layer, fn] of handlers) {
        map.off('click', layer, fn)
        map.off('mouseenter', layer, pointer)
        map.off('mouseleave', layer, reset)
      }
    }
  }, [ref])

  return (
    <>
      <Source
        id={SOURCE.riverside}
        type="geojson"
        data={COMMUNITY_DATA.riverside}
        cluster
        clusterRadius={48}
        clusterMaxZoom={10}
      >
        <PointLayers kind="riverside" labelZoom={9} />
      </Source>
      <Source
        id={SOURCE.indigenous}
        type="geojson"
        data={COMMUNITY_DATA.tiPoints}
        cluster
        clusterRadius={36}
        clusterMaxZoom={6}
      >
        <PointLayers kind="indigenous" labelZoom={6} />
      </Source>

      {selected && (
        <Popup
          longitude={selected.lngLat[0]}
          latitude={selected.lngLat[1]}
          anchor="bottom"
          offset={PIN_CSS_SIZE + 4}
          onClose={() => setSelected(null)}
          closeOnClick={false}
          closeButton={false}
          className="ti-popup"
          maxWidth="340px"
        >
          {selected.kind === 'indigenous' ? (
            <TiPopup props={selected.props} onClose={() => setSelected(null)} />
          ) : (
            <RiversidePopup props={selected.props} onClose={() => setSelected(null)} />
          )}
        </Popup>
      )}
    </>
  )
}

const RISK_TONE: Record<Risk, string> = {
  baixo: 'text-emerald-300 border-emerald-400/40 bg-emerald-400/10',
  moderado: 'text-yellow-200 border-yellow-300/40 bg-yellow-300/10',
  alto: 'text-orange-300 border-orange-400/40 bg-orange-400/10',
  'muito alto': 'text-red-300 border-red-400/50 bg-red-400/10',
}

const RISK_KEY: Record<Risk, TKey> = {
  baixo: 'community.risk.low',
  moderado: 'community.risk.moderate',
  alto: 'community.risk.high',
  'muito alto': 'community.risk.veryHigh',
}

function PopupShell({
  kind,
  title,
  subtitle,
  risk,
  onClose,
  children,
}: {
  kind: CommunityKind
  title: string
  subtitle: string
  risk: Risk | null
  onClose: () => void
  children: React.ReactNode
}) {
  const t = useT()
  return (
    <div
      className="w-[min(320px,calc(100vw-48px))] rounded-xl border bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden"
      style={{ borderColor: `color-mix(in srgb, ${KIND_COLOR[kind].fill} 45%, transparent)` }}
    >
      <div className="flex items-start gap-2.5 px-3.5 pt-3 pb-2.5">
        <CommunityPin kind={kind} size={30} />
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold leading-snug text-foreground">{title}</div>
          <div className="text-[13px] text-foreground/70 mt-0.5">{subtitle}</div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-foreground/60 hover:text-foreground hover:bg-secondary/70 transition-colors"
          aria-label={t('community.close')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {risk && (
        <div className="px-3.5 pb-2.5">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium',
              RISK_TONE[risk]
            )}
          >
            <Flame className="h-3.5 w-3.5" />
            {t('community.fireRisk')}: {t(RISK_KEY[risk])}
          </span>
        </div>
      )}
      <div className="border-t border-border/60 px-3.5 py-3 space-y-2.5">{children}</div>
    </div>
  )
}

function Fact({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-[13px]">
      <Icon className="h-4 w-4 shrink-0 text-foreground/50 mt-px" />
      <div className="min-w-0">
        <span className="text-foreground/60">{label}: </span>
        <span className="text-foreground">{value}</span>
      </div>
    </div>
  )
}

function LinkButton({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center justify-between rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors active:scale-[0.98]',
        primary
          ? 'border-sar-amber/50 bg-sar-amber/15 text-sar-amber hover:bg-sar-amber/25'
          : 'border-border bg-background/40 text-foreground/85 hover:bg-background/70'
      )}
    >
      <span>{label}</span>
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  )
}

function TiPopup({ props, onClose }: { props: TiPointProps; onClose: () => void }) {
  const t = useT()
  const fmt = (n: number) => n.toLocaleString('pt-BR')
  return (
    <PopupShell
      kind="indigenous"
      title={props.nome}
      subtitle={[t('community.indigenous'), props.fase].filter(Boolean).join(' · ')}
      risk={props.risco}
      onClose={onClose}
    >
      {props.etnia && <Fact icon={Users} label={t('community.ethnicities')} value={props.etnia} />}
      {props.area_km2 != null && (
        <Fact icon={MapPinIcon} label={t('community.area')} value={`${fmt(props.area_km2)} km²`} />
      )}
      <Fact icon={Flame} label={t('community.fires2026')} value={fmt(props.focos_2026)} />
      <div className="grid gap-1.5 pt-1">
        {props.isaId != null && <LinkButton href={tiProfileUrl(props.isaId)} label={t('community.tiProfile')} primary />}
        <LinkButton href={FUNAI_TI_URL} label={t('community.funai')} primary={props.isaId == null} />
      </div>
      <div className="text-[12px] text-foreground/55 leading-snug">{t('community.source')}</div>
    </PopupShell>
  )
}

function RiversidePopup({ props, onClose }: { props: RiversideProps; onClose: () => void }) {
  const t = useT()
  return (
    <PopupShell
      kind="riverside"
      title={props.nome}
      subtitle={`${t('community.riverside')} · ${props.municipio}`}
      risk={props.risco}
      onClose={onClose}
    >
      {props.rio && <Fact icon={MapPinIcon} label={t('community.river')} value={props.rio} />}
      {props.cidade_prox && (
        <Fact
          icon={Navigation}
          label={t('community.nearestCity')}
          value={props.dist_cidade_km != null ? `${props.cidade_prox} (${props.dist_cidade_km} km)` : props.cidade_prox}
        />
      )}
      {props.dificuldade && <Fact icon={Users} label={t('community.access')} value={props.dificuldade} />}
      {props.atividade_principal_mun && (
        <Fact icon={Users} label={t('community.economy')} value={props.atividade_principal_mun} />
      )}
      <Fact icon={Flame} label={t('community.fires10km')} value={String(props.focos_10km)} />
      <div className="text-[12px] text-foreground/55 leading-snug">{t('community.riversideSource')}</div>
    </PopupShell>
  )
}
