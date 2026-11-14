import { Fragment, useMemo, useState } from 'react'
import { Marker, Popup } from 'react-map-gl/maplibre'
import { ChevronDown, Crosshair, ExternalLink, Landmark, MapPin, Users } from 'lucide-react'
import { INDIGENOUS_LANDS, polygonCentroid, type TiProps } from '@/data/layers/indigenous-lands'
import {
  FUNAI_FETCHED_AT,
  funaiArea,
  funaiCrName,
  funaiCrPage,
  funaiDate,
  funaiList,
  funaiOutlineUrl,
  funaiRecordFor,
  funaiUf,
  type FunaiTiRecord,
} from '@/lib/funai'
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
          <TiPopupBody
            key={openTarget.id}
            props={openTarget.props}
            onClose={() => setOpenId(null)}
          />
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
        active ? 'scale-125' : 'hover:scale-110'
      )}
      style={{ width: 32, height: 32 }}
    >
      <div
        className={cn(
          'absolute inset-0 rounded-full border',
          active ? 'border-sar-amber/90 animate-pulse-soft' : 'border-sar-amber/60'
        )}
      />
      <div
        className={cn(
          'absolute rounded-full border',
          active ? 'border-sar-amber/90' : 'border-sar-amber/50'
        )}
        style={{ inset: 7 }}
      />
      <Crosshair
        className={cn(
          'relative drop-shadow-[0_0_6px_hsla(28,95%,60%,0.6)]',
          active ? 'text-sar-amber' : 'text-sar-amber/85'
        )}
        style={{ width: 14, height: 14 }}
      />
    </div>
  )
}

function TiPopupBody({ props, onClose }: { props: TiProps; onClose: () => void }) {
  const record = funaiRecordFor(props.name)
  const [showFunai, setShowFunai] = useState(false)

  return (
    <div className="bg-card/95 backdrop-blur-xl border border-sar-amber/40 rounded-lg overflow-hidden min-w-[280px]">
      <div className="bg-sar-amber/10 px-3 py-2 border-b border-sar-amber/30 flex items-start gap-2">
        <MapPin className="h-4 w-4 text-sar-amber shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground leading-tight">{props.name}</div>
          <div className="text-[13px] font-mono text-muted-foreground mt-0.5">
            {props.state} · {props.year}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-sm"
          aria-label="Fechar"
        >
          ×
        </button>
      </div>

      <div className="p-3 space-y-2">
        {!showFunai && (
          <div className="grid grid-cols-2 gap-2">
            <StatBlock label="Área" value={`${props.area_km2.toLocaleString('pt-BR')} km²`} />
            <StatBlock label="Status" value={props.status} />
          </div>
        )}
        {props.population && (
          <div className="flex items-center gap-2 bg-background/60 border border-border/60 rounded-md px-2.5 py-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex-1 text-[13px] text-foreground">
              {props.population.toLocaleString('pt-BR')} habitantes
            </div>
          </div>
        )}
        {!showFunai && props.ethnicities && props.ethnicities.length > 0 && (
          <div>
            <div className="text-[12px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
              Etnias
            </div>
            <div className="flex flex-wrap gap-1">
              {props.ethnicities.map((e) => (
                <span
                  key={e}
                  className="rounded-full bg-background/60 border border-border/60 px-2 py-0.5 text-[12px] text-foreground/90"
                >
                  {e}
                </span>
              ))}
            </div>
          </div>
        )}

        {record && (
          <button
            type="button"
            onClick={() => setShowFunai((v) => !v)}
            aria-expanded={showFunai}
            className="w-full flex items-center justify-between rounded-md bg-sar-amber/10 hover:bg-sar-amber/15 border border-sar-amber/30 px-2.5 py-1.5 text-[13px] text-sar-amber font-mono transition-colors"
          >
            <span>{showFunai ? 'Ocultar registro da FUNAI' : 'Consultar na FUNAI'}</span>
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform', showFunai && 'rotate-180')}
            />
          </button>
        )}
        {record && showFunai && <FunaiRecordPanel record={record} />}
        <div className="text-[11px] text-muted-foreground/70 leading-snug">
          Contorno simplificado para visualização. Fonte oficial: FUNAI · SIG Indigenista.
        </div>
      </div>
    </div>
  )
}

