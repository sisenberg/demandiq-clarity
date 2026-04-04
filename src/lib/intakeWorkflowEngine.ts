/**
 * Case Intake Workflow Status Engine
 *
 * Computes a single intake workflow state from pipeline step completion data.
 * Supports the 10-step pipeline and 6 user-facing states.
 */

// ─── Pipeline Steps ─────────────────────────────────────

export type IntakePipelineStep =
  | "upload"
  | "ocr"
  | "classification"
  | "demand_extraction"
  | "specials_extraction"
  | "treatment_extraction"
  | "injury_extraction"
  | "validation"
  | "human_review"
  | "publish";

export interface PipelineStepStatus {
  step: IntakePipelineStep;
  label: string;
  status: "complete" | "in_progress" | "pending" | "blocked" | "skipped";
  detail?: string;
}

// ─── Workflow States ────────────────────────────────────

export type CaseIntakeState =
  | "no_demand_found"
  | "demand_extracted"
  | "medical_extraction_in_progress"
  | "review_needed"
  | "ready_for_evaluateiq"
  | "published_to_evaluateiq";

export const INTAKE_STATE_LABEL: Record<CaseIntakeState, string> = {
  no_demand_found: "No Demand Found",
  demand_extracted: "Demand Extracted",
  medical_extraction_in_progress: "Medical Extraction In Progress",
  review_needed: "Review Needed",
  ready_for_evaluateiq: "Ready for EvaluateIQ",
  published_to_evaluateiq: "Published to EvaluateIQ",
};

export const INTAKE_STATE_CONFIG: Record<CaseIntakeState, {
  color: string;
  bg: string;
  border: string;
  ordinal: number;
}> = {
  no_demand_found:               { color: "text-muted-foreground", bg: "bg-accent", border: "border-border", ordinal: 0 },
  demand_extracted:              { color: "text-[hsl(var(--status-processing))]", bg: "bg-[hsl(var(--status-processing))]/10", border: "border-[hsl(var(--status-processing))]/30", ordinal: 1 },
  medical_extraction_in_progress:{ color: "text-[hsl(var(--status-processing))]", bg: "bg-[hsl(var(--status-processing))]/10", border: "border-[hsl(var(--status-processing))]/30", ordinal: 2 },
  review_needed:                 { color: "text-[hsl(var(--status-attention))]", bg: "bg-[hsl(var(--status-attention))]/10", border: "border-[hsl(var(--status-attention))]/30", ordinal: 3 },
  ready_for_evaluateiq:          { color: "text-[hsl(var(--status-approved))]", bg: "bg-[hsl(var(--status-approved))]/10", border: "border-[hsl(var(--status-approved))]/30", ordinal: 4 },
  published_to_evaluateiq:       { color: "text-primary", bg: "bg-primary/10", border: "border-primary/30", ordinal: 5 },
};

// ─── Input ──────────────────────────────────────────────

export interface IntakeWorkflowInput {
  totalDocuments: number;
  ocrCompleteCount: number;
  classifiedCount: number;
  hasDemand: boolean;
  specialsCount: number;
  treatmentCount: number;
  injuryCount: number;
  hasBlockers: boolean;
  hasWarnings: boolean;
  demandVerified: boolean;
  specialsVerified: boolean;
  treatmentVerified: boolean;
  injuryVerified: boolean;
  packageStatus: string | null; // draft | ready_for_review | published_to_evaluateiq
  processingInProgress: boolean;
}

// ─── Engine ─────────────────────────────────────────────

export function computeIntakeWorkflowState(input: IntakeWorkflowInput): CaseIntakeState {
  if (input.packageStatus === "published_to_evaluateiq") return "published_to_evaluateiq";

  if (!input.hasDemand) return "no_demand_found";

  if (input.processingInProgress || input.ocrCompleteCount < input.totalDocuments) {
    return input.specialsCount > 0 || input.treatmentCount > 0 || input.injuryCount > 0
      ? "medical_extraction_in_progress"
      : "demand_extracted";
  }

  const allVerified = input.demandVerified && input.specialsVerified && input.treatmentVerified && input.injuryVerified;
  const hasExtractions = input.specialsCount > 0 || input.treatmentCount > 0 || input.injuryCount > 0;

  if (!hasExtractions) return "demand_extracted";

  if (input.hasBlockers || !allVerified || input.hasWarnings) return "review_needed";

  return "ready_for_evaluateiq";
}

