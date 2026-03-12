import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useModuleCompletion } from "@/hooks/useModuleCompletion";
import { ModuleCompletionStatus } from "@/types";
import { EvaluateModuleState } from "@/types/evaluateiq";
import { toast } from "sonner";

/**
 * Maps the generic module_completions status to EvaluateIQ-specific states.
 * In the scaffold phase, we use module_completions as the backing store
 * and derive EvaluateIQ states from it.
 */
export function deriveEvaluateState(
  completionStatus: ModuleCompletionStatus | undefined
): EvaluateModuleState {
  switch (completionStatus) {
    case ModuleCompletionStatus.InProgress:
      return EvaluateModuleState.IntakeInProgress;
    case ModuleCompletionStatus.Completed:
      return EvaluateModuleState.Completed;
    case ModuleCompletionStatus.Reopened:
      return EvaluateModuleState.IntakeInProgress;
    default:
      return EvaluateModuleState.NotStarted;
  }
}

/** Start EvaluateIQ for a case — creates/updates module_completions record */
export function useStartEvaluate() {
  const { user, tenantId } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (caseId: string) => {
      if (!user || !tenantId) throw new Error("Not authenticated");

      // Check for existing record
      const { data: existing } = await supabase
        .from("module_completions")
        .select("id, status")
        .eq("case_id", caseId)
        .eq("module_id", "evaluateiq")
        .maybeSingle();

      if (existing) {
        // Resume — update to in_progress if not_started
        if (existing.status === "not_started") {
          const { error } = await supabase
            .from("module_completions")
            .update({ status: "in_progress", updated_at: new Date().toISOString() })
            .eq("id", existing.id);
          if (error) throw error;
        }
      } else {
        // Create new
        const { error } = await supabase
          .from("module_completions")
          .insert({
            case_id: caseId,
            tenant_id: tenantId,
            module_id: "evaluateiq",
            status: "in_progress",
          });
        if (error) throw error;
      }

      // Audit event
      await (supabase.from("audit_events") as any).insert({
        actor_user_id: user.id,
        tenant_id: tenantId,
        action_type: "evaluate_started",
        entity_type: "module_completion",
        entity_id: caseId,
        case_id: caseId,
        after_value: { module_id: "evaluateiq", status: "in_progress" },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["module-completion"] });
      toast.success("EvaluateIQ started");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
