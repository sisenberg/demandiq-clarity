import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { ModuleCompletion, ModuleCompletionSnapshot } from "@/types";
import { ModuleCompletionStatus, DependencyStatus } from "@/types";

// ─── Queries ─────────────────────────────────────

/** Fetch the module completion record for a specific case + module */
export function useModuleCompletion(caseId: string | undefined, moduleId: string) {
  return useQuery({
    queryKey: ["module-completion", caseId, moduleId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("module_completions") as any)
        .select("*")
        .eq("case_id", caseId!)
        .eq("module_id", moduleId)
        .maybeSingle();
      if (error) throw error;
      return (data as ModuleCompletion) ?? null;
    },
  });
}

/** Fetch all completion snapshots for a case + module */
export function useModuleSnapshots(caseId: string | undefined, moduleId: string) {
  return useQuery({
    queryKey: ["module-snapshots", caseId, moduleId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("module_completion_snapshots") as any)
        .select("*")
        .eq("case_id", caseId!)
        .eq("module_id", moduleId)
        .order("version", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ModuleCompletionSnapshot[];
    },
  });
}

// ─── Validation ──────────────────────────────────

export interface CompletionValidation {
  valid: boolean;
  errors: string[];
}

/** Validate minimum requirements to complete DemandIQ */
export function validateDemandCompletion(
  documents: { document_status: string }[],
  caseStatus: string
): CompletionValidation {
  const errors: string[] = [];

  if (caseStatus !== "complete") {
    errors.push("Case must be in Complete status before completing the demand.");
  }

  if (documents.length === 0) {
    errors.push("At least one document is required.");
  }

  const extractedDocs = documents.filter(
    (d) => d.document_status === "complete" || d.document_status === "extracted"
  );
  if (documents.length > 0 && extractedDocs.length === 0) {
    errors.push("At least one document must be fully processed.");
  }

  return { valid: errors.length === 0, errors };
}

// ─── Mutations ───────────────────────────────────

