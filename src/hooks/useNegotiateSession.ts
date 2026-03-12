/**
 * NegotiateIQ — Session & event persistence hooks
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type {
  NegotiationSessionRow,
  NegotiationSessionStatus,
  NegotiationEventType,
  NegotiationRoundRow,
  NegotiationEventRow,
  NegotiationNoteRow,
  VALID_STATUS_TRANSITIONS,
} from "@/types/negotiate-persistence";
import { VALID_STATUS_TRANSITIONS as transitions } from "@/types/negotiate-persistence";

const T = (name: string) => supabase.from(name as any) as any;

// ─── Session ────────────────────────────────────────────

export function useNegotiateSession(caseId: string | undefined) {
  return useQuery<NegotiationSessionRow | null>({
    queryKey: ["negotiate-session", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await T("negotiation_sessions")
        .select("*")
        .eq("case_id", caseId!)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
}

export function useCreateNegotiateSession() {
  const qc = useQueryClient();
  const { user, tenantId } = useAuth();

  return useMutation({
    mutationFn: async ({
      caseId,
      evalPackageId,
      evalPackageVersion,
    }: {
      caseId: string;
      evalPackageId: string;
      evalPackageVersion: number;
    }) => {
      if (!user || !tenantId) throw new Error("Not authenticated");
      const { data, error } = await T("negotiation_sessions")
        .insert({
          case_id: caseId,
          tenant_id: tenantId,
          eval_package_id: evalPackageId,
          eval_package_version: evalPackageVersion,
          status: "not_started",
          started_by: user.id,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;

      await logNegotiationEvent({
        sessionId: data.id,
        caseId,
        tenantId,
        actorId: user.id,
        eventType: "status_changed",
        summary: "Session created",
        afterValue: { status: "not_started" },
      });

      return data as { id: string };
    },
    onSuccess: (_, { caseId }) => {
      qc.invalidateQueries({ queryKey: ["negotiate-session", caseId] });
      toast.success("Negotiation session created");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateSessionStatus() {
  const qc = useQueryClient();
  const { user, tenantId } = useAuth();

  return useMutation({
    mutationFn: async ({
      sessionId,
      caseId,
      currentStatus,
      newStatus,
      reason,
    }: {
      sessionId: string;
      caseId: string;
      currentStatus: NegotiationSessionStatus;
      newStatus: NegotiationSessionStatus;
      reason?: string;
    }) => {
      if (!user || !tenantId) throw new Error("Not authenticated");

      const valid = transitions[currentStatus];
      if (!valid.includes(newStatus)) {
        throw new Error(`Invalid transition: ${currentStatus} → ${newStatus}`);
      }

      const updates: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === "settled" || newStatus === "closed_no_settlement" || newStatus === "transferred_to_litiq_candidate") {
        updates.completed_at = new Date().toISOString();
        updates.completed_by = user.id;
      }

      const { error } = await T("negotiation_sessions")
        .update(updates)
        .eq("id", sessionId);
      if (error) throw error;

      await logNegotiationEvent({
        sessionId,
        caseId,
        tenantId,
        actorId: user.id,
        eventType: "status_changed",
        summary: reason ?? `Status changed to ${newStatus}`,
        beforeValue: { status: currentStatus },
        afterValue: { status: newStatus },
      });
    },
    onSuccess: (_, { caseId }) => {
      qc.invalidateQueries({ queryKey: ["negotiate-session", caseId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Rounds ─────────────────────────────────────────────

export function useNegotiationRounds(sessionId: string | undefined) {
  return useQuery<NegotiationRoundRow[]>({
    queryKey: ["negotiate-rounds", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await T("negotiation_rounds")
        .select("*")
        .eq("session_id", sessionId!)
        .order("round_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as NegotiationRoundRow[];
    },
  });
}

// ─── Events (timeline) ─────────────────────────────────

export function useNegotiationEvents(sessionId: string | undefined) {
  return useQuery<NegotiationEventRow[]>({
    queryKey: ["negotiate-events", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await T("negotiation_events")
        .select("*")
        .eq("session_id", sessionId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as NegotiationEventRow[];
    },
  });
}

// ─── Notes ──────────────────────────────────────────────

export function useNegotiationNotes(sessionId: string | undefined) {
  return useQuery<NegotiationNoteRow[]>({
    queryKey: ["negotiate-notes", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await T("negotiation_notes")
        .select("*")
        .eq("session_id", sessionId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as NegotiationNoteRow[];
    },
  });
}

export function useAddNegotiationNote() {
  const qc = useQueryClient();
  const { user, tenantId } = useAuth();

  return useMutation({
    mutationFn: async ({
      sessionId,
      caseId,
      content,
      noteType,
      roundId,
    }: {
      sessionId: string;
      caseId: string;
      content: string;
      noteType?: string;
      roundId?: string;
    }) => {
      if (!user || !tenantId) throw new Error("Not authenticated");
      const { data, error } = await T("negotiation_notes")
        .insert({
          session_id: sessionId,
          case_id: caseId,
          tenant_id: tenantId,
          author_id: user.id,
          content,
          note_type: noteType ?? "general",
          round_id: roundId ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      await logNegotiationEvent({
        sessionId,
        caseId,
        tenantId,
        actorId: user.id,
        eventType: "note_added",
        summary: `Note added: ${content.slice(0, 80)}`,
        roundId,
      });

      return data as { id: string };
    },
    onSuccess: (_, { sessionId }) => {
      qc.invalidateQueries({ queryKey: ["negotiate-notes", sessionId] });
      qc.invalidateQueries({ queryKey: ["negotiate-events", sessionId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Shared Event Logger ────────────────────────────────

async function logNegotiationEvent({
  sessionId,
  caseId,
  tenantId,
  actorId,
  eventType,
  summary,
  beforeValue,
  afterValue,
  roundId,
  metadata,
}: {
  sessionId: string;
  caseId: string;
  tenantId: string;
  actorId: string;
  eventType: NegotiationEventType;
  summary: string;
  beforeValue?: Record<string, unknown>;
  afterValue?: Record<string, unknown>;
  roundId?: string;
  metadata?: Record<string, unknown>;
}) {
  // Write to negotiation_events
  await T("negotiation_events").insert({
    session_id: sessionId,
    case_id: caseId,
    tenant_id: tenantId,
    actor_user_id: actorId,
    event_type: eventType,
    summary,
    before_value: beforeValue ?? null,
    after_value: afterValue ?? null,
    round_id: roundId ?? null,
    metadata: metadata ?? {},
  });

  // Mirror to platform audit_events
  await (supabase.from("audit_events") as any).insert({
    actor_user_id: actorId,
    tenant_id: tenantId,
    action_type: `negotiate_${eventType}`,
    entity_type: "negotiation_session",
    entity_id: sessionId,
    case_id: caseId,
    before_value: beforeValue ?? null,
    after_value: afterValue ?? null,
  });
}

export { logNegotiationEvent };