// Registro oficial da TI na base aberta da FUNAI, com o limite oficial
// desenhado ao vivo pelo GeoServer da FUNAI.
function FunaiRecordPanel({ record }: { record: FunaiTiRecord }) {
  const [outlineState, setOutlineState] = useState<'loading' | 'ok' | 'error'>('loading')
  const outlineUrl = funaiOutlineUrl(record, 560, 240)
  const area = funaiArea(record.areaHa)
  const etnias = funaiList(record.etnias)
  const municipios = funaiList(record.municipios)
  const crName = funaiCrName(record.cr)
  const crPage = funaiCrPage(record)

  const rows: [string, string | null][] = [
    ['Fase', record.fase],
    ['Modalidade', record.modalidade],
    ['Área oficial', area ? `${area.ha} (${area.km2})` : null],
    ['UF', funaiUf(record.uf)],
    [
      'Coordenação Regional',
      crName ? `${crName}${record.crSigla ? ` (${record.crSigla})` : ''}` : null,
    ],
    ['Faixa de fronteira', record.faixaFronteira],
    ['Em reestudo', record.reestudo],
    ['Atualizado pela FUNAI', funaiDate(record.atualizadoEm) ?? 'data não informada'],
  ]

  return (
    <section
      aria-label="Registro oficial da FUNAI"
      className="rounded-md border border-[#4f9a6a]/50 bg-[#4f9a6a]/10 overflow-hidden"
    >
      <header className="flex items-center gap-2 px-2.5 py-1.5 border-b border-[#4f9a6a]/30">
        <Landmark className="h-3.5 w-3.5 text-[#4f9a6a] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium uppercase tracking-wider text-[#4f9a6a]">
            Registro oficial FUNAI
          </div>
          <div className="text-[13px] text-foreground leading-tight truncate">
            TI {record.nome}
          </div>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground shrink-0">
          cód. {record.codigo}
        </span>
      </header>

      <div
        className="max-h-[42vh] overflow-y-auto p-2.5 space-y-2.5"
        onWheel={(e) => e.stopPropagation()}
      >
        {outlineUrl && outlineState !== 'error' && (
          <figure>
            <div className="relative aspect-[560/240] rounded border border-border/60 bg-background/60 overflow-hidden">
              {outlineState === 'loading' && (
                <div className="absolute inset-0 grid place-items-center text-[11px] text-muted-foreground">
                  Carregando limite oficial…
                </div>
              )}
              <img
                src={outlineUrl}
                alt={`Limite oficial da TI ${record.nome}`}
                className={cn(
                  'relative w-full h-full transition-opacity',
                  outlineState === 'ok' ? 'opacity-100' : 'opacity-0'
                )}
                onLoad={() => setOutlineState('ok')}
                onError={() => setOutlineState('error')}
              />
            </div>
            <figcaption className="mt-1 text-[11px] text-muted-foreground leading-snug">
              Limite oficial, desenhado ao vivo pelo GeoServer da FUNAI.
            </figcaption>
          </figure>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px] leading-snug">
          {rows
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <Fragment key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-foreground">{value}</dd>
              </Fragment>
            ))}
        </dl>

        {etnias.length > 0 && (
          <div>
            <div className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Povos (FUNAI)
            </div>
            <div className="flex flex-wrap gap-1">
              {etnias.map((e) => (
                <span
                  key={e}
                  className="rounded-full bg-background/60 border border-border/60 px-2 py-0.5 text-[12px] text-foreground/90"
                >
                  {e}
                </span>
              ))}
            </div>
          </div>
        )}

        {municipios.length > 0 && (
          <div>
            <div className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Municípios
            </div>
            <div className="text-[12px] text-foreground/90 leading-snug">
              {municipios.join(', ')}
            </div>
          </div>
        )}

        {crPage && (
          <a
            href={crPage.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 rounded-md border border-[#4f9a6a]/50 bg-[#4f9a6a]/10 hover:bg-[#4f9a6a]/20 px-2.5 py-1.5 transition-colors"
          >
            <span className="min-w-0">
              <span className="block text-[12px] text-foreground">FUNAI na região</span>
              <span className="block text-[11px] text-muted-foreground truncate">
                {crPage.name} · gov.br/funai
              </span>
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#4f9a6a]" />
          </a>
        )}

        <div className="text-[11px] text-muted-foreground/80 leading-snug">
          Dados da base aberta da FUNAI (GeoServer, camada tis_poligonais), copiados em{' '}
          {funaiDate(FUNAI_FETCHED_AT)}.
        </div>
      </div>
    </section>
  )
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-background/60 border border-border/60 px-2 py-1.5">
      <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-[13px] text-foreground mt-0.5 capitalize">{value}</div>
    </div>
  )
}
