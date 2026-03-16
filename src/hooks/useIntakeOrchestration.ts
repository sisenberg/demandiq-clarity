import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ── Intake progress per document ──

export interface IntakeJobProgress {
  documentId: string;
  jobType: string;
  status: string;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

export function useIntakeProgress(caseId: string | undefined) {
  return useQuery({
    queryKey: ["intake-progress", caseId],
    enabled: !!caseId,
    refetchInterval: (query) => {
      const jobs = query.state.data as IntakeJobProgress[] | undefined;
      if (jobs?.some((j) => j.status === "queued" || j.status === "running")) {
        return 3000;
      }
      return false;
    },
    queryFn: async () => {
      const { data, error } = await (supabase.from("intake_jobs") as any)
        .select("document_id, job_type, status, error_message, started_at, completed_at")
        .eq("case_id", caseId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((j: any) => ({
        documentId: j.document_id,
        jobType: j.job_type,
        status: j.status,
        errorMessage: j.error_message,
        startedAt: j.started_at,
        completedAt: j.completed_at,
      })) as IntakeJobProgress[];
    },
  });
}

// ── Re-trigger orchestration for a specific document ──

export function useRetriggerOrchestration() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      caseId,
      tenantId,
    }: {
      documentId: string;
      caseId: string;
      tenantId: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("orchestrate-intake", {
        body: { document_id: documentId, case_id: caseId, tenant_id: tenantId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { caseId }) => {
      qc.invalidateQueries({ queryKey: ["intake-progress", caseId] });
      qc.invalidateQueries({ queryKey: ["intake-jobs", caseId] });
      qc.invalidateQueries({ queryKey: ["demands"] });
      qc.invalidateQueries({ queryKey: ["case-detail"] });
      toast.success("Orchestration re-triggered");
    },
    onError: (e) => toast.error(`Orchestration failed: ${(e as Error).message}`),
  });
}

// ── Auto-assemble package ──

export function useAutoAssemblePackage() {
  const qc = useQueryClient();
  const { tenantId } = useAuth();

  return useMutation({
    mutationFn: async ({ caseId }: { caseId: string }) => {
      if (!tenantId) throw new Error("Not authenticated");
      const { data, error } = await supabase.functions.invoke("publish-intake-package", {
        body: { case_id: caseId, tenant_id: tenantId, action: "assemble" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { caseId }) => {
      qc.invalidateQueries({ queryKey: ["intake-progress", caseId] });
      qc.invalidateQueries({ queryKey: ["demand-package"] });
      toast.success("Intake package assembled");
    },
    onError: (e) => toast.error(`Package assembly failed: ${(e as Error).message}`),
  });
}

// ── Computed helpers ──

export function computeExtractionSummary(jobs: IntakeJobProgress[]) {
  const byType: Record<string, { status: string; error?: string | null }> = {};
  for (const j of jobs) {
    // Keep the most recent status per job type
    if (!byType[j.jobType] || j.status !== "queued") {
      byType[j.jobType] = { status: j.status, error: j.errorMessage };
    }
  }
  return byType;
}
