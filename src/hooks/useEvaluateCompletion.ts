/**
 * EvaluateIQ — Completion & Package Publication
 *
 * Handles the "Complete Evaluate" action:
 * 1. Validates required fields
 * 2. Assembles and freezes an EvaluatePackage
 * 3. Updates module status to completed
 * 4. Emits audit events
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { EvaluatePackagePayload } from "@/types/evaluate-persistence";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import type { ExplanationLedger } from "@/types/explanation-ledger";

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

  // Check medical billing totals
  const totalBilled = snapshot.medical_billing.reduce((s, b) => s + b.billed_amount, 0);
  if (totalBilled === 0) {
    warnings.push("Total billed amount is $0. Confirm this is intentional.");
  }

  // Check injury data
  if (!snapshot.injuries || snapshot.injuries.length === 0) {
    warnings.push("No injuries recorded. Range output may be limited.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Package Assembly ────────────────────────────────

interface PackageAssemblyInput {
  snapshot: EvaluateIntakeSnapshot;
  sourceModule: "demandiq" | "revieweriq";
  sourceVersion: number;
  explanationLedger: ExplanationLedger | null;
}

function assembleEvaluatePackage(input: PackageAssemblyInput): EvaluatePackagePayload {
  const { snapshot, sourceModule, sourceVersion, explanationLedger } = input;

  // Derive expanders/reducers from ledger
  const driverSummaries = (explanationLedger?.entries ?? [])
    .filter((e) => (e.magnitude.value ?? 0) >= 0.3 || e.direction !== "neutral")
    .map((e) => ({
      key: e.driver_key ?? e.entry_key,
      label: e.title,
      impact: e.direction === "increase" ? "expander" as const
        : e.direction === "decrease" ? "reducer" as const
        : "neutral" as const,
      description: e.narrative,
    }));

  return {
    package_version: 1,
    engine_version: "1.0.0",
    source_module: sourceModule,
    source_package_version: sourceVersion,

    // Range outputs (placeholder — will come from valuation_runs when live)
    range_floor: null,
    range_likely: null,
    range_stretch: null,
    confidence: null,

    // Selected working range (placeholder — will come from valuation_selections)
    selected_floor: null,
    selected_likely: null,
    selected_stretch: null,
    authority_recommendation: null,
    rationale_notes: "",

    driver_summaries: driverSummaries,
    explanation_ledger: explanationLedger,

    assumptions: [],

    total_billed: snapshot.medical_billing.reduce((s, b) => s + b.billed_amount, 0),
    total_reviewed: snapshot.medical_billing.reduce((s, b) => s + (b.reviewer_recommended_amount ?? b.billed_amount), 0),

    completeness_score: snapshot.overall_completeness_score ?? 0,
  };
}

// ─── Mutations ───────────────────────────────────────

export function useCompleteEvaluate() {
  const qc = useQueryClient();
  const { user, tenantId } = useAuth();

  return useMutation({
    mutationFn: async ({
      caseId,
      snapshot,
      sourceModule,
      sourceVersion,
      explanationLedger,
    }: {
      caseId: string;
      snapshot: EvaluateIntakeSnapshot;
      sourceModule: "demandiq" | "revieweriq";
      sourceVersion: number;
      explanationLedger: ExplanationLedger | null;
    }) => {
      if (!user || !tenantId) throw new Error("Not authenticated");

      // 1. Assemble package payload
      const payload = assembleEvaluatePackage({
        snapshot,
        sourceModule,
        sourceVersion,
        explanationLedger,
      });

      // 2. Determine version from existing packages
      const { data: existingPkgs } = await (supabase.from("evaluation_packages") as any)
        .select("version")
        .eq("case_id", caseId)
        .order("version", { ascending: false })
        .limit(1);
      const newVersion = existingPkgs && existingPkgs.length > 0
        ? existingPkgs[0].version + 1
        : 1;

      payload.package_version = newVersion;

      // 3. Insert evaluation_packages record
      const { data: pkgData, error: pkgError } = await (supabase.from("evaluation_packages") as any)
        .insert({
          case_id: caseId,
          tenant_id: tenantId,
          version: newVersion,
          package_payload: payload,
          completed_by: user.id,
          completed_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (pkgError) throw pkgError;

      // 4. Update module_completions to completed
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

      // 5. Update evaluation_cases status
      await (supabase.from("evaluation_cases") as any)
        .update({
          module_status: "completed",
          completed_by: user.id,
          completed_at: new Date().toISOString(),
        })
        .eq("case_id", caseId);

      // 6. Audit event
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
          source_module: sourceModule,
          source_version: sourceVersion,
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

/** Fetch published packages for a case */
export function useEvaluatePackages(caseId: string | undefined) {
  return {
    queryKey: ["evaluation-packages", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("evaluation_packages") as any)
        .select("*")
        .eq("case_id", caseId!)
        .order("version", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  };
}
