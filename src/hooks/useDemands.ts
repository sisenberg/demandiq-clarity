import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DemandRow {
  id: string;
  tenant_id: string;
  case_id: string;
  source_document_id: string | null;
  is_active: boolean;
  demand_date: string;
  claimant_name: string;
  attorney_name: string;
  law_firm_name: string;
  represented_status: string;
  demand_amount: number | null;
  demand_deadline: string | null;
  loss_date: string;
  insured_name: string;
  claim_number: string;
  demand_summary_text: string;
  created_at: string;
  updated_at: string;
}

export interface DemandFieldExtraction {
  id: string;
  field_name: string;
  extracted_value: string;
  confidence: number | null;
  source_page: number | null;
  source_snippet: string;
  evidence_reference_id: string | null;
}

/** Fetch all demands for a case (active first, then by date) */
export function useCaseDemands(caseId: string | undefined) {
  return useQuery({
    queryKey: ["demands", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("demands") as any)
        .select("*")
        .eq("case_id", caseId)
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DemandRow[];
    },
  });
}

/** Fetch field extractions for a demand */
export function useDemandFieldExtractions(demandId: string | undefined) {
  return useQuery({
    queryKey: ["demand-field-extractions", demandId],
    enabled: !!demandId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("demand_field_extractions") as any)
        .select("*")
        .eq("demand_id", demandId)
        .order("field_name");
      if (error) throw error;
      return (data ?? []) as DemandFieldExtraction[];
    },
  });
}

/** Update demand fields (for editing before activation) */
export function useUpdateDemand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ demandId, patch }: { demandId: string; patch: Partial<DemandRow> }) => {
      const { error } = await (supabase.from("demands") as any)
        .update(patch)
        .eq("id", demandId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demands"] });
      toast.success("Demand updated");
    },
    onError: (e) => toast.error(`Update failed: ${(e as Error).message}`),
  });
}

/** Mark a demand as active (deactivates others for the case) */
export function useActivateDemand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ demandId, caseId }: { demandId: string; caseId: string }) => {
      // Deactivate all
      await (supabase.from("demands") as any)
        .update({ is_active: false })
        .eq("case_id", caseId);
      // Activate this one
      const { error } = await (supabase.from("demands") as any)
        .update({ is_active: true })
        .eq("id", demandId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demands"] });
      toast.success("Demand marked as active");
    },
    onError: (e) => toast.error(`Activation failed: ${(e as Error).message}`),
  });
}

/** Trigger demand extraction for a document */
export function useTriggerDemandExtraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ documentId, caseId, tenantId }: {
      documentId: string; caseId: string; tenantId: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("extract-demand", {
        body: { document_id: documentId, case_id: caseId, tenant_id: tenantId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demands"] });
      toast.success("Demand extraction complete");
    },
    onError: (e) => toast.error(`Extraction failed: ${(e as Error).message}`),
  });
}

/** Field labels for display */
export const DEMAND_FIELD_LABELS: Record<string, string> = {
  demand_date: "Demand Date",
  claimant_name: "Claimant Name",
  attorney_name: "Attorney Name",
  law_firm_name: "Law Firm",
  represented_status: "Representation",
  demand_amount: "Demand Amount",
  demand_deadline: "Deadline",
  loss_date: "Date of Loss",
  insured_name: "Insured Name",
  claim_number: "Claim Number",
  demand_summary_text: "Summary",
};
