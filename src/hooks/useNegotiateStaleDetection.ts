/**
 * NegotiateIQ — Stale package detection.
 *
 * Checks if a newer EvaluatePackage version exists beyond what NegotiateIQ
 * was hydrated with. Returns staleness info for the refresh banner.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NegotiateStaleInfo {
  isStale: boolean;
  currentVersion: number;
  latestVersion: number;
  latestCompletedAt: string | null;
}

export function useNegotiateStaleDetection(
  caseId: string | undefined,
  hydratedVersion: number | undefined
) {
  return useQuery<NegotiateStaleInfo>({
    queryKey: ["negotiate-stale-check", caseId, hydratedVersion],
    enabled: !!caseId && hydratedVersion != null,
    refetchInterval: 30_000, // poll every 30s
    queryFn: async () => {
      const { data, error } = await (supabase.from("evaluation_packages") as any)
        .select("version, completed_at")
        .eq("case_id", caseId!)
        .not("completed_at", "is", null)
        .order("version", { ascending: false })
        .limit(1);
      if (error) throw error;
      const latest = data?.[0];
      if (!latest) {
        return {
          isStale: false,
          currentVersion: hydratedVersion!,
          latestVersion: hydratedVersion!,
          latestCompletedAt: null,
        };
      }
      return {
        isStale: latest.version > hydratedVersion!,
        currentVersion: hydratedVersion!,
        latestVersion: latest.version,
        latestCompletedAt: latest.completed_at,
      };
    },
  });
}
