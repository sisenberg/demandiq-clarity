// ===================================================
// CasualtyIQ — Platform-Wide Entity Types & Enums
// DemandIQ is Module 1; types here are shared across modules.
// ===================================================

// ─── Status Enums ────────────────────────────────────

export enum CaseStatus {
  Draft = "draft",
  IntakeInProgress = "intake_in_progress",
  IntakeComplete = "intake_complete",
  ProcessingInProgress = "processing_in_progress",
  Complete = "complete",
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
  Deleted = "deleted",
  Exported = "exported",
  Uploaded = "uploaded",
  Assigned = "assigned",
}

export enum InjurySeverity {
  Minor = "minor",
  Moderate = "moderate",
  Severe = "severe",
  Catastrophic = "catastrophic",
  Fatal = "fatal",
}

export enum TreatmentType {
  Emergency = "emergency",
  Inpatient = "inpatient",
  Outpatient = "outpatient",
  Surgery = "surgery",
  PhysicalTherapy = "physical_therapy",
  Chiropractic = "chiropractic",
  DiagnosticImaging = "diagnostic_imaging",
  Prescription = "prescription",
  DME = "dme",
  MentalHealth = "mental_health",
  Injection = "injection",
  Other = "other",
}

export enum PartyRole {
  Claimant = "claimant",
  Insured = "insured",
  Defendant = "defendant",
  Witness = "witness",
  Employer = "employer",
  Provider = "provider",
  Expert = "expert",
  Attorney = "attorney",
  Adjuster = "adjuster",
}

export enum DocumentType {
  MedicalRecord = "medical_record",
  PoliceReport = "police_report",
  LegalFiling = "legal_filing",
  Correspondence = "correspondence",
  BillingRecord = "billing_record",
  ImagingReport = "imaging_report",
  InsuranceDocument = "insurance_document",
  EmploymentRecord = "employment_record",
  ExpertReport = "expert_report",
  Photograph = "photograph",
  Other = "other",
}

export enum PipelineStage {
  UploadReceived = "upload_received",
  OcrQueued = "ocr_queued",
  OcrComplete = "ocr_complete",
  DocumentClassified = "document_classified",
  ExtractionComplete = "extraction_complete",
  EvidenceLinksCreated = "evidence_links_created",
  ReviewItemsGenerated = "review_items_generated",
}

export enum BillStatus {
  Submitted = "submitted",
  UnderReview = "under_review",
  Approved = "approved",
  Reduced = "reduced",
  Denied = "denied",
  Paid = "paid",
  Appealed = "appealed",
}

export enum TimelineCategory {
  Accident = "Accident",
  FirstTreatment = "First Treatment",
  Treatment = "Treatment",
  Imaging = "Imaging",
  Injection = "Injection",
  Surgery = "Surgery",
  IME = "IME",
  Demand = "Demand",
  Legal = "Legal",
  Administrative = "Administrative",
}

export enum ModuleId {
  DemandIQ = "demandiq",
  ReviewerIQ = "revieweriq",
  EvaluateIQ = "evaluateiq",
  NegotiateIQ = "negotiateiq",
  LitIQ = "litiq",
}

export enum EntitlementStatus {
  Enabled = "enabled",
  Disabled = "disabled",
  Trial = "trial",
  Suspended = "suspended",
}

export enum ReviewStatus {
  Draft = "draft",
  InReview = "in_review",
  Approved = "approved",
  Published = "published",
}

export enum ModuleCompletionStatus {
  NotStarted = "not_started",
  InProgress = "in_progress",
  Completed = "completed",
  Reopened = "reopened",
}

