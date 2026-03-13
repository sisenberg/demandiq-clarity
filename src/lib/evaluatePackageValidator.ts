/**
 * EvaluateIQ — EvaluatePackage v1 Validator
 *
 * Validates the structural integrity and publication readiness
 * of an EvaluatePackage v1 before downstream consumption.
 *
 * Handles:
 *  - Required field presence
 *  - Publication state transition validation
 *  - Corridor sanity checks
 *  - Handoff object completeness
 *  - Serialization for registry publication
 */

import type {
  EvaluatePackageV1,
  EvaluatePackagePublicationState,
  EVALUATE_PACKAGE_CONTRACT_VERSION,
} from "@/types/evaluate-package-v1";
import { VALID_PUBLICATION_TRANSITIONS } from "@/types/evaluate-package-v1";

// ─── Validation Result ──────────────────────────────────

export interface PackagePublicationValidation {
  valid: boolean;
  findings: PublicationFinding[];
  error_count: number;
  warning_count: number;
}

export interface PublicationFinding {
  field: string;
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
}

// ─── State Transition Validator ─────────────────────────

export function validatePublicationTransition(
  current: EvaluatePackagePublicationState,
  next: EvaluatePackagePublicationState,
): { valid: boolean; reason: string } {
  const allowed = VALID_PUBLICATION_TRANSITIONS[current];
  if (!allowed || !allowed.includes(next)) {
    return {
      valid: false,
      reason: `Cannot transition from "${current}" to "${next}". Allowed: [${(allowed || []).join(", ")}]`,
    };
  }
  return { valid: true, reason: "" };
}

// ─── Package Validator ──────────────────────────────────

