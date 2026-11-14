import type { Risk } from '@/data/layers/communities'
import type { TKey } from '@/lib/i18n'

export const RISK_TONE: Record<Risk, string> = {
  baixo: 'text-emerald-300 border-emerald-400/40 bg-emerald-400/10',
  moderado: 'text-yellow-200 border-yellow-300/40 bg-yellow-300/10',
  alto: 'text-orange-300 border-orange-400/40 bg-orange-400/10',
  'muito alto': 'text-red-300 border-red-400/50 bg-red-400/10',
}

export const RISK_KEY: Record<Risk, TKey> = {
  baixo: 'community.risk.low',
  moderado: 'community.risk.moderate',
  alto: 'community.risk.high',
  'muito alto': 'community.risk.veryHigh',
}
