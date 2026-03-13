/**
 * Representation Analytics — Read Model Hooks
 *
 * Provides tenant-scoped access to the three representation analytics views.
 * Falls back to mock data when no rows exist (demo/development).
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type {
  RepresentedVsUnrepresentedSummary,
  RepresentationTransitionAnalytics,
  SeverityBandedRepresentationComparison,
} from "@/types/representation-analytics";
import {
  MOCK_SUMMARY,
  MOCK_TRANSITION,
  MOCK_SEVERITY_BANDED,
} from "@/types/representation-analytics";

// ─── View 1: Represented vs Unrepresented Summary ───────

export function useRepresentedVsUnrepresentedSummary() {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["representation-analytics", "summary", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<{ data: RepresentedVsUnrepresentedSummary; isMock: boolean }> => {
      const { data, error } = await supabase
        .from("represented_vs_unrepresented_summary_v" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .maybeSingle();

      if (error || !data) {
        return { data: MOCK_SUMMARY, isMock: true };
      }

      return { data: data as unknown as RepresentedVsUnrepresentedSummary, isMock: false };
    },
  });
}

// ─── View 2: Transition Analytics ───────────────────────

export function useRepresentationTransitionAnalytics() {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["representation-analytics", "transitions", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<{ data: RepresentationTransitionAnalytics; isMock: boolean }> => {
      const { data, error } = await supabase
        .from("representation_transition_analytics_v" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .maybeSingle();

      if (error || !data) {
        return { data: MOCK_TRANSITION, isMock: true };
      }

      return { data: data as unknown as RepresentationTransitionAnalytics, isMock: false };
    },
  });
}

// ─── View 3: Severity-Banded Comparison ─────────────────

export function useSeverityBandedRepresentationComparison() {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["representation-analytics", "severity-banded", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<{ data: SeverityBandedRepresentationComparison[]; isMock: boolean }> => {
      const { data, error } = await supabase
        .from("severity_banded_representation_comparison_v" as any)
        .select("*")
        .eq("tenant_id", tenantId!);

      if (error || !data || (data as any[]).length === 0) {
        return { data: MOCK_SEVERITY_BANDED, isMock: true };
      }

      return { data: data as unknown as SeverityBandedRepresentationComparison[], isMock: false };
    },
  });
}
