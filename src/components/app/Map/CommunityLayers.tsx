import { useEffect, useState } from 'react'
import { Layer, Popup, Source, useMap } from 'react-map-gl/maplibre'
import type {
  ExpressionSpecification,
  MapLayerMouseEvent,
  Map as MapLibreMap,
  PointLike,
  PositionAnchor,
} from 'maplibre-gl'
import { ExternalLink, Flame, History, MapPin as MapPinIcon, Navigation, Users, X } from 'lucide-react'
import { COMMUNITY_DATA, type Risk, type RiversideProps, type TiPointProps } from '@/data/layers/communities'
import {
  FUNAI_TI_URL,
  tiProfileUrl,
  funaiSiciUrl,
  IBGE_BC250_URL,
  INPE_QUEIMADAS_URL,
  ibgeCidadeUrl,
} from '@/lib/links'
import { useT, type TKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CommunityPin } from './CommunityPin'
import { KIND_COLOR, type CommunityKind } from './community-kind'
import { loadPinImage } from './pin-image'

const PIN_CSS_SIZE = 40
const PIN_IMAGE: Record<CommunityKind, string> = { indigenous: 'pin-indigenous', riverside: 'pin-riverside' }
const SOURCE: Record<CommunityKind, string> = { indigenous: 'ti-points', riverside: 'riverside-points' }
const PIN_LAYER: Record<CommunityKind, string> = { indigenous: 'ti-pins', riverside: 'riverside-pins' }

// Pin tip sits on the point, so the balloon needs room for the pin body when it opens above.
const PIN_TIP = 48
const POPUP_OFFSET: Record<PositionAnchor, PointLike> = {
  center: [0, -PIN_TIP / 2],
  top: [0, 6],
  'top-left': [0, 6],
  'top-right': [0, 6],
  bottom: [0, -PIN_TIP],
  'bottom-left': [0, -PIN_TIP],
  'bottom-right': [0, -PIN_TIP],
  left: [18, -PIN_TIP / 2],
  right: [-18, -PIN_TIP / 2],
}

const IS_VILLAGE: ExpressionSpecification = ['==', ['get', 'tipo'], 'vila']

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

// Each point carries the zoom at which it is revealed (scripts/build-community-data.mjs),
// so the overview shows a spaced-out subset and every pin is visible from zoom 11 on.
function PinLayer({ kind }: { kind: CommunityKind }) {
  const riverside = kind === 'riverside'
  const scale: ExpressionSpecification | number = riverside ? ['case', IS_VILLAGE, 1.2, 0.9] : 1
  const label: ExpressionSpecification = riverside
    ? ['step', ['zoom'], '', 7, ['case', IS_VILLAGE, ['get', 'nome'], ''], 9, ['get', 'nome']]
    : ['step', ['zoom'], '', 6, ['get', 'nome']]
  return (
    <Layer
      id={PIN_LAYER[kind]}
      source={SOURCE[kind]}
      type="symbol"
      filter={['>=', ['zoom'], ['get', 'minzoom']]}
      layout={{
        'icon-image': PIN_IMAGE[kind],
        'icon-anchor': 'bottom',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 4, ['*', 0.8, scale], 9, ['*', 1, scale], 13, ['*', 1.15, scale]],
        'icon-allow-overlap': true,
        'symbol-sort-key': ['get', 'minzoom'],
        'text-field': label,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 6, 11.5, 13, 14],
        'text-anchor': 'top',
        'text-offset': [0, 0.35],
        'text-max-width': 10,
        'text-optional': true,
      }}
      paint={{
        'text-color': 'hsl(0 0% 96%)',
        'text-halo-color': 'hsl(154 26% 5% / 0.95)',
        'text-halo-width': 1.6,
      }}
    />
  )
}

