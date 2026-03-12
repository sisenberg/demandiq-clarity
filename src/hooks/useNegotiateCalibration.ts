/**
 * NegotiateIQ — Calibration Data Hook
 *
 * Fetches historical claims and computes calibration signals
 * for the current case context.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { NegotiationViewModel } from "@/lib/negotiateViewModel";
import {
  computeCalibrationSignals,
  type CalibrationQuery,
  type CalibrationResult,
  type HistoricalClaimForCalibration,
} from "@/lib/negotiateCalibrationEngine";

const HIST_COLUMNS = [
  "final_settlement_amount",
  "billed_specials",
  "reviewed_specials",
  "attorney_name",
  "attorney_firm",
  "jurisdiction",
  "venue_state",
  "injury_categories",
  "primary_body_parts",
  "has_surgery",
  "has_injections",
  "has_permanency",
  "liability_posture",
  "treatment_duration_days",
].join(", ");

export function useNegotiateCalibration(
  vm: NegotiationViewModel | null,
  caseId: string | undefined,
  opts?: {
    attorneyName?: string;
    attorneyFirm?: string;
    jurisdictionState?: string;
    currentCounteroffer?: number | null;
  }
) {
  const { tenantId } = useAuth();

  return useQuery<CalibrationResult | null>({
    queryKey: [
      "negotiate-calibration",
      tenantId,
      caseId,
      vm?.provenance.packageVersion,
      opts?.attorneyName,
      opts?.currentCounteroffer,
    ],
    enabled: !!tenantId && !!vm,
    staleTime: 5 * 60 * 1000, // 5 min cache
    queryFn: async () => {
      if (!vm) return null;

      // Fetch all historical claims for tenant (up to 1000)
      const { data: claims, error } = await (supabase.from("historical_claims") as any)
        .select(HIST_COLUMNS)
        .eq("tenant_id", tenantId!);

      if (error) throw error;

      // Build the query context from the view model
      const query: CalibrationQuery = {
        jurisdictionState: opts?.jurisdictionState ?? "",
        injuryCategories: vm.expanders
          .concat(vm.reducers)
          .filter((d) => d.key.includes("injury") || d.key.includes("body"))
          .map((d) => d.label),
        bodyParts: [],
        hasSurgery: vm.expanders.some(
          (d) => d.key.includes("surgery") || d.description.toLowerCase().includes("surgery")
        ),
        hasInjections: vm.expanders.some(
          (d) => d.key.includes("injection") || d.description.toLowerCase().includes("injection")
        ),
        attorneyName: opts?.attorneyName ?? null,
        attorneyFirm: opts?.attorneyFirm ?? null,
        liabilityPosture: vm.assumptions.find((a) => a.key.includes("liability"))?.value ?? "",
        totalBilled: vm.specials.totalBilled,
        totalReviewed: vm.specials.totalReviewed,
        evalFloor: vm.valuationRange.floor,
        evalLikely: vm.valuationRange.likely,
        evalStretch: vm.valuationRange.stretch,
        currentCounteroffer: opts?.currentCounteroffer ?? null,
      };

      return computeCalibrationSignals(
        query,
        (claims ?? []) as HistoricalClaimForCalibration[]
      );
    },
  });
}
