import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CompletionSnapshotPayload } from "@/types";

/**
 * Fetch the latest completed snapshot for an upstream module on a given case.
 *
 * Rule: A downstream module may only consume the latest *completed* snapshot
 * of its upstream module — never live draft data.
 *
 * Returns the parsed snapshot payload and metadata, or null if no completed
 * snapshot exists (i.e., upstream hasn't been completed yet).
 */
export function useUpstreamSnapshot(
  caseId: string | undefined,
  upstreamModuleId: string
) {
  return useQuery({
    queryKey: ["upstream-snapshot", caseId, upstreamModuleId],
    enabled: !!caseId,
    staleTime: 1000 * 60 * 5, // 5 min — snapshots are immutable
    queryFn: async () => {
      // 1. Find the latest completed module_completion for this upstream
      const { data: completion, error: compErr } = await (supabase
        .from("module_completions") as any)
        .select("id, version, status, completed_at")
        .eq("case_id", caseId!)
        .eq("module_id", upstreamModuleId)
        .in("status", ["completed"]) // only completed, not reopened
        .maybeSingle();

      if (compErr) throw compErr;
      if (!completion) return null;

      // 2. Fetch the snapshot for that completion at the current version
      const { data: snapshot, error: snapErr } = await (supabase
        .from("module_completion_snapshots") as any)
        .select("id, version, snapshot_json, created_at, created_by")
        .eq("completion_id", completion.id)
        .eq("version", completion.version)
        .maybeSingle();

      if (snapErr) throw snapErr;
      if (!snapshot) return null;

      return {
        snapshotId: snapshot.id as string,
        version: snapshot.version as number,
        completedAt: completion.completed_at as string,
        createdAt: snapshot.created_at as string,
        createdBy: snapshot.created_by as string | null,
        payload: snapshot.snapshot_json as CompletionSnapshotPayload,
      };
    },
  });
}

/**
 * Check whether a downstream module has a current (non-stale) link to its
 * upstream snapshot. Used to gate downstream module actions.
 */
export function useIsUpstreamCurrent(
  caseId: string | undefined,
  downstreamModuleId: string,
  upstreamModuleId: string
) {
  return useQuery({
    queryKey: ["upstream-current", caseId, downstreamModuleId, upstreamModuleId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("module_dependency_state") as any)
        .select("dependency_status, upstream_snapshot_version")
        .eq("case_id", caseId!)
        .eq("downstream_module_id", downstreamModuleId)
        .eq("upstream_module_id", upstreamModuleId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return { isCurrent: false, version: null };

      return {
        isCurrent: data.dependency_status === "current",
        version: data.upstream_snapshot_version as number | null,
      };
    },
  });
}
