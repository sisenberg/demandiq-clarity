/**
 * EvaluateIQ — Profile-Based Weighting Engine
 *
 * Applies different weighting bands by claim profile instead of a universal
 * weighting scheme. Each profile emphasizes different factor groups based on
 * the PRD-specified priorities.
 *
 * Weighting bands are versioned and inspectable.
 *
 * Usage:
 *   const result = computeWeightedMeritsScore(scoringResult, profileCode);
 */

import type { ClaimProfileCode } from "@/lib/claimProfileClassifier";
import type { FactorScoringResult, ScoredFactor, FactorLayer } from "@/types/factor-taxonomy";

// ─── Weight Category ───────────────────────────────────

export type WeightCategory =
  | "injury_merit"
  | "treatment_pattern"
  | "functional_impact"
  | "economic"
  | "post_merit_adjustment";

export const WEIGHT_CATEGORY_META: Record<WeightCategory, { label: string; layers: FactorLayer[] }> = {
  injury_merit:          { label: "Injury Merit",             layers: [1] },
  treatment_pattern:     { label: "Treatment Pattern",        layers: [2] },
  functional_impact:     { label: "Functional & Life Impact", layers: [3] },
  economic:              { label: "Economic & Specials",      layers: [4] },
  post_merit_adjustment: { label: "Post-Merit Adjustments",   layers: [5] },
};

const WEIGHT_CATEGORIES: WeightCategory[] = [
  "injury_merit",
  "treatment_pattern",
  "functional_impact",
  "economic",
  "post_merit_adjustment",
];

// ─── Profile Weight Band ───────────────────────────────

export interface ProfileWeightBand {
  profile: ClaimProfileCode;
  version: string;
  effective_date: string;
  /** Weights per category — must sum to 1.0 */
  weights: Record<WeightCategory, number>;
  /** Human-readable explanation of why these weights were chosen */
  rationale: string;
}

// ─── Weight Band Registry ──────────────────────────────

const V = "1.0.0";
const D = "2026-03-13";

/**
 * Profile A: Minor soft tissue — treatment pattern and mild functional impact matter most.
 * Injury merit is less differentiating since injuries are minor by definition.
 */
const PROFILE_A_WEIGHTS: ProfileWeightBand = {
  profile: "A",
  version: V,
  effective_date: D,
  weights: {
    injury_merit: 0.15,
    treatment_pattern: 0.35,
    functional_impact: 0.25,
    economic: 0.15,
    post_merit_adjustment: 0.10,
  },
  rationale: "Profile A (Minor Soft Tissue) prioritizes treatment pattern consistency and functional impact over injury severity, which is inherently low for this profile. Economic specials are weighted moderately since they anchor mild-claim corridors.",
};

/**
 * Profile C: Objective ortho non-surgical — objective support is the differentiator.
 */
const PROFILE_C_WEIGHTS: ProfileWeightBand = {
  profile: "C",
  version: V,
  effective_date: D,
  weights: {
    injury_merit: 0.35,
    treatment_pattern: 0.20,
    functional_impact: 0.15,
    economic: 0.20,
    post_merit_adjustment: 0.10,
  },
  rationale: "Profile C (Objective Ortho, Non-Surgical) gives greatest weight to injury merit factors, where objective diagnostic support is the primary value differentiator. Treatment pattern and economic specials provide secondary anchoring.",
};

/**
 * Profile F: Surgical — objective support, invasiveness, and future impact dominate.
 */
const PROFILE_F_WEIGHTS: ProfileWeightBand = {
  profile: "F",
  version: V,
  effective_date: D,
  weights: {
    injury_merit: 0.30,
    treatment_pattern: 0.10,
    functional_impact: 0.20,
    economic: 0.25,
    post_merit_adjustment: 0.15,
  },
  rationale: "Profile F (Surgical) gives major weight to injury merit (objective support + invasiveness) and economic factors (future medical exposure from surgery). Post-merit adjustments are elevated due to the higher stakes of surgical claims and the role of coverage limits.",
};

/**
 * Profile G: Permanent residual / impairment — permanency and function dominate.
 */
const PROFILE_G_WEIGHTS: ProfileWeightBand = {
  profile: "G",
  version: V,
  effective_date: D,
  weights: {
    injury_merit: 0.30,
    treatment_pattern: 0.05,
    functional_impact: 0.35,
    economic: 0.15,
    post_merit_adjustment: 0.15,
  },
  rationale: "Profile G (Permanent Residual / Impairment) gives major weight to functional & life impact (ADL, work, permanency evidence) and injury merit (impairment rating, severity). Treatment pattern is minimal since permanency already demonstrates sustained impact.",
};

/**
 * Fallback for profiles B, D, E, H, Z — balanced weighting.
 */
const FALLBACK_WEIGHTS: ProfileWeightBand = {
  profile: "Z", // placeholder
  version: V,
  effective_date: D,
  weights: {
    injury_merit: 0.25,
    treatment_pattern: 0.20,
    functional_impact: 0.20,
    economic: 0.20,
    post_merit_adjustment: 0.15,
  },
  rationale: "Balanced weighting applied. No profile-specific tuning — all factor categories contribute proportionally. This band is used when a specific profile weight band has not yet been configured.",
};

const PROFILE_WEIGHT_BANDS: Partial<Record<ClaimProfileCode, ProfileWeightBand>> = {
  A: PROFILE_A_WEIGHTS,
  C: PROFILE_C_WEIGHTS,
  F: PROFILE_F_WEIGHTS,
  G: PROFILE_G_WEIGHTS,
};

/**
 * Get the weight band for a profile, falling back to the balanced default.
 */
