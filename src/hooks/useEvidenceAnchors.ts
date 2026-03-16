/**
 * Generic evidence anchor hooks for any module.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type {
  EvidenceAnchorRow,
  AnchorEntityType,
  CreateEvidenceAnchorParams,
  ResolvedCitation,
} from "@/types/evidence-anchor";
import {
  createEvidenceAnchor,
  fetchAnchorsForEntity,
  resolveAnchorsForEntity,
} from "@/lib/citationService";

/** Fetch all evidence anchors for a specific entity (fact, flag, event, etc.) */
export function useEntityEvidenceAnchors(
  entityType: AnchorEntityType | undefined,
  entityId: string | undefined
) {
  return useQuery({
    queryKey: ["evidence-anchors", entityType, entityId],
    enabled: !!entityType && !!entityId,
    queryFn: () => fetchAnchorsForEntity(entityType!, entityId!),
  });
}

/** Fetch resolved citations (with page text & doc metadata) for an entity */
export function useResolvedCitations(
  entityType: AnchorEntityType | undefined,
  entityId: string | undefined
) {
  return useQuery({
    queryKey: ["resolved-citations", entityType, entityId],
    enabled: !!entityType && !!entityId,
    queryFn: () => resolveAnchorsForEntity(entityType!, entityId!),
  });
}

/** Batch fetch anchors for multiple entities of the same type */
export function useBulkEvidenceAnchors(
  entityType: AnchorEntityType | undefined,
  entityIds: string[]
) {
  return useQuery({
    queryKey: ["evidence-anchors-bulk", entityType, entityIds],
    enabled: !!entityType && entityIds.length > 0,
    queryFn: async () => {
      if (!entityType || entityIds.length === 0) return {};
      const { data, error } = await (supabase.from("evidence_references") as any)
        .select("*")
        .eq("anchor_entity_type", entityType)
        .in("anchor_entity_id", entityIds)
        .order("page_number");
      if (error) throw error;

      const grouped: Record<string, EvidenceAnchorRow[]> = {};
      for (const row of (data ?? []) as EvidenceAnchorRow[]) {
        const key = row.anchor_entity_id ?? "unknown";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(row);
      }
      return grouped;
    },
  });
}

/** Create an evidence anchor with full provenance */
export function useCreateEvidenceAnchor() {
  const queryClient = useQueryClient();
  const { tenantId, user } = useAuth();

  return useMutation({
    mutationFn: async (params: CreateEvidenceAnchorParams) => {
      if (!tenantId || !user) throw new Error("Not authenticated");
      return createEvidenceAnchor(tenantId, user.id, params);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["evidence-anchors"] });
      queryClient.invalidateQueries({ queryKey: ["resolved-citations"] });
      queryClient.invalidateQueries({ queryKey: ["evidence-anchors-bulk"] });
      queryClient.invalidateQueries({ queryKey: ["evidence-references"] });
      toast.success("Evidence anchor saved");
    },
    onError: (err) => {
      toast.error(`Failed to save evidence anchor: ${(err as Error).message}`);
    },
  });
}