export function validateEvaluatePackage(
  pkg: EvaluatePackageV1,
  expectedVersion: string = "1.0.0",
): PackagePublicationValidation {
  const findings: PublicationFinding[] = [];

  // ── Contract version ──
  if (pkg.contract_version !== expectedVersion) {
    findings.push({
      field: "contract_version",
      severity: "error",
      code: "CONTRACT_VERSION_MISMATCH",
      message: `Expected "${expectedVersion}" but got "${pkg.contract_version}".`,
    });
  }

  // ── Identity ──
  if (!pkg.case_id) findings.push({ field: "case_id", severity: "error", code: "MISSING_FIELD", message: "case_id is required." });
  if (!pkg.claim_id) findings.push({ field: "claim_id", severity: "error", code: "MISSING_FIELD", message: "claim_id is required." });
  if (!pkg.evaluation_id) findings.push({ field: "evaluation_id", severity: "error", code: "MISSING_FIELD", message: "evaluation_id is required." });
  if (!pkg.tenant_id) findings.push({ field: "tenant_id", severity: "error", code: "MISSING_FIELD", message: "tenant_id is required." });

  // ── Versioning ──
  if (pkg.package_version < 1) {
    findings.push({ field: "package_version", severity: "error", code: "INVALID_VERSION", message: "package_version must be >= 1." });
  }
  if (!pkg.scoring_logic_version) {
    findings.push({ field: "scoring_logic_version", severity: "warning", code: "MISSING_FIELD", message: "scoring_logic_version should be set." });
  }

  // ── Claim profile ──
  if (!pkg.claim_profile.claimant_name) {
    findings.push({ field: "claim_profile.claimant_name", severity: "error", code: "MISSING_FIELD", message: "Claimant name is required." });
  }
  if (!pkg.claim_profile.date_of_loss) {
    findings.push({ field: "claim_profile.date_of_loss", severity: "error", code: "MISSING_FIELD", message: "Date of loss is required." });
  }

  // ── Merits ──
  if (pkg.merits.merits_score < 0 || pkg.merits.merits_score > 100) {
    findings.push({ field: "merits.merits_score", severity: "error", code: "INVALID_RANGE", message: "Merits score must be 0–100." });
  }

  // ── Settlement corridor sanity ──
  const sc = pkg.settlement_corridor;
  if (sc.range_floor != null && sc.range_likely != null && sc.range_floor > sc.range_likely) {
    findings.push({ field: "settlement_corridor", severity: "error", code: "CORRIDOR_INVERTED", message: "Floor exceeds Likely — corridor is inverted." });
  }
  if (sc.range_likely != null && sc.range_stretch != null && sc.range_likely > sc.range_stretch) {
    findings.push({ field: "settlement_corridor", severity: "error", code: "CORRIDOR_INVERTED", message: "Likely exceeds Stretch — corridor is inverted." });
  }
  if (sc.range_floor == null && sc.range_likely == null && sc.range_stretch == null) {
    findings.push({ field: "settlement_corridor", severity: "warning", code: "EMPTY_CORRIDOR", message: "No corridor values computed. Package may not be useful downstream." });
  }

  // ── Selected range sanity ──
  if (sc.selected_floor != null && sc.selected_likely != null && sc.selected_floor > sc.selected_likely) {
    findings.push({ field: "settlement_corridor.selected", severity: "warning", code: "SELECTED_INVERTED", message: "Selected floor exceeds selected likely." });
  }

  // ── Documentation sufficiency ──
  if (pkg.documentation_sufficiency.score < 0 || pkg.documentation_sufficiency.score > 100) {
    findings.push({ field: "documentation_sufficiency.score", severity: "error", code: "INVALID_RANGE", message: "Documentation sufficiency score must be 0–100." });
  }

  // ── Factors ──
  if (pkg.factor_summaries.length === 0) {
    findings.push({ field: "factor_summaries", severity: "warning", code: "NO_FACTORS", message: "No factor summaries. Downstream modules may lack context." });
  }

  // ── Handoff ──
  const hf = pkg.negotiation_handoff;
  if (hf.key_strengths.length === 0 && hf.key_weaknesses.length === 0) {
    findings.push({ field: "negotiation_handoff", severity: "warning", code: "EMPTY_HANDOFF", message: "Negotiation handoff has no strengths or weaknesses." });
  }

  // ── Representation-aware valuation fields (required for publication) ──
  if (!pkg.fact_based_value_range || (pkg.fact_based_value_range.low === 0 && pkg.fact_based_value_range.mid === 0 && pkg.fact_based_value_range.high === 0 && pkg.settlement_corridor.range_likely != null)) {
    findings.push({ field: "fact_based_value_range", severity: "error", code: "MISSING_FACT_BASED_RANGE", message: "fact_based_value_range is required and must be populated." });
  }
  if (!pkg.expected_resolution_range || (pkg.expected_resolution_range.low === 0 && pkg.expected_resolution_range.mid === 0 && pkg.expected_resolution_range.high === 0 && pkg.settlement_corridor.range_likely != null)) {
    findings.push({ field: "expected_resolution_range", severity: "error", code: "MISSING_EXPECTED_RESOLUTION_RANGE", message: "expected_resolution_range is required and must be populated." });
  }
  if (!pkg.representation_context) {
    findings.push({ field: "representation_context", severity: "error", code: "MISSING_REPRESENTATION_CONTEXT", message: "representation_context is required." });
  }
  if (!pkg.representation_notes?.value_rule_applied) {
    findings.push({ field: "representation_notes.value_rule_applied", severity: "error", code: "MISSING_VALUE_RULE", message: "representation_notes.value_rule_applied is required." });
  }

  // ── Explanation ledger ──
  if (!pkg.explanation_ledger) {
    findings.push({ field: "explanation_ledger", severity: "warning", code: "NO_LEDGER", message: "Explanation ledger is null. Package will not be fully traceable." });
  }

  // ── Audit (for published state) ──
  if (pkg.evaluation_status === "published" && !pkg.audit.published_by) {
    findings.push({ field: "audit.published_by", severity: "error", code: "MISSING_PUBLISHER", message: "Published packages must have a published_by actor." });
  }

  // ── Overrides require audit ──
  if (pkg.overrides.length > 0 && !pkg.audit.overridden_by) {
    findings.push({ field: "audit.overridden_by", severity: "warning", code: "OVERRIDE_NO_ACTOR", message: "Overrides present but no overridden_by actor recorded." });
  }

  // ── Timestamp ──
  if (!pkg.generated_at) {
    findings.push({ field: "generated_at", severity: "error", code: "MISSING_TIMESTAMP", message: "generated_at timestamp is required." });
  }

  const errorCount = findings.filter(f => f.severity === "error").length;
  const warningCount = findings.filter(f => f.severity === "warning").length;

  return {
    valid: errorCount === 0,
    findings,
    error_count: errorCount,
    warning_count: warningCount,
  };
}

