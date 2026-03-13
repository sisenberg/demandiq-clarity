/**
 * EvaluateIQ — ReviewPackage v1 Validator
 *
 * Validates the structural integrity and completeness of a ReviewPackage v1
 * before EvaluateIQ ingestion. Reports missing-but-required fields, contract
 * drift warnings, and readiness state.
 */

import type {
  ReviewPackageV1,
  REVIEW_PACKAGE_CONTRACT_VERSION,
} from "@/types/review-package-v1";

// ─── Validation Result ──────────────────────────────────

export type PackageReadinessState =
  | "evaluation_ready"    // all required fields present, high confidence
  | "provisional"         // usable but with warnings/gaps
  | "not_ready"           // missing critical fields
  | "contract_mismatch";  // schema drift detected

export interface ValidationFinding {
  field: string;
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
}

export interface PackageValidationResult {
  readiness: PackageReadinessState;
  findings: ValidationFinding[];
  completeness_score: number; // 0–100
  /** Summary counts */
  error_count: number;
  warning_count: number;
  info_count: number;
  /** Unresolved issues from ReviewerIQ */
  unresolved_issue_count: number;
  /** Whether this package can be used for provisional evaluation */
  allows_provisional: boolean;
}

// ─── Required Fields ────────────────────────────────────

interface FieldCheck {
  field: string;
  label: string;
  required: boolean;
  weight: number;
  check: (pkg: ReviewPackageV1) => boolean;
}

const FIELD_CHECKS: FieldCheck[] = [
  // Metadata
  { field: "metadata.case_id", label: "Case ID", required: true, weight: 10, check: (p) => !!p.metadata.case_id },
  { field: "metadata.claim_id", label: "Claim ID", required: true, weight: 5, check: (p) => !!p.metadata.claim_id },
  { field: "metadata.contract_version", label: "Contract Version", required: true, weight: 10, check: (p) => !!p.metadata.contract_version },
  { field: "metadata.published_at", label: "Publication Timestamp", required: true, weight: 5, check: (p) => !!p.metadata.published_at },
  { field: "metadata.package_version", label: "Package Version", required: true, weight: 5, check: (p) => p.metadata.package_version >= 1 },

  // Evaluation context
  { field: "evaluation_context.jurisdiction_state", label: "Jurisdiction", required: true, weight: 8, check: (p) => !!p.evaluation_context.jurisdiction_state },
  { field: "evaluation_context.date_of_loss", label: "Date of Loss", required: true, weight: 10, check: (p) => !!p.evaluation_context.date_of_loss },
  { field: "evaluation_context.claimant_name", label: "Claimant Name", required: true, weight: 8, check: (p) => !!p.evaluation_context.claimant_name },
  { field: "evaluation_context.mechanism_of_loss", label: "Mechanism of Loss", required: false, weight: 4, check: (p) => !!p.evaluation_context.mechanism_of_loss },
  { field: "evaluation_context.policy_limits", label: "Policy Limits", required: false, weight: 5, check: (p) => p.evaluation_context.policy_limits != null },

  // Injuries
  { field: "accepted_injuries", label: "Accepted Injuries", required: true, weight: 10, check: (p) => p.accepted_injuries.length > 0 },

  // Treatments
  { field: "accepted_treatments", label: "Accepted Treatments", required: true, weight: 10, check: (p) => p.accepted_treatments.length > 0 },

  // Providers
  { field: "providers", label: "Providers", required: true, weight: 5, check: (p) => p.providers.length > 0 },

  // Financials
  { field: "reviewed_specials.total_billed", label: "Total Billed", required: true, weight: 8, check: (p) => p.reviewed_specials.total_billed > 0 },
  { field: "reviewed_specials.total_reviewed", label: "Total Reviewed", required: true, weight: 8, check: (p) => p.reviewed_specials.total_reviewed > 0 },

  // Clinical summaries
  { field: "diagnosis_summaries", label: "Diagnosis Summaries", required: false, weight: 4, check: (p) => p.diagnosis_summaries.length > 0 },
  { field: "procedure_summaries", label: "Procedure Summaries", required: false, weight: 3, check: (p) => p.procedure_summaries.length > 0 },
  { field: "objective_findings", label: "Objective Findings", required: false, weight: 4, check: (p) => p.objective_findings.has_objective_findings || p.objective_findings.summary.length > 0 },
  { field: "imaging_summary", label: "Imaging Summary", required: false, weight: 3, check: (p) => p.imaging_summary.imaging_types.length > 0 || !p.imaging_summary.has_imaging },

  // Reasonableness
  { field: "reasonableness_findings", label: "Reasonableness Findings", required: true, weight: 8, check: (p) => p.reasonableness_findings.total_treatments_reviewed > 0 },

  // Visit chronology
  { field: "visit_chronology", label: "Visit Chronology", required: false, weight: 4, check: (p) => p.visit_chronology.length > 0 },

  // Evidence
  { field: "evidence_citations", label: "Evidence Citations", required: false, weight: 5, check: (p) => p.evidence_citations.length > 0 },
];

