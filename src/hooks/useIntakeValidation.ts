import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIntakeEvaluationPackage } from "./useIntakeEvaluationPackage";
import {
  validateIntakeForPublish,
  type IntakeValidationInput,
  type IntakeValidationResult,
} from "@/lib/intakeValidationEngine";

export function useIntakeValidation(caseId: string | undefined): {
  validation: IntakeValidationResult;
  isLoading: boolean;
} {
  const { data: pkg, isLoading: pkgLoading } = useIntakeEvaluationPackage(caseId);

  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ["intake-validation-counts", caseId],
    enabled: !!caseId,
    staleTime: 15_000,
    queryFn: async () => {
      const [dupRes, lowConfRes, treatmentRes, specialsRes, injuryRes, entityRes] =
        await Promise.all([
          (supabase.from("duplicate_document_flags") as any)
            .select("id", { count: "exact", head: true })
            .eq("case_id", caseId!)
            .eq("flag_status", "flagged"),
          (supabase.from("document_metadata_extractions") as any)
            .select("id", { count: "exact", head: true })
            .eq("case_id", caseId!)
            .lt("confidence", 0.5),
          (supabase.from("treatment_events") as any)
            .select("id, visit_date", { count: "exact", head: false })
            .eq("case_id", caseId!),
          (supabase.from("specials_records") as any)
            .select("id", { count: "exact", head: true })
            .eq("case_id", caseId!),
          (supabase.from("injury_records") as any)
            .select("id", { count: "exact", head: true })
            .eq("case_id", caseId!),
          (supabase.from("entity_clusters") as any)
            .select("id, entity_type")
            .eq("case_id", caseId!),
        ]);

      // Detect chronology gaps: check if treatment dates have > 90 day gaps
      const treatments = treatmentRes.data ?? [];
      const dates = treatments
        .map((t: any) => t.visit_date)
        .filter((d: string) => d && /^\d{4}/.test(d))
        .sort();
      let chronologyComplete = true;
      for (let i = 1; i < dates.length; i++) {
        const gap =
          (new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) /
          (1000 * 60 * 60 * 24);
        if (gap > 90) {
          chronologyComplete = false;
          break;
        }
      }

      const providers = (entityRes.data ?? []).filter(
        (e: any) => e.entity_type === "provider" || e.entity_type === "facility"
      );

      return {
        duplicateBillCount: dupRes.count ?? 0,
        lowOcrConfidenceCount: lowConfRes.count ?? 0,
        treatmentCount: treatmentRes.count ?? treatments.length,
        specialsCount: specialsRes.count ?? 0,
        injuryCount: injuryRes.count ?? 0,
        providerCount: providers.length,
        chronologyComplete,
      };
    },
  });

  const validation = useMemo<IntakeValidationResult>(() => {
    if (!counts) {
      return { state: "blocked", blockers: [], warnings: [], score: 0 };
    }

    const input: IntakeValidationInput = {
      hasDemand: !!pkg?.active_demand_id,
      claimantName: pkg?.claimant_name ?? "",
      representedStatus: pkg?.represented_status ?? "",
      demandAmount: pkg?.demand_amount ?? null,
      demandAmountConfirmedMissing: false,
      demandDeadline: pkg?.demand_deadline ?? null,
      specialsCount: counts.specialsCount,
      specialsExplicitlyNone: false,
      treatmentCount: counts.treatmentCount,
      hasMedicalClaims: counts.injuryCount > 0 || counts.treatmentCount > 0,
      providerCount: counts.providerCount,
      injuryCount: counts.injuryCount,
      duplicateBillCount: counts.duplicateBillCount,
      lowOcrConfidenceCount: counts.lowOcrConfidenceCount,
      treatmentChronologyComplete: counts.chronologyComplete,
      conflictingValueCount: 0,
    };

    return validateIntakeForPublish(input);
  }, [pkg, counts]);

  return { validation, isLoading: pkgLoading || countsLoading };
}
