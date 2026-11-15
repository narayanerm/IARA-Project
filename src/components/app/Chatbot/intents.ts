import type { ProductLayer, RegionId } from '@/lib/types'
import { DICT, type Lang, type TKey } from '@/lib/i18n'
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
const VERB_SHOW = /(mostr[ae]|vejo|olha|zoom|ir\b|vou|voar?|centraliza|focar?|abr[ei]|navegar?|carregar?|levar?|\b(?:ver|show|see|open|focus|center|centre)\b|\b(?:go|fly|take me)\s+to\b)/

// "busca | procura | encontra | cade | cadê | onde"
const VERB_SEARCH = /(buscar?|procurar?|encontrar?|achar?|cade|onde\s+(fica|esta|t(em|a))|\b(?:where|find|locate|search|look up)\b)/

// "liga | ativa | mostra | habilita"
const VERB_ON = /\b(?:ligar?|ativar?|habilitar?|exibe|exibir|mostr[ae]r?|aparecer?|on|show|enable|display)\b/

// "desliga | esconde | some | remove | desativa | fecha"
const VERB_OFF = /\b(?:desligar?|esconder?|some|remover?|desativar?|fechar?|ocultar?|off|hide|disable)\b/

// --- Entity buckets ------------------------------------------------------

const REGION_PATTERNS: Array<{
  region: RegionId
  phen: 'mining' | 'flood' | 'drought'
  rx: RegExp
}> = [
  {
    region: 'YANO',
    phen: 'mining',
    rx: /(garimp|yanomam|homox|minera|minar?|ouro|\b(?:mining|gold|pit)\b)/,
  },
  {
    region: 'ENCH',
    phen: 'flood',
    rx: /(enchent|cheia|manaus|solim[oõ]es|encontro\s+das|alaga|inunda|flood)/,
  },
  {
    region: 'SECA',
    phen: 'drought',
    rx: /(\bseca\b|tefe|manaquiri|baixa\s+do|seco|drought|boto)/,
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
  { layer: 'change', rx: /(mudanca|change\s+(detect|layer|map)|detecao|deteccao)/ },
]

// "nisar | radar | satélite | sentinela 1" (treats NISAR controls generically)
const NISAR_RX = /\b(?:nisar|satelite|satellite|radar|imagem sar|cena sar|sar imagery)\b/
const OPACITY_UP_RX = /(aumenta|sobe|mais|claro|\+|\b(?:increase|raise|higher|more)\b)/
const OPACITY_DOWN_RX = /(diminui|baixa|menos|escuro|-|\b(?:decrease|reduce|lower|less)\b)/
const OPACITY_RX = /(opacid|opacity|transparen|visib|brilh|brightness)/

// Optical / GIBS
const OPTICAL_RX = /(optic[oa]|optical|true.?colou?r|modis|visivel|colorido)/
const NASA_GIBS_RX = /(nasa|gibs|camada\s+nasa|ndvi|imerg|chuva|umidade|amsr)/

// Timeline
const TL_PLAY_RX = /(toca|\bplay\b|rodar|rode|roda|evolu|anim|reproduz|avanca)/
const TL_START_RX = /(voltar|volta\b|inicio|comeca|reset|zero|\b(?:start|beginning|first frame|rewind)\b)/
const TL_END_RX = /(fim|final|hoje|recente|ultimo|\b(?:end|latest|last frame|most recent|today)\b)/
const TIMELINE_RX = /\b(?:timeline|time series|frame|serie|linha do tempo)\b/

// Help / meta
const HELP_RX = /(?:^(?:ajuda|help(?: me)?|comandos?|commands?|use)[\s.!?]*$|\b(?:can you help(?: me)?|show (?:me )?(?:the )?commands|what can (?:you|i) do|how (?:do i|to) use (?:this|the app|the assistant)|o que (?:posso|voce|vc|rola|da|faz)|como usa)\b)/
const ABOUT_RX = /(sobre|quem|\b(?:about|credits|data sources|where does the data come from)\b|dados|origem|credito|atribu)/
const EXPLAIN_RX = /(l.?band|banda|physics|fisica|funciona|como\s+(o\s+)?sar|por\s+que|\b(?:how|what|why|explain)\b.*\b(?:sar|nisar|radar)\b)/

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

  // Resolve help, explicit timeline commands and SAR explanations before layer controls.
  if (HELP_RX.test(s)) return { kind: 'help' }

  if (TIMELINE_RX.test(s)) {
    if (TL_END_RX.test(s)) return { kind: 'timeline', action: 'end' }
    if (TL_START_RX.test(s)) return { kind: 'timeline', action: 'start' }
    if (TL_PLAY_RX.test(s)) return { kind: 'timeline', action: 'play' }
  }

  if (EXPLAIN_RX.test(s) && !OPACITY_RX.test(s)) return { kind: 'explain-sar' }

  // 2. NISAR on/off/opacity (compound: verb + "nisar|satélite")
  if (NISAR_RX.test(s)) {
    if (OPACITY_UP_RX.test(s) && OPACITY_RX.test(s))
      return { kind: 'nisar', action: 'opacity-up' }
    if (OPACITY_DOWN_RX.test(s) && OPACITY_RX.test(s))
      return { kind: 'nisar', action: 'opacity-down' }
    if (VERB_OFF.test(s)) return { kind: 'nisar', action: 'hide' }
    if (VERB_ON.test(s)) return { kind: 'nisar', action: 'show' }
    if (!/\bradar\b/.test(s) || /\b(?:toggle|alternar?|nisar|satelite|satellite)\b/.test(s))
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

  // 9. About the project
  if (ABOUT_RX.test(s)) return { kind: 'about' }

  return { kind: 'unknown', query: raw }
}

export function narrativeFor(intent: Intent, lang: Lang): string {
  const strings = DICT[lang]
  switch (intent.kind) {
    case 'focus':
      return strings[`assistant.focus.${intent.region}`]
    case 'focus-ti':
      return strings['assistant.focusLand']
        .replace('{lng}', intent.center[0].toFixed(2))
        .replace('{lat}', intent.center[1].toFixed(2))
        .replace('{name}', intent.tiName)
    case 'timeline':
      return strings[`assistant.timeline.${intent.action}`]
    case 'layer':
      return strings[`assistant.overlay.${intent.action}`]
    case 'layer-set':
      return strings['assistant.layer'].replace('{layer}', strings[`layer.${intent.layer}`])
    case 'nisar':
      return strings[`assistant.nisar.${intent.action}`]
    case 'explain-sar':
      return strings['assistant.explain']
    case 'about':
    case 'help':
    case 'unknown':
      return strings[`assistant.${intent.kind}`]
  }
}

export const SUGGESTIONS = [
  'assistant.suggest.mining',
  'assistant.suggest.land',
  'assistant.suggest.nisar',
  'assistant.suggest.help',
] as const satisfies readonly TKey[]
