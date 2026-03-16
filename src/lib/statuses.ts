/**
 * Centralized status model for DemandIQ document intake pipeline.
 *
 * STATUS FIELD SEMANTICS:
 *
 * ┌─────────────────────┬──────────────────────────────────────────────────────────┐
 * │ Field               │ Purpose                                                  │
 * ├─────────────────────┼──────────────────────────────────────────────────────────┤
 * │ document_status     │ Broad lifecycle: where is this document in its overall   │
 * │                     │ life? (uploaded → queued → processing → complete/failed) │
 * │                     │ Consumer: case-level summaries, readiness checks.        │
 * ├─────────────────────┼──────────────────────────────────────────────────────────┤
 * │ intake_status       │ Intake-specific readiness: fine-grained step within the  │
 * │                     │ intake pipeline. Drives the intake UI badges.            │
 * │                     │ Consumer: intake workstation, polling logic.             │
 * ├─────────────────────┼──────────────────────────────────────────────────────────┤
 * │ pipeline_stage      │ Processing checkpoint: which pipeline step has been      │
 * │                     │ reached? Monotonically advances. Used for progress       │
 * │                     │ visualization in the pipeline stepper.                   │
 * │                     │ Consumer: ProcessingPipeline component, exports.         │
 * ├─────────────────────┼──────────────────────────────────────────────────────────┤
 * │ intake_jobs.status  │ Job execution state: simple queued/running/completed/    │
 * │                     │ failed/cancelled. One job = one unit of work.            │
 * │                     │ Consumer: job panels, retry logic.                       │
 * └─────────────────────┴──────────────────────────────────────────────────────────┘
 */

// ═══════════════════════════════════════════════════════
// 1. DOCUMENT STATUS — broad lifecycle
// ═══════════════════════════════════════════════════════

export type DocumentStatus =
  | "uploaded"
  | "queued"
  | "ocr_in_progress"
  | "classified"
  | "extracted"
  | "needs_attention"
  | "complete"
  | "failed";

export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  uploaded: "Uploaded",
  queued: "Queued",
  ocr_in_progress: "Processing",
  classified: "Classified",
  extracted: "Extracted",
  needs_attention: "Needs Attention",
  complete: "Complete",
  failed: "Failed",
};

export const DOCUMENT_STATUS_BADGE: Record<DocumentStatus, { className: string; label: string }> = {
  uploaded:        { className: "bg-accent text-muted-foreground", label: "Uploaded" },
  queued:          { className: "bg-accent text-muted-foreground", label: "Queued" },
  ocr_in_progress: { className: "bg-[hsl(var(--status-processing-bg))] text-[hsl(var(--status-processing-foreground))]", label: "Processing" },
  classified:      { className: "bg-[hsl(var(--status-processing-bg))] text-[hsl(var(--status-processing-foreground))]", label: "Classified" },
  extracted:       { className: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]", label: "Extracted" },
  needs_attention: { className: "bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention-foreground))]", label: "Attention" },
  complete:        { className: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]", label: "Complete" },
  failed:          { className: "bg-destructive/10 text-destructive", label: "Failed" },
};

// ═══════════════════════════════════════════════════════
// 2. INTAKE STATUS — fine-grained intake readiness
// ═══════════════════════════════════════════════════════

export type IntakeStatus =
  | "uploaded"
  | "queued_for_text_extraction"
  | "extracting_text"
  | "text_extracted"
  | "queued_for_parsing"
  | "parsing"
  | "parsed"
  | "needs_review"
  | "failed";

export const INTAKE_STATUS_LABEL: Record<IntakeStatus, string> = {
  uploaded: "Uploaded",
  queued_for_text_extraction: "Queued for OCR",
  extracting_text: "Extracting Text",
  text_extracted: "Text Extracted",
  queued_for_parsing: "Queued for Parsing",
  parsing: "Parsing",
  parsed: "Parsed",
  needs_review: "Needs Review",
  failed: "Failed",
};

