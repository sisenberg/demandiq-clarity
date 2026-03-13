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
  const isOverridden = input.selectedFloor != null || input.selectedLikely != null || input.selectedStretch != null;
  const corridorFloor = isOverridden ? input.selectedFloor : input.rangeFloor;
  const corridorLikely = isOverridden ? input.selectedLikely : input.rangeLikely;
  const corridorStretch = isOverridden ? input.selectedStretch : input.rangeStretch;

  // Derive authority zones from corridor
  const openingAnchor = corridorStretch;
  const openingCeiling = corridorStretch != null && corridorLikely != null
    ? corridorStretch + (corridorStretch - corridorLikely) * 0.25
    : corridorStretch;
  const targetFloor = corridorFloor;
  const targetValue = corridorLikely;
  const walkAwayFloor = corridorFloor != null ? corridorFloor * 0.85 : null;

  // Escalation threshold: 120% of stretch or policy limits
  const escalationAmount = corridorStretch != null
    ? Math.min(corridorStretch * 1.2, claimProfile.policy_limits ?? Infinity)
    : claimProfile.policy_limits;
  const escalationRequired = escalationAmount != null && corridorStretch != null && escalationAmount > corridorStretch;

  // Documentation gaps from completeness warnings
  const docGaps: EvalHandoffGap[] = snapshot.completeness_warnings
    .filter(w => w.status === "missing" || w.status === "partial")
    .map(w => ({
      field: w.field,
      label: w.label,
      severity: w.status === "missing" ? "critical" as const : "moderate" as const,
      impact_on_valuation: w.status === "missing"
        ? `Missing ${w.label} may reduce corridor defensibility`
        : `Partial ${w.label} may limit valuation precision`,
    }));

  // Unresolved issues from upstream concerns
  const unresolvedIssues: EvalHandoffIssue[] = snapshot.upstream_concerns
    .filter(c => c.severity !== "info")
    .map(c => ({
      category: (c.category === "causation" || c.category === "credibility" ? c.category : c.category === "gap" || c.category === "documentation" ? "documentation" : c.category === "compliance" ? "liability" : "other") as EvalHandoffIssue["category"],
      description: c.description,
      severity: c.severity === "critical" ? "critical" as const : "warning" as const,
      recommendation: c.severity === "critical"
        ? "Address before finalizing negotiation position"
        : "Consider during negotiation strategy",
    }));

  // Add unresolved liability facts
  const unsupportedLiability = snapshot.liability_facts.filter(f => !f.supports_liability && f.confidence != null && f.confidence < 0.5);
  unsupportedLiability.forEach(f => {
    unresolvedIssues.push({
      category: "liability",
      description: f.fact_text,
      severity: "warning",
      recommendation: "Liability fact has low confidence — may be challenged in negotiation",
    });
  });

  const totalBilledSpecials = snapshot.medical_billing.reduce((s, b) => s + b.billed_amount, 0);

  const handoff: EvalNegotiationHandoff = {
    adjusted_corridor: {
      floor: corridorFloor,
      likely: corridorLikely,
      stretch: corridorStretch,
      is_overridden: isOverridden,
    },
    confidence_level: confidenceLevel,
    confidence_score: input.confidence,
    recommended_opening_zone: {
      anchor: openingAnchor,
      ceiling: openingCeiling,
      rationale: openingAnchor != null
        ? `Opening at stretch value (${formatDollars(openingAnchor)}) with ceiling buffer of 25% above midpoint delta`
        : "Insufficient corridor data to derive opening zone",
    },
    target_settlement_zone: {
      floor: targetFloor,
      target: targetValue,
      rationale: targetValue != null
        ? `Target at likely value (${formatDollars(targetValue)}) with floor at corridor minimum`
        : "Insufficient corridor data to derive target zone",
    },
    walk_away_floor: walkAwayFloor,
    escalation_threshold: {
      amount: escalationAmount ?? null,
      rationale: escalationRequired
        ? `Offers above ${formatDollars(escalationAmount!)} (120% of stretch) should trigger supervisor review`
        : "No escalation threshold applicable",
      review_required: escalationRequired,
    },
    key_strengths: topDrivers.map(toHandoffPoint),
    key_weaknesses: topSuppressors.map(toHandoffPoint),
    key_uncertainties: topUncertainty.map(toHandoffPoint),
    documentation_gaps: docGaps,
    unresolved_issues: unresolvedIssues,
    total_reviewed_specials: totalReviewedSpecials(snapshot),
    total_billed_specials: totalBilledSpecials,
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
    // Valuation outputs (v1.1)
    valuation_outputs: {
      fact_based_value_range: { low: corridor.range_floor ?? 0, mid: corridor.range_likely ?? 0, high: corridor.range_stretch ?? 0 },
      expected_resolution_range: { low: corridor.range_floor ?? 0, mid: corridor.range_likely ?? 0, high: corridor.range_stretch ?? 0 },
    },
    // Deprecated top-level aliases preserved for backward compatibility
    fact_based_value_range: { low: corridor.range_floor ?? 0, mid: corridor.range_likely ?? 0, high: corridor.range_stretch ?? 0 },
    expected_resolution_range: { low: corridor.range_floor ?? 0, mid: corridor.range_likely ?? 0, high: corridor.range_stretch ?? 0 },
    representation_context: {
      representation_status_current: 'unknown',
      representation_status_at_evaluation: 'unknown',
      representation_transition_flag: false,
      attorney_retained_during_claim_flag: false,
      attorney_retained_after_initial_offer_flag: false,
      representation_history_count: 0,
      attorney_retention_risk: 0,
      current_attorney_name: null,
      current_firm_name: null,
    },
    representation_notes: {
      value_rule_applied: 'Representation status did not directly reduce fact-based case value.',
      fact_value_independence_statement: 'Fact-based value is determined exclusively by claim facts. Representation status has no effect.',
      resolution_context_explanation: 'Representation context was not available at evaluation time.',
      negotiation_context_summary: null,
      compliance_notes: ['Representation status treated as negotiation-context variable only.'],
    },
    representation_scenarios: {
      direct_resolution_range_unrepresented: null,
      likely_range_if_counsel_retained: null,
      early_resolution_opportunity_range: null,
      current_represented_posture_range: null,
    },
    scenario_outputs: null,
    confidence_and_uncertainty: {
      confidence_score: input.confidence,
      confidence_level: confidenceLevel,
      uncertainty_drivers: topUncertainty.map(u => u.label),
      documentation_quality_impact: docScore < 60 ? `Documentation score (${docScore}%) may widen corridor uncertainty` : null,
      data_completeness_score: docScore,
    },
    handoff_notes: {
      evaluation_summary: `Evaluation produced a ${confidenceLevel}-confidence corridor from ${formatDollars(corridorFloor ?? 0)} to ${formatDollars(corridorStretch ?? 0)}.`,
      negotiation_considerations: [
        ...(postMeritAdj.length > 0 ? [`${postMeritAdj.length} post-merit adjustment(s) applied.`] : []),
        ...(docGaps.length > 0 ? [`${docGaps.length} documentation gap(s) may affect defensibility.`] : []),
      ],
      representation_posture_note: null,
      constraint_notes: claimProfile.policy_limits != null && corridorStretch != null && corridorStretch > claimProfile.policy_limits
        ? [`Policy limits ($${claimProfile.policy_limits.toLocaleString()}) constrain the corridor stretch.`]
        : [],
    },
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

function formatDollars(val: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}
