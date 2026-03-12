import { useMemo } from "react";
import { useCasePackage } from "@/hooks/useCasePackage";
import { useAuth } from "@/contexts/AuthContext";
import { useEvaluateEligibility } from "@/hooks/useEvaluateEligibility";
import { buildEvaluateIntakeSnapshot } from "@/lib/evaluateIntakeBuilder";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";

/**
 * Builds and returns the EvaluateIQ intake snapshot for the current case.
 * The snapshot is derived (not persisted yet) from the CasePackage context.
 */
export function useEvaluateIntakeSnapshot(caseId: string | undefined): {
  snapshot: EvaluateIntakeSnapshot | null;
  isReady: boolean;
} {
  const { pkg } = useCasePackage();
  const { user } = useAuth();
  const eligibility = useEvaluateEligibility(caseId);

  return useMemo(() => {
    if (!eligibility.eligible || !eligibility.inputSource || !caseId) {
      return { snapshot: null, isReady: false };
    }

    const snapshot = buildEvaluateIntakeSnapshot({
      casePackage: pkg,
      reviewerPackage: null, // Will be wired when ReviewerPackage persistence is live
      sourceModule: eligibility.inputSource,
      sourceVersion: eligibility.sourceVersion ?? 1,
      sourceSnapshotId: null,
      userId: user?.id ?? null,
    });

    return { snapshot, isReady: true };
  }, [pkg, eligibility, caseId, user]);
}
