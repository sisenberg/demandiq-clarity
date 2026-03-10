// ===================================================
// DemandIQ v1 — Core Entity Types & Status Enums
// ===================================================

// ─── Status Enums ────────────────────────────────────

export enum CaseStatus {
  Draft = "draft",
  IntakeInProgress = "intake_in_progress",
  IntakeComplete = "intake_complete",
  ProcessingInProgress = "processing_in_progress",
  ReviewRequired = "review_required",
  InReview = "in_review",
  ApprovedForPackage = "approved_for_package",
  PackageReady = "package_ready",
  Exported = "exported",
  Closed = "closed",
  Failed = "failed",
}

export enum DocumentStatus {
  Uploaded = "uploaded",
  Queued = "queued",
  OcrInProgress = "ocr_in_progress",
  Classified = "classified",
  Extracted = "extracted",
  NeedsAttention = "needs_attention",
  Complete = "complete",
  Failed = "failed",
}

export enum ExtractionStatus {
  Queued = "queued",
  Running = "running",
  Completed = "completed",
  Failed = "failed",
}

export enum RelevanceType {
  Direct = "direct",
  Corroborating = "corroborating",
  Contradicting = "contradicting",
  Contextual = "contextual",
}

export enum EventType {
  Medical = "medical",
  Legal = "legal",
  Incident = "incident",
  Communication = "communication",
  Administrative = "administrative",
}

export enum SourceType {
  AiExtracted = "ai_extracted",
  Manual = "manual",
}

export enum ReviewState {
  Pending = "pending",
  Approved = "approved",
  Rejected = "rejected",
  Edited = "edited",
}

export enum FlagType {
  PreExistingCondition = "pre_existing_condition",
  TreatmentGap = "treatment_gap",
  IncompleteCompliance = "incomplete_compliance",
  DocumentationMissing = "documentation_missing",
  CausationRisk = "causation_risk",
  Inconsistency = "inconsistency",
}

export enum Severity {
  Low = "low",
  Medium = "medium",
  High = "high",
  Critical = "critical",
}

export enum FlagStatus {
  Open = "open",
  Acknowledged = "acknowledged",
  Resolved = "resolved",
  Dismissed = "dismissed",
}

export enum ReviewItemType {
  ChronologyEvent = "chronology_event",
  IssueFlag = "issue_flag",
  EvidenceLink = "evidence_link",
  Document = "document",
}

export enum ReviewStatus {
  Pending = "pending",
  InProgress = "in_progress",
  Approved = "approved",
  Rejected = "rejected",
  Deferred = "deferred",
}

export enum JobType {
  DocumentExtraction = "document_extraction",
  ChronologyGeneration = "chronology_generation",
  IssueFlagging = "issue_flagging",
  PackageExport = "package_export",
}

export enum JobStatus {
  Queued = "queued",
  Running = "running",
  Completed = "completed",
  Failed = "failed",
}

export enum PackageStatus {
  Draft = "draft",
  Approved = "approved",
  Exported = "exported",
}

export enum UserRole {
  Admin = "admin",
  Manager = "manager",
  Reviewer = "reviewer",
  Adjuster = "adjuster",
  ReadOnly = "readonly",
}

export enum ActionType {
  Created = "created",
  Updated = "updated",
  StatusChanged = "status_changed",
  Approved = "approved",
  Rejected = "rejected",
  Deleted = "deleted",
  Exported = "exported",
  Uploaded = "uploaded",
  Assigned = "assigned",
}

// ─── Core Entities ───────────────────────────────────

/** 1. Tenant */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

/** 2. User */
export interface User {
  id: string;
  tenant_id: string;
  email: string;
  display_name: string;
  role: UserRole;
  created_at: string;
}

/** 3. Case */
export interface Case {
  id: string;
  tenant_id: string;
  title: string;
  case_number: string;
  claimant: string;
  defendant: string;
  case_status: CaseStatus;
  assigned_to: string | null;
  created_by: string;
  date_of_loss: string;
  created_at: string;
  updated_at: string;
}

/** 4. Document */
export interface Document {
  id: string;
  tenant_id: string;
  case_id: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  page_count: number | null;
  document_status: DocumentStatus;
  uploaded_by: string;
  extracted_at: string | null;
  created_at: string;
}

/** 5. Extraction */
export interface Extraction {
  id: string;
  tenant_id: string;
  case_id: string;
  document_id: string;
  extraction_status: ExtractionStatus;
  events_extracted: number;
  issues_flagged: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

/** 6. Evidence Link */
export interface EvidenceLink {
  id: string;
  tenant_id: string;
  case_id: string;
  source_document_id: string;
  source_page: number;
  source_chunk_id: string | null;
  quoted_text: string;
  locator_text: string;
  relevance_type: RelevanceType;
  linked_entity_type: string;
  linked_entity_id: string;
  created_at: string;
}

/** 7. Chronology Event */
export interface ChronologyEvent {
  id: string;
  tenant_id: string;
  case_id: string;
  event_date: string;
  event_type: EventType;
  summary: string;
  source_type: SourceType;
  review_state: ReviewState;
  version: number;
  created_at: string;
  updated_at: string;
}

/** 8. Issue Flag */
export interface IssueFlag {
  id: string;
  tenant_id: string;
  case_id: string;
  flag_type: FlagType;
  severity: Severity;
  description: string;
  status: FlagStatus;
  review_state: ReviewState;
  created_at: string;
  updated_at: string;
}

/** 9. Review Item */
export interface ReviewItem {
  id: string;
  tenant_id: string;
  case_id: string;
  item_type: ReviewItemType;
  linked_record_type: string;
  linked_record_id: string;
  assigned_to: string | null;
  review_status: ReviewStatus;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 10. Job */
export interface Job {
  id: string;
  tenant_id: string;
  case_id: string;
  job_type: JobType;
  job_status: JobStatus;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

/** 11. Case Package */
export interface CasePackage {
  id: string;
  tenant_id: string;
  case_id: string;
  package_version: number;
  schema_version: string;
  package_status: PackageStatus;
  approved_at: string | null;
  exported_at: string | null;
  created_at: string;
}

/** 12. Audit Event */
export interface AuditEvent {
  id: string;
  tenant_id: string;
  case_id: string | null;
  actor_user_id: string;
  entity_type: string;
  entity_id: string;
  action_type: ActionType;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  created_at: string;
}
