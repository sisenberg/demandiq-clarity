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
  completionStatus: ModuleCompletionStatus | undefined,
  evaluationCaseStatus?: string | null,
): EvaluateModuleState {
  // If we have a fine-grained evaluation_cases status, prefer it
  if (evaluationCaseStatus) {
    switch (evaluationCaseStatus) {
      case "intake_in_progress": return EvaluateModuleState.IntakeInProgress;
      case "valuation_ready": return EvaluateModuleState.ValuationReady;
      case "valuation_in_review": return EvaluateModuleState.ValuationInReview;
      case "provisional": return EvaluateModuleState.ProvisionalEvaluation;
      case "valued": return EvaluateModuleState.Valued;
      case "completed": return EvaluateModuleState.Completed;
      case "published": return EvaluateModuleState.Published;
    }
  }

  // Fallback to module_completions status
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

/** Start EvaluateIQ for a case — creates/updates module_completions record.
 *  Pre-flight: verifies a published DemandPackage exists and stores the
 *  source package reference in the evaluation_cases record.
 */
export function useStartEvaluate() {
  const { user, tenantId } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      caseId,
      demandPackageId,
      demandPackageVersion,
    }: {
      caseId: string;
      demandPackageId?: string | null;
      demandPackageVersion?: number | null;
    }) => {
      if (!user || !tenantId) throw new Error("Not authenticated");

      // Pre-flight: verify published DemandPackage exists
      const { data: publishedPkg } = await (supabase
        .from("intake_evaluation_packages") as any)
        .select("id, version")
        .eq("case_id", caseId)
        .eq("package_status", "published_to_evaluateiq")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      const pkgId = demandPackageId ?? publishedPkg?.id ?? null;
      const pkgVersion = demandPackageVersion ?? publishedPkg?.version ?? null;

      if (!pkgId) {
        throw new Error("Cannot start EvaluateIQ: no published DemandPackage found for this case.");
      }

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

      const { error: evaluationCaseError } = await (supabase.rpc("ensure_evaluation_case", {
        _case_id: caseId,
      }) as any);
      if (evaluationCaseError) throw evaluationCaseError;

      // Store source DemandPackage reference on evaluation_cases
      await (supabase.from("evaluation_cases") as any)
        .update({
          source_demand_package_id: pkgId,
          source_demand_package_version: pkgVersion,
          updated_at: new Date().toISOString(),
        })
        .eq("case_id", caseId)
        .eq("tenant_id", tenantId);

      // Audit event
      await (supabase.from("audit_events") as any).insert({
        actor_user_id: user.id,
        tenant_id: tenantId,
        action_type: "evaluate_started",
        entity_type: "module_completion",
        entity_id: caseId,
        case_id: caseId,
        after_value: {
          module_id: "evaluateiq",
          status: "in_progress",
          source_demand_package_id: pkgId,
          source_demand_package_version: pkgVersion,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["module-completion"] });
      qc.invalidateQueries({ queryKey: ["demand-package"] });
      toast.success("EvaluateIQ started");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