// Zooms toward the pin and parks it in the lower part of the map so the balloon above it fits.
function focusOn(map: MapLibreMap, sel: Selected) {
  const height = map.getContainer().clientHeight
  const current = map.getZoom()
  let zoom = Math.max(current, 10.5)
  if (sel.kind === 'indigenous') {
    const { bw, bs, be, bn } = sel.props
    const fit = map.cameraForBounds(
      [
        [bw, bs],
        [be, bn],
      ],
      { padding: 48, maxZoom: 11 }
    )
    zoom = Math.max(current, fit?.zoom ?? current)
  }
  map.easeTo({
    center: sel.lngLat,
    zoom,
    offset: [0, Math.round(height * 0.22)],
    duration: 900,
    essential: true,
  })
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
      const sel = { kind, lngLat: f.geometry.coordinates as [number, number], props: f.properties } as Selected
      setSelected(sel)
      focusOn(map, sel)
    }

    const handlers = kinds.map((kind) => [PIN_LAYER[kind], onPin(kind)] as const)
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
      <Source id={SOURCE.riverside} type="geojson" data={COMMUNITY_DATA.riverside}>
        <PinLayer kind="riverside" />
      </Source>
      <Source id={SOURCE.indigenous} type="geojson" data={COMMUNITY_DATA.tiPoints}>
        <PinLayer kind="indigenous" />
      </Source>

      {selected && (
        <Popup
          longitude={selected.lngLat[0]}
          latitude={selected.lngLat[1]}
          offset={POPUP_OFFSET}
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

// Fire risk reads as a scale from muted to the deep orange used for damage elsewhere on the map.
const RISK_TONE: Record<Risk, string> = {
  baixo: 'text-muted-foreground border-border',
  moderado: 'text-foreground border-border',
  alto: 'text-foreground border-iara-orange-deep bg-iara-orange-deep/20',
  'muito alto': 'text-foreground border-destructive bg-destructive/20',
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
    <div className="w-[min(320px,calc(100vw-48px))] max-h-[min(460px,calc(100dvh-140px))] overflow-y-auto overscroll-contain rounded-lg border border-border bg-card">
      <div className="flex items-start gap-2.5 border-b border-border px-3 py-2.5">
        <CommunityPin kind={kind} size={26} />
        <div className="min-w-0 flex-1">
          <div className="break-words text-[15px] font-semibold leading-snug text-foreground">{title}</div>
          <div className="mt-0.5 break-words text-[13px] text-muted-foreground">{subtitle}</div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-raised hover:text-foreground"
          aria-label={t('community.close')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2.5 px-3 py-3">
        {risk && (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[12px] font-medium',
              RISK_TONE[risk]
            )}
          >
            <Flame className="h-3.5 w-3.5" />
            {t('community.fireRisk')}: {t(RISK_KEY[risk])}
          </span>
        )}
        {children}
      </div>
    </div>
  )
}

function Fact({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-[13px]">
      <Icon className="mt-px h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 break-words">
        <span className="text-muted-foreground">{label}: </span>
        <span className="tabular-nums text-foreground">{value}</span>
      </div>
    </div>
  )
}

function LinkButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-[13px] text-foreground transition-colors hover:bg-raised"
    >
      <span className="min-w-0 truncate">{label}</span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </a>
  )
}

function SourceNote({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] leading-snug text-muted-foreground">{children}</div>
}

function SourceA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
      {children}
    </a>
  )
}

