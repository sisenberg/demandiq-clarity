/**
 * NegotiateIQ — Strategy persistence hook
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { GeneratedStrategy, StrategyOverride } from "@/types/negotiate-strategy";

export interface StrategyRow {
  id: string;
  case_id: string;
  tenant_id: string;
  eval_package_id: string;
  eval_package_version: number;
  generated_strategy: GeneratedStrategy;
  overrides: StrategyOverride[];
  version: number;
  created_at: string;
  created_by: string | null;
}

export function useNegotiateStrategy(caseId: string | undefined) {
  return useQuery<StrategyRow | null>({
    queryKey: ["negotiate-strategy", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("negotiate_strategies" as any) as any)
        .select("*")
        .eq("case_id", caseId!)
        .order("version", { ascending: false })
        .limit(1);
      if (error) throw error;
      if (!data || data.length === 0) return null;
      return data[0] as StrategyRow;
    },
  });
}

export function useSaveNegotiateStrategy() {
  const qc = useQueryClient();
  const { user, tenantId } = useAuth();

  return useMutation({
    mutationFn: async ({
      caseId,
      evalPackageId,
      evalPackageVersion,
      generated,
      overrides,
    }: {
      caseId: string;
      evalPackageId: string;
      evalPackageVersion: number;
      generated: GeneratedStrategy;
      overrides: StrategyOverride[];
    }) => {
      if (!user || !tenantId) throw new Error("Not authenticated");

      // Get next version
      const { data: existing } = await (supabase.from("negotiate_strategies" as any) as any)
        .select("version")
        .eq("case_id", caseId)
        .order("version", { ascending: false })
        .limit(1);
      const nextVersion = existing && existing.length > 0 ? existing[0].version + 1 : 1;

      const { data, error } = await (supabase.from("negotiate_strategies") as any)
        .insert({
          case_id: caseId,
          tenant_id: tenantId,
          eval_package_id: evalPackageId,
          eval_package_version: evalPackageVersion,
          generated_strategy: generated,
          overrides,
          version: nextVersion,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Audit
      await (supabase.from("audit_events") as any).insert({
        actor_user_id: user.id,
        tenant_id: tenantId,
        action_type: "negotiate_strategy_saved",
        entity_type: "negotiate_strategy",
        entity_id: data.id,
        case_id: caseId,
        after_value: {
          version: nextVersion,
          eval_package_version: evalPackageVersion,
          override_count: overrides.length,
        },
      });

      return { id: data.id, version: nextVersion };
    },
    onSuccess: (result, { caseId }) => {
      qc.invalidateQueries({ queryKey: ["negotiate-strategy", caseId] });
      toast.success(`Strategy v${result.version} saved`);
    },
    onError: (err: Error) => toast.error(`Save failed: ${err.message}`),
  });
}
