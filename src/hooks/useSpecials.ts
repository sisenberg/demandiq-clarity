import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SpecialsRecordRow {
  id: string;
  tenant_id: string;
  case_id: string;
  linked_demand_id: string | null;
  source_document_id: string | null;
  provider_name: string;
  provider_party_id: string | null;
  date_of_service: string;
  cpt_or_hcpcs_code: string | null;
  description: string;
  billed_amount: number;
  adjustments: number | null;
  balance_due: number | null;
  extraction_confidence: number | null;
  verification_status: string;
  verified_by: string | null;
  verified_at: string | null;
  source_page: number | null;
  source_snippet: string;
  created_at: string;
  updated_at: string;
}

/** Fetch all specials records for a case */
export function useCaseSpecials(caseId: string | undefined) {
  return useQuery({
    queryKey: ["specials-records", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("specials_records") as any)
        .select("*")
        .eq("case_id", caseId)
        .order("date_of_service", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SpecialsRecordRow[];
    },
  });
}

/** Fetch specials linked to a specific demand */
export function useDemandSpecials(demandId: string | undefined) {
  return useQuery({
    queryKey: ["specials-records", "demand", demandId],
    enabled: !!demandId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("specials_records") as any)
        .select("*")
        .eq("linked_demand_id", demandId)
        .order("date_of_service", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SpecialsRecordRow[];
    },
  });
}

/** Update a specials record (edit fields) */
export function useUpdateSpecialsRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ recordId, patch }: { recordId: string; patch: Partial<SpecialsRecordRow> }) => {
      const { error } = await (supabase.from("specials_records") as any)
        .update(patch)
        .eq("id", recordId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["specials-records"] });
      toast.success("Record updated");
    },
    onError: (e) => toast.error(`Update failed: ${(e as Error).message}`),
  });
}

/** Verify a specials record */
export function useVerifySpecialsRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ recordId, userId }: { recordId: string; userId: string }) => {
      const { error } = await (supabase.from("specials_records") as any)
        .update({
          verification_status: "verified",
          verified_by: userId,
          verified_at: new Date().toISOString(),
        })
        .eq("id", recordId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["specials-records"] });
      toast.success("Record verified");
    },
    onError: (e) => toast.error(`Verification failed: ${(e as Error).message}`),
  });
}

/** Flag a specials record for review */
export function useFlagSpecialsRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ recordId }: { recordId: string }) => {
      const { error } = await (supabase.from("specials_records") as any)
        .update({ verification_status: "flagged" })
        .eq("id", recordId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["specials-records"] });
      toast.success("Record flagged for review");
    },
  });
}

/** Delete a specials record */
export function useDeleteSpecialsRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ recordId }: { recordId: string }) => {
      const { error } = await (supabase.from("specials_records") as any)
        .delete()
        .eq("id", recordId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["specials-records"] });
      toast.success("Record deleted");
    },
  });
}

/** Trigger specials extraction for a document */
export function useTriggerSpecialsExtraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ documentId, caseId, tenantId }: {
      documentId: string; caseId: string; tenantId: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("extract-specials", {
        body: { document_id: documentId, case_id: caseId, tenant_id: tenantId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["specials-records"] });
      qc.invalidateQueries({ queryKey: ["demands"] });
      toast.success(`Extracted ${data?.records_created ?? 0} bill line items`);
    },
    onError: (e) => toast.error(`Extraction failed: ${(e as Error).message}`),
  });
}

/** Compute aggregate stats from specials records */
export function computeSpecialsAggregates(records: SpecialsRecordRow[]) {
  const totalBilled = records.reduce((sum, r) => sum + (r.billed_amount || 0), 0);
  const totalAdjustments = records.reduce((sum, r) => sum + (r.adjustments || 0), 0);
  const totalBalanceDue = records.reduce((sum, r) => sum + (r.balance_due || 0), 0);
  const uniqueProviders = new Set(records.map((r) => r.provider_name.toLowerCase().trim()).filter(Boolean));
  const verified = records.filter((r) => r.verification_status === "verified").length;
  const flagged = records.filter((r) => r.verification_status === "flagged").length;

  return {
    totalBilled,
    totalAdjustments,
    totalBalanceDue,
    numberOfBills: records.length,
    numberOfProviders: uniqueProviders.size,
    verified,
    flagged,
    unverified: records.length - verified - flagged,
  };
}
