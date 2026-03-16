import { useMemo } from "react";
import { useModuleCompletion } from "@/hooks/useModuleCompletion";
import { useAuth } from "@/contexts/AuthContext";
import { isEntitlementActive } from "@/hooks/useModuleEntitlements";
import { ModuleCompletionStatus, ModuleId } from "@/types";
import { useDemandPackageLaunchEligibility } from "@/hooks/useDemandPackage";
import type { EvaluateEligibility } from "@/types/evaluateiq";

/**
 * Determines whether a case is eligible for EvaluateIQ.
 *
 * Primary gate: a published DemandPackage must exist.
 * Preferred enrichment: ReviewerIQ completion (optional, not gating).
 */
export function useEvaluateEligibility(caseId: string | undefined): EvaluateEligibility {
  const { entitlements } = useAuth();
  const hasEvaluateIQ = isEntitlementActive(entitlements, ModuleId.EvaluateIQ);
  const hasReviewerIQ = isEntitlementActive(entitlements, ModuleId.ReviewerIQ);

  const { data: reviewerCompletion } = useModuleCompletion(caseId, "revieweriq");

  // Primary gate: published DemandPackage
  const demandPkgEligibility = useDemandPackageLaunchEligibility(caseId);

  return useMemo<EvaluateEligibility>(() => {
    if (!hasEvaluateIQ) {
      return { eligible: false, inputSource: null, sourceVersion: null, blockerReason: "EvaluateIQ module is not enabled for this tenant." };
    }

    if (!caseId) {
      return { eligible: false, inputSource: null, sourceVersion: null, blockerReason: "No case selected." };
    }

    // Must have a published DemandPackage — this is the hard gate
    if (!demandPkgEligibility.eligible) {
      return {
        eligible: false,
        inputSource: null,
        sourceVersion: null,
        blockerReason: demandPkgEligibility.blockers[0] || "A published DemandPackage is required before starting evaluation.",
      };
    }

    // Preferred: ReviewerIQ completed → use as input source (optional enrichment)
    if (hasReviewerIQ && reviewerCompletion?.status === ModuleCompletionStatus.Completed) {
      return {
        eligible: true,
        inputSource: "revieweriq",
        sourceVersion: reviewerCompletion.version,
        blockerReason: null,
        demandPackageVersion: demandPkgEligibility.package_version,
        demandPackageId: demandPkgEligibility.package_id,
      };
    }

    // Fallback: DemandPackage alone is sufficient
    return {
      eligible: true,
      inputSource: "demandiq",
      sourceVersion: demandPkgEligibility.package_version,
      blockerReason: null,
      demandPackageVersion: demandPkgEligibility.package_version,
      demandPackageId: demandPkgEligibility.package_id,
    };
  }, [hasEvaluateIQ, hasReviewerIQ, caseId, reviewerCompletion, demandPkgEligibility]);
}