export const INTAKE_STATUS_BADGE: Record<IntakeStatus, { className: string; label: string }> = {
  uploaded:                    { className: "bg-accent text-muted-foreground", label: "Uploaded" },
  queued_for_text_extraction:  { className: "bg-[hsl(var(--status-processing-bg))] text-[hsl(var(--status-processing-foreground))]", label: "OCR Queued" },
  extracting_text:             { className: "bg-[hsl(var(--status-processing-bg))] text-[hsl(var(--status-processing-foreground))]", label: "Extracting" },
  text_extracted:              { className: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]", label: "Text Ready" },
  queued_for_parsing:          { className: "bg-[hsl(var(--status-processing-bg))] text-[hsl(var(--status-processing-foreground))]", label: "Parse Queued" },
  parsing:                     { className: "bg-[hsl(var(--status-processing-bg))] text-[hsl(var(--status-processing-foreground))]", label: "Parsing" },
  parsed:                      { className: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]", label: "Parsed" },
  needs_review:                { className: "bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention-foreground))]", label: "Review" },
  failed:                      { className: "bg-destructive/10 text-destructive", label: "Failed" },
};

/** Intake statuses that indicate active processing (for polling logic) */
export const INTAKE_PROCESSING_STATUSES: IntakeStatus[] = [
  "queued_for_text_extraction",
  "extracting_text",
  "queued_for_parsing",
  "parsing",
];

/** Intake statuses that indicate completion (text ready or parsed) */
export const INTAKE_COMPLETE_STATUSES: IntakeStatus[] = [
  "text_extracted",
  "parsed",
];

// ═══════════════════════════════════════════════════════
// 3. PIPELINE STAGE — processing checkpoint (monotonic)
// ═══════════════════════════════════════════════════════

export type PipelineStage =
  | "upload_received"
  | "validated"
  | "ocr_queued"
  | "ocr_complete"
  | "document_classified"
  | "extraction_complete"
  | "chunked"
  | "indexed"
  | "extraction_ready"
  | "evidence_links_created"
  | "review_items_generated";

export const PIPELINE_STAGE_LABEL: Record<PipelineStage, string> = {
  upload_received: "Upload Received",
  validated: "Validated",
  ocr_queued: "OCR Queued",
  ocr_complete: "OCR Complete",
  document_classified: "Classified",
  extraction_complete: "Extraction Complete",
  chunked: "Chunked",
  indexed: "Indexed",
  extraction_ready: "Extraction Ready",
  evidence_links_created: "Evidence Links Created",
  review_items_generated: "Review Items Generated",
};

/** Ordered pipeline stages for stepper/progress visualization */
export const PIPELINE_STAGES_ORDERED: { key: PipelineStage; label: string }[] = [
  { key: "upload_received", label: "Upload Received" },
  { key: "validated", label: "Validated" },
  { key: "ocr_queued", label: "OCR Queued" },
  { key: "ocr_complete", label: "OCR Complete" },
  { key: "document_classified", label: "Classified" },
  { key: "extraction_complete", label: "Extraction Complete" },
  { key: "chunked", label: "Chunked" },
  { key: "indexed", label: "Indexed" },
  { key: "extraction_ready", label: "Extraction Ready" },
  { key: "evidence_links_created", label: "Evidence Links Created" },
  { key: "review_items_generated", label: "Review Items Generated" },
];

// ═══════════════════════════════════════════════════════
// 4. JOB STATUS — execution state
// ═══════════════════════════════════════════════════════

export type IntakeJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export const JOB_STATUS_LABEL: Record<IntakeJobStatus, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const JOB_STATUS_BADGE: Record<IntakeJobStatus, { className: string; label: string }> = {
  queued:    { className: "bg-accent text-muted-foreground", label: "Queued" },
  running:   { className: "bg-[hsl(var(--status-processing-bg))] text-[hsl(var(--status-processing-foreground))]", label: "Running" },
  completed: { className: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]", label: "Completed" },
  failed:    { className: "bg-destructive/10 text-destructive", label: "Failed" },
  cancelled: { className: "bg-accent text-muted-foreground", label: "Cancelled" },
};

// ═══════════════════════════════════════════════════════
// 5. INTAKE JOB TYPE labels
// ═══════════════════════════════════════════════════════

export type IntakeJobType =
  | "text_extraction"
  | "document_parsing"
  | "fact_extraction"
  | "duplicate_detection"
  | "validation"
  | "chunking"
  | "indexing";

export const JOB_TYPE_LABEL: Record<IntakeJobType, string> = {
  text_extraction: "Text Extraction (OCR)",
  document_parsing: "Document Parsing",
  fact_extraction: "Fact Extraction",
  duplicate_detection: "Duplicate Detection",
  validation: "Validation",
  chunking: "Chunking",
  indexing: "Indexing",
};

// ═══════════════════════════════════════════════════════
// 6. DOCUMENT TYPE labels
// ═══════════════════════════════════════════════════════

