/**
 * EvaluateIQ — EvaluatePackage v1 Assembly
 *
 * Assembles a full EvaluatePackageV1 from evaluation state.
 * Used by the completion hook and package publication flow.
 */

import type { EvaluatePackageV1, EvalClaimProfile, EvalMeritsAssessment, EvalSettlementCorridor, EvalDocumentationSufficiency, EvalFactorSummary, EvalBenchmarkSummary, EvalNegotiationHandoff, EvalHandoffPoint, EvalHandoffGap, EvalHandoffIssue, EvalAdoptedAssumption, EvalOverrideRecord, EvalPostMeritAdjustment, EvalConfidenceLevel } from "@/types/evaluate-package-v1";
import { EVALUATE_PACKAGE_CONTRACT_VERSION } from "@/types/evaluate-package-v1";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import type { ExplanationLedger, LedgerEntry } from "@/types/explanation-ledger";

// ─── Assembly Input ─────────────────────────────────────

export interface PackageAssemblyInput {
  evaluationId: string;
  caseId: string;
  claimId: string;
  tenantId: string;
  snapshot: EvaluateIntakeSnapshot;
  sourceModule: "demandiq" | "revieweriq";
  sourceVersion: number;
  snapshotId: string | null;
  valuationRunId: string | null;
  selectionId: string | null;
  explanationLedger: ExplanationLedger | null;
  /** Engine-computed range */
  rangeFloor: number | null;
  rangeLikely: number | null;
  rangeStretch: number | null;
  confidence: number | null;
  /** Human-selected range */
  selectedFloor: number | null;
  selectedLikely: number | null;
  selectedStretch: number | null;
  authorityRecommendation: number | null;
  rationaleNotes: string;
  /** Version metadata */
  packageVersion: number;
  engineVersion: string;
  scoringLogicVersion: string;
  benchmarkLogicVersion: string;
  /** User context */
  userId: string;
}

// ─── Assembler ──────────────────────────────────────────