/** Module completion record — tracks lifecycle per module per case */
export interface ModuleCompletion {
  id: string;
  tenant_id: string;
  case_id: string;
  module_id: string;
  status: ModuleCompletionStatus;
  version: number;
  completed_by: string | null;
  completed_at: string | null;
  reopened_by: string | null;
  reopened_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Versioned snapshot created at module completion */
export interface ModuleCompletionSnapshot {
  id: string;
  tenant_id: string;
  case_id: string;
  module_id: string;
  completion_id: string;
  version: number;
  snapshot_json: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

/** Tenant module entitlement record */
export interface TenantModuleEntitlement {
  id: string;
  tenant_id: string;
  module_id: string;
  status: EntitlementStatus;
  trial_ends_at: string | null;
  enabled_at: string | null;
  enabled_by: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
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

/** 3. Case — shared across all modules */
export interface Case {
  id: string;
  tenant_id: string;
  title: string;
  case_number: string;
  claim_number: string;
  external_reference: string;
  claimant: string;
  insured: string;
  defendant: string;
  case_status: CaseStatus;
  priority: "low" | "normal" | "high" | "urgent";
  assigned_to: string | null;
  created_by: string;
  date_of_loss: string;
  jurisdiction_state: string;
  mechanism_of_loss: string;
  created_at: string;
  updated_at: string;
}

/** 4. Party */
export interface Party {
  id: string;
  tenant_id: string;
  case_id: string;
  full_name: string;
  party_role: PartyRole;
  organization: string;
  contact_phone: string;
  contact_email: string;
  address: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

/** 5. Document */
export interface Document {
  id: string;
  tenant_id: string;
  case_id: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  page_count: number | null;
  document_type: DocumentType;
  document_status: DocumentStatus;
  pipeline_stage: PipelineStage;
  storage_path: string | null;
  uploaded_by: string;
  extracted_text: string | null;
  extracted_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 6. SourcePage — extracted page from a document */
export interface SourcePage {
  id: string;
  document_id: string;
  doc_name: string;
  page_number: number;
  page_label: string;
  document_type: DocumentType;
  extracted_text: string;
  highlights: SourceHighlight[];
}

export interface SourceHighlight {
  text: string;
  relevance: RelevanceType;
}

/** 7. EvidenceReference — link between any entity and a source location */
export interface EvidenceReference {
  id: string;
  tenant_id: string;
  case_id: string;
  source_document_id: string;
  source_page: number;
  source_chunk_id: string | null;
  quoted_text: string;
  locator_text: string;
  doc_name: string;
  page_label: string;
  relevance: RelevanceType;
  confidence: number | null;
  review_state: ReviewState;
  linked_entity_type: string;
  linked_entity_id: string;
  created_at: string;
}

/** 8. TimelineEvent — shared chronology */
export interface TimelineEvent {
  id: string;
  tenant_id: string;
  case_id: string;
  event_date: string;
  category: TimelineCategory;
  label: string;
  description: string;
  source_type: SourceType;
  review_state: ReviewState;
  evidence_refs: EvidenceReference[];
  version: number;
  created_at: string;
  updated_at: string;
}

/** 9. Injury */
export interface Injury {
  id: string;
  tenant_id: string;
  case_id: string;
  party_id: string | null;
  body_part: string;
  body_region: string;
  diagnosis_description: string;
  diagnosis_code: string;
  severity: InjurySeverity;
  is_pre_existing: boolean;
  date_of_onset: string | null;
  notes: string;
  evidence_refs: EvidenceReference[];
  /** Body map positioning (0-100 percentages) */
  map_x: number;
  map_y: number;
  created_at: string;
  updated_at: string;
}

/** 10. Provider */
export interface Provider {
  id: string;
  tenant_id: string;
  case_id: string;
  party_id: string | null;
  full_name: string;
  specialty: string;
  facility_name: string;
  role_description: string;
  total_visits: number;
  first_visit_date: string | null;
  last_visit_date: string | null;
  total_billed: number;
  total_paid: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

/** 11. TreatmentRecord */
export interface TreatmentRecord {
  id: string;
  tenant_id: string;
  case_id: string;
  injury_id: string | null;
  provider_id: string | null;
  document_id: string | null;
  treatment_type: TreatmentType;
  treatment_date: string | null;
  treatment_end_date: string | null;
  description: string;
  procedure_codes: string[];
  facility_name: string;
  provider_name: string;
  source_page: number | null;
  evidence_refs: EvidenceReference[];
  created_at: string;
  updated_at: string;
}

/** 12. BillingLine / Charge */
export interface BillingLine {
  id: string;
  tenant_id: string;
  case_id: string;
  treatment_id: string | null;
  provider_id: string | null;
  document_id: string | null;
  description: string;
  service_date: string | null;
  cpt_codes: string[];
  diagnosis_codes: string[];
  billed_amount: number;
  allowed_amount: number | null;
  paid_amount: number | null;
  adjusted_amount: number | null;
  bill_status: BillStatus;
  provider_name: string;
  facility_name: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

/** 13. InsurancePolicy */
export interface InsurancePolicy {
  id: string;
  tenant_id: string;
  case_id: string;
  carrier_name: string;
  policy_number: string;
  policy_type: string;
  coverage_limit: number | null;
  deductible: number | null;
  effective_date: string | null;
  expiration_date: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

/** 14. LiabilityFact */
export interface LiabilityFact {
  id: string;
  tenant_id: string;
  case_id: string;
  fact_text: string;
  supports_liability: boolean;
  confidence_score: number | null;
  source_document_id: string | null;
  source_page: number | null;
  evidence_refs: EvidenceReference[];
  notes: string;
  created_at: string;
  updated_at: string;
}

/** 15. DemandSummary — DemandIQ module output */
export interface DemandSummary {
  demand_amount: number;
  medical_specials: number;
  lost_wages: number;
  future_medical: number;
  general_damages: number;
  policy_limits: number | null;
  demand_date: string | null;
  response_deadline: string | null;
  status: "preparing" | "transmitted" | "countered" | "accepted" | "rejected" | "litigated";
  carrier_response_amount: number | null;
  notes: string;
}

// ─── Module System ──────────────────────────────────

/** 16. ModuleRun — tracks a single module execution */
export interface ModuleRun {
  id: string;
  tenant_id: string;
  case_id: string;
  module_id: ModuleId;
  run_status: "queued" | "running" | "completed" | "failed";
  started_at: string | null;
  completed_at: string | null;
  triggered_by: string;
  version: number;
  error_message: string | null;
  created_at: string;
}

/** 17. ModuleOutput — versioned output from a module */
export interface ModuleOutput {
  id: string;
  tenant_id: string;
  case_id: string;
  module_id: ModuleId;
  module_run_id: string;
  output_type: string;
  content_json: Record<string, unknown>;
  review_status: ReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

/** 18. DemandIQOutput — typed content for DemandIQ module */
export interface DemandIQOutput {
  claim_assessment: ClaimAssessmentSection[];
  chronological_summary: string[];
  medical_codes: string[];
  billing_summary: string[];
  provider_summary: string[];
  demand_package: string[];
  demand_summary: DemandSummary;
  review_status: ReviewStatus;
  last_edited_by: string;
  last_edited_at: string;
}

export interface ClaimAssessmentSection {
  title: string;
  content: ClaimAssessmentBlock[];
}

export interface ClaimAssessmentBlock {
  text: string;
  evidence_refs: EvidenceReference[];
}

// ─── Case Package ───────────────────────────────────

/** 19. CasePackage — the full assembled data for a case, consumed by all modules */
export interface CasePackage {
  case_record: Case;
  parties: Party[];
  documents: Document[];
  source_pages: SourcePage[];
  evidence_refs: EvidenceReference[];
  timeline_events: TimelineEvent[];
  injuries: Injury[];
  providers: Provider[];
  treatments: TreatmentRecord[];
  billing_lines: BillingLine[];
  insurance_policies: InsurancePolicy[];
  liability_facts: LiabilityFact[];
  issue_flags: IssueFlag[];
  demand_summary: DemandSummary;
  module_runs: ModuleRun[];
  module_outputs: ModuleOutput[];
}

// ─── Extraction ─────────────────────────────────────

/** 20. Extraction */
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

/** 21. Evidence Link (legacy compat) */
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

/** 22. Chronology Event (legacy compat) */
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

/** 23. Issue Flag */
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

/** 24. Job */
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

/** 25. Audit Event */
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

// ─── Convenience re-exports for citation UI ─────────

/** Slim citation reference used by UI components */
export interface CitationRef {
  doc_name: string;
  page_label: string;
  excerpt?: string;
  relevance: RelevanceType;
}
