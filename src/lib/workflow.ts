// ===================================================
// DemandIQ v1 — Workflow Engine
// Status labels, colors, transitions, allowed actions
// ===================================================

import { CaseStatus, DocumentStatus, ReviewStatus, PackageStatus } from "@/types";
import type { Permission } from "@/lib/permissions";

// ─── Case Status ───────────────────────────────────

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  [CaseStatus.Draft]: "Draft",
  [CaseStatus.IntakeInProgress]: "Intake In Progress",
  [CaseStatus.IntakeComplete]: "Intake Complete",
  [CaseStatus.ProcessingInProgress]: "Processing",
  [CaseStatus.ReviewRequired]: "Review Required",
  [CaseStatus.InReview]: "In Review",
  [CaseStatus.ApprovedForPackage]: "Approved for Package",
  [CaseStatus.PackageReady]: "Package Ready",
  [CaseStatus.Exported]: "Exported",
  [CaseStatus.Closed]: "Closed",
  [CaseStatus.Failed]: "Failed",
};

export const CASE_STATUS_BADGE: Record<CaseStatus, string> = {
  [CaseStatus.Draft]: "status-badge-draft",
  [CaseStatus.IntakeInProgress]: "status-badge-processing",
  [CaseStatus.IntakeComplete]: "status-badge-approved",
  [CaseStatus.ProcessingInProgress]: "status-badge-processing",
  [CaseStatus.ReviewRequired]: "status-badge-attention",
  [CaseStatus.InReview]: "status-badge-review",
  [CaseStatus.ApprovedForPackage]: "status-badge-approved",
  [CaseStatus.PackageReady]: "status-badge-approved",
  [CaseStatus.Exported]: "status-badge-draft",
  [CaseStatus.Closed]: "status-badge-draft",
  [CaseStatus.Failed]: "status-badge-failed",
};

export const CASE_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  [CaseStatus.Draft]: [CaseStatus.IntakeInProgress],
  [CaseStatus.IntakeInProgress]: [CaseStatus.IntakeComplete, CaseStatus.Failed],
  [CaseStatus.IntakeComplete]: [CaseStatus.ProcessingInProgress],
  [CaseStatus.ProcessingInProgress]: [CaseStatus.ReviewRequired, CaseStatus.Failed],
  [CaseStatus.ReviewRequired]: [CaseStatus.InReview],
  [CaseStatus.InReview]: [CaseStatus.ApprovedForPackage, CaseStatus.ReviewRequired],
  [CaseStatus.ApprovedForPackage]: [CaseStatus.PackageReady],
  [CaseStatus.PackageReady]: [CaseStatus.Exported],
  [CaseStatus.Exported]: [CaseStatus.Closed],
  [CaseStatus.Closed]: [],
  [CaseStatus.Failed]: [CaseStatus.Draft],
};

export interface CaseAction {
  label: string;
  targetStatus: CaseStatus;
  permission: Permission;
  variant: "primary" | "secondary" | "destructive";
  icon: string;
}

export const CASE_ACTIONS: Record<CaseStatus, CaseAction[]> = {
  [CaseStatus.Draft]: [
    { label: "Begin Intake", targetStatus: CaseStatus.IntakeInProgress, permission: "edit_case", variant: "primary", icon: "Play" },
  ],
  [CaseStatus.IntakeInProgress]: [
    { label: "Complete Intake", targetStatus: CaseStatus.IntakeComplete, permission: "edit_case", variant: "primary", icon: "CheckCircle" },
    { label: "Mark Failed", targetStatus: CaseStatus.Failed, permission: "edit_case", variant: "destructive", icon: "XCircle" },
  ],
  [CaseStatus.IntakeComplete]: [
    { label: "Start Processing", targetStatus: CaseStatus.ProcessingInProgress, permission: "trigger_processing", variant: "primary", icon: "Play" },
  ],
  [CaseStatus.ProcessingInProgress]: [
    { label: "Send to Review", targetStatus: CaseStatus.ReviewRequired, permission: "trigger_processing", variant: "primary", icon: "Send" },
    { label: "Mark Failed", targetStatus: CaseStatus.Failed, permission: "trigger_processing", variant: "destructive", icon: "XCircle" },
  ],
  [CaseStatus.ReviewRequired]: [
    { label: "Begin Review", targetStatus: CaseStatus.InReview, permission: "approve_review", variant: "primary", icon: "ClipboardCheck" },
  ],
  [CaseStatus.InReview]: [
    { label: "Approve for Package", targetStatus: CaseStatus.ApprovedForPackage, permission: "approve_review", variant: "primary", icon: "CheckCircle" },
    { label: "Request Changes", targetStatus: CaseStatus.ReviewRequired, permission: "approve_review", variant: "secondary", icon: "RotateCcw" },
  ],
  [CaseStatus.ApprovedForPackage]: [
    { label: "Build Package", targetStatus: CaseStatus.PackageReady, permission: "approve_package", variant: "primary", icon: "Package" },
  ],
  [CaseStatus.PackageReady]: [
    { label: "Export Package", targetStatus: CaseStatus.Exported, permission: "export_package", variant: "primary", icon: "Download" },
  ],
  [CaseStatus.Exported]: [
    { label: "Close Case", targetStatus: CaseStatus.Closed, permission: "edit_case", variant: "secondary", icon: "Archive" },
  ],
  [CaseStatus.Closed]: [],
  [CaseStatus.Failed]: [
    { label: "Reset to Draft", targetStatus: CaseStatus.Draft, permission: "edit_case", variant: "secondary", icon: "RotateCcw" },
  ],
};

// ─── Document Status ──────────────────────────────

