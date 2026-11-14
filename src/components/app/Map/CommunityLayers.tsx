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
        'text-halo-color': 'hsl(222 47% 6% / 0.95)',
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
      className="w-[min(320px,calc(100vw-48px))] max-h-[min(460px,calc(100dvh-140px))] overflow-y-auto overscroll-contain rounded-xl border bg-card shadow-2xl"
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
  const ethnicities = props.etnia ? props.etnia.split(/[;,/]\s*/).filter(Boolean) : []
  return (
    <PopupShell
      kind="indigenous"
      title={props.nome}
      subtitle={[t('community.indigenous'), props.fase].filter(Boolean).join(' · ')}
      risk={props.risco}
      onClose={onClose}
    >
      {ethnicities.length > 0 && (
        <div className="rounded-md border border-sar-amber/30 bg-sar-amber/5 p-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-sar-amber/90">
            {t('community.ethnicities')}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {ethnicities.map((e) => (
              <span
                key={e}
                className="rounded-full bg-sar-amber/15 border border-sar-amber/30 px-2 py-0.5 text-[12px] font-semibold text-foreground"
              >
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
            .join(' · ')}
        />
      )}
      <Fact icon={Flame} label={t('community.fires2026')} value={fmt(props.focos_2026)} />
      <div className="grid gap-1.5 pt-1">
        {props.isaId != null && <LinkButton href={tiProfileUrl(props.isaId)} label={t('community.tiProfile')} primary />}
        <LinkButton
          href={funaiSiciUrl(props.nome)}
          label={`FUNAI · ${props.nome.replace(/^TI\s+/i, '')}`}
          primary={props.isaId == null}
        />
        <LinkButton href={FUNAI_TI_URL} label={t('community.funai')} />
      </div>
      <div className="text-[12px] text-foreground/55 leading-snug">
        Limites:{' '}
        <a
          href="https://terrabrasilis.dpi.inpe.br/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          FUNAI via TerraBrasilis/INPE
        </a>
        .
      </div>
    </PopupShell>
  )
}

function AccessDifficulty({ level, distKm }: { level: string; distKm?: number }) {
  const key = level.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const meta: Record<string, { label: string; color: string; hint: string }> = {
    baixa: {
      label: 'Baixa',
      color: 'hsl(140 60% 45%)',
      hint: 'Acesso rodoviário pavimentado ou curta travessia (< 20 km da cidade).',
    },
    media: {
      label: 'Média',
      color: 'hsl(38 95% 55%)',
      hint: 'Estrada precária + travessia fluvial · 20–100 km da cidade.',
    },
    alta: {
      label: 'Alta',
      color: 'hsl(0 85% 55%)',
      hint: 'Só por rio/avião · > 100 km da cidade, dias de viagem.',
    },
    'muito alta': {
      label: 'Muito alta',
      color: 'hsl(0 85% 45%)',
      hint: 'Isolamento extremo · regularmente sem navegação na seca.',
    },
  }
  const m = meta[key] ?? { label: level, color: 'hsl(220 10% 60%)', hint: '' }
  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Dificuldade de acesso
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-mono font-semibold text-background"
          style={{ background: m.color }}
        >
          {m.label}
        </span>
      </div>
      {m.hint && (
        <div className="mt-1 text-[11px] text-foreground/80 leading-snug">
          {m.hint}
          {distKm != null && (
            <span className="text-muted-foreground"> · medido: {distKm} km</span>
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
      {props.dificuldade && (
        <AccessDifficulty level={props.dificuldade} distKm={props.dist_cidade_km ?? undefined} />
      )}
      {props.atividade_principal_mun && (
        <Fact icon={Users} label={t('community.economy')} value={props.atividade_principal_mun} />
      )}
      <Fact icon={Flame} label={t('community.fires10km')} value={String(props.focos_10km)} />
      <div className="grid gap-1.5 pt-1">
        {props.municipio && (
          <LinkButton
            href={ibgeCidadeUrl(props.municipio)}
            label={`IBGE Cidades · ${props.municipio}`}
            primary
          />
        )}
        <LinkButton href={IBGE_BC250_URL} label="IBGE BC250 · base cartográfica" />
        <LinkButton href={INPE_QUEIMADAS_URL} label="INPE Queimadas · focos de calor" />
      </div>
      <div className="text-[12px] text-foreground/55 leading-snug">
        Localização:{' '}
        <a
          href={IBGE_BC250_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          IBGE BC250
        </a>
        . Focos:{' '}
        <a
          href={INPE_QUEIMADAS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          INPE
        </a>
        .
      </div>
    </PopupShell>
  )
}