function TiPopup({ props, onClose }: { props: TiPointProps; onClose: () => void }) {
  const t = useT()
  const fmt = (n: number) => n.toLocaleString('en-US')
  const ethnicities = props.etnia ? props.etnia.split(/[;,/]\s*/).filter(Boolean) : []
  return (
    <PopupShell
      kind="indigenous"
      title={props.nome}
      subtitle={[t('community.indigenous'), props.fase].filter(Boolean).join(', ')}
      risk={props.risco}
      onClose={onClose}
    >
      {ethnicities.length > 0 && (
        <div>
          <div className="text-[12px] text-muted-foreground">{t('community.ethnicities')}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {ethnicities.map((e) => (
              <span key={e} className="rounded-md bg-raised px-2 py-0.5 text-[12px] font-medium text-foreground">
                {e}
              </span>
            ))}
          </div>
        </div>
      )}
      {props.area_km2 != null && (
        <Fact icon={MapPinIcon} label={t('community.area')} value={`${fmt(props.area_km2)} km²`} />
      )}
      {props.revisao_fase && (
        <Fact
          icon={History}
          label={t('community.revision')}
          value={[props.revisao_fase, props.revisao_area_km2 != null ? `${fmt(props.revisao_area_km2)} km²` : null]
            .filter(Boolean)
            .join(', ')}
        />
      )}
      <Fact icon={Flame} label={t('community.fires2026')} value={fmt(props.focos_2026)} />
      <div className="grid gap-1.5 pt-1">
        {props.isaId != null && <LinkButton href={tiProfileUrl(props.isaId)} label={t('community.tiProfile')} />}
        <LinkButton href={funaiSiciUrl(props.nome)} label={`FUNAI, ${props.nome.replace(/^TI\s+/i, '')}`} />
        <LinkButton href={FUNAI_TI_URL} label={t('community.funai')} />
      </div>
      <SourceNote>
        {t('community.limits')}: <SourceA href="https://terrabrasilis.dpi.inpe.br/">FUNAI via TerraBrasilis/INPE</SourceA>.
      </SourceNote>
    </PopupShell>
  )
}

const ACCESS_KEY: Record<string, { label: TKey; hint: TKey; tone: string }> = {
  baixa: { label: 'community.access.low', hint: 'community.access.lowHint', tone: 'bg-raised text-foreground' },
  media: { label: 'community.access.medium', hint: 'community.access.mediumHint', tone: 'bg-raised text-foreground' },
  alta: { label: 'community.access.high', hint: 'community.access.highHint', tone: 'bg-iara-orange-deep/30 text-foreground' },
  'muito alta': {
    label: 'community.access.veryHigh',
    hint: 'community.access.veryHighHint',
    tone: 'bg-destructive/30 text-foreground',
  },
}

function AccessDifficulty({ level, distKm }: { level: string; distKm?: number }) {
  const t = useT()
  const key = level.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const m = ACCESS_KEY[key]
  return (
    <div className="rounded-md border border-border p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12px] text-muted-foreground">{t('community.access')}</div>
        <span className={cn('rounded-md px-2 py-0.5 text-[12px] font-medium', m?.tone ?? 'bg-raised text-foreground')}>
          {m ? t(m.label) : level}
        </span>
      </div>
      {m && (
        <div className="mt-1 text-[12px] leading-snug text-foreground">
          {t(m.hint)}
          {distKm != null && (
            <span className="text-muted-foreground"> {t('community.measured', { km: String(distKm) })}</span>
          )}
        </div>
      )}
    </div>
  )
}

function RiversidePopup({ props, onClose }: { props: RiversideProps; onClose: () => void }) {
  const t = useT()
  return (
    <PopupShell
      kind="riverside"
      title={props.nome}
      subtitle={`${t('community.riverside')}, ${props.municipio}`}
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
      {props.dificuldade && (
        <AccessDifficulty level={props.dificuldade} distKm={props.dist_cidade_km ?? undefined} />
      )}
      {props.atividade_principal_mun && (
        <Fact icon={Users} label={t('community.economy')} value={props.atividade_principal_mun} />
      )}
      <Fact icon={Flame} label={t('community.fires10km')} value={String(props.focos_10km)} />
      <div className="grid gap-1.5 pt-1">
        {props.municipio && <LinkButton href={ibgeCidadeUrl(props.municipio)} label={`IBGE Cidades, ${props.municipio}`} />}
        <LinkButton href={IBGE_BC250_URL} label={t('community.ibgeBase')} />
        <LinkButton href={INPE_QUEIMADAS_URL} label={t('community.inpeFires')} />
      </div>
      <SourceNote>
        {t('community.location')}: <SourceA href={IBGE_BC250_URL}>IBGE BC250</SourceA>. {t('community.hotspots')}:{' '}
        <SourceA href={INPE_QUEIMADAS_URL}>INPE</SourceA>.
      </SourceNote>
    </PopupShell>
  )
}