export function computePipelineSteps(input: IntakeWorkflowInput): PipelineStepStatus[] {
  const s = (status: boolean, inProgress?: boolean): PipelineStepStatus["status"] =>
    status ? "complete" : inProgress ? "in_progress" : "pending";

  const hasUploads = input.totalDocuments > 0;
  const ocrDone = input.ocrCompleteCount >= input.totalDocuments && hasUploads;
  const classifyDone = input.classifiedCount >= input.totalDocuments && hasUploads;

  return [
    { step: "upload", label: "Upload Documents", status: s(hasUploads), detail: hasUploads ? `${input.totalDocuments} uploaded` : undefined },
    { step: "ocr", label: "OCR Processing", status: s(ocrDone, input.processingInProgress), detail: ocrDone ? `${input.ocrCompleteCount} processed` : input.processingInProgress ? "Processing…" : undefined },
    { step: "classification", label: "Document Classification", status: s(classifyDone, input.processingInProgress && hasUploads) },
    { step: "demand_extraction", label: "Demand Extraction", status: s(input.hasDemand), detail: input.hasDemand ? "Active demand found" : undefined },
    { step: "specials_extraction", label: "Specials Extraction", status: s(input.specialsCount > 0), detail: input.specialsCount > 0 ? `${input.specialsCount} records` : undefined },
    { step: "treatment_extraction", label: "Treatment Extraction", status: s(input.treatmentCount > 0), detail: input.treatmentCount > 0 ? `${input.treatmentCount} events` : undefined },
    { step: "injury_extraction", label: "Injury Extraction", status: s(input.injuryCount > 0), detail: input.injuryCount > 0 ? `${input.injuryCount} records` : undefined },
    { step: "validation", label: "Intake Validation", status: input.hasBlockers ? "blocked" : input.packageStatus ? "complete" : "pending", detail: input.hasBlockers ? "Blockers detected" : undefined },
    { step: "human_review", label: "Human Review", status: s(input.demandVerified && input.specialsVerified && input.treatmentVerified && input.injuryVerified), detail: `${[input.demandVerified, input.specialsVerified, input.treatmentVerified, input.injuryVerified].filter(Boolean).length}/4 verified` },
    { step: "publish", label: "Publish to EvaluateIQ", status: s(input.packageStatus === "published_to_evaluateiq") },
  ];
}

// ─── Simplified 8-Step Pipeline ─────────────────────────

export type SimplifiedPipelineStep =
  | "documents_uploaded"
  | "ocr_processed"
  | "demand_identified"
  | "bills_extracted"
  | "treatment_timeline_built"
  | "injuries_extracted"
  | "demand_record_created"
  | "ready_for_evaluateiq";

export interface SimplifiedStepStatus {
  step: SimplifiedPipelineStep;
  label: string;
  status: "complete" | "in_progress" | "pending";
  detail?: string;
}

export function computeSimplifiedPipeline(input: IntakeWorkflowInput): SimplifiedStepStatus[] {
  const s = (done: boolean, inProgress?: boolean): SimplifiedStepStatus["status"] =>
    done ? "complete" : inProgress ? "in_progress" : "pending";

  const hasUploads = input.totalDocuments > 0;
  const ocrDone = hasUploads && input.ocrCompleteCount >= input.totalDocuments;
  const hasExtractions = input.specialsCount > 0 || input.treatmentCount > 0 || input.injuryCount > 0;
  const demandRecordReady = input.hasDemand && hasExtractions && !input.hasBlockers;
  const allVerified = input.demandVerified && input.specialsVerified && input.treatmentVerified && input.injuryVerified;

  return [
    { step: "documents_uploaded", label: "Documents Uploaded", status: s(hasUploads), detail: hasUploads ? `${input.totalDocuments} files` : undefined },
    { step: "ocr_processed", label: "OCR Processed", status: s(ocrDone, input.processingInProgress), detail: ocrDone ? `${input.ocrCompleteCount} processed` : input.processingInProgress ? "Processing…" : undefined },
    { step: "demand_identified", label: "Demand Identified", status: s(input.hasDemand) },
    { step: "bills_extracted", label: "Bills Extracted", status: s(input.specialsCount > 0), detail: input.specialsCount > 0 ? `${input.specialsCount} records` : undefined },
    { step: "treatment_timeline_built", label: "Treatment Timeline Built", status: s(input.treatmentCount > 0), detail: input.treatmentCount > 0 ? `${input.treatmentCount} events` : undefined },
    { step: "injuries_extracted", label: "Injuries Extracted", status: s(input.injuryCount > 0), detail: input.injuryCount > 0 ? `${input.injuryCount} records` : undefined },
    { step: "demand_record_created", label: "Demand Record Created", status: s(demandRecordReady, input.hasDemand && !demandRecordReady), detail: demandRecordReady ? "Complete" : undefined },
    { step: "ready_for_evaluateiq", label: "Ready for EvaluateIQ", status: s(input.packageStatus === "published_to_evaluateiq", allVerified && !input.hasBlockers && input.packageStatus !== "published_to_evaluateiq") },
  ];
}