export function assembleEvaluatePackageV1(input: PackageAssemblyInput): EvaluatePackageV1 {
  const { snapshot, explanationLedger } = input;
  const now = new Date().toISOString();

  // ── Claim profile ──
  const claimProfile: EvalClaimProfile = {
    claimant_name: snapshot.claimant.claimant_name.value ?? "",
    claimant_dob: snapshot.claimant.date_of_birth.value ?? null,
    date_of_loss: snapshot.accident.date_of_loss.value ?? "",
    mechanism_of_loss: snapshot.accident.mechanism_of_loss.value ?? "",
    jurisdiction_state: snapshot.venue_jurisdiction.jurisdiction_state.value ?? "",
    venue_county: snapshot.venue_jurisdiction.venue_county.value ?? null,
    policy_type: snapshot.policy_coverage[0]?.policy_type ?? "BI",
    policy_limits: snapshot.policy_coverage[0]?.coverage_limit ?? null,
    comparative_negligence_pct: snapshot.comparative_negligence.claimant_negligence_percentage.value ?? null,
    injury_count: snapshot.injuries.length,
    provider_count: snapshot.providers.length,
    treatment_duration_days: computeTreatmentDuration(snapshot),
  };

  // ── Factor summaries from ledger ──
  const factorSummaries = buildFactorSummaries(explanationLedger);
  const topDrivers = factorSummaries.filter(f => f.direction === "expander").slice(0, 5);
  const topSuppressors = factorSummaries.filter(f => f.direction === "reducer").slice(0, 5);
  const topUncertainty = factorSummaries.filter(f => f.direction === "neutral").slice(0, 5);

  // ── Driver summaries (legacy) ──
  const driverSummaries = (explanationLedger?.entries ?? [])
    .filter(e => (e.magnitude.value ?? 0) >= 0.3 || e.direction !== "neutral")
    .map(e => ({
      key: e.driver_key ?? e.entry_key,
      label: e.title,
      impact: e.direction === "increase" ? "expander" as const
        : e.direction === "decrease" ? "reducer" as const
        : "neutral" as const,
      description: e.narrative,
    }));

  // ── Merits ──
  const meritsScore = computeMeritsScore(snapshot, explanationLedger);
  const merits: EvalMeritsAssessment = {
    merits_score: meritsScore,
    merits_label: meritsScore >= 80 ? "strong" : meritsScore >= 65 ? "above_average" : meritsScore >= 50 ? "average" : meritsScore >= 35 ? "below_average" : "weak",
    corridor_floor: input.rangeFloor,
    corridor_likely: input.rangeLikely,
    corridor_stretch: input.rangeStretch,
    contributing_factors: topDrivers.map(d => d.label),
  };

  // ── Settlement corridor ──
  const confidenceLevel = (input.confidence ?? 0) >= 75 ? "high" as const
    : (input.confidence ?? 0) >= 50 ? "moderate" as const
    : (input.confidence ?? 0) >= 25 ? "low" as const
    : "insufficient" as const;

  const corridor: EvalSettlementCorridor = {
    range_floor: input.rangeFloor,
    range_likely: input.rangeLikely,
    range_stretch: input.rangeStretch,
    confidence: input.confidence,
    confidence_level: confidenceLevel,
    selected_floor: input.selectedFloor,
    selected_likely: input.selectedLikely,
    selected_stretch: input.selectedStretch,
    authority_recommendation: input.authorityRecommendation,
    rationale_notes: input.rationaleNotes,
  };

  // ── Documentation sufficiency ──
  const docScore = snapshot.overall_completeness_score ?? 0;
  const docSufficiency: EvalDocumentationSufficiency = {
    score: docScore,
    label: docScore >= 80 ? "sufficient" : docScore >= 60 ? "adequate" : docScore >= 40 ? "limited" : "insufficient",
    findings: snapshot.completeness_warnings.map(w => w.message),
    incomplete_fields: snapshot.completeness_warnings.filter(w => w.status === "missing").map(w => w.field),
  };

  // ── Benchmark summary (placeholder until calibration engine is wired) ──
  const benchmarkSummary: EvalBenchmarkSummary = {
    comparable_claim_count: 0,
    comparable_median: null,
    comparable_p25: null,
    comparable_p75: null,
    matching_criteria: [],
    match_quality: "no_match",
    calibration_config_version: null,
  };

  // ── Post-merit adjustments ──
  const postMeritAdj: EvalPostMeritAdjustment[] = [];
  if (claimProfile.comparative_negligence_pct != null && claimProfile.comparative_negligence_pct > 0) {
    postMeritAdj.push({
      adjustment_key: "comparative_negligence",
      label: "Comparative Negligence Reduction",
      direction: "decrease",
      impact_value: claimProfile.comparative_negligence_pct,
      impact_unit: "percentage",
      reason: `${claimProfile.comparative_negligence_pct}% comparative negligence applied.`,
    });
  }
  if (claimProfile.policy_limits != null && input.rangeLikely != null && input.rangeLikely > claimProfile.policy_limits) {
    postMeritAdj.push({
      adjustment_key: "policy_limits_cap",
      label: "Policy Limits Constraint",
      direction: "constraint",
      impact_value: claimProfile.policy_limits,
      impact_unit: "dollars",
      reason: `Range capped by policy limits of $${claimProfile.policy_limits.toLocaleString()}.`,
    });
  }

  // ── Handoff ──
  const handoff: EvalNegotiationHandoff = {
    recommended_opening_anchor: input.rangeStretch,
    suggested_target: input.selectedLikely ?? input.rangeLikely,
    walk_away_floor: input.selectedFloor ?? input.rangeFloor,
    key_strengths: topDrivers.map(toHandoffPoint),
    key_weaknesses: topSuppressors.map(toHandoffPoint),
    key_uncertainties: topUncertainty.map(toHandoffPoint),
    total_reviewed_specials: totalReviewedSpecials(snapshot),
    policy_limits: claimProfile.policy_limits,
  };

  // ── Total specials ──
  const totalBilled = snapshot.medical_billing.reduce((s, b) => s + b.billed_amount, 0);
  const totalReviewed = snapshot.medical_billing.reduce((s, b) => s + (b.reviewer_recommended_amount ?? b.billed_amount), 0);

  return {
    contract_version: EVALUATE_PACKAGE_CONTRACT_VERSION,
    case_id: input.caseId,
    claim_id: input.claimId,
    evaluation_id: input.evaluationId,
    tenant_id: input.tenantId,
    package_version: input.packageVersion,
    evaluation_status: "draft",
    scoring_logic_version: input.scoringLogicVersion,
    benchmark_logic_version: input.benchmarkLogicVersion,
    engine_version: input.engineVersion,
    source_module: input.sourceModule,
    source_package_version: input.sourceVersion,
    snapshot_id: input.snapshotId,
    valuation_run_id: input.valuationRunId,
    selection_id: input.selectionId,
    claim_profile: claimProfile,
    merits,
    settlement_corridor: corridor,
    documentation_sufficiency: docSufficiency,
    factor_summaries: factorSummaries,
    top_drivers: topDrivers,
    top_suppressors: topSuppressors,
    top_uncertainty_drivers: topUncertainty,
    benchmark_summary: benchmarkSummary,
    post_merit_adjustments: postMeritAdj,
    driver_summaries: driverSummaries,
    explanation_ledger: explanationLedger,
    assumptions: [],
    overrides: [],
    total_billed: totalBilled,
    total_reviewed: totalReviewed,
    completeness_score: docScore,
    negotiation_handoff: handoff,
    audit: {
      accepted_by: null,
      accepted_at: null,
      overridden_by: null,
      overridden_at: null,
      published_by: null,
      published_at: null,
      override_reason: null,
    },
    generated_at: now,
    created_at: now,
  };
}

