import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface IntakeEvaluationPackageRow {
  id: string;
  tenant_id: string;
  case_id: string;
  active_demand_id: string | null;
  version: number;
  package_status: string;
  claimant_name: string;
  represented_status: string;
  attorney_name: string;
  law_firm: string;
  demand_amount: number | null;
  demand_deadline: string | null;
  specials_summary: Record<string, unknown>;
  provider_list: Array<{ party_id: string | null; name: string; organization: string; role: string }>;
  treatment_summary: Record<string, unknown>;
  injury_summary: Array<Record<string, unknown>>;
  objective_support_flags: Array<{ injury_id: string; body_part: string; detail: string }>;
  invasive_treatment_flags: Array<{ injury_id: string; body_part: string; detail: string }>;
  residual_symptom_flags: Array<{ injury_id: string; body_part: string; detail: string }>;
  functional_impact_flags: Array<{ injury_id: string; body_part: string; detail: string }>;
  missing_data_flags: Array<{ field: string; message: string }>;
  package_payload: Record<string, unknown>;
  assembled_at: string | null;
  assembled_by: string | null;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
}

export const PACKAGE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  ready_for_review: "Ready for Review",
  published_to_evaluateiq: "Published to EvaluateIQ",
};

export const PACKAGE_STATUS_COLOR: Record<string, string> = {
  draft: "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))] border-[hsl(var(--status-attention))]/20",
  ready_for_review: "bg-primary/10 text-primary border-primary/20",
  published_to_evaluateiq: "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))] border-[hsl(var(--status-approved))]/20",
};

/** Fetch latest intake evaluation package for a case */
export function useIntakeEvaluationPackage(caseId: string | undefined) {
  return useQuery({
    queryKey: ["intake-evaluation-package", caseId],
    enabled: !!caseId,
    refetchInterval: (query) => {
      const pkg = query.state.data as IntakeEvaluationPackageRow | null | undefined;
      if (pkg && pkg.package_status !== "published_to_evaluateiq") {
        return 5000;
      }
      return false;
    },
    queryFn: async () => {
      const { data, error } = await (supabase.from("intake_evaluation_packages") as any)
        .select("*")
        .eq("case_id", caseId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as IntakeEvaluationPackageRow | null;
    },
  });
}

/** Fetch all versions for a case */
export function useIntakeEvaluationPackageHistory(caseId: string | undefined) {
  return useQuery({
    queryKey: ["intake-evaluation-package-history", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("intake_evaluation_packages") as any)
        .select("id, version, package_status, assembled_at, published_at, created_at")
        .eq("case_id", caseId)
        .order("version", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<Pick<IntakeEvaluationPackageRow, "id" | "version" | "package_status" | "assembled_at" | "published_at" | "created_at">>;
    },
  });
}

/** Assemble (draft/review) the intake package */
export function useAssembleIntakePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ caseId, tenantId, userId }: { caseId: string; tenantId: string; userId: string }) => {
      const { data, error } = await supabase.functions.invoke("publish-intake-package", {
        body: { case_id: caseId, tenant_id: tenantId, user_id: userId, action: "assemble" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["intake-evaluation-package"] });
      qc.invalidateQueries({ queryKey: ["intake-evaluation-package-history"] });
      toast.success(`Intake package assembled (v${data?.version ?? "?"}) — Status: ${PACKAGE_STATUS_LABEL[data?.status] ?? data?.status}`);
    },
    onError: (e) => toast.error(`Assembly failed: ${(e as Error).message}`),
  });
}

/** Publish the intake package to EvaluateIQ */
export function usePublishIntakePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ caseId, tenantId, userId }: { caseId: string; tenantId: string; userId: string }) => {
      const { data, error } = await supabase.functions.invoke("publish-intake-package", {
        body: { case_id: caseId, tenant_id: tenantId, user_id: userId, action: "publish" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["intake-evaluation-package"] });
      qc.invalidateQueries({ queryKey: ["intake-evaluation-package-history"] });
      toast.success(`Published to EvaluateIQ (v${data?.version ?? "?"})`);
    },
    onError: (e) => toast.error(`Publish failed: ${(e as Error).message}`),
  });
}
