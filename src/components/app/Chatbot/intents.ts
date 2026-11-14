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

  if (/(garimpo|yanomami|homoxi|minera|mining|ouro|gold|pit)/.test(s))
    return { kind: 'focus', region: 'YANO', phenomenon: 'mining' }

  if (/(enchente|cheia|manaus|solimoes|encontro|flood|inunda)/.test(s))
    return { kind: 'focus', region: 'ENCH', phenomenon: 'flood' }

  if (/(seca|tefe|baixa|seco|drought|boto)/.test(s))
    return { kind: 'focus', region: 'SECA', phenomenon: 'drought' }

  if (/(toca|play|rodar|evolu|anim)/.test(s)) return { kind: 'timeline', action: 'play' }
  if (/(voltar|inicio|comeca|start|beginning|rewind)/.test(s)) return { kind: 'timeline', action: 'start' }
  if (/(fim|final|hoje|recente|latest|today|recent)/.test(s)) return { kind: 'timeline', action: 'end' }

  if (/(optico|optical|true.?color|modis|vis[ií]vel|visible)/.test(s))
    return { kind: 'layer', action: 'toggle-truecolor' }
  if (/(nasa|gibs|camada|layer)/.test(s)) return { kind: 'layer', action: 'toggle-nasa' }

  if (/(l.?band|banda|physics|fisica|funciona|como|how|work)/.test(s)) return { kind: 'explain-sar' }
  if (/(sobre|quem|time|about|team|who|nisar|dados|data)/.test(s)) return { kind: 'about' }

  return { kind: 'unknown', query: raw }
}

// Pre-written narratives per intent; no free-form LLM output to avoid fabricated numbers.

const NARRATIVE_FOCUS: Record<RegionId, string> = {
  YANO: `Zooming to **Homoxi**, inside the Yanomami Indigenous Land.

Between 2019 and 2022 the L-band (HH) signature showed a **6-10 dB drop** across several polygons, consistent with canopy being converted to bare soil. The federal operation of Feb 2023 marks a turning point that is visible in the time series.

Layers turned on: MODIS NDVI and detection polygons.`,
  ENCH: `Centering on the **meeting of the Solimões and Negro rivers**, Manaus.

The **May 2024** flood set a historic record at the port of Manaus (30.70 m). SAR separates water from vegetation with an amplitude threshold: a specular pixel is about -18 dB, flooded forest about -8 dB.

The IMERG layer shows the rainfall input over the basin.`,
  SECA: `Zooming to **Lake Tefé**.

The historic **2023-24** drought shrank the water area to levels linked to the die-off of pink river dolphins. The SAR signal here is **extent** (area in km²) over time, not amplitude.

The AMSR2 layer adds passive soil moisture.`,
}

const NARRATIVE_EXPLAIN_SAR = `**SAR** = Synthetic Aperture Radar. It sends out microwaves and measures the backscatter.

**NISAR** is L-band (λ ≈ 24 cm). Unlike optical sensors, it **sees through the canopy** and works under clouds, smoke and at night.

The physics changes with each phenomenon:
- **Mining**: backscatter drops (forest → bare soil)
- **Flood**: specular reflection (smooth water = black pixel)
- **Drought**: shrinking water area, visible in the time series`

const NARRATIVE_ABOUT = `**IARA**, built by team Curupira for the NASA Space Apps 2026 challenge "Dancing with the SARs".

Data: NISAR (NASA/ISRO), with historical Sentinel-1 and ALOS-2 PALSAR analogues from ASF DAAC. Validation: MapBiomas Alerta, DETER/INPE, ANA.

Chatbot: currently a deterministic router (stub) that will grow into the Claude API with tool use. It never generates numbers; it only narrates precomputed evidence.`

const NARRATIVE_UNKNOWN = `I did not understand that. Try something like:
- "show the mining at Homoxi"
- "Manaus flood 2024"
- "Tefé drought"
- "how SAR works"`

export function narrativeFor(intent: Intent): string {
  switch (intent.kind) {
    case 'focus':
      return NARRATIVE_FOCUS[intent.region]
    case 'timeline':
      return intent.action === 'play'
        ? 'Playing the time series. Watch the curve change.'
        : intent.action === 'start'
        ? 'Back to the start of the series.'
        : 'Jumping to the most recent frame.'
    case 'layer':
      return intent.action === 'toggle-truecolor'
        ? 'Toggling the optical layer (MODIS true color). Notice where SAR sees and optical goes blind.'
        : 'Toggling the auxiliary NASA GIBS layer.'
    case 'explain-sar':
      return NARRATIVE_EXPLAIN_SAR
    case 'about':
      return NARRATIVE_ABOUT
    case 'unknown':
      return NARRATIVE_UNKNOWN
  }
}

export const SUGGESTIONS = [
  'show the mining at Homoxi',
  'Manaus flood 2024',
  'Lake Tefé drought',
  'how SAR works',
] as const
