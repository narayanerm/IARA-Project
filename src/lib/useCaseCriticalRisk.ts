import { useEffect, useState } from 'react'

import type { RegionId } from './types'
import type { RiskLevel } from '@/data/cases'

/**
 * Forecast-derived risk per community for a case. Replaces the hand-picked
 * `level` on cases.ts hotspots so the map pins reflect the predictive model.
 *
 * Data sources:
 *  - SECA (`/analysis/data/seca-isolation-forecast.json`): produced by the IARA
 *    pipeline (scripts/analysis/*). Per community: isolated-days quantiles +
 *    probability of isolation within 30 days. Communities (Andiroba, Jutaí,
 *    Barro Alto, Janauacá) from IBGE 2022 ribeirinho cadastre + SGB cota
 *    thresholds (Porto de Manaus régua).
 *  - ENCH (`/analysis/data/ench-flood-forecast.json`): daily p10/p50/p90 of the
 *    Rio Negro stage at Porto de Manaus (ANA 14990000). Per-neighborhood risk
 *    derived by combining the forecast with the activation cota of each bairro
 *    (see ENCH_NEIGHBORHOOD_THRESHOLDS_M below for sources).
 *  - YANO (`YANO_VILLAGE_RISK` below): static map precomputed offline from
 *    `deter-mineracao-regional-2019-2026.geojson` (INPE). For each curated
 *    Yanomami polo-base we take the minimum haversine distance to any mining
 *    polygon centroid, plus the date of that nearest alert. Village selection
 *    and coordinates: Hutukara "Yanomami Sob Ataque" 2022/23, SESAI DSEI-Y
 *    polo-base cadastre, ISA Povos Indígenas do Brasil.
 */
export interface CriticalRisk {
  id: string
  level: RiskLevel
  /** Short human sentence shown in the pin tooltip, in both app languages. */
  insight: { pt: string; en: string }
  /** Numeric sort key (lower = more urgent). Used to pick a representative pin on dense maps. */
  score: number
}

/**
 * Approximate activation cota (meters at Porto de Manaus régua) per Manaus bairro.
 * Sources:
 *  - SGB Porto de Manaus thresholds: atenção = 27.50 m, inundação = 29.00 m,
 *    inundação severa = 29.97 m.
 *  - Defesa Civil de Manaus — Plano de Contingência da Cheia e mapeamentos
 *    públicos (Educandos, Igarapé do Quarenta, Centro, São Raimundo são as
 *    primeiras zonas afetadas, geralmente ~1-2 m abaixo da cota oficial por
 *    estarem na foz de igarapés tributários que transbordam cedo).
 *  - Reportagens históricas das cheias 2012/2021/2024 que registraram dia-a-dia
 *    em qual cota cada bairro começou a alagar.
 *
 * Valores são estimativas razoáveis, não medições oficiais por bairro (SGB só
 * publica a série da régua, não por bairro). Melhor ter um ranking honesto com
 * fonte citada do que um único número cego para toda a cidade.
 */
const ENCH_NEIGHBORHOOD_THRESHOLDS_M: Record<string, number> = {
  educandos: 27.0,
  'igarape-quarenta': 27.0,
  quarenta: 27.0,
  'sao-raimundo': 27.5,
  centro: 28.5,
  mauazinho: 29.0,
}

/**
 * Precomputed YANO villages — nearest DETER mineração alert and date. See the
 * header docstring for sources. If you edit this table, also update the hotspot
 * block in src/data/cases.ts so coordinates/levels stay consistent.
 */
const YANO_VILLAGE_RISK: Record<string, { km: number; nearestDate: string; level: RiskLevel }> = {
  homoxi:   { km: 10.7, nearestDate: '2022-05-24', level: 'critical' },
  xitei:    { km: 16.2, nearestDate: '2023-03-23', level: 'high' },
  surucucu: { km: 16.3, nearestDate: '2024-02-21', level: 'high' },
  watoriki: { km: 20.6, nearestDate: '2023-08-22', level: 'watch' },
  marari:   { km: 23.0, nearestDate: '2021-08-22', level: 'watch' },
}

function buildYanoRisks(): Record<string, CriticalRisk> {
  const out: Record<string, CriticalRisk> = {}
  for (const [id, r] of Object.entries(YANO_VILLAGE_RISK)) {
    const km = r.km.toFixed(1)
    out[id] = {
      id,
      level: r.level,
      insight: {
        pt: `Garimpo (DETER) a ${km} km — alerta mais próximo em ${r.nearestDate}`,
        en: `Mining (DETER) ${km} km away — nearest alert on ${r.nearestDate}`,
      },
      score: r.km,
    }
  }
  return out
}

interface EnchDaily {
  date: string
  p10: number
  p50: number
  p90: number
}

interface EnchForecast {
  generated_at: string
  station: string
  horizon_days: number
  daily: EnchDaily[]
}

interface SecaCommunity {
  id: string
  name: string
  pop: number
  threshold_m: number
  p_isolated_any_day: number
  p_isolated_30_days: number
  isolated_days: { p10: number; p50: number; p90: number; mean: number }
}

interface SecaForecast {
  generated_at: string
  n_mc: number
  communities: SecaCommunity[]
}

const cache = new Map<RegionId, Record<string, CriticalRisk> | null>()

