/**
 * Attorney Pattern Intelligence Engine — v1
 *
 * Heuristic, transparent, explainable.
 * Builds attorney profiles from historical_claims + attorney_observations.
 * No opaque ML — only aggregated statistics and adjuster-captured observations.
 */

// ─── Structured Observation Tags ────────────────────────

export const OBSERVATION_TAGS = [
  { key: "starts_high_moves_late", label: "Starts high and moves late" },
  { key: "full_specials_emphasis", label: "Demands full specials emphasis" },
  { key: "responds_to_bracket", label: "Responds to bracket strategy" },
  { key: "requires_medical_challenge", label: "Requires medical support challenge" },
  { key: "settles_near_deadline", label: "Typically settles near deadline" },
  { key: "needs_supervisor_contact", label: "Rarely moves without supervisor contact" },
] as const;

export type ObservationTag = typeof OBSERVATION_TAGS[number]["key"];

// ─── Types ──────────────────────────────────────────────

export interface AttorneyHistoricalStats {
  priorCaseCount: number;
  avgDemandToSettlementRatio: number | null;
  avgSettlementVsMidpoint: number | null;
  avgRoundCount: number | null;
  avgNegotiationDays: number | null;
  commonProviders: string[];
  commonInjuryCategories: string[];
  hasSurgeryRate: number | null;
  hasInjectionRate: number | null;
}

export interface AttorneyObservation {
  id: string;
  caseId: string | null;
  observationType: string;
  observationText: string;
  observedBy: string;
  createdAt: string;
}

export interface AttorneyProfile {
  attorneyName: string;
  firmName: string;
  historicalStats: AttorneyHistoricalStats;
  observations: AttorneyObservation[];
  tagSummary: Record<string, number>;
}

// ─── Historical Stats Builder ───────────────────────────

export interface HistoricalClaimRow {
  attorney_name: string;
  attorney_firm: string;
  final_settlement_amount: number | null;
  billed_specials: number | null;
  reviewed_specials: number | null;
  provider_names: string[];
  injury_categories: string[];
  has_surgery: boolean;
  has_injections: boolean;
  treatment_duration_days: number | null;
  treatment_provider_count: number | null;
}

export function buildHistoricalStats(claims: HistoricalClaimRow[]): AttorneyHistoricalStats {
  const n = claims.length;
  if (n === 0) {
    return {
      priorCaseCount: 0,
      avgDemandToSettlementRatio: null,
      avgSettlementVsMidpoint: null,
      avgRoundCount: null,
      avgNegotiationDays: null,
      commonProviders: [],
      commonInjuryCategories: [],
      hasSurgeryRate: null,
      hasInjectionRate: null,
    };
  }

  // Demand-to-settlement ratio: settlement / billed_specials
  const ratios = claims
    .filter((c) => c.final_settlement_amount != null && c.billed_specials != null && c.billed_specials > 0)
    .map((c) => c.final_settlement_amount! / c.billed_specials!);
  const avgRatio = ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null;

  // Provider frequency
  const providerCounts: Record<string, number> = {};
  for (const c of claims) {
    for (const p of c.provider_names) {
      providerCounts[p] = (providerCounts[p] || 0) + 1;
    }
  }
  const commonProviders = Object.entries(providerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  // Injury category frequency
  const injCounts: Record<string, number> = {};
  for (const c of claims) {
    for (const cat of c.injury_categories) {
      injCounts[cat] = (injCounts[cat] || 0) + 1;
    }
  }
  const commonInjuryCategories = Object.entries(injCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  const surgeryCount = claims.filter((c) => c.has_surgery).length;
  const injectionCount = claims.filter((c) => c.has_injections).length;

  // Avg duration
  const durations = claims.filter((c) => c.treatment_duration_days != null).map((c) => c.treatment_duration_days!);
  const avgDays = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

  return {
    priorCaseCount: n,
    avgDemandToSettlementRatio: avgRatio ? Math.round(avgRatio * 100) / 100 : null,
    avgSettlementVsMidpoint: null, // requires cross-referencing evaluations — future v2
    avgRoundCount: null, // requires negotiation session data — future v2
    avgNegotiationDays: avgDays,
    commonProviders,
    commonInjuryCategories,
    hasSurgeryRate: Math.round((surgeryCount / n) * 100),
    hasInjectionRate: Math.round((injectionCount / n) * 100),
  };
}

// ─── Tag Summary Builder ────────────────────────────────

export function buildTagSummary(observations: AttorneyObservation[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const obs of observations) {
    if (obs.observationType !== "free_text") {
      counts[obs.observationType] = (counts[obs.observationType] || 0) + 1;
    }
  }
  return counts;
}

// ─── Profile Assembly ───────────────────────────────────

export function assembleAttorneyProfile(
  attorneyName: string,
  firmName: string,
  historicalClaims: HistoricalClaimRow[],
  observations: AttorneyObservation[]
): AttorneyProfile {
  return {
    attorneyName,
    firmName,
    historicalStats: buildHistoricalStats(historicalClaims),
    observations,
    tagSummary: buildTagSummary(observations),
  };
}
