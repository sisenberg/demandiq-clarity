/**
 * NegotiateIQ — Representation tracking hook
 *
 * Manages representation context within a negotiation session:
 * - Tracks representation at key milestones
 * - Records representation change events in the timeline
 * - Triggers strategy refresh when representation changes
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { logNegotiationEvent } from "@/hooks/useNegotiateSession";
import type { NegotiateRepresentationContext, NegotiationEventType } from "@/types/negotiate-persistence";

// ─── Default Context ────────────────────────────────────

export function createDefaultRepresentationContext(
  currentStatus: "represented" | "unrepresented" | "unknown" = "unknown",
  attorneyName?: string | null,
  firmName?: string | null,
): NegotiateRepresentationContext {
  return {
    representation_status_current: currentStatus,
    representation_status_at_first_negotiation_event: null,
    representation_status_at_publication: currentStatus,
    representation_status_at_outcome: null,
    representation_transition_flag: false,
    attorney_retained_during_negotiation_flag: currentStatus === "represented",
    attorney_retained_after_initial_offer_flag: false,
    unrepresented_resolved_flag: false,
    current_attorney_name: attorneyName ?? null,
    current_firm_name: firmName ?? null,
    representation_history_summary: currentStatus === "unknown"
      ? "Representation status not yet determined."
      : currentStatus === "represented"
        ? `Represented by ${attorneyName ?? "counsel"}${firmName ? ` (${firmName})` : ""}.`
        : "Claimant is unrepresented.",
    representation_changes: [],
  };
}

// ─── Update on first negotiation event ──────────────────

export function captureFirstEventStatus(
  ctx: NegotiateRepresentationContext,
): NegotiateRepresentationContext {
  if (ctx.representation_status_at_first_negotiation_event !== null) return ctx;
  return {
    ...ctx,
    representation_status_at_first_negotiation_event: ctx.representation_status_current,
  };
}

// ─── Update on outcome ──────────────────────────────────

export function captureOutcomeStatus(
  ctx: NegotiateRepresentationContext,
): NegotiateRepresentationContext {
  return {
    ...ctx,
    representation_status_at_outcome: ctx.representation_status_current,
  };
}

// ─── Apply Representation Change ────────────────────────

export function applyRepresentationChange(
  ctx: NegotiateRepresentationContext,
  eventType: NegotiationEventType,
  newStatus: "represented" | "unrepresented" | "unknown",
  attorneyName: string | null,
  firmName: string | null,
  occurredAt: string,
): NegotiateRepresentationContext {
  const previousStatus = ctx.representation_status_current;
  const wasRepresented = previousStatus === "represented";
  const nowRepresented = newStatus === "represented";

  const transitioned =
    ctx.representation_transition_flag ||
    (previousStatus !== "unknown" && newStatus !== "unknown" && previousStatus !== newStatus);

  return {
    ...ctx,
    representation_status_current: newStatus,
    current_attorney_name: attorneyName,
    current_firm_name: firmName,
    representation_transition_flag: transitioned,
    attorney_retained_during_negotiation_flag:
      ctx.attorney_retained_during_negotiation_flag || nowRepresented,
    representation_changes: [
      ...ctx.representation_changes,
      {
        event_type: eventType,
        previous_status: previousStatus,
        new_status: newStatus,
        attorney_name: attorneyName,
        firm_name: firmName,
        occurred_at: occurredAt,
        recorded_at: new Date().toISOString(),
      },
    ],
  };
}

// ─── Record Representation Event Mutation ───────────────

export function useRecordRepresentationEvent() {
  const qc = useQueryClient();
  const { user, tenantId } = useAuth();

  return useMutation({
    mutationFn: async ({
      sessionId,
      caseId,
      eventType,
      representationStatus,
      attorneyName,
      firmName,
      occurredAt,
      notes,
    }: {
      sessionId: string;
      caseId: string;
      eventType: NegotiationEventType;
      representationStatus: "represented" | "unrepresented" | "unknown";
      attorneyName: string | null;
      firmName: string | null;
      occurredAt: string;
      notes?: string;
    }) => {
      if (!user || !tenantId) throw new Error("Not authenticated");

      const summary = buildRepresentationEventSummary(eventType, representationStatus, attorneyName, firmName);

      await logNegotiationEvent({
        sessionId,
        caseId,
        tenantId,
        actorId: user.id,
        eventType,
        summary: notes ? `${summary} — ${notes}` : summary,
        afterValue: {
          representation_status: representationStatus,
          attorney_name: attorneyName,
          firm_name: firmName,
          occurred_at: occurredAt,
        },
        metadata: {
          is_representation_event: true,
          representation_status: representationStatus,
        },
      });
    },
    onSuccess: (_, { sessionId, caseId }) => {
      qc.invalidateQueries({ queryKey: ["negotiate-events", sessionId] });
      qc.invalidateQueries({ queryKey: ["negotiate-session", caseId] });
      toast.success("Representation change recorded");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Helpers ────────────────────────────────────────────

function buildRepresentationEventSummary(
  eventType: NegotiationEventType,
  status: string,
  attorneyName: string | null,
  firmName: string | null,
): string {
  switch (eventType) {
    case "attorney_retained":
      return `Attorney retained: ${attorneyName ?? "Unknown"}${firmName ? ` (${firmName})` : ""}`;
    case "attorney_substituted":
      return `Attorney substituted: ${attorneyName ?? "Unknown"}${firmName ? ` (${firmName})` : ""}`;
    case "attorney_withdrew":
      return "Attorney withdrew from representation";
    case "representation_confirmed_unrepresented":
      return "Claimant confirmed unrepresented";
    case "representation_status_recorded":
      return `Representation status recorded: ${status}`;
    default:
      return `Representation event: ${eventType}`;
  }
}

// ─── Determine if strategy refresh is needed ────────────

export function needsStrategyRefresh(
  ctx: NegotiateRepresentationContext,
  strategyRepresentationStatus: string | null,
): boolean {
  if (!strategyRepresentationStatus) return false;
  return ctx.representation_status_current !== strategyRepresentationStatus;
}