export const DOC_STATUS_LABEL: Record<DocumentStatus, string> = {
  [DocumentStatus.Uploaded]: "Uploaded",
  [DocumentStatus.Queued]: "Queued",
  [DocumentStatus.OcrInProgress]: "OCR In Progress",
  [DocumentStatus.Classified]: "Classified",
  [DocumentStatus.Extracted]: "Extracted",
  [DocumentStatus.NeedsAttention]: "Needs Attention",
  [DocumentStatus.Complete]: "Complete",
  [DocumentStatus.Failed]: "Failed",
};

export const DOC_STATUS_BADGE: Record<DocumentStatus, string> = {
  [DocumentStatus.Uploaded]: "status-badge-draft",
  [DocumentStatus.Queued]: "status-badge-draft",
  [DocumentStatus.OcrInProgress]: "status-badge-processing",
  [DocumentStatus.Classified]: "status-badge-processing",
  [DocumentStatus.Extracted]: "status-badge-review",
  [DocumentStatus.NeedsAttention]: "status-badge-attention",
  [DocumentStatus.Complete]: "status-badge-approved",
  [DocumentStatus.Failed]: "status-badge-failed",
};

// ─── Review Status ────────────────────────────────

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  [ReviewStatus.NotStarted]: "Not Started",
  [ReviewStatus.Pending]: "Pending",
  [ReviewStatus.InReview]: "In Review",
  [ReviewStatus.ChangesRequested]: "Changes Requested",
  [ReviewStatus.Approved]: "Approved",
};

export const REVIEW_STATUS_BADGE: Record<ReviewStatus, string> = {
  [ReviewStatus.NotStarted]: "status-badge-draft",
  [ReviewStatus.Pending]: "status-badge-review",
  [ReviewStatus.InReview]: "status-badge-processing",
  [ReviewStatus.ChangesRequested]: "status-badge-attention",
  [ReviewStatus.Approved]: "status-badge-approved",
};

// ─── Package Status ───────────────────────────────

export const PKG_STATUS_LABEL: Record<PackageStatus, string> = {
  [PackageStatus.NotReady]: "Not Ready",
  [PackageStatus.Assembling]: "Assembling",
  [PackageStatus.Ready]: "Ready",
  [PackageStatus.Approved]: "Approved",
  [PackageStatus.Exported]: "Exported",
  [PackageStatus.Failed]: "Failed",
};

export const PKG_STATUS_BADGE: Record<PackageStatus, string> = {
  [PackageStatus.NotReady]: "status-badge-draft",
  [PackageStatus.Assembling]: "status-badge-processing",
  [PackageStatus.Ready]: "status-badge-review",
  [PackageStatus.Approved]: "status-badge-approved",
  [PackageStatus.Exported]: "status-badge-approved",
  [PackageStatus.Failed]: "status-badge-failed",
};

// ─── Workflow Phase Computation ───────────────────

export type WorkflowPhase = "intake" | "processing" | "review" | "package";
export type PhaseState = "pending" | "active" | "complete" | "failed";

const PHASE_ORDER: WorkflowPhase[] = ["intake", "processing", "review", "package"];

const STATUS_TO_PHASE: Record<CaseStatus, { phase: WorkflowPhase; state: PhaseState }> = {
  [CaseStatus.Draft]: { phase: "intake", state: "pending" },
  [CaseStatus.IntakeInProgress]: { phase: "intake", state: "active" },
  [CaseStatus.IntakeComplete]: { phase: "intake", state: "complete" },
  [CaseStatus.ProcessingInProgress]: { phase: "processing", state: "active" },
  [CaseStatus.ReviewRequired]: { phase: "review", state: "pending" },
  [CaseStatus.InReview]: { phase: "review", state: "active" },
  [CaseStatus.ApprovedForPackage]: { phase: "review", state: "complete" },
  [CaseStatus.PackageReady]: { phase: "package", state: "active" },
  [CaseStatus.Exported]: { phase: "package", state: "complete" },
  [CaseStatus.Closed]: { phase: "package", state: "complete" },
  [CaseStatus.Failed]: { phase: "intake", state: "failed" },
};

export function getPhaseStates(caseStatus: CaseStatus): Record<WorkflowPhase, PhaseState> {
  const current = STATUS_TO_PHASE[caseStatus];
  const currentIdx = PHASE_ORDER.indexOf(current.phase);

  const result: Record<WorkflowPhase, PhaseState> = {
    intake: "pending",
    processing: "pending",
    review: "pending",
    package: "pending",
  };

  if (caseStatus === CaseStatus.Failed) {
    result[current.phase] = "failed";
    return result;
  }

  for (let i = 0; i < PHASE_ORDER.length; i++) {
    const phase = PHASE_ORDER[i];
    if (i < currentIdx) {
      result[phase] = "complete";
    } else if (i === currentIdx) {
      result[phase] = current.state;
    }
  }

  return result;
}

// ─── Activity Event Types ─────────────────────────

export interface CaseActivityEvent {
  id: string;
  case_id: string;
  action: string;
  description: string;
  actor_name: string;
  from_status?: string;
  to_status?: string;
  created_at: string;
}

// ─── Transition Guards ────────────────────────────

export function canTransition(from: CaseStatus, to: CaseStatus): boolean {
  return CASE_TRANSITIONS[from].includes(to);
}

/** Check if review is complete enough for package approval */
export function isReviewComplete(reviewStatuses: ReviewStatus[]): boolean {
  if (reviewStatuses.length === 0) return false;
  return reviewStatuses.every((s) => s === ReviewStatus.Approved);
}

/** Check if package is approved for export */
export function isPackageApproved(packageStatus: PackageStatus | null): boolean {
  return packageStatus === PackageStatus.Approved;
}