function secaLevel(p30: number): RiskLevel {
  // Thresholds calibrated to spread the 4 SECA communities across the 3 buckets
  // while keeping the semantics: p30 is the probability of being cut off within
  // one month, which is the window a family can realistically plan supplies for.
  if (p30 >= 0.5) return 'critical'
  if (p30 >= 0.05) return 'high'
  return 'watch'
}

function enchLevel(daysUntil: number | null, p30: number): RiskLevel {
  // Amazon flood cycle rises ~Jan-May and peaks Apr-Jun. Tiers calibrated for the
  // 365-day horizon: a bairro that will be flooded before the peak window ends is
  // "high"; before the next 2 months, "critical"; after, just "watch".
  if (p30 >= 0.3) return 'critical'
  if (daysUntil !== null && daysUntil <= 60) return 'critical'
  if (daysUntil !== null && daysUntil <= 180) return 'high'
  return 'watch'
}

function buildEnchRisks(fc: EnchForecast): Record<string, CriticalRisk> {
  const out: Record<string, CriticalRisk> = {}
  const daily = fc.daily
  for (const [id, threshold] of Object.entries(ENCH_NEIGHBORHOOD_THRESHOLDS_M)) {
    // First day (0-indexed) where p50 crosses the bairro's activation cota.
    let daysUntil: number | null = null
    for (let i = 0; i < daily.length; i++) {
      if (daily[i].p50 >= threshold) {
        daysUntil = i
        break
      }
    }
    // Fraction of the next 30 days above threshold — proxy for near-term risk.
    const window = daily.slice(0, 30)
    const p30 = window.length ? window.filter((d) => d.p50 >= threshold).length / window.length : 0
    const p30pct = Math.round(p30 * 100)
    const th = threshold.toFixed(1)
    const insight =
      daysUntil === null
        ? {
            pt: `Sem previsão de atingir a cota de ${th} m nos próximos ${fc.horizon_days} dias`,
            en: `Not forecast to reach the ${th} m stage in the next ${fc.horizon_days} days`,
          }
        : daysUntil === 0
        ? {
            pt: `Cota de ativação (${th} m) já ultrapassada no forecast (${p30pct}% dos próximos 30 d)`,
            en: `Activation stage (${th} m) already exceeded in the forecast (${p30pct}% of the next 30 d)`,
          }
        : {
            pt: `Rio Negro atinge a cota do bairro (${th} m) em ${daysUntil} dias (${p30pct}% dos próximos 30 d)`,
            en: `Rio Negro reaches the neighborhood stage (${th} m) in ${daysUntil} days (${p30pct}% of the next 30 d)`,
          }
    out[id] = {
      id,
      level: enchLevel(daysUntil, p30),
      insight,
      // Lower score sorts first (most urgent).
      score: daysUntil === null ? 9999 : daysUntil - p30 * 10,
    }
  }
  return out
}

function buildSecaRisks(fc: SecaForecast): Record<string, CriticalRisk> {
  const out: Record<string, CriticalRisk> = {}
  for (const c of fc.communities) {
    const p30pct = Math.round(c.p_isolated_30_days * 100)
    const days = Math.round(c.isolated_days.p50)
    const uncertainty = Math.round((c.isolated_days.p90 - c.isolated_days.p10) / 2)
    out[c.id] = {
      id: c.id,
      level: secaLevel(c.p_isolated_30_days),
      insight:
        p30pct >= 1
          ? {
              pt: `${days} ± ${uncertainty} dias de isolamento previstos (${p30pct}% em 30 d)`,
              en: `${days} ± ${uncertainty} days of isolation forecast (${p30pct}% within 30 d)`,
            }
          : {
              pt: `${days} ± ${uncertainty} dias de isolamento previstos (risco baixo em 30 d)`,
              en: `${days} ± ${uncertainty} days of isolation forecast (low risk within 30 d)`,
            },
      // Lower score = higher urgency. Negative p30 so higher probability sorts first;
      // tie-breaker: shorter wait until isolation (lower p50 isolated-days is more acute).
      score: -c.p_isolated_30_days * 100 + c.isolated_days.p50 * 0.01,
    }
  }
  return out
}

export function useCaseCriticalRisk(caseId: RegionId): Record<string, CriticalRisk> | null {
  const [data, setData] = useState<Record<string, CriticalRisk> | null>(
    () => cache.get(caseId) ?? null
  )

  useEffect(() => {
    if (cache.has(caseId)) {
      setData(cache.get(caseId) ?? null)
      return
    }
    if (caseId === 'YANO') {
      // No JSON fetch — risk is precomputed offline from DETER mineração polygons
      // because we don't ship a dynamic Yanomami-village forecast yet.
      const built = buildYanoRisks()
      cache.set(caseId, built)
      setData(built)
      return
    }
    let cancelled = false
    const url =
      caseId === 'SECA'
        ? '/analysis/data/seca-isolation-forecast.json'
        : '/analysis/data/ench-flood-forecast.json'
    fetch(url, { cache: 'force-cache' })
      .then((r) => r.json())
      .then((j: SecaForecast | EnchForecast) => {
        if (cancelled) return
        const built = caseId === 'SECA' ? buildSecaRisks(j as SecaForecast) : buildEnchRisks(j as EnchForecast)
        cache.set(caseId, built)
        setData(built)
      })
      .catch(() => {
        if (!cancelled) {
          cache.set(caseId, null)
          setData(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [caseId])

  return data
}
