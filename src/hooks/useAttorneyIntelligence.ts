/**
 * Attorney Pattern Intelligence — Data hooks
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  assembleAttorneyProfile,
  type AttorneyObservation,
  type AttorneyProfile,
  type HistoricalClaimRow,
} from "@/lib/attorneyPatternEngine";

const T = (name: string) => supabase.from(name as any) as any;

// ─── Fetch attorney profile (historical + observations) ─

export function useAttorneyProfile(attorneyName: string | undefined, firmName: string | undefined) {
  const { tenantId } = useAuth();

  return useQuery<AttorneyProfile | null>({
    queryKey: ["attorney-profile", tenantId, attorneyName, firmName],
    enabled: !!tenantId && !!attorneyName,
    queryFn: async () => {
      if (!attorneyName) return null;

      // Fetch historical claims for this attorney (by name match)
      const { data: claims, error: claimsErr } = await T("historical_claims")
        .select("attorney_name, attorney_firm, final_settlement_amount, billed_specials, reviewed_specials, provider_names, injury_categories, has_surgery, has_injections, treatment_duration_days, treatment_provider_count")
        .eq("tenant_id", tenantId!)
        .ilike("attorney_name", attorneyName);

      if (claimsErr) throw claimsErr;

      // Fetch observations
      const { data: obs, error: obsErr } = await T("attorney_observations")
        .select("*")
        .eq("tenant_id", tenantId!)
        .ilike("attorney_name", attorneyName)
        .order("created_at", { ascending: false });

      if (obsErr) throw obsErr;

      const mappedObs: AttorneyObservation[] = (obs ?? []).map((o: any) => ({
        id: o.id,
        caseId: o.case_id,
        observationType: o.observation_type,
        observationText: o.observation_text,
        observedBy: o.observed_by,
        createdAt: o.created_at,
      }));

      return assembleAttorneyProfile(
        attorneyName,
        firmName ?? "",
        (claims ?? []) as HistoricalClaimRow[],
        mappedObs
      );
    },
  });
}

// ─── Case-level observations ────────────────────────────

export function useCaseAttorneyObservations(caseId: string | undefined) {
  return useQuery<AttorneyObservation[]>({
    queryKey: ["attorney-observations-case", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await T("attorney_observations")
        .select("*")
        .eq("case_id", caseId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((o: any) => ({
        id: o.id,
        caseId: o.case_id,
        observationType: o.observation_type,
        observationText: o.observation_text,
        observedBy: o.observed_by,
        createdAt: o.created_at,
      }));
    },
  });
}

// ─── Add observation ────────────────────────────────────

export function useAddAttorneyObservation() {
  const qc = useQueryClient();
  const { user, tenantId } = useAuth();

  return useMutation({
    mutationFn: async ({
      caseId,
      sessionId,
      attorneyName,
      firmName,
      observationType,
      observationText,
    }: {
      caseId?: string;
      sessionId?: string;
      attorneyName: string;
      firmName: string;
      observationType: string;
      observationText: string;
    }) => {
      if (!user || !tenantId) throw new Error("Not authenticated");
      const { data, error } = await T("attorney_observations").insert({
        tenant_id: tenantId,
        case_id: caseId ?? null,
        session_id: sessionId ?? null,
        attorney_name: attorneyName,
        firm_name: firmName,
        observation_type: observationType,
        observation_text: observationText,
        observed_by: user.id,
      }).select("id").single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["attorney-profile"] });
      qc.invalidateQueries({ queryKey: ["attorney-observations-case", vars.caseId] });
      toast.success("Observation saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
