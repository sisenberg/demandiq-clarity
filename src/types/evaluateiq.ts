/**
 * EvaluateIQ — Module Types & Enums
 * Valuation modeling and settlement range analysis module.
 */

// ─── Module State ───────────────────────────────────────

export enum EvaluateModuleState {
  NotStarted = "not_started",
  IntakeReady = "intake_ready",
  IntakeInProgress = "intake_in_progress",
  ValuationReady = "valuation_ready",
  ValuationInReview = "valuation_in_review",
  Valued = "valued",
  Completed = "completed",
}

export const EVALUATE_STATE_LABEL: Record<EvaluateModuleState, string> = {
  [EvaluateModuleState.NotStarted]: "Not Started",
  [EvaluateModuleState.IntakeReady]: "Intake Ready",
  [EvaluateModuleState.IntakeInProgress]: "Intake In Progress",
  [EvaluateModuleState.ValuationReady]: "Valuation Ready",
  [EvaluateModuleState.ValuationInReview]: "Valuation In Review",
  [EvaluateModuleState.Valued]: "Valued",
  [EvaluateModuleState.Completed]: "Completed",
};

export const EVALUATE_STATE_BADGE_CLASS: Record<EvaluateModuleState, string> = {
  [EvaluateModuleState.NotStarted]: "text-muted-foreground",
  [EvaluateModuleState.IntakeReady]: "text-[hsl(var(--status-approved))]",
  [EvaluateModuleState.IntakeInProgress]: "text-[hsl(var(--status-processing))]",
  [EvaluateModuleState.ValuationReady]: "text-[hsl(var(--status-approved))]",
  [EvaluateModuleState.ValuationInReview]: "text-[hsl(var(--status-review))]",
  [EvaluateModuleState.Valued]: "text-[hsl(var(--status-attention))]",
  [EvaluateModuleState.Completed]: "text-[hsl(var(--status-approved))]",
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
  | "evaluate_reopened";