export type DocumentType =
  | "demand_letter" | "medical_bill" | "medical_record" | "itemized_statement"
  | "narrative_report" | "imaging_report" | "wage_loss_document"
  | "police_report" | "legal_filing" | "correspondence"
  | "billing_record" | "insurance_document" | "employment_record"
  | "expert_report" | "photograph" | "unknown" | "other";

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  demand_letter: "Demand Letter",
  medical_bill: "Medical Bill",
  medical_record: "Medical Record",
  itemized_statement: "Itemized Statement",
  narrative_report: "Narrative Report",
  imaging_report: "Imaging Report",
  wage_loss_document: "Wage Loss",
  police_report: "Police Report",
  legal_filing: "Legal Filing",
  correspondence: "Correspondence",
  billing_record: "Billing Record",
  insurance_document: "Insurance",
  employment_record: "Employment",
  expert_report: "Expert Report",
  photograph: "Photograph",
  unknown: "Unknown",
  other: "Other",
};

// ═══════════════════════════════════════════════════════
// 7. DOCUMENT WORKFLOW ROUTING
// ═══════════════════════════════════════════════════════

export type ExtractionWorkflow =
  | "demand_extraction"
  | "specials_extraction"
  | "treatment_extraction"
  | "general_review"
  | "pending_classification";

export const WORKFLOW_ROUTING: Record<DocumentType, ExtractionWorkflow> = {
  demand_letter: "demand_extraction",
  medical_bill: "specials_extraction",
  itemized_statement: "specials_extraction",
  billing_record: "specials_extraction",
  wage_loss_document: "specials_extraction",
  medical_record: "treatment_extraction",
  narrative_report: "treatment_extraction",
  imaging_report: "treatment_extraction",
  police_report: "general_review",
  correspondence: "general_review",
  legal_filing: "general_review",
  insurance_document: "general_review",
  employment_record: "general_review",
  expert_report: "general_review",
  photograph: "general_review",
  unknown: "pending_classification",
  other: "general_review",
};

export const WORKFLOW_LABEL: Record<ExtractionWorkflow, string> = {
  demand_extraction: "Demand Extraction",
  specials_extraction: "Specials Extraction",
  treatment_extraction: "Treatment Extraction",
  general_review: "General Review",
  pending_classification: "Awaiting Classification",
};

// ═══════════════════════════════════════════════════════
// 7. HELPERS — safe lookups with fallbacks
// ═══════════════════════════════════════════════════════

const FALLBACK_BADGE = { className: "bg-accent text-muted-foreground", label: "Unknown" };

/** Get intake status badge with safe fallback */
export function getIntakeBadge(status: string): { className: string; label: string } {
  return INTAKE_STATUS_BADGE[status as IntakeStatus] ?? FALLBACK_BADGE;
}

/** Get document status badge with safe fallback */
export function getDocumentStatusBadge(status: string): { className: string; label: string } {
  return DOCUMENT_STATUS_BADGE[status as DocumentStatus] ?? FALLBACK_BADGE;
}

/** Get job status badge with safe fallback */
export function getJobStatusBadge(status: string): { className: string; label: string } {
  return JOB_STATUS_BADGE[status as IntakeJobStatus] ?? FALLBACK_BADGE;
}

/** Get pipeline stage label with safe fallback */
export function getPipelineStageLabel(stage: string): string {
  return PIPELINE_STAGE_LABEL[stage as PipelineStage] ?? stage.replace(/_/g, " ");
}

/** Check if an intake_status indicates active processing */
export function isIntakeProcessing(status: string): boolean {
  return INTAKE_PROCESSING_STATUSES.includes(status as IntakeStatus);
}

/** Check if an intake_status indicates completion */
export function isIntakeComplete(status: string): boolean {
  return INTAKE_COMPLETE_STATUSES.includes(status as IntakeStatus);
}

/** Check if a document_status indicates readiness for downstream use */
export function isDocumentReady(status: string): boolean {
  return status === "complete" || status === "extracted";
}

/** Get the extraction workflow for a document type */
export function getWorkflowRoute(docType: string): ExtractionWorkflow {
  return WORKFLOW_ROUTING[docType as DocumentType] ?? "general_review";
}

/** Get document type label with safe fallback */
export function getDocumentTypeLabel(docType: string): string {
  return DOCUMENT_TYPE_LABEL[docType as DocumentType] ?? docType.replace(/_/g, " ");
}
