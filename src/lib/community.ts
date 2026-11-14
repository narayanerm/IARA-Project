import type { RiversideProps, TiPointProps } from '@/data/layers/communities'
import type { CommunityKind } from '@/components/app/Map/community-kind'
import { bboxAround, type Bbox } from './polygon-bbox'

export type Step = 'know' | 'watch' | 'follow'
export const STEPS: readonly Step[] = ['know', 'watch', 'follow']

// Riverside communities are followed within the same radius used for their hotspot count (focos_10km).
export const RIVERSIDE_RADIUS_KM = 10

interface FocusBase {
  id: number
  name: string
  lngLat: [number, number]
  bbox: Bbox
}

export type Focus =
  | (FocusBase & { kind: 'indigenous'; props: TiPointProps })
  | (FocusBase & { kind: 'riverside'; props: RiversideProps })

export function focusFromTi(props: TiPointProps, lngLat: [number, number]): Focus {
  const box = [props.bw, props.bs, props.be, props.bn]
  const bbox = box.every((v) => typeof v === 'number' && Number.isFinite(v))
    ? (box as Bbox)
    : bboxAround(lngLat, 15)
  return { kind: 'indigenous', id: props.id, name: props.nome, lngLat, bbox, props }
}

export function focusFromRiverside(props: RiversideProps, lngLat: [number, number]): Focus {
  return {
    kind: 'riverside',
    id: props.id,
    name: props.nome,
    lngLat,
    bbox: bboxAround(lngLat, RIVERSIDE_RADIUS_KM),
    props,
  }
}

const KIND_PREFIX: Record<CommunityKind, string> = { indigenous: 'ti', riverside: 'rib' }

export function focusKey(f: { kind: CommunityKind; id: number }): string {
  return `${KIND_PREFIX[f.kind]}:${f.id}`
}

export function parseFocusKey(raw: string): { kind: CommunityKind; id: number } | null {
  const m = /^(ti|rib):(\d+)$/.exec(raw)
  if (!m) return null
  return { kind: m[1] === 'ti' ? 'indigenous' : 'riverside', id: Number(m[2]) }
}
