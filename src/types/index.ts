// ─── Enums ───────────────────────────────────────────────────────────────────

export type TenantId = string;
export type UserId = string;
export type CaseId = string;
export type DocumentId = string;
export type EventId = string;
export type IssueId = string;

export enum UserRole {
  Admin = "admin",
  Reviewer = "reviewer",
  Adjuster = "adjuster",
  ReadOnly = "read_only",
}

export enum CaseStatus {
  Intake = "intake",
  Extraction = "extraction",
  Review = "review",
  Approved = "approved",
  Exported = "exported",
  Archived = "archived",
}

export enum DocumentStatus {
  Uploading = "uploading",
  Processing = "processing",
  Extracted = "extracted",
  ReviewNeeded = "review_needed",
  Verified = "verified",
  Error = "error",
}

export enum EventStatus {
  Draft = "draft",
  NeedsReview = "needs_review",
  Approved = "approved",
  Rejected = "rejected",
}

export enum IssueStatus {
  Open = "open",
  UnderReview = "under_review",
  Resolved = "resolved",
  Dismissed = "dismissed",
}

export enum IssueSeverity {
  Low = "low",
  Medium = "medium",
  High = "high",
  Critical = "critical",
}

export enum ExtractionSource {
  AI = "ai",
  Manual = "manual",
}

// ─── Models ──────────────────────────────────────────────────────────────────

export interface Tenant {
  id: TenantId;
  name: string;
  createdAt: string;
}

export interface User {
  id: UserId;
  tenantId: TenantId;
  email: string;
  name: string;
  role: UserRole;
}

export interface Case {
  id: CaseId;
  tenantId: TenantId;
  title: string;
  claimNumber: string;
  status: CaseStatus;
  assigneeId: UserId | null;
  createdAt: string;
  updatedAt: string;
  documentCount: number;
  eventCount: number;
  issueCount: number;
}

export interface CaseDocument {
  id: DocumentId;
  caseId: CaseId;
  tenantId: TenantId;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: DocumentStatus;
  uploadedBy: UserId;
  uploadedAt: string;
  pageCount: number | null;
  extractionJobId: string | null;
}

export interface TimelineEvent {
  id: EventId;
  caseId: CaseId;
  tenantId: TenantId;
  date: string;
  title: string;
  description: string;
  status: EventStatus;
  source: ExtractionSource;
  sourceDocumentId: DocumentId | null;
  sourcePageNumber: number | null;
  sourceTextSnippet: string | null;
  createdAt: string;
  reviewedBy: UserId | null;
  reviewedAt: string | null;
  version: number;
}

export interface Issue {
  id: IssueId;
  caseId: CaseId;
  tenantId: TenantId;
  title: string;
  description: string;
  severity: IssueSeverity;
  status: IssueStatus;
  source: ExtractionSource;
  sourceDocumentId: DocumentId | null;
  sourcePageNumber: number | null;
  flaggedBy: UserId | null;
  flaggedAt: string;
  resolvedBy: UserId | null;
  resolvedAt: string | null;
}

export interface EvidenceReference {
  documentId: DocumentId;
  pageNumber: number;
  textSnippet: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

// ─── Case Package (Export Contract) ──────────────────────────────────────────

export interface CasePackage {
  version: "1.0";
  exportedAt: string;
  exportedBy: UserId;
  case: Case;
  documents: CaseDocument[];
  chronology: TimelineEvent[];
  issues: Issue[];
}
