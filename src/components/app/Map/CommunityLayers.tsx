import { useEffect, useMemo } from 'react'
import { Layer, Source, useMap } from 'react-map-gl/maplibre'
import type { ExpressionSpecification, FilterSpecification, MapLayerMouseEvent } from 'maplibre-gl'
import { ExternalLink, Flame, History, MapPin as MapPinIcon, Navigation, Users } from 'lucide-react'
import { COMMUNITY_DATA, type RiversideProps, type TiPointProps } from '@/data/layers/communities'
import {
  FUNAI_TI_URL,
  tiProfileUrl,
  funaiSiciUrl,
  IBGE_BC250_URL,
  INPE_QUEIMADAS_URL,
  ibgeCidadeUrl,
} from '@/lib/links'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/store'
import { focusFromRiverside, focusFromTi, focusKey } from '@/lib/community'
import { loadCommunityIndex, useNeighbours } from '@/lib/useCommunityIndex'
import { KIND_COLOR, type CommunityKind } from './community-kind'
import { loadPinImage } from './pin-image'

const PIN_CSS_SIZE = 40
const PIN_IMAGE: Record<CommunityKind, string> = { indigenous: 'pin-indigenous', riverside: 'pin-riverside' }
const SOURCE: Record<CommunityKind, string> = { indigenous: 'ti-points', riverside: 'riverside-points' }
const PIN_LAYER: Record<CommunityKind, string> = { indigenous: 'ti-pins', riverside: 'riverside-pins' }

const IS_VILLAGE: ExpressionSpecification = ['==', ['get', 'tipo'], 'vila']

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
// Inside a community only its own pin and its neighbours stay, always labelled.
function PinLayer({ kind, only }: { kind: CommunityKind; only: number[] | null }) {
  const riverside = kind === 'riverside'
  const scale: ExpressionSpecification | number = riverside ? ['case', IS_VILLAGE, 1.2, 0.9] : 1
  const label: ExpressionSpecification = only
    ? ['get', 'nome']
    : riverside
    ? ['step', ['zoom'], '', 7, ['case', IS_VILLAGE, ['get', 'nome'], ''], 9, ['get', 'nome']]
    : ['step', ['zoom'], '', 6, ['get', 'nome']]
  const filter: FilterSpecification = only
    ? ['in', ['get', 'id'], ['literal', only]]
    : ['>=', ['zoom'], ['get', 'minzoom']]
  return (
    <Layer
      id={PIN_LAYER[kind]}
      source={SOURCE[kind]}
      type="symbol"
      filter={filter}
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

export function CommunityPoints() {
  usePinImages()
  const { current: ref } = useMap()
  const focus = useApp((s) => s.focus)
  const focusCommunity = useApp((s) => s.focusCommunity)
  const neighbours = useNeighbours(focus)

  const only = useMemo(() => {
    if (!focus) return null
    const ids: Record<CommunityKind, number[]> = { indigenous: [], riverside: [] }
    for (const f of [focus, ...neighbours.map((n) => n.entry.focus)]) ids[f.kind].push(f.id)
    return ids
  }, [focus, neighbours])

  useEffect(() => {
    const map = ref?.getMap()
    if (!map) return
    const kinds = Object.keys(PIN_LAYER) as CommunityKind[]
    const pointer = () => (map.getCanvas().style.cursor = 'pointer')
    const reset = () => (map.getCanvas().style.cursor = '')

    // Tile features drop null properties, so the full record comes from the shared index when it is loaded.
    const onPin = (kind: CommunityKind) => (e: MapLayerMouseEvent) => {
      const f = e.features?.[0]
      if (!f || f.geometry.type !== 'Point') return
      const lngLat = f.geometry.coordinates as [number, number]
      const fallback =
        kind === 'indigenous'
          ? focusFromTi(f.properties as TiPointProps, lngLat)
          : focusFromRiverside(f.properties as RiversideProps, lngLat)
      loadCommunityIndex()
        .then((index) => focusCommunity(index.byKey.get(focusKey(fallback))?.focus ?? fallback))
        .catch(() => focusCommunity(fallback))
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
  }, [ref, focusCommunity])

  return (
    <>
      <Source id={SOURCE.riverside} type="geojson" data={COMMUNITY_DATA.riverside}>
        <PinLayer kind="riverside" only={only?.riverside ?? null} />
      </Source>
      <Source id={SOURCE.indigenous} type="geojson" data={COMMUNITY_DATA.tiPoints}>
        <PinLayer kind="indigenous" only={only?.indigenous ?? null} />
      </Source>
    </>
  )
}

export function Fact({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
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

export function LinkButton({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
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

/** Who the TI is: ethnicities, area, boundary revision, hotspots and official sources. */
export function TiFacts({ props }: { props: TiPointProps }) {
  const t = useT()
  const fmt = (n: number) => n.toLocaleString('pt-BR')
  const ethnicities = props.etnia ? props.etnia.split(/[;,/]\s*/).filter(Boolean) : []
  return (
    <>
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
    </>
  )
}

export function AccessDifficulty({ level, distKm }: { level: string; distKm?: number }) {
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

/** Where the riverside community is and how hard it is to reach, with its official sources. */
export function RiversideFacts({ props }: { props: RiversideProps }) {
  const t = useT()
  return (
    <>
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
    </>
  )
}
