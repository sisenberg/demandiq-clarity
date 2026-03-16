import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface EvidenceReferenceRow {
  id: string;
  tenant_id: string;
  case_id: string;
  document_id: string;
  page_number: number;
  quoted_text: string;
  character_start: number | null;
  character_end: number | null;
  evidence_type: string;
  chunk_id: string | null;
  parse_version: number | null;
  processing_run_id: string | null;
  bounding_box: Record<string, number> | null;
  anchor_entity_type: string | null;
  anchor_entity_id: string | null;
  anchor_module: string | null;
  created_by: string | null;
  created_at: string;
}

export type EvidenceType = "direct" | "corroborating" | "contradicting" | "contextual";

export const EVIDENCE_TYPE_LABEL: Record<EvidenceType, string> = {
  direct: "Direct",
  corroborating: "Corroborating",
  contradicting: "Contradicting",
  contextual: "Contextual",
};

export function useDocumentEvidenceRefs(documentId: string | undefined) {
  return useQuery({
    queryKey: ["evidence-references", "document", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("evidence_references") as any)
        .select("*")
        .eq("document_id", documentId!)
        .order("page_number")
        .order("character_start");
      if (error) throw error;
      return data as EvidenceReferenceRow[];
    },
  });
}

export function useCaseEvidenceRefs(caseId: string | undefined) {
  return useQuery({
    queryKey: ["evidence-references", "case", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("evidence_references") as any)
        .select("*")
        .eq("case_id", caseId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as EvidenceReferenceRow[];
    },
  });
}

export function useCreateEvidenceRef() {
  const queryClient = useQueryClient();
  const { tenantId, user } = useAuth();

  return useMutation({
    mutationFn: async ({
      caseId,
      documentId,
      pageNumber,
      quotedText,
      characterStart,
      characterEnd,
      evidenceType,
      chunkId,
      parseVersion,
      processingRunId,
      anchorEntityType,
      anchorEntityId,
      anchorModule,
    }: {
      caseId: string;
      documentId: string;
      pageNumber: number;
      quotedText: string;
      characterStart?: number;
      characterEnd?: number;
      evidenceType: EvidenceType;
      chunkId?: string;
      parseVersion?: number;
      processingRunId?: string;
      anchorEntityType?: string;
      anchorEntityId?: string;
      anchorModule?: string;
    }) => {
      if (!tenantId || !user) throw new Error("Not authenticated");
      const { data, error } = await (supabase.from("evidence_references") as any)
        .insert({
          tenant_id: tenantId,
          case_id: caseId,
          document_id: documentId,
          page_number: pageNumber,
          quoted_text: quotedText,
          character_start: characterStart ?? null,
          character_end: characterEnd ?? null,
          evidence_type: evidenceType,
          chunk_id: chunkId ?? null,
          parse_version: parseVersion ?? null,
          processing_run_id: processingRunId ?? null,
          anchor_entity_type: anchorEntityType ?? null,
          anchor_entity_id: anchorEntityId ?? null,
          anchor_module: anchorModule ?? null,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as EvidenceReferenceRow;
    },
    onSuccess: (_, { documentId, caseId }) => {
      queryClient.invalidateQueries({ queryKey: ["evidence-references", "document", documentId] });
      queryClient.invalidateQueries({ queryKey: ["evidence-references", "case", caseId] });
      toast.success("Evidence reference saved");
    },
    onError: (err) => {
      toast.error(`Failed to save evidence reference: ${(err as Error).message}`);
    },
  });
}

export function useDeleteEvidenceRef() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (refId: string) => {
      const { error } = await (supabase.from("evidence_references") as any)
        .delete()
        .eq("id", refId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evidence-references"] });
      toast.success("Evidence reference removed");
    },
  });
}

/** Format an evidence reference as a copyable citation string */
export function formatEvidenceCitation(ref: EvidenceReferenceRow, fileName?: string): string {
  const parts = [
    `[${ref.evidence_type.toUpperCase()}]`,
    fileName ? `"${fileName}"` : `Doc:${ref.document_id.slice(0, 8)}`,
    `p.${ref.page_number}`,
  ];
  if (ref.character_start != null && ref.character_end != null) {
    parts.push(`chars ${ref.character_start}–${ref.character_end}`);
  }
  return `${parts.join(" | ")}\n"${ref.quoted_text}"`;
}
