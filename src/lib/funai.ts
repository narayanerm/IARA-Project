import { FUNAI_TIS, FUNAI_TIS_FETCHED_AT, type FunaiTiRecord } from '@/data/layers/funai-tis'

// Consulta às Terras Indígenas na base aberta da FUNAI.
//
// O GeoServer da FUNAI não libera CORS: o navegador não consegue ler os dados
// (WFS) de dentro do app. Por isso os registros vêm de um retrato local
// (src/data/layers/funai-tis.ts, atualizado por scripts/update-funai-tis.mjs).
// Imagens (WMS) não sofrem essa restrição, então o limite oficial é desenhado
// ao vivo direto do servidor da FUNAI.

export type { FunaiTiRecord }

const GEOSERVER = 'https://geoserver.funai.gov.br/geoserver/Funai'
const LAYER = 'Funai:tis_poligonais'

export const FUNAI_FETCHED_AT = FUNAI_TIS_FETCHED_AT

export function funaiRecordFor(name: string): FunaiTiRecord | null {
  return FUNAI_TIS[name] ?? null
}

const CR_BASE =
  'https://www.gov.br/funai/pt-br/acesso-a-informacao/institucional/coordenacoes-regionais-funai/'

// Sigla da Coordenação Regional no registro oficial → página da unidade no site
// da FUNAI. A base ainda usa "CR-RR" para Roraima; em 2025 a FUNAI dividiu a
// coordenação em Roraima I (a antiga CR Roraima, que segue com Yanomami e Raposa
// Serra do Sol) e Roraima II (28 TIs menores).
const CR_PAGES: Record<string, { slug: string; name: string }> = {
  'CR-APUR': { slug: 'cr-alto-purus', name: 'CR Alto Purus' },
  'CR-CLPA': { slug: 'cr-centro-leste-do-para', name: 'CR Centro Leste do Pará' },
  'CR-JPR': { slug: 'cr-ji-parana', name: 'CR Ji-Paraná' },
  'CR-JUR': { slug: 'cr-jurua', name: 'CR Juruá' },
  'CR-KSPA': { slug: 'cr-kayapo-sul-do-para', name: 'CR Kayapó Sul do Pará' },
  'CR-MA': { slug: 'cr-maranhao', name: 'CR Maranhão' },
  'CR-MAO': { slug: 'cr-manaus', name: 'CR Manaus' },
  'CR-RNG': { slug: 'cr-rio-negro', name: 'CR Rio Negro' },
  'CR-RR': { slug: 'cr-roraima-i', name: 'CR Roraima I' },
  'CR-TPJ': { slug: 'cr-tapajos', name: 'CR Tapajós' },
  'CR-VJ': { slug: 'cr-vale-do-javari', name: 'CR Vale do Javari' },
  'CR-XIN': { slug: 'cr-xingu', name: 'CR Xingu' },
}

/** Página da Coordenação Regional da FUNAI que atende a TI. */
export function funaiCrPage(rec: FunaiTiRecord): { url: string; name: string } | null {
  const page = rec.crSigla ? CR_PAGES[rec.crSigla.toUpperCase()] : undefined
  return page ? { url: CR_BASE + page.slug, name: page.name } : null
}

/**
 * Imagem do limite oficial da TI, gerada ao vivo pelo GeoServer da FUNAI (WMS).
 * O enquadramento segue a proporção pedida sem distorcer o desenho.
 */
export function funaiOutlineUrl(rec: FunaiTiRecord, width: number, height: number): string | null {
  if (!rec.bbox) return null
  const [w, s, e, n] = rec.bbox
  const cx = (w + e) / 2
  const cy = (s + n) / 2
  const k = Math.max(Math.cos((cy * Math.PI) / 180), 0.2)
  const pad = 1.16
  let gw = (e - w) * k * pad
  let gh = (n - s) * pad
  if (gw / gh > width / height) gh = (gw * height) / width
  else gw = (gh * width) / height
  const bbox = [cx - gw / k / 2, cy - gh / 2, cx + gw / k / 2, cy + gh / 2]
    .map((v) => v.toFixed(4))
    .join(',')
  const q = new URLSearchParams({
    service: 'WMS',
    version: '1.1.1',
    request: 'GetMap',
    layers: LAYER,
    styles: '',
    srs: 'EPSG:4326',
    bbox,
    width: String(width),
    height: String(height),
    format: 'image/png',
    transparent: 'true',
    CQL_FILTER: `terrai_codigo=${rec.codigo}`,
  })
  return `${GEOSERVER}/wms?${q}`
}

/** "A e B e C" / "A,B" / "A, B" → ["A", "B", "C"] */
export function funaiList(value: string | null): string[] {
  if (!value) return []
  const parts = value
    .split(/\s+e\s+|\s*,\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
  return [...new Set(parts)]
}

/** "RR, AM" / "MT,PA" → "RR/AM" */
export function funaiUf(value: string | null): string | null {
  const list = funaiList(value)
  return list.length ? list.join('/') : null
}

const LOWER = new Set(['de', 'do', 'da', 'dos', 'das', 'e'])

/** "COORDENACAO REGIONAL DO RIO NEGRO" → "Coordenação Regional do Rio Negro" */
export function funaiCrName(value: string | null): string | null {
  if (!value) return null
  return value
    .toLocaleLowerCase('pt-BR')
    .replace(/^coordenacao/, 'coordenação')
    .split(' ')
    .map((word, i) =>
      i > 0 && LOWER.has(word)
        ? word
        : word
            .split('-')
            .map((p) => p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1))
            .join('-')
    )
    .join(' ')
}

/** "15/08/2025" → "15.08.2025"; "2026-11-14" → "14.11.2026" */
export function funaiDate(value: string | null): string | null {
  if (!value) return null
  const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (br) return `${br[1]}.${br[2]}.${br[3]}`
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`
  return value
}

export function funaiArea(ha: number | null): { ha: string; km2: string } | null {
  if (ha == null) return null
  return {
    ha: `${Math.round(ha).toLocaleString('pt-BR')} ha`,
    km2: `${Math.round(ha / 100).toLocaleString('pt-BR')} km²`,
  }
}
