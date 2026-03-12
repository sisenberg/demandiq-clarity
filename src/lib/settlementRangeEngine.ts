/**
 * EvaluateIQ — Settlement Range Engine (v1.0)
 *
 * Generates a defensible bodily injury valuation range from normalized
 * intake data and extracted valuation drivers.
 *
 * ═══════════════════════════════════════════════════════════════════
 * DESIGN PRINCIPLES
 * ═══════════════════════════════════════════════════════════════════
 *
 * 1. TRANSPARENT COMPOSITION — Range is built from named, additive
 *    components (economic base, non-economic severity, adjustments).
 *    No black-box ML.
 *
 * 2. NO FALSE PRECISION — Outputs are rounded to negotiation-friendly
 *    increments ($250 for small claims, $500 for mid, $1000+ for large).
 *
 * 3. NEVER A SINGLE NUMBER — Always produces floor / likely / stretch.
 *
 * 4. REVIEWER-PREFERRED — Uses ReviewerIQ-assessed medicals when
 *    available; billed totals shown for context only.
 *
 * 5. EVERY CONSTANT DOCUMENTED — No magic numbers.
 *
 * ═══════════════════════════════════════════════════════════════════
 */

import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import type { ExtractedDriver, DriverExtractionResult } from "./valuationDriverEngine";
import type { ValuationRunAssumptionSummary } from "@/types/evaluate-persistence";
import type { HumanAssumptionOverrides } from "@/hooks/useAssumptionOverrides";

// ─── Engine Version ────────────────────────────────────

export const RANGE_ENGINE_VERSION = "v1.0.0";

// ─── Output Types ──────────────────────────────────────

export interface RangeEngineOutput {
  /** Engine metadata */
  engine_version: string;
  computed_at: string;

  /** Range bands */
  floor: number;
  likely: number;
  stretch: number;

  /** Confidence (0–100) based on data completeness & input stability */
  confidence: number;
  confidence_label: "high" | "moderate" | "low" | "very_low";

  /** Composition breakdown: how each component contributed */
  composition: RangeComposition;

  /** Top assumptions that most affected the range */
  top_assumptions: ValuationRunAssumptionSummary[];

  /** Rationale object for UI rendering and downstream publication */
  rationale: RangeRationale;

  /** Warnings about data quality or high uncertainty */
  warnings: RangeWarning[];

  /** Inputs summary for persistence */
  inputs_summary: RangeInputsSummary;
}

export interface RangeComposition {
  /** Economic base (medicals + wage loss + future treatment) */
  economic_base: ComponentBreakdown;
  /** Non-economic severity multiplier applied to economic base */
  severity_multiplier: MultiplierBreakdown;
  /** Liability adjustment factor (0–1.0 where 1.0 = full liability) */
  liability_factor: AdjustmentBreakdown;
  /** Treatment quality/reliability adjustment (0.8–1.0) */
  treatment_reliability: AdjustmentBreakdown;
  /** Policy/collectability cap if applicable */
  policy_cap: PolicyCapBreakdown;
}

export interface ComponentBreakdown {
  label: string;
  /** For each band */
  floor: number;
  likely: number;
  stretch: number;
  details: string[];
}

export interface MultiplierBreakdown {
  label: string;
  floor_mult: number;
  likely_mult: number;
  stretch_mult: number;
  reasons: string[];
}

export interface AdjustmentBreakdown {
  label: string;
  factor: number;
  reasons: string[];
}

export interface PolicyCapBreakdown {
  applied: boolean;
  max_coverage: number | null;
  capped_band: "floor" | "likely" | "stretch" | null;
  detail: string;
}

export interface RangeRationale {
  summary: string;
  economic_narrative: string;
  severity_narrative: string;
  adjustment_narrative: string;
  key_expanders: string[];
  key_reducers: string[];
}

export interface RangeWarning {
  code: string;
  severity: "info" | "warning" | "critical";
  message: string;
}

