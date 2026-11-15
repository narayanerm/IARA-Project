import type { Lang } from '@/lib/i18n'
import type { AgentAction } from './agent'

// Kept here rather than in i18n.ts so the agent stays a self-contained module.
const TEXT = {
  pt: {
    done: 'Pronto, já mudei o mapa.',
    empty: 'Não consegui responder agora. Tente de novo com outras palavras.',
    actions: 'O que o assistente fez no site',
  },
  en: {
    done: 'Done, the map is updated.',
    empty: "I couldn't answer that right now. Try rephrasing.",
    actions: 'What the assistant did on the site',
  },
} as const

export const agentText = (k: keyof (typeof TEXT)['pt'], lang: Lang) => TEXT[lang][k]

const NAMES: Record<string, { pt: string; en: string }> = {
  open_case: { pt: 'abriu caso', en: 'opened case' },
  close_case: { pt: 'voltou aos casos', en: 'back to cases' },
  open_case_tab: { pt: 'aba', en: 'tab' },
  focus_hotspot: { pt: 'zona de risco', en: 'risk zone' },
  set_case_year: { pt: 'ano', en: 'year' },
  fly_to: { pt: 'moveu o mapa', en: 'moved map' },
  reset_camera: { pt: 'recentralizou', en: 're-centred' },
  focus_indigenous_land: { pt: 'terra indígena', en: 'Indigenous land' },
  set_map_layers: { pt: 'camadas', en: 'layers' },
  set_sar_product: { pt: 'produto SAR', en: 'SAR product' },
  set_radar_opacity: { pt: 'opacidade', en: 'opacity' },
  open_side_panel: { pt: 'painel', en: 'panel' },
  set_language: { pt: 'idioma', en: 'language' },
}

export function actionLabel(a: AgentAction, lang: Lang): string {
  const name = NAMES[a.name]?.[lang] ?? a.name
  let detail = ''
  try {
    const args = JSON.parse(a.args || '{}') as Record<string, unknown>
    if (a.name === 'set_map_layers') {
      detail = Object.entries(args)
        .map(([k, v]) => `${k} ${v ? 'on' : 'off'}`)
        .join(', ')
    } else if (a.name === 'fly_to') {
      detail = `${Number(args.lat).toFixed(2)}, ${Number(args.lon).toFixed(2)}`
    } else {
      detail = Object.values(args).map(String).join(' ')
    }
  } catch {}
  return detail ? `${name}: ${detail}` : name
}
