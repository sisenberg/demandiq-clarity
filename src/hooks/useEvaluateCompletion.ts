/**
 * EvaluateIQ — Completion & Package Publication
 *
 * Handles the "Complete Evaluate" action:
 * 1. Validates required fields
 * 2. Assembles and freezes an EvaluatePackageV1
 * 3. Updates module status to completed
 * 4. Emits audit events
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import type { ExplanationLedger } from "@/types/explanation-ledger";
import type { EvaluatePackageV1, EvaluatePackagePublicationState } from "@/types/evaluate-package-v1";
import { assembleEvaluatePackageV1, type PackageAssemblyInput } from "@/lib/evaluatePackageAssembler";
import { validateEvaluatePackage, validatePublicationTransition } from "@/lib/evaluatePackageValidator";

// ─── Validation ──────────────────────────────────────

export interface EvalCompletionValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEvaluateCompletion(
  snapshot: EvaluateIntakeSnapshot | null,
  moduleStatus: string | undefined
): EvalCompletionValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!snapshot) {
    errors.push("No evaluation intake snapshot available.");
    return { valid: false, errors, warnings };
  }

  if (!moduleStatus || moduleStatus === "not_started") {
    errors.push("EvaluateIQ must be started before it can be completed.");
  }

  if (moduleStatus === "completed") {
    errors.push("EvaluateIQ is already completed. Reopen to make changes.");
  }

  const totalBilled = snapshot.medical_billing.reduce((s, b) => s + b.billed_amount, 0);
  if (totalBilled === 0) {
    warnings.push("Total billed amount is $0. Confirm this is intentional.");
  }

  if (!snapshot.injuries || snapshot.injuries.length === 0) {
    warnings.push("No injuries recorded. Range output may be limited.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Mutations ───────────────────────────────────────

export function useCompleteEvaluate() {
  const qc = useQueryClient();
  const { user, tenantId } = useAuth();

  return useMutation({
    mutationFn: async ({
      caseId,
      claimId,
      evaluationId,
      snapshot,
      sourceModule,
      sourceVersion,
      explanationLedger,
      snapshotId,
      valuationRunId,
      selectionId,
    }: {
      caseId: string;
      claimId?: string;
      evaluationId?: string;
      snapshot: EvaluateIntakeSnapshot;
      sourceModule: "demandiq" | "revieweriq";
      sourceVersion: number;
      explanationLedger: ExplanationLedger | null;
      snapshotId?: string | null;
      valuationRunId?: string | null;
      selectionId?: string | null;
    }) => {
      if (!user || !tenantId) throw new Error("Not authenticated");

      // 1. Determine version from existing packages
      const { data: existingPkgs } = await (supabase.from("evaluation_packages") as any)
        .select("version")
        .eq("case_id", caseId)
        .order("version", { ascending: false })
        .limit(1);
      const newVersion = existingPkgs && existingPkgs.length > 0
        ? existingPkgs[0].version + 1
        : 1;

      // 2. Assemble EvaluatePackageV1
      const assemblyInput: PackageAssemblyInput = {
        evaluationId: evaluationId ?? caseId,
        caseId,
        claimId: claimId ?? caseId,
        tenantId,
        snapshot,
        sourceModule,
        sourceVersion,
        snapshotId: snapshotId ?? null,
        valuationRunId: valuationRunId ?? null,
        selectionId: selectionId ?? null,
        explanationLedger,
        rangeFloor: null,
        rangeLikely: null,
        rangeStretch: null,
        confidence: null,
        selectedFloor: null,
        selectedLikely: null,
        selectedStretch: null,
        authorityRecommendation: null,
        rationaleNotes: "",
        packageVersion: newVersion,
        engineVersion: "1.0.0",
        scoringLogicVersion: "1.0.0",
        benchmarkLogicVersion: "1.0.0",
        userId: user.id,
      };

      const pkg = assembleEvaluatePackageV1(assemblyInput);

      // 3. Transition to accepted → published
      pkg.evaluation_status = "published";
      pkg.audit.accepted_by = user.id;
      pkg.audit.accepted_at = new Date().toISOString();
      pkg.audit.published_by = user.id;
      pkg.audit.published_at = new Date().toISOString();

      // 4. Validate before persisting
      const validation = validateEvaluatePackage(pkg);
      if (!validation.valid) {
        const errorMsgs = validation.findings
          .filter(f => f.severity === "error")
          .map(f => f.message);
        throw new Error(`Package validation failed: ${errorMsgs.join("; ")}`);
      }

      // 5. Insert evaluation_packages record (preserves prior versions)
      const { data: pkgData, error: pkgError } = await (supabase.from("evaluation_packages") as any)
        .insert({
          case_id: caseId,
          tenant_id: tenantId,
          version: newVersion,
          package_payload: pkg,
          snapshot_id: snapshotId ?? null,
          valuation_run_id: valuationRunId ?? null,
          selection_id: selectionId ?? null,
          completed_by: user.id,
          completed_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (pkgError) throw pkgError;

      // 6. Update module_completions to completed
      const { data: existing } = await supabase
        .from("module_completions")
        .select("id, version, status")
        .eq("case_id", caseId)
        .eq("module_id", "evaluateiq")
        .maybeSingle();

      if (existing) {
        const completionVersion = existing.status === "reopened"
          ? (existing.version ?? 1) + 1
          : (existing.version ?? 1);

        await supabase
          .from("module_completions")
          .update({
            status: "completed",
            version: completionVersion,
            completed_by: user.id,
            completed_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      }

      // 7. Update evaluation_cases status
      await (supabase.from("evaluation_cases") as any)
        .update({
          module_status: "completed",
          completed_by: user.id,
          completed_at: new Date().toISOString(),
        })
        .eq("case_id", caseId);

      // 8. Audit event
      await (supabase.from("audit_events") as any).insert({
        actor_user_id: user.id,
        tenant_id: tenantId,
        action_type: "evaluate_package_published",
        entity_type: "evaluation_package",
        entity_id: pkgData.id,
        case_id: caseId,
        after_value: {
          module_id: "evaluateiq",
          version: newVersion,
          contract_version: pkg.contract_version,
          source_module: sourceModule,
          source_version: sourceVersion,
          evaluation_status: pkg.evaluation_status,
        },
      });

      return { packageId: pkgData.id, version: newVersion };
    },
    onSuccess: (result, { caseId }) => {
      qc.invalidateQueries({ queryKey: ["module-completion"] });
      qc.invalidateQueries({ queryKey: ["evaluation-packages", caseId] });
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["dependency-states", caseId] });
      toast.success(`EvaluatePackage v${result.version} published`);
    },
    onError: (err: Error) => {
      toast.error(`Completion failed: ${err.message}`);
    },
  });
}

/** Reopen a completed EvaluateIQ module */
export function useReopenEvaluate() {
  const qc = useQueryClient();
  const { user, tenantId } = useAuth();

  return useMutation({
    mutationFn: async (caseId: string) => {
      if (!user || !tenantId) throw new Error("Not authenticated");

      await supabase
        .from("module_completions")
        .update({
          status: "reopened",
          reopened_by: user.id,
          reopened_at: new Date().toISOString(),
        })
        .eq("case_id", caseId)
        .eq("module_id", "evaluateiq");

      await (supabase.from("evaluation_cases") as any)
        .update({ module_status: "valuation_in_review" })
        .eq("case_id", caseId);

      await (supabase.from("audit_events") as any).insert({
        actor_user_id: user.id,
        tenant_id: tenantId,
        action_type: "evaluate_reopened",
        entity_type: "module_completion",
        entity_id: caseId,
        case_id: caseId,
        after_value: { module_id: "evaluateiq" },
      });
    },
    onSuccess: (_, caseId) => {
      qc.invalidateQueries({ queryKey: ["module-completion"] });
      qc.invalidateQueries({ queryKey: ["evaluation-packages", caseId] });
      qc.invalidateQueries({ queryKey: ["cases"] });
      toast.success("EvaluateIQ reopened for revision");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Note: useEvaluatePackages is exported from useEvaluatePublish.ts — do not duplicate here.
