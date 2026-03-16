import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIntakeEvaluationPackage } from "./useIntakeEvaluationPackage";
import { useIntakeValidation } from "./useIntakeValidation";
import type { DocumentRow } from "./useDocuments";
import {
  computeIntakeWorkflowState,
  computePipelineSteps,
  computeSimplifiedPipeline,
  type CaseIntakeState,
  type PipelineStepStatus,
  type SimplifiedStepStatus,
  type IntakeWorkflowInput,
} from "@/lib/intakeWorkflowEngine";

export interface IntakeWorkflowResult {
  state: CaseIntakeState;
  steps: PipelineStepStatus[];
  simplifiedSteps: SimplifiedStepStatus[];
  input: IntakeWorkflowInput;
  isLoading: boolean;
}

export function useIntakeWorkflow(
  caseId: string | undefined,
  documents: DocumentRow[]
): IntakeWorkflowResult {
  const { data: pkg, isLoading: pkgLoading } = useIntakeEvaluationPackage(caseId);
  const { validation, isLoading: valLoading } = useIntakeValidation(caseId);

  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ["intake-workflow-counts", caseId],
    enabled: !!caseId,
    staleTime: 10_000,
    refetchInterval: 8_000,
    queryFn: async () => {
      const [demandRes, specialsRes, treatmentRes, injuryRes] = await Promise.all([
        (supabase.from("demands") as any)
          .select("id", { count: "exact", head: true })
          .eq("case_id", caseId!)
          .eq("is_active", true),
        (supabase.from("specials_records") as any)
          .select("id", { count: "exact", head: true })
          .eq("case_id", caseId!),
        (supabase.from("treatment_events") as any)
          .select("id", { count: "exact", head: true })
          .eq("case_id", caseId!),
        (supabase.from("injury_records") as any)
          .select("id", { count: "exact", head: true })
          .eq("case_id", caseId!),
      ]);
      return {
        hasDemand: (demandRes.count ?? 0) > 0,
        specialsCount: specialsRes.count ?? 0,
        treatmentCount: treatmentRes.count ?? 0,
        injuryCount: injuryRes.count ?? 0,
      };
    },
  });

  return useMemo(() => {
    const isLoading = pkgLoading || valLoading || countsLoading;

    const ocrComplete = documents.filter((d) =>
      d.document_status === "complete" || d.document_status === "extracted" || d.document_status === "classified"
    );
    const classified = documents.filter((d) =>
      d.document_status === "classified" || d.document_status === "extracted" || d.document_status === "complete"
    );
    const processing = documents.filter((d) =>
      d.document_status === "queued" || d.document_status === "ocr_in_progress"
    );

    const input: IntakeWorkflowInput = {
      totalDocuments: documents.length,
      ocrCompleteCount: ocrComplete.length,
      classifiedCount: classified.length,
      hasDemand: counts?.hasDemand ?? false,
      specialsCount: counts?.specialsCount ?? 0,
      treatmentCount: counts?.treatmentCount ?? 0,
      injuryCount: counts?.injuryCount ?? 0,
      hasBlockers: validation.blockers.length > 0,
      hasWarnings: validation.warnings.length > 0,
      demandVerified: (pkg as any)?.demand_verified ?? false,
      specialsVerified: (pkg as any)?.specials_verified ?? false,
      treatmentVerified: (pkg as any)?.treatment_verified ?? false,
      injuryVerified: (pkg as any)?.injury_verified ?? false,
      packageStatus: pkg?.package_status ?? null,
      processingInProgress: processing.length > 0,
    };

    const state = computeIntakeWorkflowState(input);
    const steps = computePipelineSteps(input);

    return { state, steps, input, isLoading };
  }, [documents, pkg, pkgLoading, validation, valLoading, counts, countsLoading]);
}
