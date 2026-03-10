// ===================================================
// DemandIQ v1 — Core Entity Types & Status Enums
// ===================================================

// --- Status Enums ---

export enum CaseStatus {
  Intake = "intake",
  Extraction = "extraction",
  Review = "review",
  Approved = "approved",
  Exported = "exported",
  Archived = "archived",
}

export enum DocumentStatus {
  Pending = "pending",
  Processing = "processing",
  Extracted = "extracted",
  Failed = "failed",
}

export enum EventStatus {
  Draft = "draft",
  PendingReview = "pending_review",
  Approved = "approved",
  Rejected = "rejected",
  Edited = "edited",
}

export enum IssueSeverity {
  Low = "low",
  Medium = "medium",
  High = "high",
  Critical = "critical",
}

export enum IssueStatus {
  Open = "open",
  Acknowledged = "acknowledged",
  Resolved = "resolved",
  Dismissed = "dismissed",
}

export enum UserRole {
  Admin = "admin",
  Reviewer = "reviewer",
  Analyst = "analyst",
  Viewer = "viewer",
}

export enum JobStatus {
  Queued = "queued",
  Running = "running",
  Completed = "completed",
  Failed = "failed",
}

// --- Core Entities ---

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

export interface Case {
  id: string;
  tenantId: string;
  title: string;
  caseNumber: string;
  claimant: string;
  defendant: string;
  status: CaseStatus;
  createdById: string;
  assignedToId: string | null;
  dateOfLoss: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseDocument {
  id: string;
  caseId: string;
  tenantId: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  status: DocumentStatus;
  uploadedById: string;
  pageCount: number | null;
  extractedAt: string | null;
  createdAt: string;
}

export interface EvidenceRef {
  documentId: string;
  pageNumber: number;
  excerpt: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface TimelineEvent {
  id: string;
  caseId: string;
  tenantId: string;
  eventDate: string;
  title: string;
  description: string;
  status: EventStatus;
  source: "ai_extracted" | "manual";
  evidenceRefs: EvidenceRef[];
  createdById: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Issue {
  id: string;
  caseId: string;
  tenantId: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  status: IssueStatus;
  source: "ai_flagged" | "manual";
  evidenceRefs: EvidenceRef[];
  flaggedById: string | null;
  resolvedById: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractionJob {
  id: string;
  caseId: string;
  documentId: string;
  tenantId: string;
  status: JobStatus;
  eventsExtracted: number;
  issuesFlagged: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

// --- Versioned CasePackage Contract ---

export interface CasePackage {
  version: "1.0";
  exportedAt: string;
  exportedById: string;
  case: Case;
  documents: CaseDocument[];
  timeline: TimelineEvent[];
  issues: Issue[];
  metadata: {
    totalDocuments: number;
    totalEvents: number;
    approvedEvents: number;
    openIssues: number;
    tenantId: string;
  };
}
