/**
 * EvaluateIQ — Merits Corridor Engine
 *
 * Converts a weighted merits score into an explainable merits corridor
 * (Low / Mid / High bands) BEFORE post-merit adjustments are applied.
 *
 * The corridor represents the pre-adjustment "merit-based value zone"
 * informed by claim profile and benchmark-driven shaping.
 *
 * DESIGN:
 *  - Output is always a corridor (three bands), never a single number.
 *  - Shaping hooks are modular: v1 uses seeded logic, future versions
 *    swap in real benchmark datasets.
 *  - Post-merit adjustments (liability, venue, coverage) are explicitly
 *    excluded — they layer on top later.
 */

import type { ClaimProfileCode } from "@/lib/claimProfileClassifier";
import type { WeightedMeritsResult, CategoryScore } from "@/lib/profileWeightingEngine";
import type { RankedFactorSummary } from "@/types/factor-taxonomy";

// ─── Engine Version ────────────────────────────────────

export const CORRIDOR_ENGINE_VERSION = "1.0.0";

// ─── Corridor Output ───────────────────────────────────

export interface MeritsCorridor {
  /** Engine metadata */
  engine_version: string;
  computed_at: string;

  /** The merits score that seeded this corridor */
  merits_score: number;
  profile: ClaimProfileCode;

  /** Corridor label */
  corridor_label: CorridorLabel;

  /** Corridor bands — pre-adjustment value zones */
  low: number;
  mid: number;
  high: number;

  /** Band width (high - low) as a percentage of mid */
  band_width_pct: number;

  /** Confidence inherited from merits scoring */
  confidence: "high" | "moderate" | "low";

  /** Top contributors driving the corridor position */
  top_contributors: CorridorContributor[];

  /** Corridor explanation */
  explanation: CorridorExplanation;

  /** Whether gates passed (if not, corridor is provisional) */
  is_provisional: boolean;
}

export type CorridorLabel =
  | "very_low"    // 0–19
  | "low"         // 20–34
  | "below_mid"   // 35–49
  | "mid"         // 50–64
  | "above_mid"   // 65–79
  | "high"        // 80–89
  | "very_high";  // 90–100

export interface CorridorContributor {
  label: string;
  category: string;
  direction: "expander" | "reducer" | "neutral";
  contribution: number; // weighted contribution value
  narrative: string;
}

export interface CorridorExplanation {
  /** One-line corridor summary */
  summary: string;
  /** Why this corridor position */
  position_rationale: string;
  /** Why this corridor width */
  width_rationale: string;
  /** What is NOT included (post-merit adjustments) */
  exclusions: string[];
}

// ─── Corridor Label Mapping ────────────────────────────

const CORRIDOR_LABELS: { max: number; label: CorridorLabel }[] = [
  { max: 19, label: "very_low" },
  { max: 34, label: "low" },
  { max: 49, label: "below_mid" },
  { max: 64, label: "mid" },
  { max: 79, label: "above_mid" },
  { max: 89, label: "high" },
  { max: 100, label: "very_high" },
];

export const CORRIDOR_LABEL_META: Record<CorridorLabel, { display: string; description: string }> = {
  very_low:  { display: "Very Low",  description: "Minimal merit support — significant data gaps or weak injury profile." },
  low:       { display: "Low",       description: "Below-average merit support — limited objective findings or treatment concerns." },
  below_mid: { display: "Below Mid", description: "Moderate-low merit — some supporting factors but notable weaknesses." },
  mid:       { display: "Mid",       description: "Average merit corridor — balanced supporting and limiting factors." },
  above_mid: { display: "Above Mid", description: "Above-average merit — strong clinical support with minor gaps." },
  high:      { display: "High",      description: "Strong merit support — objective findings, clear treatment, documented impact." },
  very_high: { display: "Very High", description: "Exceptional merit support across all factor categories." },
};

function classifyCorridorLabel(score: number): CorridorLabel {
  for (const entry of CORRIDOR_LABELS) {
    if (score <= entry.max) return entry.label;
  }
  return "very_high";
}

// ─── Benchmark Shaping (v1 Seeded) ────────────────────
//
// These hooks define how the merits score maps to corridor
// band widths. v1 uses profile-aware seeded logic.
// Future versions replace this with real benchmark-driven curves.

interface ShapingConfig {
  /** Base band width as % of mid-point (e.g. 0.30 = ±15%) */
  base_width_pct: number;
  /** Asymmetry factor: >1.0 stretches high band more than low */
  asymmetry: number;
  /** Min floor as fraction of mid (prevents corridor collapsing to zero) */
  min_floor_ratio: number;
}

const PROFILE_SHAPING: Partial<Record<ClaimProfileCode, ShapingConfig>> = {
  A: { base_width_pct: 0.40, asymmetry: 1.1, min_floor_ratio: 0.70 },
  C: { base_width_pct: 0.35, asymmetry: 1.2, min_floor_ratio: 0.72 },
  F: { base_width_pct: 0.45, asymmetry: 1.3, min_floor_ratio: 0.65 },
  G: { base_width_pct: 0.50, asymmetry: 1.4, min_floor_ratio: 0.60 },
};

const DEFAULT_SHAPING: ShapingConfig = {
  base_width_pct: 0.40,
  asymmetry: 1.2,
  min_floor_ratio: 0.68,
};

function getShapingConfig(profile: ClaimProfileCode): ShapingConfig {
  return PROFILE_SHAPING[profile] ?? DEFAULT_SHAPING;
}