// ─── Serialization for Registry ─────────────────────────

/**
 * Serializes an EvaluatePackage v1 for storage in the package registry.
 * Strips transient state and ensures stable JSON output.
 */
export function serializeForRegistry(pkg: EvaluatePackageV1): Record<string, unknown> {
  return {
    contract_version: pkg.contract_version,
    case_id: pkg.case_id,
    claim_id: pkg.claim_id,
    evaluation_id: pkg.evaluation_id,
    tenant_id: pkg.tenant_id,
    package_version: pkg.package_version,
    evaluation_status: pkg.evaluation_status,
    scoring_logic_version: pkg.scoring_logic_version,
    benchmark_logic_version: pkg.benchmark_logic_version,
    engine_version: pkg.engine_version,
    source_module: pkg.source_module,
    source_package_version: pkg.source_package_version,
    snapshot_id: pkg.snapshot_id,
    valuation_run_id: pkg.valuation_run_id,
    selection_id: pkg.selection_id,
    claim_profile: pkg.claim_profile,
    merits: pkg.merits,
    settlement_corridor: pkg.settlement_corridor,
    documentation_sufficiency: pkg.documentation_sufficiency,
    factor_summaries: pkg.factor_summaries,
    top_drivers: pkg.top_drivers,
    top_suppressors: pkg.top_suppressors,
    top_uncertainty_drivers: pkg.top_uncertainty_drivers,
    benchmark_summary: pkg.benchmark_summary,
    post_merit_adjustments: pkg.post_merit_adjustments,
    driver_summaries: pkg.driver_summaries,
    explanation_ledger: pkg.explanation_ledger,
    assumptions: pkg.assumptions,
    overrides: pkg.overrides,
    total_billed: pkg.total_billed,
    total_reviewed: pkg.total_reviewed,
    completeness_score: pkg.completeness_score,
    negotiation_handoff: pkg.negotiation_handoff,
    // Representation-aware fields (v1.1)
    valuation_outputs: pkg.valuation_outputs,
    fact_based_value_range: pkg.fact_based_value_range,
    expected_resolution_range: pkg.expected_resolution_range,
    representation_context: pkg.representation_context,
    representation_notes: pkg.representation_notes,
    representation_scenarios: pkg.representation_scenarios,
    scenario_outputs: pkg.scenario_outputs,
    confidence_and_uncertainty: pkg.confidence_and_uncertainty,
    handoff_notes: pkg.handoff_notes,
    audit: pkg.audit,
    generated_at: pkg.generated_at,
    created_at: pkg.created_at,
  };
}

/**
 * Validates that a deserialized payload matches the EvaluatePackage v1 shape.
 * Returns true if the object has the minimum required structure.
 */
export function isEvaluatePackageV1Shape(obj: unknown): obj is EvaluatePackageV1 {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.contract_version === "string" &&
    typeof o.case_id === "string" &&
    typeof o.evaluation_id === "string" &&
    typeof o.package_version === "number" &&
    typeof o.evaluation_status === "string" &&
    typeof o.claim_profile === "object" &&
    typeof o.merits === "object" &&
    typeof o.settlement_corridor === "object" &&
    typeof o.negotiation_handoff === "object" &&
    typeof o.generated_at === "string" &&
    // v1.1 required fields
    typeof o.fact_based_value_range === "object" && o.fact_based_value_range !== null &&
    typeof o.expected_resolution_range === "object" && o.expected_resolution_range !== null &&
    typeof o.representation_context === "object" && o.representation_context !== null &&
    typeof o.representation_notes === "object" && o.representation_notes !== null
  );
}
