// ===================================================
// ReviewerIQ — Module Read Contract & Owned State Types
// Contract version: 1.0.0
// ===================================================
//
// This file defines:
//   1. The read-only INPUT contract ReviewerIQ consumes from the upstream
//      DemandIQ completion snapshot / case package.
//   2. The module-OWNED state ReviewerIQ creates, stores, and manages.
//
// Invariants:
//   - Upstream data is NEVER mutated by ReviewerIQ.
//   - All ReviewerIQ derived outputs live in module-scoped tables.
//   - Evidence traceability is preserved via source_document_id + source_page + quoted_text.
//   - Contract is versioned; downstream consumers check contract_version.

import type {
  Case,
  Party,
  Injury,
  Provider,
  TreatmentRecord,
  BillingLine,
  InsurancePolicy,
  LiabilityFact,
  TimelineEvent,
  EvidenceReference,
  Document,
  DemandSummary,
  IssueFlag,
  SourcePage,
} from "@/types";

// ─── 1. INPUT CONTRACT (read-only from upstream) ────────────────

/**
 * The stable input contract ReviewerIQ reads when initializing a case workspace.
 * Populated from the completed DemandIQ snapshot + live platform data.
 *
 * Rule: ReviewerIQ must never write back to these structures.
 */
export interface ReviewerIQInputContract {
  /** Semantic version of this contract shape */
  contract_version: string;

  /** Upstream snapshot metadata (null if reading from live mock data) */
  upstream_snapshot?: {
    snapshot_id: string;
    module_id: string;
    version: number;
    completed_at: string;
  };

  // ── Case metadata ──
  case_record: Case;

  // ── Parties (claimant, defendant, providers, witnesses, etc.) ──
  parties: Party[];

  // ── Documents with classification & pipeline status ──
  documents: ReviewerDocumentRef[];

  // ── OCR text references (page-level) ──
  source_pages: SourcePage[];

  // ── Injuries identified upstream ──
  injuries: Injury[];

  // ── Providers identified upstream ──
  providers: Provider[];

  // ── Treatment records from DemandIQ ──
  treatments: TreatmentRecord[];

  // ── Medical bills if already extracted ──
  billing_lines: BillingLine[];

  // ── Insurance policies ──
  insurance_policies: InsurancePolicy[];

  // ── Liability facts ──
  liability_facts: LiabilityFact[];

  // ── Chronology items if available ──
  timeline_events: TimelineEvent[];

  // ── Evidence links from upstream ──
  evidence_refs: EvidenceReference[];

  // ── Issue flags from DemandIQ ──
  issue_flags: IssueFlag[];

  // ── DemandIQ baseline summary ──
  demand_summary: DemandSummary;
}

/**
 * Slim document reference for ReviewerIQ — includes classification
 * and pipeline status but not raw extracted_text (which lives in source_pages).
 */
export interface ReviewerDocumentRef {
  id: string;
  file_name: string;
  file_type: string;
  page_count: number | null;
  document_type: string;
  document_status: string;
  pipeline_stage: string;
  /** Whether OCR text is available for this document */
  has_extracted_text: boolean;
}

// ─── 2. MODULE-OWNED STATE (ReviewerIQ writes) ─────────────────

// -- Review status enum --

export type ReviewerCaseStatus =
  | "not_started"
  | "intake_review"
  | "treatment_review"
  | "billing_review"
  | "provider_review"
  | "flagging"
  | "completed";

// -- Treatment review records --

export type TreatmentReviewDecision =
  | "pending"
  | "reasonable"
  | "questionable"
  | "unreasonable"
  | "insufficient_info";

export type TreatmentReviewSource = "ai_suggested" | "manual";

/**
 * ReviewerIQ's own assessment of a treatment record.
 * Links back to the upstream treatment_id but stores all review
 * data in module-owned columns.
 */