// ─── Confidence Width Modifier ─────────────────────────
// Lower confidence → wider corridor (more uncertainty)

function confidenceWidthMultiplier(confidence: "high" | "moderate" | "low"): number {
  switch (confidence) {
    case "high": return 1.0;
    case "moderate": return 1.15;
    case "low": return 1.35;
  }
}

// ─── Engine Entry Point ────────────────────────────────

export function computeMeritsCorridor(
  meritsResult: WeightedMeritsResult,
  topDrivers: RankedFactorSummary[],
  topSuppressors: RankedFactorSummary[],
): MeritsCorridor {
  const { merits_score, profile, confidence, category_scores, is_provisional } = meritsResult;
  const shaping = getShapingConfig(profile);

  // Mid-point IS the merits score (normalized 0–100)
  const mid = merits_score;

  // Compute band width with confidence adjustment
  const confMult = confidenceWidthMultiplier(confidence);
  const effectiveWidth = shaping.base_width_pct * confMult;

  // Asymmetric bands: high band stretches more than low band compresses
  const lowSpread = effectiveWidth / (1 + shaping.asymmetry) * mid;
  const highSpread = effectiveWidth * shaping.asymmetry / (1 + shaping.asymmetry) * mid;

  let low = Math.max(0, Math.round(mid - lowSpread));
  let high = Math.min(100, Math.round(mid + highSpread));

  // Enforce minimum floor ratio
  if (mid > 0 && low < mid * shaping.min_floor_ratio) {
    low = Math.round(mid * shaping.min_floor_ratio);
  }

  // Ensure ordering
  if (low > mid) low = mid;
  if (high < mid) high = mid;

  const band_width_pct = mid > 0 ? Math.round(((high - low) / mid) * 100) : 0;
  const corridorLabel = classifyCorridorLabel(mid);

  // Build contributors from category scores + ranked factors
  const contributors = buildContributors(category_scores, topDrivers, topSuppressors);

  // Build explanation
  const labelMeta = CORRIDOR_LABEL_META[corridorLabel];
  const explanation: CorridorExplanation = {
    summary: `Merits score of ${mid}/100 places this claim in the "${labelMeta.display}" corridor (${low}–${high}). ${labelMeta.description}`,
    position_rationale: buildPositionRationale(category_scores, profile),
    width_rationale: `Corridor width is ${band_width_pct}% of mid-point. ${confidence === "low" ? "Width expanded due to low data confidence." : confidence === "moderate" ? "Slightly widened for moderate confidence." : "Narrow corridor reflects high data confidence."}${is_provisional ? " Corridor is provisional — readiness gates have not all passed." : ""}`,
    exclusions: [
      "Comparative negligence / liability apportionment",
      "Venue / jurisdiction adjustment",
      "Coverage / collectability constraints",
      "Documentation confidence adjustment",
      "Causation and apportionment factors",
    ],
  };

  return {
    engine_version: CORRIDOR_ENGINE_VERSION,
    computed_at: new Date().toISOString(),
    merits_score: mid,
    profile,
    corridor_label: corridorLabel,
    low,
    mid,
    high,
    band_width_pct,
    confidence,
    top_contributors: contributors,
    explanation,
    is_provisional,
  };
}

// ─── Helpers ───────────────────────────────────────────

function buildContributors(
  categoryScores: CategoryScore[],
  topDrivers: RankedFactorSummary[],
  topSuppressors: RankedFactorSummary[],
): CorridorContributor[] {
  const contributors: CorridorContributor[] = [];

  // Top 3 category contributors
  const sortedCats = [...categoryScores]
    .filter(c => c.applicable_count > 0)
    .sort((a, b) => b.weighted_contribution - a.weighted_contribution);

  for (const cat of sortedCats.slice(0, 3)) {
    contributors.push({
      label: cat.label,
      category: cat.category,
      direction: cat.weighted_contribution >= 15 ? "expander" : cat.weighted_contribution <= 5 ? "reducer" : "neutral",
      contribution: cat.weighted_contribution,
      narrative: `${cat.label}: ${cat.applicable_count} factors scored, contributing ${cat.weighted_contribution.toFixed(1)} points (${Math.round(cat.weight * 100)}% weight).`,
    });
  }

  // Top 2 individual drivers
  for (const d of topDrivers.slice(0, 2)) {
    contributors.push({
      label: d.factor_name,
      category: `Layer ${d.layer}`,
      direction: "expander",
      contribution: d.score,
      narrative: d.narrative,
    });
  }

  // Top 2 individual suppressors
  for (const s of topSuppressors.slice(0, 2)) {
    contributors.push({
      label: s.factor_name,
      category: `Layer ${s.layer}`,
      direction: "reducer",
      contribution: s.score,
      narrative: s.narrative,
    });
  }

  return contributors;
}

function buildPositionRationale(categoryScores: CategoryScore[], profile: ClaimProfileCode): string {
  const sorted = [...categoryScores].sort((a, b) => b.weighted_contribution - a.weighted_contribution);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];

  if (!top || !bottom) return "Insufficient data to determine position rationale.";

  return `Profile ${profile} weighting emphasizes ${top.label} (${Math.round(top.weight * 100)}%), which contributed ${top.weighted_contribution.toFixed(1)} points. ${bottom.label} had the least impact at ${bottom.weighted_contribution.toFixed(1)} points. This corridor position reflects the balance of merit-based factors before any legal or coverage adjustments.`;
}
