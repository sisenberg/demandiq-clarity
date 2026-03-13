/**
 * EvaluateIQ — Override & Audit Engine
 *
 * Manages corridor overrides with reason codes, supervisory review
 * thresholds, before/after comparison, and immutable audit trail.
 *
 * DESIGN: Every override is a discrete, immutable record. The system
 * corridor is never mutated — overrides layer on top.
 */

// ─── Reason Codes ──────────────────────────────────────

export type OverrideReasonCode =
  | "adjuster_judgment"
  | "additional_information"
  | "policy_limits_adjustment"
  | "litigation_risk"
  | "claimant_credibility"
  | "venue_reassessment"
  | "medical_evidence_update"
  | "comparative_fault_revision"
  | "settlement_authority_alignment"
  | "benchmark_calibration"
  | "documentation_gap"
  | "manager_directive"
  | "other";

export const OVERRIDE_REASON_LABELS: Record<OverrideReasonCode, string> = {
  adjuster_judgment: "Adjuster Professional Judgment",
  additional_information: "Additional Information Received",
  policy_limits_adjustment: "Policy Limits Adjustment",
  litigation_risk: "Litigation Risk Assessment",
  claimant_credibility: "Claimant Credibility Factor",
  venue_reassessment: "Venue Reassessment",
  medical_evidence_update: "Medical Evidence Update",
  comparative_fault_revision: "Comparative Fault Revision",
  settlement_authority_alignment: "Settlement Authority Alignment",
  benchmark_calibration: "Benchmark Calibration Alignment",
  documentation_gap: "Documentation Gap Acknowledgment",
  manager_directive: "Manager Directive",
  other: "Other (see rationale)",
};

// ─── Override Types ────────────────────────────────────

export type OverrideAction =
  | "accept_recommended"
  | "override_corridor"
  | "replace_corridor";

export interface CorridorValues {
  low: number;
  mid: number;
  high: number;
}

export interface CorridorOverrideEntry {
  id: string;
  action: OverrideAction;
  /** System-derived values at time of override */
  system_corridor: CorridorValues;
  /** New values (same as system for accept) */
  override_corridor: CorridorValues;
  reason_code: OverrideReasonCode;
  rationale: string;
  /** Optional evidence note */
  evidence_note: string | null;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  timestamp: string;
  /** Engine version at time of override */
  logic_version: string;
  /** Whether this triggered a supervisory review flag */
  requires_supervisor_review: boolean;
  /** Supervisor review status */
  supervisor_review_status: "not_required" | "pending" | "approved" | "rejected";
  supervisor_id: string | null;
  supervisor_reviewed_at: string | null;
}

// ─── Audit Event Types ─────────────────────────────────

export type EvalAuditEventType =
  | "module_started"
  | "snapshot_created"
  | "claim_profile_classified"
  | "factor_scoring_completed"
  | "merits_corridor_computed"
  | "post_merit_adjustments_applied"
  | "documentation_sufficiency_scored"
  | "benchmark_matching_completed"
  | "settlement_range_computed"
  | "corridor_accepted"
  | "corridor_overridden"
  | "corridor_replaced"
  | "assumption_overridden"
  | "assumption_reset"
  | "assumptions_reset_all"
  | "working_range_selected"
  | "supervisor_review_triggered"
  | "supervisor_review_completed"
  | "evaluation_completed"
  | "evaluation_reopened"
  | "package_published";

export interface EvalAuditEvent {
  id: string;
  event_type: EvalAuditEventType;
  label: string;
  detail: string;
  before_value: unknown | null;
  after_value: unknown | null;
  actor_id: string;
  actor_name: string;
  timestamp: string;
  logic_version: string;
  /** Links to override entry if applicable */
  override_id: string | null;
  /** Severity for display */
  severity: "info" | "warning" | "critical";
}

// ─── Supervisory Review Thresholds ─────────────────────

export interface SupervisoryThresholds {
  /** Override > X% deviation from system mid triggers review */
  corridor_deviation_pct: number;
  /** Override amount exceeding system high triggers review */
  exceeds_system_high: boolean;
  /** Override amount below system low triggers review */
  below_system_low: boolean;
  /** Certain reason codes always trigger review */
  always_review_reason_codes: OverrideReasonCode[];
}

export const DEFAULT_SUPERVISORY_THRESHOLDS: SupervisoryThresholds = {
  corridor_deviation_pct: 25,
  exceeds_system_high: true,
  below_system_low: true,
  always_review_reason_codes: ["manager_directive", "other"],
};

// ─── Engine Functions ──────────────────────────────────

let idCounter = 0;
function generateId(): string {
  return `eval-ovr-${Date.now()}-${++idCounter}`;
}

function generateAuditId(): string {
  return `eval-aud-${Date.now()}-${++idCounter}`;
}

/**
 * Checks whether an override should trigger supervisory review
 */
