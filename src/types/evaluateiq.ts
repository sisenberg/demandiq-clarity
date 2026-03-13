/**
 * EvaluateIQ — Module Types & Enums
 * Valuation modeling and settlement range analysis module.
 */

// ─── Module State ───────────────────────────────────────

export enum EvaluateModuleState {
  NotStarted = "not_started",
  PackageReady = "package_ready",
  IntakeReady = "intake_ready",
  IntakeInProgress = "intake_in_progress",
  ValuationReady = "valuation_ready",
  ValuationInReview = "valuation_in_review",
  ProvisionalEvaluation = "provisional_evaluation",
  Valued = "valued",
  Completed = "completed",
  Published = "published",
}

export const EVALUATE_STATE_LABEL: Record<EvaluateModuleState, string> = {
  [EvaluateModuleState.NotStarted]: "Not Started",
  [EvaluateModuleState.PackageReady]: "Package Ready",
  [EvaluateModuleState.IntakeReady]: "Intake Ready",
  [EvaluateModuleState.IntakeInProgress]: "Intake In Progress",
  [EvaluateModuleState.ValuationReady]: "Valuation Ready",
  [EvaluateModuleState.ValuationInReview]: "Valuation In Review",
  [EvaluateModuleState.ProvisionalEvaluation]: "Provisional Evaluation",
  [EvaluateModuleState.Valued]: "Valued",
  [EvaluateModuleState.Completed]: "Completed",
  [EvaluateModuleState.Published]: "Published",
};

export const EVALUATE_STATE_BADGE_CLASS: Record<EvaluateModuleState, string> = {
  [EvaluateModuleState.NotStarted]: "text-muted-foreground",
  [EvaluateModuleState.PackageReady]: "text-[hsl(var(--status-processing))]",
  [EvaluateModuleState.IntakeReady]: "text-[hsl(var(--status-approved))]",
  [EvaluateModuleState.IntakeInProgress]: "text-[hsl(var(--status-processing))]",
  [EvaluateModuleState.ValuationReady]: "text-[hsl(var(--status-approved))]",
  [EvaluateModuleState.ValuationInReview]: "text-[hsl(var(--status-review))]",
  [EvaluateModuleState.ProvisionalEvaluation]: "text-[hsl(var(--status-attention))]",
  [EvaluateModuleState.Valued]: "text-[hsl(var(--status-attention))]",
  [EvaluateModuleState.Completed]: "text-[hsl(var(--status-approved))]",
  [EvaluateModuleState.Published]: "text-primary",
};

// ─── Upstream Input Source ──────────────────────────────

export type EvaluateInputSource = "revieweriq" | "demandiq";

export interface EvaluateEligibility {
  eligible: boolean;
  inputSource: EvaluateInputSource | null;
  /** Package version being consumed */
  sourceVersion: number | null;
  /** Reason if not eligible */
  blockerReason: string | null;
}

// ─── CTA Actions ────────────────────────────────────────

export type EvaluateCTA = "start" | "resume" | "complete";

export function getEvaluateCTA(state: EvaluateModuleState): { label: string; action: EvaluateCTA } | null {
  switch (state) {
    case EvaluateModuleState.NotStarted:
    case EvaluateModuleState.IntakeReady:
      return { label: "Start Evaluate", action: "start" };
    case EvaluateModuleState.IntakeInProgress:
    case EvaluateModuleState.ValuationReady:
    case EvaluateModuleState.ValuationInReview:
      return { label: "Resume Evaluate", action: "resume" };
    case EvaluateModuleState.Valued:
      return { label: "Complete Evaluate", action: "complete" };
    case EvaluateModuleState.Completed:
      return null;
  }
}

// ─── Audit Action Types ─────────────────────────────────

export type EvaluateAuditAction =
  | "evaluate_started"
  | "evaluate_status_changed"
  | "evaluate_completed"
  | "evaluate_reopened"
  | "evaluate_snapshot_created"
  | "evaluate_snapshot_refreshed"
  | "evaluate_valuation_run_created"
  | "evaluate_assumption_adopted"
  | "evaluate_assumption_updated"
  | "evaluate_selection_saved"
  | "evaluate_selection_updated"
  | "evaluate_package_published"
  | "evaluate_status_transition";
