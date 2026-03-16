import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { retrieveChunks } from "@/lib/chunkRetrievalService";
import { toast } from "sonner";
import type {
  ChunkLabel,
  ChunkLabelRow,
  RetrievalQuery,
  RetrievalResult,
  RetrievalEventRow,
} from "@/types/chunk-retrieval";

// ── Label Hooks ────────────────────────────────────────────

/** Fetch labels for a single chunk */
export function useChunkLabels(chunkId: string | undefined) {
  return useQuery({
    queryKey: ["chunk-labels", chunkId],
    enabled: !!chunkId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("chunk_labels") as any)
        .select("*")
        .eq("chunk_id", chunkId)
        .order("confidence", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ChunkLabelRow[];
    },
  });
}

/** Fetch all labels for a case, grouped by chunk */
export function useCaseChunkLabels(caseId: string | undefined) {
  return useQuery({
    queryKey: ["chunk-labels", "case", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("chunk_labels") as any)
        .select("*")
        .eq("case_id", caseId)
        .order("confidence", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ChunkLabelRow[];
    },
  });
}

/** Manually assign a label to a chunk */
export function useAssignChunkLabel() {
  const qc = useQueryClient();
  const { tenantId } = useAuth();

  return useMutation({
    mutationFn: async ({
      chunkId,
      documentId,
      caseId,
      label,
      confidence = 1,
    }: {
      chunkId: string;
      documentId: string;
      caseId: string;
      label: ChunkLabel;
      confidence?: number;
    }) => {
      if (!tenantId) throw new Error("No tenant context");
      const { data, error } = await (supabase.from("chunk_labels") as any)
        .upsert(
          {
            tenant_id: tenantId,
            case_id: caseId,
            chunk_id: chunkId,
            document_id: documentId,
            label,
            confidence,
            source: "manual",
          },
          { onConflict: "chunk_id,label" }
        )
        .select()
        .single();
      if (error) throw error;
      return data as ChunkLabelRow;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["chunk-labels", vars.chunkId] });
      qc.invalidateQueries({ queryKey: ["chunk-labels", "case", vars.caseId] });
      toast.success("Label assigned");
    },
    onError: (e) => toast.error(`Label assignment failed: ${(e as Error).message}`),
  });
}

/** Remove a label from a chunk */
export function useRemoveChunkLabel() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ labelId, chunkId, caseId }: { labelId: string; chunkId: string; caseId: string }) => {
      const { error } = await (supabase.from("chunk_labels") as any)
        .delete()
        .eq("id", labelId);
      if (error) throw error;
      return { chunkId, caseId };
    },
    onSuccess: (vars) => {
      qc.invalidateQueries({ queryKey: ["chunk-labels", vars.chunkId] });
      qc.invalidateQueries({ queryKey: ["chunk-labels", "case", vars.caseId] });
      toast.success("Label removed");
    },
    onError: (e) => toast.error(`Remove failed: ${(e as Error).message}`),
  });
}

// ── Search Hook ────────────────────────────────────────────

/** Execute a chunk search with filters and retrieval logging */
export function useChunkSearch(caseId: string | undefined) {
  const { tenantId } = useAuth();

  return useMutation({
    mutationFn: async (query: RetrievalQuery): Promise<RetrievalResult[]> => {
      if (!caseId || !tenantId) throw new Error("Missing case or tenant context");
      return retrieveChunks(caseId, tenantId, query);
    },
    onError: (e) => toast.error(`Search failed: ${(e as Error).message}`),
  });
}

// ── Retrieval Event Audit Log ──────────────────────────────

/** Fetch retrieval event log for a case */
export function useRetrievalEvents(caseId: string | undefined, limit = 50) {
  return useQuery({
    queryKey: ["retrieval-events", caseId, limit],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("retrieval_events") as any)
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as RetrievalEventRow[];
    },
  });
}
