import type { Risk } from '@/data/layers/communities'
import type { TKey } from '@/lib/i18n'

export const RISK_KEY: Record<Risk, TKey> = {
  baixo: 'community.risk.low',
  moderado: 'community.risk.moderate',
  alto: 'community.risk.high',
  'muito alto': 'community.risk.veryHigh',
}
