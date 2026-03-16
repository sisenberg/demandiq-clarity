import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useEvaluateEligibility } from "@/hooks/useEvaluateEligibility";
import { useDemandPackagePublished } from "@/hooks/useDemandPackage";
import { buildIntakeFromDemandPackage } from "@/lib/demandPackageIntakeAdapter";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";

/**
 * Builds the EvaluateIQ intake snapshot from the real published DemandPackage.
 * No mock data — returns null until a valid published package exists.
 */
export function useEvaluateIntakeSnapshot(caseId: string | undefined): {
  snapshot: EvaluateIntakeSnapshot | null;
  isReady: boolean;
} {
  const { user } = useAuth();
  const eligibility = useEvaluateEligibility(caseId);
  const { data: pkg, isLoading } = useDemandPackagePublished(caseId);

  return useMemo(() => {
    if (!caseId || !eligibility.eligible || isLoading) {
      return { snapshot: null, isReady: false };
    }
    if (!pkg) {
      return { snapshot: null, isReady: false };
    }

    const snapshot = buildIntakeFromDemandPackage(pkg, user?.id ?? null);
    return { snapshot, isReady: true };
  }, [caseId, eligibility.eligible, pkg, isLoading, user]);
}
