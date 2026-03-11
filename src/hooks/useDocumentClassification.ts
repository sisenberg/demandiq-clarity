import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────

export interface TypeSuggestionRow {
  id: string;
  tenant_id: string;
  case_id: string;
  document_id: string;
  suggested_type: string;
  confidence: number | null;
  reasoning: string;
  source_snippet: string;
  source_page: number | null;
  is_accepted: boolean;
  created_at: string;
}

export interface MetadataExtractionRow {
  id: string;
  tenant_id: string;
  case_id: string;
  document_id: string;
  field_type: string;
  extracted_value: string;
  confidence: number | null;
  source_snippet: string;
  source_page: number | null;
  is_accepted: boolean;
  user_corrected_value: string | null;
  created_at: string;
}

// ── Field type labels ──────────────────────────────────

export const METADATA_FIELD_LABEL: Record<string, string> = {
  claimant_name: "Claimant Name",
  attorney_name: "Attorney",
  law_firm: "Law Firm",
  provider_name: "Provider",
  facility_name: "Facility",
  claim_number: "Claim #",
  loss_date: "Loss Date",
  treatment_date: "Treatment Date",
  document_date: "Document Date",
  bill_total: "Bill Total",
  charge_amount: "Charge Amount",
  phone: "Phone",
  email: "Email",
  address: "Address",
};

// ── Queries ────────────────────────────────────────────

export function useDocumentTypeSuggestions(documentId: string | undefined) {
  return useQuery({
    queryKey: ["type-suggestions", documentId],
    enabled: !!documentId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase.from("document_type_suggestions") as any)
        .select("*")
        .eq("document_id", documentId!)
        .order("confidence", { ascending: false });
      if (error) throw error;
      return data as TypeSuggestionRow[];
    },
  });
}

export function useDocumentMetadataExtractions(documentId: string | undefined) {
  return useQuery({
    queryKey: ["metadata-extractions", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("document_metadata_extractions") as any)
        .select("*")
        .eq("document_id", documentId!)
        .order("confidence", { ascending: false });
      if (error) throw error;
      return data as MetadataExtractionRow[];
    },
  });
}

export function useCaseMetadataExtractions(caseId: string | undefined) {
  return useQuery({
    queryKey: ["metadata-extractions", "case", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("document_metadata_extractions") as any)
        .select("*")
        .eq("case_id", caseId!)
        .order("confidence", { ascending: false });
      if (error) throw error;
      return data as MetadataExtractionRow[];
    },
  });
}

// ── Mutations ──────────────────────────────────────────

/** Invoke the classify-document edge function */
export function useClassifyDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const { data, error } = await supabase.functions.invoke("classify-document", {
        body: { document_id: documentId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["type-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["metadata-extractions"] });
      queryClient.invalidateQueries({ queryKey: ["case-documents"] });
      if (data?.type_suggestions > 0) {
        toast.success(
          `Classified as ${data.top_type?.replace(/_/g, " ")} (${Math.round((data.top_confidence ?? 0) * 100)}% confidence) — ${data.metadata_extractions} fields extracted`
        );
      }
    },
    onError: (err) => {
      toast.error(`Classification failed: ${(err as Error).message}`);
    },
  });
}

/** Accept a type suggestion (set is_accepted and update document_type) */
export function useAcceptTypeSuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ suggestionId, documentId, suggestedType }: {
      suggestionId: string;
      documentId: string;
      suggestedType: string;
    }) => {
      // Clear other acceptances for this document
      await (supabase.from("document_type_suggestions") as any)
        .update({ is_accepted: false })
        .eq("document_id", documentId);

      // Accept this one
      await (supabase.from("document_type_suggestions") as any)
        .update({ is_accepted: true })
        .eq("id", suggestionId);

      // Update the document type
      await supabase
        .from("case_documents")
        .update({ document_type: suggestedType as any })
        .eq("id", documentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["type-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["case-documents"] });
      toast.success("Document type updated");
    },
  });
}

/** Correct a metadata extraction value */
export function useCorrectMetadata() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ extractionId, correctedValue }: {
      extractionId: string;
      correctedValue: string;
    }) => {
      const { error } = await (supabase.from("document_metadata_extractions") as any)
        .update({
          user_corrected_value: correctedValue,
          is_accepted: true,
        })
        .eq("id", extractionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metadata-extractions"] });
      toast.success("Metadata updated");
    },
  });
}

/** Accept a metadata extraction as-is */
export function useAcceptMetadata() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (extractionId: string) => {
      const { error } = await (supabase.from("document_metadata_extractions") as any)
        .update({ is_accepted: true })
        .eq("id", extractionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metadata-extractions"] });
    },
  });
}