/** Complete a module: upsert completion record, create snapshot, write audit event */
export function useCompleteModule() {
  const qc = useQueryClient();
  const { user, tenantId } = useAuth();

  return useMutation({
    mutationFn: async ({
      caseId,
      moduleId,
      snapshotData,
    }: {
      caseId: string;
      moduleId: string;
      snapshotData: Record<string, unknown>;
    }) => {
      if (!user || !tenantId) throw new Error("Not authenticated");

      // 1. Upsert module_completions (increment version if reopened→completed)
      const { data: existing } = await (supabase.from("module_completions") as any)
        .select("id, version, status")
        .eq("case_id", caseId)
        .eq("module_id", moduleId)
        .maybeSingle();

      let completionId: string;
      let newVersion: number;

      if (existing) {
        newVersion = existing.status === ModuleCompletionStatus.Reopened
          ? existing.version + 1
          : existing.version;

        const { error } = await (supabase.from("module_completions") as any)
          .update({
            status: "completed",
            version: newVersion,
            completed_by: user.id,
            completed_at: new Date().toISOString(),
            reopened_by: null,
            reopened_at: null,
          })
          .eq("id", existing.id);
        if (error) throw error;
        completionId = existing.id;
      } else {
        newVersion = 1;
        const { data: inserted, error } = await (supabase.from("module_completions") as any)
          .insert({
            tenant_id: tenantId,
            case_id: caseId,
            module_id: moduleId,
            status: "completed",
            version: 1,
            completed_by: user.id,
            completed_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (error) throw error;
        completionId = inserted.id;
      }

      // 2. Create versioned snapshot
      const { data: snapData, error: snapError } = await (supabase.from("module_completion_snapshots") as any)
        .insert({
          tenant_id: tenantId,
          case_id: caseId,
          module_id: moduleId,
          completion_id: completionId,
          version: newVersion,
          snapshot_json: snapshotData,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (snapError) throw snapError;

      // 3. Sync all downstream dependency states to "current" with this snapshot
      const { data: deps } = await (supabase.from("module_dependencies") as any)
        .select("downstream_module_id")
        .eq("upstream_module_id", moduleId);
      const downstreamIds = (deps ?? []).map((d: any) => d.downstream_module_id);
      for (const dsId of downstreamIds) {
        await (supabase.from("module_dependency_state") as any)
          .upsert(
            {
              tenant_id: tenantId,
              case_id: caseId,
              downstream_module_id: dsId,
              upstream_module_id: moduleId,
              dependency_status: DependencyStatus.Current,
              upstream_snapshot_id: snapData.id,
              upstream_snapshot_version: newVersion,
              last_synced_at: new Date().toISOString(),
              stale_since: null,
            },
            { onConflict: "case_id,downstream_module_id,upstream_module_id" }
          );
      }

      // 4. Write audit event
      const { error: auditError } = await (supabase.from("audit_events") as any)
        .insert({
          tenant_id: tenantId,
          case_id: caseId,
          actor_user_id: user.id,
          entity_type: "module_completion",
          entity_id: completionId,
          action_type: "module_completed",
          after_value: { module_id: moduleId, version: newVersion },
        });
      if (auditError) console.error("Audit write failed:", auditError);

      return { completionId, version: newVersion };
    },
    onSuccess: (_, { caseId, moduleId }) => {
      qc.invalidateQueries({ queryKey: ["module-completion", caseId, moduleId] });
      qc.invalidateQueries({ queryKey: ["module-snapshots", caseId, moduleId] });
      qc.invalidateQueries({ queryKey: ["cases", caseId] });
      qc.invalidateQueries({ queryKey: ["cases"] });
      toast.success("Module completed successfully");
    },
    onError: (err: Error) => {
      toast.error(`Completion failed: ${err.message}`);
    },
  });
}

/** Reopen a completed module */
export function useReopenModule() {
  const qc = useQueryClient();
  const { user, tenantId } = useAuth();

  return useMutation({
    mutationFn: async ({
      caseId,
      moduleId,
    }: {
      caseId: string;
      moduleId: string;
    }) => {
      if (!user || !tenantId) throw new Error("Not authenticated");

      const { error } = await (supabase.from("module_completions") as any)
        .update({
          status: "reopened",
          reopened_by: user.id,
          reopened_at: new Date().toISOString(),
        })
        .eq("case_id", caseId)
        .eq("module_id", moduleId);
      if (error) throw error;

      // Audit event
      await (supabase.from("audit_events") as any).insert({
        tenant_id: tenantId,
        case_id: caseId,
        actor_user_id: user.id,
        entity_type: "module_completion",
        entity_id: moduleId,
        action_type: "module_reopened",
        after_value: { module_id: moduleId },
      });
    },
    onSuccess: (_, { caseId, moduleId }) => {
      qc.invalidateQueries({ queryKey: ["module-completion", caseId, moduleId] });
      qc.invalidateQueries({ queryKey: ["cases", caseId] });
      qc.invalidateQueries({ queryKey: ["cases"] });
      toast.success("Module reopened");
    },
    onError: (err: Error) => {
      toast.error(`Reopen failed: ${err.message}`);
    },
  });
}

// ─── Module label helpers ────────────────────────

export const MODULE_COMPLETION_LABELS: Record<string, { action: string; noun: string }> = {
  demandiq: { action: "Complete Demand", noun: "DemandIQ" },
  revieweriq: { action: "Complete Reviewer", noun: "ReviewerIQ" },
  evaluateiq: { action: "Complete Evaluation", noun: "EvaluateIQ" },
  negotiateiq: { action: "Complete Negotiation", noun: "NegotiateIQ" },
  litiq: { action: "Complete Litigation", noun: "LitIQ" },
};

export const COMPLETION_STATUS_LABEL: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
  reopened: "Reopened",
};

export const COMPLETION_STATUS_BADGE: Record<string, string> = {
  not_started: "status-badge-draft",
  in_progress: "status-badge-processing",
  completed: "status-badge-approved",
  reopened: "status-badge-attention",
};
