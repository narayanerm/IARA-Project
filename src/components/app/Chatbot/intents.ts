import type { ProductLayer, RegionId } from '@/lib/types'
import { INDIGENOUS_LANDS, type TiProps } from '@/data/layers/indigenous-lands'
import type { Polygon } from 'geojson'

export type Intent =
  | { kind: 'focus'; region: RegionId; phenomenon: 'mining' | 'flood' | 'drought' }
  | {
      kind: 'focus-ti'
      tiName: string
      center: [number, number]
      zoom?: number
    }
  | { kind: 'timeline'; action: 'play' | 'start' | 'end' }
  | { kind: 'layer'; action: 'toggle-nasa' | 'toggle-truecolor' }
  | { kind: 'layer-set'; layer: ProductLayer }
  | {
      kind: 'nisar'
      action: 'show' | 'hide' | 'toggle' | 'opacity-up' | 'opacity-down'
    }
  | { kind: 'explain-sar' }
  | { kind: 'about' }
  | { kind: 'help' }
  | { kind: 'unknown'; query: string }

// --- Normalization -------------------------------------------------------

function norm(raw: string): string {
  return raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// --- Verb buckets --------------------------------------------------------
// These are OR-joined regexes; the whole message is matched against them,
// so order within a bucket doesn't matter.

// "mostra | ver | zoom | ir | voa | centraliza | foca | abre | navega"
const VERB_SHOW = /(mostra|most(ra|re)|ver|vejo|olha|zoom|zoom[a-z]+|ir\b|vou|voa[r]?|centraliza|foca[r]?|abre|abrir|navega[r]?|carrega[r]?|leva[r]?)/

// "busca | procura | encontra | cade | cadê | onde"
const VERB_SEARCH = /(busca[r]?|procura[r]?|encontra[r]?|acha[r]?|cade|cad[eê]|onde\s+(fica|est[áa]|t(em|a))|where)/

// "liga | ativa | mostra | habilita"
const VERB_ON = /(liga[r]?|ativa[r]?|habilita[r]?|exibe|exibir|mostra[r]?|aparece[r]?|on\b)/

// "desliga | esconde | some | remove | desativa | fecha"
const VERB_OFF = /(desliga[r]?|esconde[r]?|some[r]?|some|remove[r]?|desativa[r]?|fecha[r]?|oculta[r]?|off\b)/

// --- Entity buckets ------------------------------------------------------

const REGION_PATTERNS: Array<{
  region: RegionId
  phen: 'mining' | 'flood' | 'drought'
  rx: RegExp
}> = [
  {
    region: 'YANO',
    phen: 'mining',
    rx: /(garimp|yanomam|homox|minera|mina[r]?|ouro|pit)/,
  },
  {
    region: 'ENCH',
    phen: 'flood',
    rx: /(enchent|cheia|manaus|solim[oõ]es|encontro\s+das|alaga|inunda|flood)/,
  },
  {
    region: 'SECA',
    phen: 'drought',
    rx: /(\bseca\b|tef[eé]|baixa\s+do|seco|drought|boto)/,
  },
]

const LAYER_PATTERNS: Array<{ layer: ProductLayer; rx: RegExp }> = [
  { layer: 'amplitude', rx: /(amplitude|backscatter|intensidad|sigma0|sigma\s*0)/ },
  { layer: 'coherence', rx: /(coerenci|coherence|correla[çc][aã]o)/ },
  {
    layer: 'interferogram',
    rx: /(interferogr|insar|gunw|fase\s+(interfer|sar)|franja|fringe)/,
  },
  { layer: 'displacement', rx: /(deslocament|displacement|subsid|afunda|recalque)/ },
  { layer: 'change', rx: /(mudan[çc]a|change\s+detect|detec[çc][aã]o)/ },
]

// "nisar | radar | satélite | sentinela 1" (treats NISAR controls generically)
const NISAR_RX = /(nisar|sat[eé]lite|radar\s+(sar)?|imagem\s+sar|cena\s+sar)/
const OPACITY_UP_RX = /(aumenta|sobe|mais|claro|\+)/
const OPACITY_DOWN_RX = /(diminui|baixa|menos|escuro|\-)/

// Optical / GIBS
const OPTICAL_RX = /(optico|[óo]ptico|true.?color|modis|vis[ií]vel|colorido)/
const NASA_GIBS_RX = /(nasa|gibs|camada\s+nasa|ndvi|imerg|chuva|umidade|amsr)/

// Timeline
const TL_PLAY_RX = /(toca|play|rodar|rode|roda|evolu|anim|reproduz|avan[çc]a)/
const TL_START_RX = /(voltar|volta\b|in[ií]cio|come[çc]a|reset|zero)/
const TL_END_RX = /(fim|final|hoje|recente|[úu]ltimo)/

// Help / meta
const HELP_RX = /(ajuda|help|comando|o\s+que\s+(posso|voce|vc|rolla|rola|d[aá]|faz)|como\s+usa|use)/
const ABOUT_RX = /(sobre|quem|time|about|dados|origem|cr[eé]dito|atribu)/
const EXPLAIN_RX = /(l.?band|banda|physics|f[ií]sica|funciona|como\s+(o\s+)?sar|por\s+que|how|what\s+is\s+sar)/

// --- TI index (built once from the hand-drawn dataset) ------------------

interface TiEntry {
  name: string
  normName: string
  normNameNoPrefix: string // "TI Yanomami" → "yanomami"
  center: [number, number]
  zoom: number
  ethnicities: string[]
  area_km2: number
}

function polygonCentroid(poly: Polygon): [number, number] {
  const ring = poly.coordinates[0]
  let sx = 0
  let sy = 0
  for (const [x, y] of ring) {
    sx += x
    sy += y
  }
  const n = ring.length
  return [sx / n, sy / n]
}

function zoomForArea(areaKm2: number): number {
  if (areaKm2 > 50_000) return 6.5
  if (areaKm2 > 10_000) return 7.5
  if (areaKm2 > 2_000) return 8.5
  return 9.5
}

const TI_INDEX: TiEntry[] = INDIGENOUS_LANDS.features.map((f) => {
  const p = f.properties as TiProps
  const nameNoPrefix = p.name.replace(/^TI\s+/i, '')
  return {
    name: p.name,
    normName: norm(p.name),
    normNameNoPrefix: norm(nameNoPrefix),
    center: polygonCentroid(f.geometry),
    zoom: zoomForArea(p.area_km2),
    ethnicities: p.ethnicities ?? [],
    area_km2: p.area_km2,
  }
})

/** Match a TI by substring hit against name (with or without "TI" prefix) or ethnicity. */
function findTi(query: string): TiEntry | null {
  const q = norm(query)
  // Try exact token containment first (most selective)
  for (const t of TI_INDEX) {
    if (q.includes(t.normNameNoPrefix) && t.normNameNoPrefix.length >= 4) return t
  }
  // Fall back to ethnicity
  for (const t of TI_INDEX) {
    for (const e of t.ethnicities) {
      const ne = norm(e)
      if (ne.length >= 4 && q.includes(ne)) return t
    }
  }
  return null
}

// --- Router --------------------------------------------------------------

export function routeIntent(raw: string): Intent {
  const s = norm(raw)

  // 1. Help / meta — short strings so they win early
  if (HELP_RX.test(s)) return { kind: 'help' }

  // 2. NISAR on/off/opacity (compound: verb + "nisar|satélite")
  if (NISAR_RX.test(s)) {
    if (OPACITY_UP_RX.test(s) && /(opacid|transparen|visib|brilh)/.test(s))
      return { kind: 'nisar', action: 'opacity-up' }
    if (OPACITY_DOWN_RX.test(s) && /(opacid|transparen|visib|brilh)/.test(s))
      return { kind: 'nisar', action: 'opacity-down' }
    if (VERB_ON.test(s)) return { kind: 'nisar', action: 'show' }
    if (VERB_OFF.test(s)) return { kind: 'nisar', action: 'hide' }
    return { kind: 'nisar', action: 'toggle' }
  }

  // 3. GIBS / optical overlays (verb-sensitive but not strict)
  if (OPTICAL_RX.test(s)) return { kind: 'layer', action: 'toggle-truecolor' }
  if (NASA_GIBS_RX.test(s)) return { kind: 'layer', action: 'toggle-nasa' }

  // 4. SAR product selection ("mostra amplitude" / "ver coerência" / "muda pra displacement")
  for (const { layer, rx } of LAYER_PATTERNS) {
    if (rx.test(s)) return { kind: 'layer-set', layer }
  }

  // 5. TI focus (search verbs OR when the query doesn't match a region)
  //    "zoom na TI Kayapó" / "busca kayapó" / "onde fica Javari"
  if (VERB_SEARCH.test(s) || VERB_SHOW.test(s)) {
    const ti = findTi(s)
    if (ti) {
      return {
        kind: 'focus-ti',
        tiName: ti.name,
        center: ti.center,
        zoom: ti.zoom,
      }
    }
  }

  // 6. Phenomenon / region focus (anchors — fallback after TI search)
  for (const { region, phen, rx } of REGION_PATTERNS) {
    if (rx.test(s)) return { kind: 'focus', region, phenomenon: phen }
  }

  // 7. Also allow bare "ti kayapó" etc. without an explicit verb
  const tiBare = findTi(s)
  if (tiBare) {
    return {
      kind: 'focus-ti',
      tiName: tiBare.name,
      center: tiBare.center,
      zoom: tiBare.zoom,
    }
  }

  // 8. Timeline
  if (TL_PLAY_RX.test(s)) return { kind: 'timeline', action: 'play' }
  if (TL_START_RX.test(s)) return { kind: 'timeline', action: 'start' }
  if (TL_END_RX.test(s)) return { kind: 'timeline', action: 'end' }

  // 9. About / explain
  if (EXPLAIN_RX.test(s)) return { kind: 'explain-sar' }
  if (ABOUT_RX.test(s)) return { kind: 'about' }

  return { kind: 'unknown', query: raw }
}

// --- Narratives ----------------------------------------------------------

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

const NARRATIVE_ABOUT = `**Curupira** · NASA Space Apps 2026 · desafio "Dancing with the SARs".

Dados: NISAR (NASA/ISRO) · análogos históricos Sentinel-1 e ALOS-2 PALSAR via ASF DAAC. Validação: MapBiomas Alerta, DETER/INPE, ANA.

Chatbot determinístico — não gera números, só narra evidência pré-computada e move o mapa por comandos.`

const NARRATIVE_HELP = `**Comandos que entendo**

Navegação:
- "mostra garimpo em Homoxi" · "enchente de Manaus" · "seca do Tefé"
- "zoom na TI Kayapó" · "busca Javari" · "onde fica Munduruku"

Camadas SAR:
- "mostra amplitude" · "ver coerência" · "interferograma" · "deslocamento"

Satélite NISAR:
- "liga NISAR" · "desliga satélite" · "aumenta opacidade do radar"

NASA auxiliar:
- "camada NASA" (NDVI/IMERG/AMSR2) · "óptico MODIS"

Timeline:
- "toca a série" · "volta ao início" · "pula pro fim"

Explicações:
- "como o SAR funciona" · "sobre o projeto"`

const NARRATIVE_UNKNOWN = `Não entendi o pedido. Tenta **"ajuda"** pra ver a lista de comandos, ou algo como:
- "mostra o garimpo em Homoxi"
- "zoom na TI Kayapó"
- "liga NISAR"`

export function narrativeFor(intent: Intent): string {
  switch (intent.kind) {
    case 'focus':
      return NARRATIVE_FOCUS[intent.region]
    case 'focus-ti':
      return `Focando em **${intent.tiName}**. Mapa centrado em [${intent.center[0].toFixed(2)}, ${intent.center[1].toFixed(2)}].`
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
    case 'layer-set':
      return `Camada SAR → **${intent.layer}**.`
    case 'nisar': {
      switch (intent.action) {
        case 'show':
          return 'Ligando a camada **NISAR** (browse via ASF/Vertex).'
        case 'hide':
          return 'Desligando a camada NISAR.'
        case 'toggle':
          return 'Alternando NISAR.'
        case 'opacity-up':
          return 'Aumentando opacidade da camada NISAR.'
        case 'opacity-down':
          return 'Reduzindo opacidade da camada NISAR.'
      }
      return ''
    }
    case 'explain-sar':
      return NARRATIVE_EXPLAIN_SAR
    case 'about':
      return NARRATIVE_ABOUT
    case 'help':
      return NARRATIVE_HELP
    case 'unknown':
      return NARRATIVE_UNKNOWN
  }
}

export const SUGGESTIONS = [
  'mostra o garimpo em Homoxi',
  'zoom na TI Kayapó',
  'liga NISAR',
  'ajuda',
] as const