export interface TreatmentReviewRow {
  id: string;
  tenant_id: string;
  case_id: string;
  /** FK to upstream treatment (read-only reference) */
  upstream_treatment_id: string;
  /** Snapshot of key upstream fields at review time */
  upstream_snapshot: {
    treatment_type: string;
    treatment_date: string | null;
    description: string;
    provider_name: string;
    procedure_codes: string[];
  };
  /** AI-suggested decision */
  ai_decision: TreatmentReviewDecision;
  ai_reasoning: string;
  ai_confidence: number | null;
  /** User-accepted / corrected decision */
  accepted_decision: TreatmentReviewDecision;
  accepted_reasoning: string;
  /** Whether the user has reviewed this item */
  is_reviewed: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  /** AMA / Medicare guideline references */
  guideline_refs: string[];
  /** Evidence traceability */
  source_document_id: string | null;
  source_page: number | null;
  source_snippet: string;
  created_at: string;
  updated_at: string;
}

// -- Provider normalization status --

export type ProviderNormalizationStatus =
  | "pending"
  | "matched"
  | "new_entity"
  | "needs_review"
  | "confirmed";

export interface ProviderReviewRow {
  id: string;
  tenant_id: string;
  case_id: string;
  /** FK to upstream provider (read-only reference) */
  upstream_provider_id: string;
  /** FK to entity cluster if matched */
  entity_cluster_id: string | null;
  normalization_status: ProviderNormalizationStatus;
  /** Corrected/canonical name if different from upstream */
  canonical_name: string | null;
  canonical_specialty: string | null;
  canonical_npi: string | null;
  is_reviewed: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

// -- Bill-to-treatment linkage --

export type BillLinkageStatus =
  | "pending"
  | "linked"
  | "unlinked"
  | "disputed"
  | "confirmed";

export interface BillTreatmentLinkRow {
  id: string;
  tenant_id: string;
  case_id: string;
  /** FK to upstream bill */
  upstream_bill_id: string;
  /** FK to upstream treatment (may be null if unlinked) */
  upstream_treatment_id: string | null;
  /** FK to treatment review record */
  treatment_review_id: string | null;
  linkage_status: BillLinkageStatus;
  /** AI-suggested linkage confidence */
  ai_confidence: number | null;
  /** User override */
  is_reviewed: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  /** Amount analysis */
  billed_amount: number;
  assessed_reasonable_amount: number | null;
  reduction_reason: string;
  created_at: string;
  updated_at: string;
}

// -- Medical review flags --

export type MedicalFlagCategory =
  | "excessive_treatment"
  | "insufficient_documentation"
  | "coding_mismatch"
  | "pre_existing_aggravation"
  | "causation_gap"
  | "guideline_deviation"
  | "billing_anomaly"
  | "provider_concern"
  | "other";

export type MedicalFlagSeverity = "info" | "warning" | "alert" | "critical";

export type MedicalFlagStatus = "open" | "acknowledged" | "resolved" | "dismissed";

export interface MedicalReviewFlagRow {
  id: string;
  tenant_id: string;
  case_id: string;
  category: MedicalFlagCategory;
  severity: MedicalFlagSeverity;
  title: string;
  description: string;
  status: MedicalFlagStatus;
  /** Evidence traceability */
  source_document_id: string | null;
  source_page: number | null;
  source_snippet: string;
  /** Which upstream entity this flag relates to */
  related_entity_type: string | null;
  related_entity_id: string | null;
  /** Review metadata */
  flagged_by: string; // 'ai' or user_id
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string;
  created_at: string;
  updated_at: string;
}

// -- Module-level case state --

export interface ReviewerIQCaseState {
  id: string;
  tenant_id: string;
  case_id: string;
  /** Current review workflow status */
  review_status: ReviewerCaseStatus;
  /** Version of upstream snapshot consumed */
  upstream_snapshot_version: number | null;
  upstream_snapshot_id: string | null;
  /** Summary counters (denormalized for dashboard) */
  total_treatments: number;
  treatments_reviewed: number;
  total_bills: number;
  bills_reviewed: number;
  total_providers: number;
  providers_confirmed: number;
  open_flags: number;
  /** Audit */
  started_at: string | null;
  started_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── 3. CONTRACT CONSTANTS ─────────────────────────────────────

export const REVIEWERIQ_CONTRACT_VERSION = "1.0.0";
export const REVIEWERIQ_MODULE_ID = "revieweriq";