export function getProfileWeightBand(profile: ClaimProfileCode): ProfileWeightBand {
  const band = PROFILE_WEIGHT_BANDS[profile];
  if (band) return band;
  return { ...FALLBACK_WEIGHTS, profile };
}

/**
 * List all configured weight bands (including fallback).
 */
export function getAllWeightBands(): ProfileWeightBand[] {
  const configured = Object.values(PROFILE_WEIGHT_BANDS) as ProfileWeightBand[];
  return [...configured, { ...FALLBACK_WEIGHTS, profile: "Z" as ClaimProfileCode }];
}

// ─── Category Score Computation ────────────────────────

export interface CategoryScore {
  category: WeightCategory;
  label: string;
  weight: number;
  raw_avg: number;        // 0–5 average of applicable factors in this category
  normalized: number;     // 0–100 (raw_avg / 5 * 100)
  weighted_contribution: number; // normalized * weight
  factor_count: number;
  applicable_count: number;
}

export interface WeightedMeritsResult {
  /** The claim profile used */
  profile: ClaimProfileCode;
  /** The weight band applied */
  weight_band: ProfileWeightBand;
  /** Per-category breakdown */
  category_scores: CategoryScore[];
  /** Final merits score 0–100 */
  merits_score: number;
  /** Merits confidence */
  confidence: "high" | "moderate" | "low";
  /** Gate status from scoring */
  gates_passed: boolean;
  /** If gates failed, merits is provisional */
  is_provisional: boolean;
  /** Explanation of the weighting */
  weighting_explanation: string;
}

/**
 * Compute the weighted merits score using profile-specific weight bands.
 *
 * Layer 0 (gates) is excluded from the merits score — it controls eligibility only.
 * Layers 1–5 map to the five weight categories.
 */
export function computeWeightedMeritsScore(
  scoringResult: FactorScoringResult,
  profile: ClaimProfileCode,
): WeightedMeritsResult {
  const band = getProfileWeightBand(profile);

  const categoryScores: CategoryScore[] = WEIGHT_CATEGORIES.map(cat => {
    const meta = WEIGHT_CATEGORY_META[cat];
    const weight = band.weights[cat];

    // Collect factors for this category's layers
    const factors = scoringResult.scored_factors.filter(
      f => meta.layers.includes(f.definition.layer) && !f.suppressed
    );
    const applicable = factors.filter(f => f.applicable);

    // Compute raw average — for ordinal_0_5, use score directly; for others, normalize
    let rawAvg = 0;
    if (applicable.length > 0) {
      const normalizedScores = applicable.map(f => normalizeFactorScore(f));
      rawAvg = normalizedScores.reduce((a, b) => a + b, 0) / normalizedScores.length;
    }

    const normalized = Math.round(rawAvg * 20 * 10) / 10; // 0–5 → 0–100
    const weightedContribution = Math.round(normalized * weight * 10) / 10;

    return {
      category: cat,
      label: meta.label,
      weight,
      raw_avg: Math.round(rawAvg * 10) / 10,
      normalized: Math.min(100, normalized),
      weighted_contribution: weightedContribution,
      factor_count: factors.length,
      applicable_count: applicable.length,
    };
  });

  // Sum weighted contributions → merits score
  const rawMerits = categoryScores.reduce((s, c) => s + c.weighted_contribution, 0);
  const meritsScore = Math.round(Math.min(100, Math.max(0, rawMerits)));

  // Confidence from scoring result
  const lowConfCount = scoringResult.scored_factors.filter(f => f.confidence === "low" && f.applicable).length;
  const applicableCount = scoringResult.scored_factors.filter(f => f.applicable).length;
  const lowRatio = applicableCount > 0 ? lowConfCount / applicableCount : 1;
  const confidence: "high" | "moderate" | "low" =
    lowRatio > 0.3 ? "low" : lowRatio > 0.1 ? "moderate" : "high";

  const isProvisional = !scoringResult.gates_passed;

  // Build explanation
  const topCategory = [...categoryScores].sort((a, b) => b.weighted_contribution - a.weighted_contribution)[0];
  const weighting_explanation = `Profile ${profile} weight band applied (v${band.version}). ${band.rationale} Highest-weighted category: ${topCategory?.label ?? "N/A"} (${Math.round((topCategory?.weight ?? 0) * 100)}%).${isProvisional ? " Score is provisional — readiness gates have not all passed." : ""}`;

  return {
    profile,
    weight_band: band,
    category_scores: categoryScores,
    merits_score: meritsScore,
    confidence,
    gates_passed: scoringResult.gates_passed,
    is_provisional: isProvisional,
    weighting_explanation,
  };
}

/**
 * Normalize a factor's score to a 0–5 scale regardless of score type.
 */
function normalizeFactorScore(factor: ScoredFactor): number {
  const def = factor.definition;
  switch (def.score_type) {
    case "ordinal_0_5":
      return factor.score; // already 0–5
    case "binary":
      return factor.score >= 1 ? 5 : 0;
    case "percentage":
      // Invert for reducers (e.g. 20% negligence = 4/5 remaining)
      if (def.default_direction === "reducer") {
        return Math.max(0, 5 * (1 - factor.score / 100));
      }
      return (factor.score / 100) * 5;
    case "multiplier":
      // 1.0 = neutral (2.5), 0.5 = 0, 1.5 = 5
      return Math.max(0, Math.min(5, (factor.score - 0.5) * 5));
    case "dollar_adjustment":
      // Policy limits — higher is better for claimant; normalize with log scale
      if (factor.score <= 0) return 0;
      if (factor.score >= 1000000) return 5;
      return Math.min(5, Math.log10(factor.score) / Math.log10(1000000) * 5);
    case "not_scored":
      return 0;
    default:
      return Math.min(5, Math.max(0, factor.score));
  }
}
