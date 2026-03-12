/**
 * EvaluateIQ — Calibration Config Hooks
 *
 * React Query hooks for loading, saving, and versioning
 * calibration configurations.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { CalibrationConfig } from "@/types/calibration-config";
import {
  DEFAULT_SEVERITY_MULTIPLIERS,
  DEFAULT_CLINICAL_ADJUSTMENTS,
  DEFAULT_RELIABILITY_REDUCTIONS,
  DEFAULT_VENUE_MULTIPLIERS,
  DEFAULT_CONFIDENCE_RULES,
} from "@/types/calibration-config";

// ─── Active Config ────────────────────────────────────────

export function useActiveCalibrationConfig() {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["calibration_config_active", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calibration_configs")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as CalibrationConfig | null;
    },
    enabled: !!tenantId,
  });
}

// ─── Config History ───────────────────────────────────────

export function useCalibrationConfigHistory() {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["calibration_config_history", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calibration_configs")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("version", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data ?? []) as unknown as CalibrationConfig[];
    },
    enabled: !!tenantId,
  });
}

// ─── Save New Config Version ──────────────────────────────

export function useSaveCalibrationConfig() {
  const { tenantId, user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      config,
      changeReason,
      changeSummary,
    }: {
      config: Partial<CalibrationConfig>;
      changeReason: string;
      changeSummary: string;
    }) => {
      if (!tenantId || !user) throw new Error("Not authenticated");

      // Get current max version
      const { data: latest } = await supabase
        .from("calibration_configs")
        .select("version")
        .eq("tenant_id", tenantId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVersion = ((latest as any)?.version ?? 0) + 1;

      // Deactivate all current configs
      await supabase
        .from("calibration_configs")
        .update({ is_active: false } as any)
        .eq("tenant_id", tenantId)
        .eq("is_active", true);

      // Insert new version
      const { data, error } = await supabase
        .from("calibration_configs")
        .insert([{
          tenant_id: tenantId,
          version: nextVersion,
          is_active: true,
          severity_multipliers: config.severity_multipliers ?? DEFAULT_SEVERITY_MULTIPLIERS,
          clinical_adjustments: config.clinical_adjustments ?? DEFAULT_CLINICAL_ADJUSTMENTS,
          reliability_reductions: config.reliability_reductions ?? DEFAULT_RELIABILITY_REDUCTIONS,
          venue_multipliers: config.venue_multipliers ?? DEFAULT_VENUE_MULTIPLIERS,
          confidence_rules: config.confidence_rules ?? DEFAULT_CONFIDENCE_RULES,
          rounding_rules: config.rounding_rules ?? {},
          change_reason: changeReason,
          changed_by: user.id,
          change_summary: changeSummary,
        }] as any)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as CalibrationConfig;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calibration_config_active"] });
      qc.invalidateQueries({ queryKey: ["calibration_config_history"] });
    },
  });
}
