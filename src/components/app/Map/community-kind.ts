export type CommunityKind = 'indigenous' | 'riverside'

export const KIND_COLOR: Record<CommunityKind, { fill: string; ink: string }> = {
  indigenous: { fill: 'hsl(135 19% 92%)', ink: 'hsl(154 26% 5%)' },
  riverside: { fill: 'hsl(198 51% 57%)', ink: 'hsl(154 26% 5%)' },
}
