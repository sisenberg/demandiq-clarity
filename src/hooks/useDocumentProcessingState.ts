/**
 * Hooks for document processing state machine:
 * - State transition history
 * - Processing runs with structured errors
 * - Reprocess action (creates new run, doesn't overwrite history)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { ProcessingRun, StateTransition } from "@/lib/documentStateMachine";
import {
  createProcessingRun,
  transitionDocumentState,
} from "@/lib/documentStateMachine";

// ═══════════════════════════════════════════════════════
// State transition history (append-only audit log)
// ═══════════════════════════════════════════════════════

export function useDocumentStateHistory(documentId: string | undefined) {
  return useQuery({
    queryKey: ["document-state-transitions", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("document_state_transitions") as any)
        .select("*")
        .eq("document_id", documentId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as StateTransition[];
    },
  });
}

// ═══════════════════════════════════════════════════════
// Processing runs (grouped job executions)
// ═══════════════════════════════════════════════════════

export function useDocumentProcessingRuns(documentId: string | undefined) {
  return useQuery({
    queryKey: ["document-processing-runs", documentId],
    enabled: !!documentId,
    refetchInterval: (query) => {
      const runs = query.state.data as ProcessingRun[] | undefined;
      if (runs?.some((r) => r.run_status === "queued" || r.run_status === "running")) {
        return 4000;
      }
      return false;
    },
    queryFn: async () => {
      const { data, error } = await (supabase.from("document_processing_runs") as any)
        .select("*")
        .eq("document_id", documentId!)
        .order("run_number", { ascending: false });
      if (error) throw error;
      return data as ProcessingRun[];
    },
  });
}

// ═══════════════════════════════════════════════════════
// Reprocess document — creates a NEW run, preserves history
// ═══════════════════════════════════════════════════════

export function useReprocessDocument() {
  const queryClient = useQueryClient();
  const { tenantId, user } = useAuth();

  return useMutation({
    mutationFn: async ({
      documentId,
      caseId,
      currentStage,
    }: {
      documentId: string;
      caseId: string;
      currentStage: string;
    }) => {
      if (!tenantId || !user) throw new Error("Not authenticated");

      // 1. Create a new processing run
      const run = await createProcessingRun({
        documentId,
        caseId,
        tenantId,
        triggeredBy: user.id,
        triggerReason: "reprocess",
      });

      // 2. Log transition from current state back to queued
      await transitionDocumentState({
        documentId,
        tenantId,
        fromStatus: currentStage,
        toStatus: "queued",
        triggeredBy: user.id,
        processingRunId: run.id,
        metadata: { reason: "reprocess" },
      });

      // 3. Reset document statuses for reprocessing
      await (supabase.from("case_documents") as any)
        .update({
          pipeline_stage: "upload_received",
          intake_status: "uploaded",
          document_status: "queued",
        })
        .eq("id", documentId);

      // 4. Enqueue new intake jobs linked to this run
      await (supabase.from("intake_jobs") as any).insert([
        {
          tenant_id: tenantId,
          case_id: caseId,
          document_id: documentId,
          job_type: "text_extraction",
          status: "queued",
          processing_run_id: run.id,
        },
        {
          tenant_id: tenantId,
          case_id: caseId,
          document_id: documentId,
          job_type: "duplicate_detection",
          status: "queued",
          processing_run_id: run.id,
        },
      ]);

      return run;
    },
    onSuccess: (_, { caseId }) => {
      queryClient.invalidateQueries({ queryKey: ["document-processing-runs"] });
      queryClient.invalidateQueries({ queryKey: ["document-state-transitions"] });
      queryClient.invalidateQueries({ queryKey: ["case-documents", caseId] });
      queryClient.invalidateQueries({ queryKey: ["intake-jobs", caseId] });
      toast.success("Document queued for reprocessing (new run created)");
    },
    onError: (err) => {
      toast.error(`Reprocess failed: ${(err as Error).message}`);
    },
  });
}
