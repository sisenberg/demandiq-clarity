/**
 * Intake Validation Engine
 *
 * Validates intake data completeness before publishing to EvaluateIQ.
 * Returns blockers (must fix), warnings (publishable with logged exceptions),
 * and an overall readiness state.
 */

export type IntakeQualityState = "ready" | "warning" | "blocked";

export interface IntakeValidationFinding {
  code: string;
  severity: "blocker" | "warning";
  message: string;
  field?: string;
}

export interface IntakeValidationResult {
  state: IntakeQualityState;
  blockers: IntakeValidationFinding[];
  warnings: IntakeValidationFinding[];
  score: number; // 0–100
}

export interface IntakeValidationInput {
  hasDemand: boolean;
  claimantName: string;
  representedStatus: string;
  demandAmount: number | null;
  demandAmountConfirmedMissing?: boolean;
  demandDeadline: string | null;
  specialsCount: number;
  specialsExplicitlyNone?: boolean;
  treatmentCount: number;
  hasMedicalClaims: boolean;
  providerCount: number;
  injuryCount: number;
  duplicateBillCount: number;
  lowOcrConfidenceCount: number;
  treatmentChronologyComplete: boolean;
  conflictingValueCount: number;
}

export function validateIntakeForPublish(input: IntakeValidationInput): IntakeValidationResult {
  const blockers: IntakeValidationFinding[] = [];
  const warnings: IntakeValidationFinding[] = [];

  // ─── Blockers ────────────────────────────────────────

  if (!input.hasDemand) {
    blockers.push({
      code: "NO_ACTIVE_DEMAND",
      severity: "blocker",
      message: "No active demand record exists. An active demand is required before publishing.",
      field: "demand",
    });
  }

  if (!input.claimantName || input.claimantName.trim() === "") {
    blockers.push({
      code: "NO_CLAIMANT",
      severity: "blocker",
      message: "Claimant has not been identified. A claimant name is required.",
      field: "claimant_name",
    });
  }

  if (!input.representedStatus || input.representedStatus.trim() === "") {
    blockers.push({
      code: "NO_REPRESENTED_STATUS",
      severity: "blocker",
      message: "Represented status has not been determined.",
      field: "represented_status",
    });
  }

  if (input.demandAmount == null && !input.demandAmountConfirmedMissing) {
    blockers.push({
      code: "NO_DEMAND_AMOUNT",
      severity: "blocker",
      message: "Demand amount has not been extracted or confirmed missing.",
      field: "demand_amount",
    });
  }

  if (input.specialsCount === 0 && !input.specialsExplicitlyNone) {
    blockers.push({
      code: "NO_SPECIALS",
      severity: "blocker",
      message: "No medical specials present. Mark as none if no specials exist.",
      field: "specials",
    });
  }

  if (input.hasMedicalClaims && input.treatmentCount === 0) {
    blockers.push({
      code: "NO_TREATMENT_SOURCE",
      severity: "blocker",
      message: "Medical claims are alleged but no treatment source has been extracted.",
      field: "treatments",
    });
  }

  // ─── Warnings (exception flags) ─────────────────────

  if (input.lowOcrConfidenceCount > 0) {
    warnings.push({
      code: "LOW_OCR_CONFIDENCE",
      severity: "warning",
      message: `${input.lowOcrConfidenceCount} extraction(s) have low OCR confidence and may contain errors.`,
      field: "ocr_confidence",
    });
  }

  if (input.duplicateBillCount > 0) {
    warnings.push({
      code: "DUPLICATE_BILLS",
      severity: "warning",
      message: `${input.duplicateBillCount} suspected duplicate bill(s) detected.`,
      field: "duplicates",
    });
  }

  if (input.hasDemand && !input.demandDeadline) {
    warnings.push({
      code: "MISSING_DEADLINE",
      severity: "warning",
      message: "Demand deadline has not been captured.",
      field: "demand_deadline",
    });
  }

  if (input.providerCount === 0 && input.treatmentCount > 0) {
    warnings.push({
      code: "MISSING_PROVIDERS",
      severity: "warning",
      message: "Treatment events exist but no providers have been identified.",
      field: "providers",
    });
  }

  if (!input.treatmentChronologyComplete && input.treatmentCount > 0) {
    warnings.push({
      code: "INCOMPLETE_CHRONOLOGY",
      severity: "warning",
      message: "Treatment chronology appears incomplete — gaps or missing dates detected.",
      field: "chronology",
    });
  }

  if (input.conflictingValueCount > 0) {
    warnings.push({
      code: "CONFLICTING_VALUES",
      severity: "warning",
      message: `${input.conflictingValueCount} conflicting value(s) detected across documents.`,
      field: "conflicts",
    });
  }

  // ─── Score ──────────────────────────────────────────

  let score = 100;
  score -= blockers.length * 15;
  score -= warnings.length * 5;
  score = Math.max(0, Math.min(100, score));

  const state: IntakeQualityState =
    blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready";

  return { state, blockers, warnings, score };
}
