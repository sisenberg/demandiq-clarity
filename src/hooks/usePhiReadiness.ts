import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type EnvironmentDesignation = "development" | "staging" | "production";
export type PhiReadinessStatus = "development_test_allowed" | "production_phi_blocked" | "production_phi_ready";

export interface PhiReadinessConfig {
  id: string;
  tenant_id: string;
  environment_designation: EnvironmentDesignation;
  baa_executed: boolean;
  baa_vendor_list: string;
  baa_confirmed_at: string | null;
  baa_confirmed_by: string | null;
  ai_retention_terms_finalized: boolean;
  ai_retention_notes: string;
  ai_retention_confirmed_at: string | null;
  ai_retention_confirmed_by: string | null;
  logging_masking_hardened: boolean;
  logging_masking_confirmed_at: string | null;
  logging_masking_confirmed_by: string | null;
  overall_status: PhiReadinessStatus;
  last_status_change_at: string;
  last_status_change_by: string | null;
  created_at: string;
  updated_at: string;
}

export function usePhiReadiness() {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["phi-readiness", tenantId],
    queryFn: async (): Promise<PhiReadinessConfig | null> => {
      if (!tenantId) return null;
      const { data, error } = await (supabase.from("phi_readiness_config") as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });
}

export function useUpsertPhiReadiness() {
  const { user, tenantId } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<Omit<PhiReadinessConfig, "id" | "tenant_id" | "created_at" | "updated_at">>) => {
      if (!tenantId || !user) throw new Error("Not authenticated");

      // Check if config exists
      const { data: existing } = await (supabase.from("phi_readiness_config") as any)
        .select("id")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (existing) {
        const { error } = await (supabase.from("phi_readiness_config") as any)
          .update(updates)
          .eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("phi_readiness_config") as any)
          .insert({ tenant_id: tenantId, ...updates });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["phi-readiness", tenantId] });
    },
  });
}
