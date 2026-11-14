export type CommunityKind = 'indigenous' | 'riverside'

export const KIND_COLOR: Record<CommunityKind, { fill: string; ink: string }> = {
  indigenous: { fill: 'hsl(28 92% 58%)', ink: 'hsl(222 47% 8%)' },
  riverside: { fill: 'hsl(174 72% 52%)', ink: 'hsl(222 47% 8%)' },
}