export interface RangeInputsSummary {
  total_billed: number;
  total_reviewed: number | null;
  economic_base_used: number;
  wage_loss: number;
  future_medical: number;
  injury_count: number;
  treatment_count: number;
  has_surgery: boolean;
  has_permanency: boolean;
  liability_supporting: number;
  liability_adverse: number;
  completeness_score: number;
}

// ─── Constants (all documented) ────────────────────────

/**
 * NON-ECONOMIC SEVERITY MULTIPLIERS
 *
 * These represent the general-damages-to-specials ratio observed
 * in settlement data across U.S. jurisdictions. The multiplier is
 * applied to the economic base to estimate non-economic damages.
 *
 * Source basis: Industry settlement databases, published verdict
 * reporter analyses. Ranges are conservative for v1.
 */
const SEVERITY_MULT = {
  /** Mild/soft-tissue only, no objective findings */
  baseline: { floor: 1.0, likely: 1.5, stretch: 2.5 },
  /** Moderate injuries, some objective findings */
  moderate: { floor: 1.5, likely: 2.5, stretch: 4.0 },
  /** Severe injuries, clear objective findings */
  severe:   { floor: 2.5, likely: 4.0, stretch: 6.0 },
  /** Catastrophic / permanent disability */
  catastrophic: { floor: 4.0, likely: 7.0, stretch: 12.0 },
} as const;

/**
 * CLINICAL SEVERITY ADJUSTMENTS
 *
 * Incremental multiplier adjustments for specific clinical findings.
 * Each adjustment is additive to the base multiplier to prevent
 * compounding effects.
 *
 * Rationale: Surgery and permanency are the strongest non-economic
 * drivers per verdict research. Imaging and injections are supporting.
 */
const CLINICAL_ADJUSTMENTS = {
  surgery:        { floor: 0.5, likely: 1.0, stretch: 1.5, reason: "Surgical intervention" },
  permanency:     { floor: 0.5, likely: 1.0, stretch: 2.0, reason: "Permanency / impairment indicators" },
  impairment_rating: { floor: 0.3, likely: 0.5, stretch: 1.0, reason: "Formal impairment rating documented" },
  injections:     { floor: 0.2, likely: 0.4, stretch: 0.6, reason: "Interventional injection procedures" },
  scarring:       { floor: 0.1, likely: 0.3, stretch: 0.5, reason: "Scarring / disfigurement" },
  advanced_imaging: { floor: 0.1, likely: 0.2, stretch: 0.3, reason: "Advanced imaging (MRI/CT) with findings" },
} as const;

/**
 * TREATMENT RELIABILITY ADJUSTMENT RANGE
 *
 * When upstream review flags treatment concerns (gaps, passive-only,
 * coding issues), the treatment reliability factor reduces the
 * effective economic base. Factor range: 0.70 (significant concerns)
 * to 1.00 (no concerns).
 *
 * Each concern type applies a documented reduction.
 */
const RELIABILITY_REDUCTIONS: Record<string, { factor: number; reason: string }> = {
  treatment_gap:           { factor: 0.03, reason: "Treatment gap >30 days identified" },
  passive_concentration:   { factor: 0.04, reason: "High passive-treatment concentration" },
  reasonableness_concerns: { factor: 0.05, reason: "Reasonableness concerns from medical review" },
  billing_reduction:       { factor: 0.03, reason: "Significant billing reductions by reviewer" },
  credibility_issues:      { factor: 0.04, reason: "Claimant credibility concerns" },
};

/**
 * ROUNDING INCREMENTS
 *
 * Values are rounded to practical negotiation increments:
 *  - Under $10K:  round to nearest $250
 *  - $10K–$100K:  round to nearest $500
 *  - $100K–$500K: round to nearest $1,000
 *  - Over $500K:  round to nearest $5,000
 */