export function checkSupervisoryReview(
  systemCorridor: CorridorValues,
  overrideCorridor: CorridorValues,
  reasonCode: OverrideReasonCode,
  thresholds: SupervisoryThresholds = DEFAULT_SUPERVISORY_THRESHOLDS,
): { required: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Deviation check
  if (systemCorridor.mid > 0) {
    const deviationPct = Math.abs(overrideCorridor.mid - systemCorridor.mid) / systemCorridor.mid * 100;
    if (deviationPct > thresholds.corridor_deviation_pct) {
      reasons.push(`Midpoint deviation of ${deviationPct.toFixed(1)}% exceeds ${thresholds.corridor_deviation_pct}% threshold`);
    }
  }

  // Exceeds system high
  if (thresholds.exceeds_system_high && overrideCorridor.mid > systemCorridor.high) {
    reasons.push("Override midpoint exceeds system corridor ceiling");
  }

  // Below system low
  if (thresholds.below_system_low && overrideCorridor.mid < systemCorridor.low) {
    reasons.push("Override midpoint below system corridor floor");
  }

  // Always-review reason codes
  if (thresholds.always_review_reason_codes.includes(reasonCode)) {
    reasons.push(`Reason code "${OVERRIDE_REASON_LABELS[reasonCode]}" requires supervisory review`);
  }

  return { required: reasons.length > 0, reasons };
}

/**
 * Creates a corridor override entry with full audit context
 */
export function createCorridorOverride(
  action: OverrideAction,
  systemCorridor: CorridorValues,
  overrideCorridor: CorridorValues,
  reasonCode: OverrideReasonCode,
  rationale: string,
  evidenceNote: string | null,
  actorId: string,
  actorName: string,
  actorRole: string,
  logicVersion: string = "1.0.0",
  thresholds: SupervisoryThresholds = DEFAULT_SUPERVISORY_THRESHOLDS,
): CorridorOverrideEntry {
  const review = checkSupervisoryReview(systemCorridor, overrideCorridor, reasonCode, thresholds);

  return {
    id: generateId(),
    action,
    system_corridor: { ...systemCorridor },
    override_corridor: action === "accept_recommended" ? { ...systemCorridor } : { ...overrideCorridor },
    reason_code: reasonCode,
    rationale,
    evidence_note: evidenceNote,
    actor_id: actorId,
    actor_name: actorName,
    actor_role: actorRole,
    timestamp: new Date().toISOString(),
    logic_version: logicVersion,
    requires_supervisor_review: review.required,
    supervisor_review_status: review.required ? "pending" : "not_required",
    supervisor_id: null,
    supervisor_reviewed_at: null,
  };
}

/**
 * Creates an audit event from a corridor override
 */
export function createOverrideAuditEvent(override: CorridorOverrideEntry): EvalAuditEvent {
  const actionLabels: Record<OverrideAction, string> = {
    accept_recommended: "Corridor Accepted",
    override_corridor: "Corridor Overridden",
    replace_corridor: "Corridor Replaced",
  };

  return {
    id: generateAuditId(),
    event_type: override.action === "accept_recommended" ? "corridor_accepted"
      : override.action === "override_corridor" ? "corridor_overridden"
      : "corridor_replaced",
    label: actionLabels[override.action],
    detail: `${OVERRIDE_REASON_LABELS[override.reason_code]}: ${override.rationale}`,
    before_value: override.system_corridor,
    after_value: override.override_corridor,
    actor_id: override.actor_id,
    actor_name: override.actor_name,
    timestamp: override.timestamp,
    logic_version: override.logic_version,
    override_id: override.id,
    severity: override.requires_supervisor_review ? "warning" : "info",
  };
}

/**
 * Creates a system audit event (non-override)
 */
export function createSystemAuditEvent(
  eventType: EvalAuditEventType,
  label: string,
  detail: string,
  logicVersion: string = "1.0.0",
): EvalAuditEvent {
  return {
    id: generateAuditId(),
    event_type: eventType,
    label,
    detail,
    before_value: null,
    after_value: null,
    actor_id: "system",
    actor_name: "Engine v" + logicVersion,
    timestamp: new Date().toISOString(),
    logic_version: logicVersion,
    override_id: null,
    severity: "info",
  };
}

/**
 * Compute before/after comparison for display
 */
export function computeBeforeAfter(
  systemCorridor: CorridorValues,
  overrideCorridor: CorridorValues,
): {
  low_delta: number;
  mid_delta: number;
  high_delta: number;
  low_pct: number;
  mid_pct: number;
  high_pct: number;
  direction: "increase" | "decrease" | "mixed" | "unchanged";
} {
  const low_delta = overrideCorridor.low - systemCorridor.low;
  const mid_delta = overrideCorridor.mid - systemCorridor.mid;
  const high_delta = overrideCorridor.high - systemCorridor.high;

  const pctSafe = (d: number, base: number) => base === 0 ? 0 : (d / base) * 100;

  const direction = mid_delta === 0 ? "unchanged"
    : mid_delta > 0 && low_delta >= 0 ? "increase"
    : mid_delta < 0 && high_delta <= 0 ? "decrease"
    : "mixed";

  return {
    low_delta, mid_delta, high_delta,
    low_pct: pctSafe(low_delta, systemCorridor.low),
    mid_pct: pctSafe(mid_delta, systemCorridor.mid),
    high_pct: pctSafe(high_delta, systemCorridor.high),
    direction,
  };
}
