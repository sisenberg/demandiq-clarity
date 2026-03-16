import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface InjuryRecordRow {
  id: string;
  tenant_id: string;
  case_id: string;
  linked_demand_id: string | null;
  source_document_id: string | null;
  injury_description: string;
  body_part: string;
  icd_codes: string[];
  diagnosis_description: string;
  imaging_references: string;
  surgery_mentions: string;
  injections_or_procedures: string;
  therapy_mentions: string;
  residual_symptom_language: string;
  work_restrictions: string;
  functional_limitations: string;
  objective_support_flag: boolean;
  invasive_treatment_flag: boolean;
  residual_symptom_flag: boolean;
  functional_impact_flag: boolean;
  source_page: number | null;
  source_snippet: string;
  extraction_confidence: number | null;
  verification_status: string;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useCaseInjuryRecords(caseId: string | undefined) {
  return useQuery({
    queryKey: ["injury-records", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("injury_records") as any)
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as InjuryRecordRow[];
    },
  });
}

export function useUpdateInjuryRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ recordId, patch }: { recordId: string; patch: Partial<InjuryRecordRow> }) => {
      const { error } = await (supabase.from("injury_records") as any)
        .update(patch)
        .eq("id", recordId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["injury-records"] });
      toast.success("Injury record updated");
    },
    onError: (e) => toast.error(`Update failed: ${(e as Error).message}`),
  });
}

export function useVerifyInjuryRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ recordId, userId }: { recordId: string; userId: string }) => {
      const { error } = await (supabase.from("injury_records") as any)
        .update({
          verification_status: "verified",
          verified_by: userId,
          verified_at: new Date().toISOString(),
        })
        .eq("id", recordId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["injury-records"] });
      toast.success("Injury verified");
    },
  });
}

export function useDeleteInjuryRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ recordId }: { recordId: string }) => {
      const { error } = await (supabase.from("injury_records") as any)
        .delete()
        .eq("id", recordId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["injury-records"] });
      toast.success("Injury deleted");
    },
  });
}

export function useTriggerInjuryExtraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ documentId, caseId, tenantId }: {
      documentId: string; caseId: string; tenantId: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("extract-injuries", {
        body: { document_id: documentId, case_id: caseId, tenant_id: tenantId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["injury-records"] });
      toast.success(`Extracted ${data?.injuries_created ?? 0} injury records`);
    },
    onError: (e) => toast.error(`Extraction failed: ${(e as Error).message}`),
  });
}

export function computeInjurySummary(records: InjuryRecordRow[]) {
  return {
    totalInjuries: records.length,
    verified: records.filter((r) => r.verification_status === "verified").length,
    objectiveSupport: records.filter((r) => r.objective_support_flag).length,
    invasiveTreatment: records.filter((r) => r.invasive_treatment_flag).length,
    residualSymptoms: records.filter((r) => r.residual_symptom_flag).length,
    functionalImpact: records.filter((r) => r.functional_impact_flag).length,
    bodyParts: [...new Set(records.map((r) => r.body_part).filter(Boolean))],
  };
}
