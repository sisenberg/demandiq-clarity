/**
 * NegotiateIQ — Resolve completed EvaluatePackage v1 for a case.
 * Reads the latest completed evaluation_packages record.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EvaluatePackagePayload } from "@/types/evaluate-persistence";

export interface ResolvedEvalPackage {
  id: string;
  version: number;
  completed_at: string | null;
  completed_by: string | null;
  package_payload: EvaluatePackagePayload;
}

export function useNegotiateEvalPackage(caseId: string | undefined) {
  return useQuery<ResolvedEvalPackage | null>({
    queryKey: ["negotiate-eval-package", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("evaluation_packages") as any)
        .select("id, version, completed_at, completed_by, package_payload")
        .eq("case_id", caseId!)
        .not("completed_at", "is", null)
        .order("version", { ascending: false })
        .limit(1);
      if (error) throw error;
      if (!data || data.length === 0) return null;
      return data[0] as ResolvedEvalPackage;
    },
  });
}
