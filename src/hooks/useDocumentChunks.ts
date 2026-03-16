import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DocumentChunkRow {
  id: string;
  tenant_id: string;
  case_id: string;
  document_id: string;
  page_start: number;
  page_end: number;
  chunk_type: string;
  chunk_text: string;
  chunk_index: number;
  content_hash: string | null;
  extraction_pass: string | null;
  extraction_version: number | null;
  extraction_timestamp: string | null;
  extraction_status: string;
  created_at: string;
  updated_at: string;
  /** Attached labels (populated when fetched with labels) */
  labels?: import("@/types/chunk-retrieval").ChunkLabelRow[];
}

export const CHUNK_TYPE_LABEL: Record<string, string> = {
  semantic_large: "Semantic (Large)",
  table_aware: "Table-Aware",
  page_section: "Page / Section",
  paragraph: "Paragraph",
  generic: "Generic",
};

export const EXTRACTION_PASS_LABEL: Record<string, string> = {
  demand_extraction: "Demand Extraction",
  specials_extraction: "Specials Extraction",
  treatment_extraction: "Treatment Extraction",
  injury_extraction: "Injury Extraction",
};

/** Fetch all chunks for a document */
export function useDocumentChunks(documentId: string | undefined) {
  return useQuery({
    queryKey: ["document-chunks", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("document_chunks") as any)
        .select("*")
        .eq("document_id", documentId)
        .order("chunk_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DocumentChunkRow[];
    },
  });
}

/** Fetch all chunks for a case */
export function useCaseDocumentChunks(caseId: string | undefined) {
  return useQuery({
    queryKey: ["document-chunks", "case", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("document_chunks") as any)
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DocumentChunkRow[];
    },
  });
}

/** Trigger chunking for a document */
export function useTriggerDocumentChunking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ documentId }: { documentId: string }) => {
      const { data, error } = await supabase.functions.invoke("chunk-document", {
        body: { document_id: documentId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["document-chunks"] });
      qc.invalidateQueries({ queryKey: ["intake-jobs"] });
      toast.success(
        `Created ${data?.chunks_created ?? 0} chunks (${data?.chunk_strategy ?? "unknown"} strategy)`
      );
    },
    onError: (e) => toast.error(`Chunking failed: ${(e as Error).message}`),
  });
}

/** Compute chunk stats for display */
export function computeChunkStats(chunks: DocumentChunkRow[]) {
  const byType = chunks.reduce<Record<string, number>>((acc, c) => {
    acc[c.chunk_type] = (acc[c.chunk_type] ?? 0) + 1;
    return acc;
  }, {});

  const byStatus = chunks.reduce<Record<string, number>>((acc, c) => {
    acc[c.extraction_status] = (acc[c.extraction_status] ?? 0) + 1;
    return acc;
  }, {});

  const totalChars = chunks.reduce((sum, c) => sum + c.chunk_text.length, 0);

  return {
    totalChunks: chunks.length,
    byType,
    byStatus,
    totalChars,
    pending: byStatus["pending"] ?? 0,
    completed: byStatus["completed"] ?? 0,
  };
}
