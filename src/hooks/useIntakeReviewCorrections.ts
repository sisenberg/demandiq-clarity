import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ReviewSection = "demand" | "specials" | "treatment" | "injury";

export interface IntakeReviewCorrectionRow {
  id: string;
  tenant_id: string;
  case_id: string;
  section: string;
  field_name: string;
  extracted_value: string;
  corrected_value: string | null;
  evidence_document_id: string | null;
  evidence_page: number | null;
  evidence_snippet: string;
  corrected_by: string | null;
  corrected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VerificationStatus {
  demand_verified: boolean;
  specials_verified: boolean;
  treatment_verified: boolean;
  injury_verified: boolean;
  demand_verified_by: string | null;
  demand_verified_at: string | null;
  specials_verified_by: string | null;
  specials_verified_at: string | null;
  treatment_verified_by: string | null;
  treatment_verified_at: string | null;
  injury_verified_by: string | null;
  injury_verified_at: string | null;
}

/** Fetch all corrections for a case */
export function useIntakeReviewCorrections(caseId: string | undefined) {
  return useQuery({
    queryKey: ["intake-review-corrections", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("intake_review_corrections") as any)
        .select("*")
        .eq("case_id", caseId)
        .order("section", { ascending: true })
        .order("field_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as IntakeReviewCorrectionRow[];
    },
  });
}

/** Upsert a correction (insert or update) */
export function useUpsertCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      caseId: string;
      tenantId: string;
      section: ReviewSection;
      fieldName: string;
      extractedValue: string;
      correctedValue: string;
      userId: string;
      evidenceDocumentId?: string;
      evidencePage?: number;
      evidenceSnippet?: string;
    }) => {
      const { data, error } = await (supabase.from("intake_review_corrections") as any)
        .upsert(
          {
            case_id: params.caseId,
            tenant_id: params.tenantId,
            section: params.section,
            field_name: params.fieldName,
            extracted_value: params.extractedValue,
            corrected_value: params.correctedValue,
            corrected_by: params.userId,
            corrected_at: new Date().toISOString(),
            evidence_document_id: params.evidenceDocumentId ?? null,
            evidence_page: params.evidencePage ?? null,
            evidence_snippet: params.evidenceSnippet ?? "",
          },
          { onConflict: "case_id,section,field_name" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intake-review-corrections"] });
      toast.success("Correction saved");
    },
    onError: (e) => toast.error(`Save failed: ${(e as Error).message}`),
  });
}

/** Mark a section as verified */
export function useVerifySection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      packageId: string;
      section: ReviewSection;
      verified: boolean;
      userId: string;
    }) => {
      const updates: Record<string, unknown> = {};
      updates[`${params.section}_verified`] = params.verified;
      updates[`${params.section}_verified_by`] = params.verified ? params.userId : null;
      updates[`${params.section}_verified_at`] = params.verified ? new Date().toISOString() : null;

      const { error } = await (supabase.from("intake_evaluation_packages") as any)
        .update(updates)
        .eq("id", params.packageId);
      if (error) throw error;
    },
    onSuccess: (_, params) => {
      qc.invalidateQueries({ queryKey: ["intake-evaluation-package"] });
      toast.success(`${params.section.charAt(0).toUpperCase() + params.section.slice(1)} ${params.verified ? "verified" : "unverified"}`);
    },
    onError: (e) => toast.error(`Verification failed: ${(e as Error).message}`),
  });
}