// ─── Helpers ────────────────────────────────────────────

function computeTreatmentDuration(snapshot: EvaluateIntakeSnapshot): number | null {
  const dates = snapshot.treatment_timeline
    .map(t => t.treatment_date)
    .filter((d): d is string => d != null)
    .map(d => new Date(d).getTime())
    .filter(t => !isNaN(t));
  if (dates.length < 2) return null;
  const min = Math.min(...dates);
  const max = Math.max(...dates);
  return Math.round((max - min) / (1000 * 60 * 60 * 24));
}

function buildFactorSummaries(ledger: ExplanationLedger | null): EvalFactorSummary[] {
  if (!ledger) return [];
  return ledger.entries
    .filter(e => e.direction !== "neutral" || (e.magnitude.value ?? 0) > 0)
    .map(entryToFactor)
    .sort((a, b) => b.score - a.score);
}

function entryToFactor(entry: LedgerEntry): EvalFactorSummary {
  const categoryToFamily: Record<string, string> = {
    economic_base: "treatment_intensity",
    severity_multiplier: "injury_severity",
    clinical_adjustment: "surgery",
    liability: "liability",
    comparative_fault: "liability",
    treatment_reliability: "credibility",
    policy_constraint: "policy_limits",
    venue: "venue",
    credibility: "credibility",
    prior_conditions: "pre_existing",
    wage_loss: "wage_loss",
    future_medical: "future_treatment",
    human_assumption: "other",
  };

  return {
    factor_key: entry.driver_key ?? entry.entry_key,
    label: entry.title,
    family: (categoryToFamily[entry.category] ?? "other") as EvalFactorSummary["family"],
    direction: entry.direction === "increase" ? "expander" : entry.direction === "decrease" ? "reducer" : "neutral",
    score: Math.abs(entry.magnitude.value ?? 0) * 100,
    impact_description: entry.magnitude.display,
    narrative: entry.narrative,
    evidence_ref_ids: entry.evidence_ref_ids,
  };
}

function toHandoffPoint(factor: EvalFactorSummary): EvalHandoffPoint {
  return {
    label: factor.label,
    description: factor.narrative,
    impact: factor.score >= 70 ? "high" : factor.score >= 40 ? "medium" : "low",
    evidence_ref_ids: factor.evidence_ref_ids,
  };
}

function totalReviewedSpecials(snapshot: EvaluateIntakeSnapshot): number {
  return snapshot.medical_billing.reduce((s, b) => s + (b.reviewer_recommended_amount ?? b.billed_amount), 0);
}

function computeMeritsScore(snapshot: EvaluateIntakeSnapshot, ledger: ExplanationLedger | null): number {
  let score = 50; // base

  // Boost for objective findings
  if (snapshot.clinical_flags.has_surgery) score += 10;
  if (snapshot.clinical_flags.has_permanency_indicators) score += 10;
  if (snapshot.clinical_flags.has_advanced_imaging) score += 5;
  if (snapshot.clinical_flags.has_impairment_rating) score += 5;

  // Adjust for completeness
  score += ((snapshot.overall_completeness_score ?? 50) - 50) * 0.2;

  // Adjust for injury count
  if (snapshot.injuries.length >= 3) score += 5;
  if (snapshot.injuries.length >= 5) score += 5;

  // Ledger-based adjustments
  if (ledger) {
    const expanderCount = ledger.summary.increase_count;
    const reducerCount = ledger.summary.decrease_count;
    score += (expanderCount - reducerCount) * 2;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}