// ─── Validator ──────────────────────────────────────────

export function validateReviewPackage(
  pkg: ReviewPackageV1,
  expectedContractVersion: string = "1.0.0"
): PackageValidationResult {
  const findings: ValidationFinding[] = [];

  // ── Contract version check ──
  if (pkg.metadata.contract_version !== expectedContractVersion) {
    findings.push({
      field: "metadata.contract_version",
      severity: "error",
      code: "CONTRACT_VERSION_MISMATCH",
      message: `Expected contract version "${expectedContractVersion}" but received "${pkg.metadata.contract_version}". Schema drift may cause data loss.`,
    });
  }

  // ── Field checks ──
  let totalWeight = 0;
  let earnedWeight = 0;

  for (const check of FIELD_CHECKS) {
    totalWeight += check.weight;
    const passed = check.check(pkg);

    if (passed) {
      earnedWeight += check.weight;
    } else {
      findings.push({
        field: check.field,
        severity: check.required ? "error" : "warning",
        code: check.required ? "REQUIRED_FIELD_MISSING" : "OPTIONAL_FIELD_MISSING",
        message: `${check.label} is ${check.required ? "required" : "recommended"} for accurate valuation but is missing or empty.`,
      });
    }
  }

  // ── Disputed injuries check ──
  if (pkg.disputed_injuries.length > 0) {
    findings.push({
      field: "disputed_injuries",
      severity: "warning",
      code: "DISPUTED_INJURIES_PRESENT",
      message: `${pkg.disputed_injuries.length} disputed injury/injuries. These will be excluded from primary valuation but noted as uncertainty factors.`,
    });
  }

  // ── Unresolved issues check ──
  const unresolvedCount = pkg.unresolved_issues.length;
  if (unresolvedCount > 0) {
    const criticalCount = pkg.unresolved_issues.filter(i => i.severity === "critical" || i.severity === "high").length;
    findings.push({
      field: "unresolved_issues",
      severity: criticalCount > 0 ? "warning" : "info",
      code: "UNRESOLVED_ISSUES",
      message: `${unresolvedCount} unresolved medical issue(s) from ReviewerIQ (${criticalCount} critical/high). These may affect valuation confidence.`,
    });
  }

  // ── Treatment gaps ──
  const criticalGaps = pkg.treatment_gaps.filter(g => g.severity === "critical" && !g.is_explained);
  if (criticalGaps.length > 0) {
    findings.push({
      field: "treatment_gaps",
      severity: "warning",
      code: "UNEXPLAINED_TREATMENT_GAPS",
      message: `${criticalGaps.length} unexplained critical treatment gap(s). These may suppress the valuation range.`,
    });
  }

  // ── Reasonableness concerns ──
  const rf = pkg.reasonableness_findings;
  if (rf.overall_assessment === "unreasonable" || rf.overall_assessment === "questionable") {
    findings.push({
      field: "reasonableness_findings.overall_assessment",
      severity: "warning",
      code: "REASONABLENESS_CONCERN",
      message: `Overall treatment reasonableness assessed as "${rf.overall_assessment}". This will significantly impact valuation.`,
    });
  }

  // ── Reviewer confirmation coverage ──
  const unreviewedTx = pkg.accepted_treatments.filter(t => t.confirmation.state === "unreviewed");
  if (unreviewedTx.length > 0) {
    findings.push({
      field: "accepted_treatments.confirmation",
      severity: "info",
      code: "UNREVIEWED_TREATMENTS",
      message: `${unreviewedTx.length} accepted treatment(s) have not been individually reviewed. AI-suggested dispositions are in effect.`,
    });
  }

  // ── Compute readiness ──
  const errorCount = findings.filter(f => f.severity === "error").length;
  const warningCount = findings.filter(f => f.severity === "warning").length;
  const infoCount = findings.filter(f => f.severity === "info").length;
  const completenessScore = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

  const hasContractMismatch = findings.some(f => f.code === "CONTRACT_VERSION_MISMATCH");

  let readiness: PackageReadinessState;
  if (hasContractMismatch) {
    readiness = "contract_mismatch";
  } else if (errorCount > 0) {
    readiness = "not_ready";
  } else if (warningCount > 0 || completenessScore < 80) {
    readiness = "provisional";
  } else {
    readiness = "evaluation_ready";
  }

  return {
    readiness,
    findings,
    completeness_score: completenessScore,
    error_count: errorCount,
    warning_count: warningCount,
    info_count: infoCount,
    unresolved_issue_count: unresolvedCount,
    allows_provisional: readiness !== "contract_mismatch" && errorCount <= 2,
  };
}
