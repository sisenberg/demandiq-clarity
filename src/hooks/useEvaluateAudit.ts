/**
 * EvaluateIQ — Audit & Override State Hook
 *
 * Manages the full override history and audit trail for the
 * EvaluateIQ workspace. Provides immutable, append-only logging.
 */

import { useState, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  type CorridorOverrideEntry,
  type CorridorValues,
  type EvalAuditEvent,
  type OverrideAction,
  type OverrideReasonCode,
  type SupervisoryThresholds,
  DEFAULT_SUPERVISORY_THRESHOLDS,
  createCorridorOverride,
  createOverrideAuditEvent,
  createSystemAuditEvent,
} from "@/lib/evaluateOverrideEngine";

export interface EvaluateAuditState {
  overrides: CorridorOverrideEntry[];
  auditEvents: EvalAuditEvent[];
  activeOverride: CorridorOverrideEntry | null;
  hasOverrides: boolean;
  pendingReviewCount: number;
  thresholds: SupervisoryThresholds;
}

const INITIAL_SYSTEM_EVENTS: EvalAuditEvent[] = [
  createSystemAuditEvent("module_started", "Module Started", "EvaluateIQ module initialized"),
  createSystemAuditEvent("snapshot_created", "Intake Snapshot Created", "Upstream package consumed and snapshot generated"),
  createSystemAuditEvent("claim_profile_classified", "Claim Profile Classified", "Injury pattern and severity profile determined"),
  createSystemAuditEvent("factor_scoring_completed", "Factor Scoring Completed", "All valuation factors scored across taxonomy layers"),
  createSystemAuditEvent("merits_corridor_computed", "Merits Corridor Computed", "Base corridor derived from weighted merits score"),
  createSystemAuditEvent("post_merit_adjustments_applied", "Post-Merit Adjustments Applied", "Comparative negligence, venue, and credibility adjustments applied"),
  createSystemAuditEvent("documentation_sufficiency_scored", "Documentation Sufficiency Scored", "8 subcomponent documentation assessment completed"),
  createSystemAuditEvent("benchmark_matching_completed", "Benchmark Matching Completed", "Historical corpus matching and similarity analysis completed"),
  createSystemAuditEvent("settlement_range_computed", "Settlement Range Computed", "Final settlement corridor generated"),
];

export function useEvaluateAudit() {
  const { user, role } = useAuth();
  const [overrides, setOverrides] = useState<CorridorOverrideEntry[]>([]);
  const [auditEvents, setAuditEvents] = useState<EvalAuditEvent[]>([...INITIAL_SYSTEM_EVENTS]);
  const [thresholds] = useState<SupervisoryThresholds>({ ...DEFAULT_SUPERVISORY_THRESHOLDS });

  /** Submit a corridor override */
  const submitOverride = useCallback((
    action: OverrideAction,
    systemCorridor: CorridorValues,
    overrideCorridor: CorridorValues,
    reasonCode: OverrideReasonCode,
    rationale: string,
    evidenceNote: string | null,
  ) => {
    const entry = createCorridorOverride(
      action,
      systemCorridor,
      overrideCorridor,
      reasonCode,
      rationale,
      evidenceNote,
      user?.id ?? "unknown",
      user?.email ?? "Unknown User",
      role ?? "unknown",
      "1.0.0",
      thresholds,
    );

    const auditEvent = createOverrideAuditEvent(entry);

    setOverrides(prev => [entry, ...prev]);
    setAuditEvents(prev => [auditEvent, ...prev]);

    // If supervisor review triggered, add that event too
    if (entry.requires_supervisor_review) {
      const reviewEvent = createSystemAuditEvent(
        "supervisor_review_triggered",
        "Supervisory Review Triggered",
        `Override ${entry.id} flagged for manager review`,
      );
      setAuditEvents(prev => [reviewEvent, ...prev]);
    }

    return entry;
  }, [user, role, thresholds]);

  /** Add a generic audit event */
  const addAuditEvent = useCallback((
    eventType: Parameters<typeof createSystemAuditEvent>[0],
    label: string,
    detail: string,
  ) => {
    const event = createSystemAuditEvent(eventType, label, detail);
    setAuditEvents(prev => [event, ...prev]);
  }, []);

  const state = useMemo<EvaluateAuditState>(() => {
    const activeOverride = overrides.length > 0 ? overrides[0] : null;
    return {
      overrides,
      auditEvents,
      activeOverride,
      hasOverrides: overrides.length > 0,
      pendingReviewCount: overrides.filter(o => o.supervisor_review_status === "pending").length,
      thresholds,
    };
  }, [overrides, auditEvents, thresholds]);

  return {
    state,
    overrides,
    auditEvents,
    submitOverride,
    addAuditEvent,
  };
}
