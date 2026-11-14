import type { RegionId } from '@/lib/types'

export type Intent =
  | { kind: 'focus'; region: RegionId; phenomenon: 'mining' | 'flood' | 'drought' }
  | { kind: 'timeline'; action: 'play' | 'start' | 'end' }
  | { kind: 'layer'; action: 'toggle-nasa' | 'toggle-truecolor' }
  | { kind: 'explain-sar' }
  | { kind: 'about' }
  | { kind: 'unknown'; query: string }

export function routeIntent(raw: string): Intent {
  const s = raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  if (/(garimpo|yanomami|homoxi|minera|ouro|pit)/.test(s))
    return { kind: 'focus', region: 'YANO', phenomenon: 'mining' }

  if (/(enchente|cheia|manaus|solimoes|encontro|flood|inunda)/.test(s))
    return { kind: 'focus', region: 'ENCH', phenomenon: 'flood' }

  if (/(seca|tefe|baixa|seco|drought|boto)/.test(s))
    return { kind: 'focus', region: 'SECA', phenomenon: 'drought' }

  if (/(toca|play|rodar|evolu|anim)/.test(s)) return { kind: 'timeline', action: 'play' }
  if (/(voltar|inicio|comeca)/.test(s)) return { kind: 'timeline', action: 'start' }
  if (/(fim|final|hoje|recente)/.test(s)) return { kind: 'timeline', action: 'end' }

  if (/(optico|true.?color|modis|vis[ií]vel)/.test(s))
    return { kind: 'layer', action: 'toggle-truecolor' }
  if (/(nasa|gibs|camada)/.test(s)) return { kind: 'layer', action: 'toggle-nasa' }

  if (/(l.?band|banda|physics|fisica|funciona|como)/.test(s)) return { kind: 'explain-sar' }
  if (/(sobre|quem|time|about|nisar|dados)/.test(s)) return { kind: 'about' }

  return { kind: 'unknown', query: raw }
}

// Pre-written narratives per intent; no free-form LLM output to avoid fabricated numbers.

const NARRATIVE_FOCUS: Record<RegionId, string> = {
  YANO: `Zoom em **Homoxi**, dentro da TI Yanomami.

Entre 2019 e 2022, a assinatura L-band (HH) mostrou **queda de 6-10 dB** em vários polígonos — consistente com conversão de dossel em solo exposto. A operação federal de fev/2023 marca um ponto de inflexão visível na série temporal.

Camadas ativadas: NDVI MODIS + polígonos de detecção.`,
  ENCH: `Centrando no **encontro Solimões–Negro**, Manaus.

A cheia de **maio/2024** bateu recorde histórico no porto de Manaus (30,70 m). SAR separa água de vegetação com threshold de amplitude: pixel especular ≈ -18 dB vs floresta inundada ≈ -8 dB.

Camada IMERG mostra o input de precipitação na bacia.`,
  SECA: `Zoom em **Lago Tefé**.

A seca histórica de **2023-24** retraiu a área hidrográfica a níveis associados à mortandade de botos-rosa. O sinal SAR aqui é **extensão** (área em km²) ao longo do tempo, não amplitude.

Camada AMSR2 complementa: umidade de solo passivo.`,
}

const NARRATIVE_EXPLAIN_SAR = `**SAR** = Synthetic Aperture Radar. Emite microondas e mede o retroespalhamento.

**NISAR** é L-band (λ ≈ 24 cm). Diferente do óptico, **penetra copa** e enxerga sob nuvem, fumaça e noite.

Para cada fenômeno, a física muda:
- **Garimpo**: queda de backscatter (mata → solo exposto)
- **Enchente**: reflexão especular (água lisa = pixel preto)
- **Seca**: retração de área hidrográfica detectável em série temporal`

const NARRATIVE_ABOUT = `**AmazonSAR Explorer** · NASA Space Apps 2026 · desafio "Dancing with the SARs".

Dados: NISAR (NASA/ISRO) · análogos históricos Sentinel-1 e ALOS-2 PALSAR via ASF DAAC. Validação: MapBiomas Alerta, DETER/INPE, ANA.

Chatbot: roteador determinístico atual (stub); evolui para Claude API com tool use. Não gera números, só narra evidência pré-computada.`

const NARRATIVE_UNKNOWN = `Não entendi o pedido. Tente algo como:
- "mostra o garimpo em Homoxi"
- "enchente de Manaus 2024"
- "seca do Tefé"
- "como o SAR funciona"`

export function narrativeFor(intent: Intent): string {
  switch (intent.kind) {
    case 'focus':
      return NARRATIVE_FOCUS[intent.region]
    case 'timeline':
      return intent.action === 'play'
        ? 'Reproduzindo série temporal. Observe a curva evoluir.'
        : intent.action === 'start'
        ? 'Voltando ao início da série.'
        : 'Saltando para o frame mais recente.'
    case 'layer':
      return intent.action === 'toggle-truecolor'
        ? 'Alternando camada óptica (MODIS true color). Note onde o SAR enxerga e o óptico cega.'
        : 'Alternando camada NASA GIBS auxiliar.'
    case 'explain-sar':
      return NARRATIVE_EXPLAIN_SAR
    case 'about':
      return NARRATIVE_ABOUT
    case 'unknown':
      return NARRATIVE_UNKNOWN
  }
}

export const SUGGESTIONS = [
  'mostra o garimpo em Homoxi',
  'enchente de Manaus 2024',
  'seca do Lago Tefé',
  'como o SAR funciona',
] as const
