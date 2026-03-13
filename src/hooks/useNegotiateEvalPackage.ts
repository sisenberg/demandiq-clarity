/**
 * NegotiateIQ — Resolve completed EvaluatePackage v1 for a case.
 * Reads the latest completed evaluation_packages record and
 * returns the full EvaluatePackageV1 contract.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EvaluatePackageV1 } from "@/types/evaluate-package-v1";
import type { EvaluatePackagePayload } from "@/types/evaluate-persistence";
import { isEvaluatePackageV1Shape } from "@/lib/evaluatePackageValidator";

export interface ResolvedEvalPackage {
  id: string;
  version: number;
  completed_at: string | null;
  completed_by: string | null;
  /** Full v1 package if available, otherwise legacy payload */
  package_v1: EvaluatePackageV1 | null;
  /** @deprecated Legacy payload — use package_v1 */
  package_payload: EvaluatePackagePayload | EvaluatePackageV1;
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

      const row = data[0];
      const payload = row.package_payload;

      // Detect whether this is a v1 contract or legacy payload
      const isV1 = isEvaluatePackageV1Shape(payload);

      return {
        id: row.id,
        version: row.version,
        completed_at: row.completed_at,
        completed_by: row.completed_by,
        package_v1: isV1 ? (payload as EvaluatePackageV1) : null,
        package_payload: payload,
      } as ResolvedEvalPackage;
    },
  });
}