function roundToNegotiationIncrement(value: number): number {
  if (value <= 0) return 0;
  if (value < 10_000) return Math.round(value / 250) * 250;
  if (value < 100_000) return Math.round(value / 500) * 500;
  if (value < 500_000) return Math.round(value / 1_000) * 1_000;
  return Math.round(value / 5_000) * 5_000;
}

// ─── Engine Entry Point ────────────────────────────────

export function computeSettlementRange(
  snapshot: EvaluateIntakeSnapshot,
  driverResult: DriverExtractionResult,
): RangeEngineOutput {
  const warnings: RangeWarning[] = [];
  const assumptions: ValuationRunAssumptionSummary[] = [];

  // ════════════════════════════════════════════════════
  // STEP 1: Compute Economic Base
  // ════════════════════════════════════════════════════

  const totalBilled = snapshot.medical_billing.reduce((s, b) => s + b.billed_amount, 0);
  const hasReviewed = snapshot.medical_billing.some((b) => b.reviewer_recommended_amount != null);
  const totalReviewed = hasReviewed
    ? snapshot.medical_billing.reduce((s, b) => s + (b.reviewer_recommended_amount ?? b.billed_amount), 0)
    : null;

  // Prefer reviewed amounts; fall back to billed
  const medicalBase = totalReviewed ?? totalBilled;
  const wageLoss = snapshot.wage_loss.total_lost_wages.value;
  const futureMedical = snapshot.future_treatment.future_medical_estimate.value;

  const economicBase = medicalBase + wageLoss + futureMedical;

  if (hasReviewed) {
    assumptions.push({
      key: "medical_base",
      label: "Reviewer-assessed medicals used as economic base",
      impact: "neutral",
      description: `$${medicalBase.toLocaleString()} reviewed vs $${totalBilled.toLocaleString()} billed`,
    });
  } else {
    assumptions.push({
      key: "medical_base",
      label: "Billed medical totals used (reviewed amounts unavailable)",
      impact: "neutral",
      description: `$${totalBilled.toLocaleString()} billed — range may narrow with reviewed amounts`,
    });
  }

  if (economicBase === 0) {
    warnings.push({
      code: "ZERO_ECONOMIC_BASE",
      severity: "critical",
      message: "No economic damages found (medicals, wages, future treatment all zero). Range will be $0.",
    });
  }

  const economicDetails: string[] = [
    `Medical base: $${medicalBase.toLocaleString()}${hasReviewed ? " (reviewed)" : " (billed)"}`,
  ];
  if (wageLoss > 0) economicDetails.push(`Wage loss: $${wageLoss.toLocaleString()}`);
  if (futureMedical > 0) economicDetails.push(`Future medical: $${futureMedical.toLocaleString()}`);

  // ════════════════════════════════════════════════════
  // STEP 2: Determine Severity Tier & Multipliers
  // ════════════════════════════════════════════════════

  const severityTier = determineSeverityTier(snapshot, driverResult);
  const baseMult = SEVERITY_MULT[severityTier];
  let floorMult = baseMult.floor;
  let likelyMult = baseMult.likely;
  let stretchMult = baseMult.stretch;

  const multReasons: string[] = [`Base tier: ${severityTier} (${baseMult.floor}x / ${baseMult.likely}x / ${baseMult.stretch}x)`];

  // Apply clinical adjustments
  const flags = snapshot.clinical_flags;
  for (const [key, adj] of Object.entries(CLINICAL_ADJUSTMENTS)) {
    let applies = false;
    switch (key) {
      case "surgery": applies = flags.has_surgery; break;
      case "permanency": applies = flags.has_permanency_indicators && !flags.has_impairment_rating; break;
      case "impairment_rating": applies = flags.has_impairment_rating; break;
      case "injections": applies = flags.has_injections; break;
      case "scarring": applies = flags.has_scarring_disfigurement; break;
      case "advanced_imaging": applies = flags.has_advanced_imaging; break;
    }
    if (applies) {
      floorMult += adj.floor;
      likelyMult += adj.likely;
      stretchMult += adj.stretch;
      multReasons.push(`+${adj.floor}/${adj.likely}/${adj.stretch} — ${adj.reason}`);
      assumptions.push({
        key: `clinical_${key}`,
        label: adj.reason,
        impact: "expander",
        description: `Adds ${adj.floor}x–${adj.stretch}x to severity multiplier`,
      });
    }
  }

  // ════════════════════════════════════════════════════
  // STEP 3: Liability Adjustment Factor
  // ════════════════════════════════════════════════════

  const { factor: liabilityFactor, reasons: liabilityReasons } =
    computeLiabilityFactor(snapshot, driverResult, assumptions);

  // ════════════════════════════════════════════════════
  // STEP 4: Treatment Reliability Adjustment
  // ════════════════════════════════════════════════════

  const { factor: reliabilityFactor, reasons: reliabilityReasons } =
    computeReliabilityFactor(snapshot, driverResult, totalBilled, totalReviewed, assumptions);

  // ════════════════════════════════════════════════════
  // STEP 5: Compute Raw Range
  // ════════════════════════════════════════════════════

  // Range = (economic_base × severity_mult) × liability × reliability
  const rawFloor = economicBase * floorMult * liabilityFactor * reliabilityFactor;
  const rawLikely = economicBase * likelyMult * liabilityFactor * reliabilityFactor;
  const rawStretch = economicBase * stretchMult * liabilityFactor * reliabilityFactor;

  // ════════════════════════════════════════════════════
  // STEP 6: Policy / Collectability Cap
  // ════════════════════════════════════════════════════

  const maxCoverage = snapshot.policy_coverage.reduce((m, p) => Math.max(m, p.coverage_limit ?? 0), 0);
  let cappedFloor = rawFloor;
  let cappedLikely = rawLikely;
  let cappedStretch = rawStretch;
  let policyCapApplied = false;
  let cappedBand: "floor" | "likely" | "stretch" | null = null;

  if (maxCoverage > 0) {
    if (rawStretch > maxCoverage) {
      cappedStretch = maxCoverage;
      cappedBand = "stretch";
      policyCapApplied = true;
    }
    if (rawLikely > maxCoverage) {
      cappedLikely = maxCoverage;
      cappedBand = "likely";
    }
    if (rawFloor > maxCoverage) {
      cappedFloor = maxCoverage;
      cappedBand = "floor";
    }
    if (policyCapApplied) {
      assumptions.push({
        key: "policy_cap",
        label: "Policy limits cap applied to range",
        impact: "reducer",
        description: `Maximum coverage of $${maxCoverage.toLocaleString()} constrains ${cappedBand} band`,
      });
      warnings.push({
        code: "POLICY_CAP_APPLIED",
        severity: "warning",
        message: `Range capped by $${maxCoverage.toLocaleString()} policy limits at the ${cappedBand} band.`,
      });
    }
  }

  // ════════════════════════════════════════════════════
  // STEP 7: Round & Enforce Floor ≤ Likely ≤ Stretch
  // ════════════════════════════════════════════════════

  let floor = roundToNegotiationIncrement(cappedFloor);
  let likely = roundToNegotiationIncrement(cappedLikely);
  let stretch = roundToNegotiationIncrement(cappedStretch);

  // Enforce monotonic ordering after rounding
  if (likely < floor) likely = floor;
  if (stretch < likely) stretch = likely;

  // ════════════════════════════════════════════════════
  // STEP 8: Confidence Score
  // ════════════════════════════════════════════════════

  const confidence = computeConfidence(snapshot, driverResult, warnings);
  const confidence_label: RangeEngineOutput["confidence_label"] =
    confidence >= 75 ? "high"
    : confidence >= 50 ? "moderate"
    : confidence >= 25 ? "low"
    : "very_low";

  // ════════════════════════════════════════════════════
  // STEP 9: Build Rationale
  // ════════════════════════════════════════════════════

  const expanders = driverResult.drivers
    .filter((d) => d.direction === "expander" && d.score >= 50)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((d) => d.narrative);

  const reducers = driverResult.drivers
    .filter((d) => d.direction === "reducer" && d.score >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((d) => d.narrative);

  const rationale: RangeRationale = {
    summary: `Settlement range of $${floor.toLocaleString()} – $${stretch.toLocaleString()} based on $${economicBase.toLocaleString()} economic base with ${severityTier}-tier severity multipliers, ${Math.round(liabilityFactor * 100)}% liability factor, and ${Math.round(reliabilityFactor * 100)}% treatment reliability.`,
    economic_narrative: `Economic base of $${economicBase.toLocaleString()} comprises ${hasReviewed ? "reviewer-assessed" : "billed"} medicals ($${medicalBase.toLocaleString()})${wageLoss > 0 ? `, wage loss ($${wageLoss.toLocaleString()})` : ""}${futureMedical > 0 ? `, future medical ($${futureMedical.toLocaleString()})` : ""}.`,
    severity_narrative: `${severityTier.charAt(0).toUpperCase() + severityTier.slice(1)} severity tier applied with multipliers of ${floorMult.toFixed(1)}x / ${likelyMult.toFixed(1)}x / ${stretchMult.toFixed(1)}x after clinical adjustments.`,
    adjustment_narrative: `Liability factor of ${Math.round(liabilityFactor * 100)}% and treatment reliability of ${Math.round(reliabilityFactor * 100)}% applied.${policyCapApplied ? ` Policy cap of $${maxCoverage.toLocaleString()} constrains the ${cappedBand} band.` : ""}`,
    key_expanders: expanders,
    key_reducers: reducers,
  };

  // ════════════════════════════════════════════════════
  // STEP 10: Additional warnings
  // ════════════════════════════════════════════════════

  if (snapshot.overall_completeness_score < 50) {
    warnings.push({
      code: "LOW_COMPLETENESS",
      severity: "warning",
      message: `Intake completeness is only ${snapshot.overall_completeness_score}%. Range accuracy may be significantly affected.`,
    });
  }

  if (driverResult.drivers.length < 3) {
    warnings.push({
      code: "FEW_DRIVERS",
      severity: "warning",
      message: "Fewer than 3 valuation drivers extracted. Range may not reflect full claim complexity.",
    });
  }

  const spreadRatio = floor > 0 ? stretch / floor : 0;
  if (spreadRatio > 5) {
    warnings.push({
      code: "WIDE_SPREAD",
      severity: "info",
      message: `Range spread is ${spreadRatio.toFixed(1)}x (stretch/floor). This may indicate high uncertainty in key inputs.`,
    });
  }

  return {
    engine_version: RANGE_ENGINE_VERSION,
    computed_at: new Date().toISOString(),
    floor,
    likely,
    stretch,
    confidence,
    confidence_label,
    composition: {
      economic_base: {
        label: "Economic Base",
        floor: economicBase,
        likely: economicBase,
        stretch: economicBase,
        details: economicDetails,
      },
      severity_multiplier: {
        label: "Non-Economic Severity",
        floor_mult: floorMult,
        likely_mult: likelyMult,
        stretch_mult: stretchMult,
        reasons: multReasons,
      },
      liability_factor: {
        label: "Liability Adjustment",
        factor: liabilityFactor,
        reasons: liabilityReasons,
      },
      treatment_reliability: {
        label: "Treatment Reliability",
        factor: reliabilityFactor,
        reasons: reliabilityReasons,
      },
      policy_cap: {
        applied: policyCapApplied,
        max_coverage: maxCoverage > 0 ? maxCoverage : null,
        capped_band: cappedBand,
        detail: policyCapApplied
          ? `Policy limits of $${maxCoverage.toLocaleString()} cap the ${cappedBand} band`
          : maxCoverage > 0
            ? `$${maxCoverage.toLocaleString()} coverage available — no cap applied`
            : "No policy limits data available",
      },
    },
    top_assumptions: assumptions,
    rationale,
    warnings,
    inputs_summary: {
      total_billed: totalBilled,
      total_reviewed: totalReviewed,
      economic_base_used: economicBase,
      wage_loss: wageLoss,
      future_medical: futureMedical,
      injury_count: snapshot.injuries.filter((i) => !i.is_pre_existing).length,
      treatment_count: snapshot.treatment_timeline.length,
      has_surgery: flags.has_surgery,
      has_permanency: flags.has_permanency_indicators,
      liability_supporting: snapshot.liability_facts.filter((f) => f.supports_liability).length,
      liability_adverse: snapshot.liability_facts.filter((f) => !f.supports_liability).length,
      completeness_score: snapshot.overall_completeness_score,
    },
  };
}

// ─── Severity Tier Determination ───────────────────────

/**
 * Determines the severity tier based on injury severity profile and
 * driver scores. Uses the most severe non-pre-existing injury as
 * primary input, with driver scores as confirmation.
 */
function determineSeverityTier(
  s: EvaluateIntakeSnapshot,
  dr: DriverExtractionResult,
): keyof typeof SEVERITY_MULT {
  const nonPreExisting = s.injuries.filter((i) => !i.is_pre_existing);
  const severities = nonPreExisting.map((i) => i.severity.toLowerCase());

  if (severities.includes("catastrophic")) return "catastrophic";
  if (severities.includes("severe")) return "severe";

  // Check driver scores for elevated severity signals
  const injuryDrivers = dr.drivers.filter((d) => d.family === "injury_severity");
  const maxInjuryScore = injuryDrivers.reduce((m, d) => Math.max(m, d.score), 0);

  if (severities.includes("moderate") || maxInjuryScore >= 55) return "moderate";
  return "baseline";
}

// ─── Liability Factor ──────────────────────────────────

/**
 * Computes liability adjustment factor (0.10 – 1.00).
 *
 * Based on:
 *  - Ratio of supporting to adverse liability facts
 *  - Comparative negligence percentage
 *  - Overall liability driver scores
 *
 * 1.00 = full liability (no reduction)
 * 0.10 = minimum floor (never fully zero — reflects nuisance value)
 */
function computeLiabilityFactor(
  s: EvaluateIntakeSnapshot,
  dr: DriverExtractionResult,
  assumptions: ValuationRunAssumptionSummary[],
): { factor: number; reasons: string[] } {
  const reasons: string[] = [];
  let factor = 1.0;

  // Liability fact ratio
  const supporting = s.liability_facts.filter((f) => f.supports_liability).length;
  const adverse = s.liability_facts.filter((f) => !f.supports_liability).length;
  const total = supporting + adverse;

  if (total > 0) {
    const ratio = supporting / total;
    // Scale: ratio 1.0 → factor 1.0; ratio 0.0 → factor 0.30
    factor = 0.30 + ratio * 0.70;
    reasons.push(`Liability fact ratio: ${supporting}/${total} supporting (${Math.round(ratio * 100)}%)`);
  } else {
    // No liability facts — assume moderate uncertainty
    factor = 0.75;
    reasons.push("No liability facts available — assumed moderate liability");
  }

  // Comparative negligence
  const compNeg = s.comparative_negligence.claimant_negligence_percentage.value;
  if (compNeg !== null && compNeg > 0) {
    // Direct reduction by comparative fault percentage
    const compReduction = compNeg / 100;
    factor *= (1 - compReduction);
    reasons.push(`Comparative negligence: ${compNeg}% reduction applied`);
    assumptions.push({
      key: "comp_negligence",
      label: `${compNeg}% comparative negligence reduces range`,
      impact: "reducer",
      description: `Claimant fault of ${compNeg}% directly reduces recoverable damages`,
    });
  }

  // Floor at 0.10 (nuisance value)
  factor = Math.max(0.10, Math.min(1.0, factor));
  return { factor, reasons };
}

// ─── Treatment Reliability Factor ──────────────────────

/**
 * Computes treatment reliability factor (0.70 – 1.00).
 *
 * Reduces the effective economic base when treatment patterns
 * show concerning indicators from upstream review.
 */
function computeReliabilityFactor(
  s: EvaluateIntakeSnapshot,
  dr: DriverExtractionResult,
  totalBilled: number,
  totalReviewed: number | null,
  assumptions: ValuationRunAssumptionSummary[],
): { factor: number; reasons: string[] } {
  const reasons: string[] = [];
  let reductionTotal = 0;

  // Check each concern type against drivers
  const driverKeys = new Set(dr.drivers.map((d) => d.driver_key));

  if (driverKeys.has("treatment_gap")) {
    reductionTotal += RELIABILITY_REDUCTIONS.treatment_gap.factor;
    reasons.push(RELIABILITY_REDUCTIONS.treatment_gap.reason);
  }

  if (driverKeys.has("passive_concentration")) {
    reductionTotal += RELIABILITY_REDUCTIONS.passive_concentration.factor;
    reasons.push(RELIABILITY_REDUCTIONS.passive_concentration.reason);
  }

  if (driverKeys.has("reasonableness_concerns")) {
    reductionTotal += RELIABILITY_REDUCTIONS.reasonableness_concerns.factor;
    reasons.push(RELIABILITY_REDUCTIONS.reasonableness_concerns.reason);
  }

  // Significant billing reduction from reviewer
  if (totalReviewed !== null && totalBilled > 0) {
    const reductionPct = (totalBilled - totalReviewed) / totalBilled;
    if (reductionPct > 0.20) {
      reductionTotal += RELIABILITY_REDUCTIONS.billing_reduction.factor;
      reasons.push(`${RELIABILITY_REDUCTIONS.billing_reduction.reason} (${Math.round(reductionPct * 100)}% reduced)`);
    }
  }

  // Credibility concerns
  const credConcerns = s.upstream_concerns.filter((c) => c.category === "credibility");
  if (credConcerns.length > 0) {
    reductionTotal += RELIABILITY_REDUCTIONS.credibility_issues.factor;
    reasons.push(RELIABILITY_REDUCTIONS.credibility_issues.reason);
  }

  const factor = Math.max(0.70, 1.0 - reductionTotal);

  if (reductionTotal > 0) {
    assumptions.push({
      key: "treatment_reliability",
      label: `Treatment reliability adjusted to ${Math.round(factor * 100)}%`,
      impact: "reducer",
      description: reasons.join("; "),
    });
  }

  if (reasons.length === 0) {
    reasons.push("No treatment reliability concerns identified");
  }

  return { factor, reasons };
}

// ─── Confidence Computation ────────────────────────────

/**
 * Confidence score (0–100) based on:
 *  - Data completeness (40% weight)
 *  - Driver coverage — how many families have ≥1 driver (30% weight)
 *  - Input stability — spread ratio and warning count (30% weight)
 */
function computeConfidence(
  s: EvaluateIntakeSnapshot,
  dr: DriverExtractionResult,
  warnings: RangeWarning[],
): number {
  // Completeness (0–100, 40% weight)
  const completeness = s.overall_completeness_score;

  // Driver coverage (0–100, 30% weight)
  const familiesCovered = new Set(dr.drivers.map((d) => d.family)).size;
  const maxFamilies = 13; // total possible families
  const coverage = Math.min(100, Math.round((familiesCovered / Math.min(maxFamilies, 8)) * 100));

  // Stability (0–100, 30% weight) — penalize for critical warnings
  const criticalCount = warnings.filter((w) => w.severity === "critical").length;
  const warningCount = warnings.filter((w) => w.severity === "warning").length;
  const stability = Math.max(0, 100 - criticalCount * 30 - warningCount * 10);

  return Math.round(completeness * 0.40 + coverage * 0.30 + stability * 0.30);
}
