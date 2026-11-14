import { MapPin, Sailboat, TentTree } from 'lucide-react'
import { KIND_COLOR, type CommunityKind } from './community-kind'

const GLYPH = { indigenous: TentTree, riverside: Sailboat }

// Lucide MapPin as the pin body with the kind glyph inside its head.
export function CommunityPin({ kind, size = 40 }: { kind: CommunityKind; size?: number }) {
  const { fill, ink } = KIND_COLOR[kind]
  const Glyph = GLYPH[kind]
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <MapPin x={0} y={0} width={24} height={24} fill={fill} stroke={ink} strokeWidth={1.25} />
      <circle cx={12} cy={10} r={6.2} fill={fill} />
      <Glyph x={7.6} y={5.6} width={8.8} height={8.8} stroke={ink} strokeWidth={2.4} />
    </svg>
  )
}
