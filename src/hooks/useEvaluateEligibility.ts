import { useMemo } from "react";
import { useModuleCompletion } from "@/hooks/useModuleCompletion";
import { useAuth } from "@/contexts/AuthContext";
import { isEntitlementActive } from "@/hooks/useModuleEntitlements";
import { ModuleCompletionStatus, ModuleId } from "@/types";
import type { EvaluateEligibility } from "@/types/evaluateiq";

/**
 * Determines whether a case is eligible for EvaluateIQ.
 * 
 * Preferred input: latest completed ReviewPackage v1
 * Fallback: latest completed DemandPackage v1 (when ReviewerIQ not present/completed)
 */
export function useEvaluateEligibility(caseId: string | undefined): EvaluateEligibility {
  const { entitlements } = useAuth();
  const hasEvaluateIQ = isEntitlementActive(entitlements, ModuleId.EvaluateIQ);
  const hasReviewerIQ = isEntitlementActive(entitlements, ModuleId.ReviewerIQ);

  const { data: reviewerCompletion } = useModuleCompletion(caseId, "revieweriq");
  const { data: demandCompletion } = useModuleCompletion(caseId, "demandiq");

  return useMemo<EvaluateEligibility>(() => {
    if (!hasEvaluateIQ) {
      return { eligible: false, inputSource: null, sourceVersion: null, blockerReason: "EvaluateIQ module is not enabled for this tenant." };
    }

    if (!caseId) {
      return { eligible: false, inputSource: null, sourceVersion: null, blockerReason: "No case selected." };
    }

    // Preferred: ReviewerIQ completed
    if (hasReviewerIQ && reviewerCompletion?.status === ModuleCompletionStatus.Completed) {
      return { eligible: true, inputSource: "revieweriq", sourceVersion: reviewerCompletion.version, blockerReason: null };
    }

    // EvaluateIQ must still work from DemandIQ alone when ReviewerIQ is absent or incomplete.
    if (demandCompletion?.status === ModuleCompletionStatus.Completed) {
      return { eligible: true, inputSource: "demandiq", sourceVersion: demandCompletion.version, blockerReason: null };
    }

    return {
      eligible: false,
      inputSource: null,
      sourceVersion: null,
      blockerReason: "DemandIQ must be completed before starting evaluation.",
    };
  }, [hasEvaluateIQ, hasReviewerIQ, caseId, reviewerCompletion, demandCompletion]);
}
