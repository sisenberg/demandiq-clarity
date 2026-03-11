// ===================================================
// DemandIQ v1 — Workflow Engine
// Status labels, colors, transitions, allowed actions
// ===================================================

import { CaseStatus, DocumentStatus } from "@/types";
import type { Permission } from "@/lib/permissions";

// ─── Case Status ───────────────────────────────────

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  [CaseStatus.Draft]: "Draft",
  [CaseStatus.IntakeInProgress]: "Intake In Progress",
  [CaseStatus.IntakeComplete]: "Intake Complete",
  [CaseStatus.ProcessingInProgress]: "Processing",
  [CaseStatus.Complete]: "Complete",
  [CaseStatus.Exported]: "Demand Completed",
  [CaseStatus.Closed]: "Closed",
  [CaseStatus.Failed]: "Failed",
};

export const CASE_STATUS_BADGE: Record<CaseStatus, string> = {
  [CaseStatus.Draft]: "status-badge-draft",
  [CaseStatus.IntakeInProgress]: "status-badge-processing",
  [CaseStatus.IntakeComplete]: "status-badge-approved",
  [CaseStatus.ProcessingInProgress]: "status-badge-processing",
  [CaseStatus.Complete]: "status-badge-approved",
  [CaseStatus.Exported]: "status-badge-approved",
  [CaseStatus.Closed]: "status-badge-draft",
  [CaseStatus.Failed]: "status-badge-failed",
};

export const CASE_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  [CaseStatus.Draft]: [CaseStatus.IntakeInProgress],
  [CaseStatus.IntakeInProgress]: [CaseStatus.IntakeComplete, CaseStatus.Failed],
  [CaseStatus.IntakeComplete]: [CaseStatus.ProcessingInProgress],
  [CaseStatus.ProcessingInProgress]: [CaseStatus.Complete, CaseStatus.Failed],
  [CaseStatus.Complete]: [CaseStatus.Exported],
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
    { label: "Mark Complete", targetStatus: CaseStatus.Complete, permission: "trigger_processing", variant: "primary", icon: "CheckCircle" },
    { label: "Mark Failed", targetStatus: CaseStatus.Failed, permission: "trigger_processing", variant: "destructive", icon: "XCircle" },
  ],
  [CaseStatus.Complete]: [
    { label: "Complete Demand", targetStatus: CaseStatus.Exported, permission: "complete_module", variant: "primary", icon: "CheckCircle2" },
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
  [DocumentStatus.Extracted]: "status-badge-approved",
  [DocumentStatus.NeedsAttention]: "status-badge-attention",
  [DocumentStatus.Complete]: "status-badge-approved",
  [DocumentStatus.Failed]: "status-badge-failed",
};

// ─── Workflow Phase Computation ───────────────────

export type WorkflowPhase = "intake" | "processing" | "completion";
export type PhaseState = "pending" | "active" | "complete" | "failed";

const PHASE_ORDER: WorkflowPhase[] = ["intake", "processing", "completion"];

const STATUS_TO_PHASE: Record<CaseStatus, { phase: WorkflowPhase; state: PhaseState }> = {
  [CaseStatus.Draft]: { phase: "intake", state: "pending" },
  [CaseStatus.IntakeInProgress]: { phase: "intake", state: "active" },
  [CaseStatus.IntakeComplete]: { phase: "intake", state: "complete" },
  [CaseStatus.ProcessingInProgress]: { phase: "processing", state: "active" },
  [CaseStatus.Complete]: { phase: "processing", state: "complete" },
  [CaseStatus.Exported]: { phase: "completion", state: "complete" },
  [CaseStatus.Closed]: { phase: "completion", state: "complete" },
  [CaseStatus.Failed]: { phase: "intake", state: "failed" },
};

export function getPhaseStates(caseStatus: CaseStatus): Record<WorkflowPhase, PhaseState> {
  const current = STATUS_TO_PHASE[caseStatus];
  const currentIdx = PHASE_ORDER.indexOf(current.phase);

  const result: Record<WorkflowPhase, PhaseState> = {
    intake: "pending",
    processing: "pending",
    export: "pending",
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
