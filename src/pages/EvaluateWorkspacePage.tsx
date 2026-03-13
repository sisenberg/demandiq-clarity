import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { useCase } from "@/hooks/useCases";
import { useAuth } from "@/contexts/AuthContext";
import { useModuleCompletion } from "@/hooks/useModuleCompletion";
import { useEvaluateEligibility } from "@/hooks/useEvaluateEligibility";
import { useStartEvaluate, deriveEvaluateState } from "@/hooks/useEvaluateState";
import { useEvaluateIntakeSnapshot } from "@/hooks/useEvaluateIntakeSnapshot";
import { useCompleteEvaluate, useReopenEvaluate, validateEvaluateCompletion } from "@/hooks/useEvaluateCompletion";
import { useIsUpstreamCurrent } from "@/hooks/useUpstreamSnapshot";
import { isEntitlementActive } from "@/hooks/useModuleEntitlements";
import { ModuleId } from "@/types";
import {
  EvaluateModuleState,
  EVALUATE_STATE_LABEL,
  EVALUATE_STATE_BADGE_CLASS,
  getEvaluateCTA,
} from "@/types/evaluateiq";
import { PageLoading } from "@/components/ui/LoadingSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import EvaluateWorkspaceTabs, { type EvalTab } from "@/components/evaluate/EvaluateWorkspaceTabs";
import EvalLeftPanel from "@/components/evaluate/EvalLeftPanel";
import EvalRightPanel from "@/components/evaluate/EvalRightPanel";
import EvalOverviewTab from "@/components/evaluate/EvalOverviewTab";
import EvalDriversTab from "@/components/evaluate/EvalDriversTab";
import EvalRangeTab from "@/components/evaluate/EvalRangeTab";
import EvalEvidenceTab from "@/components/evaluate/EvalEvidenceTab";
import EvalExplanationTab from "@/components/evaluate/EvalExplanationTab";
import EvalHandoffTab from "@/components/evaluate/EvalHandoffTab";
import EvalPlaceholderTab from "@/components/evaluate/EvalPlaceholderTab";
import EvalValuationCards from "@/components/evaluate/EvalValuationCards";
import EvalIntakeReadinessCard from "@/components/evaluate/EvalIntakeReadinessCard";
import EvalStickyActions from "@/components/evaluate/EvalStickyActions";
import EvalStaleDataBanner from "@/components/evaluate/EvalStaleDataBanner";
import {
  ArrowLeft,
  Calculator,
  Inbox,
  Lock,
  AlertTriangle,
  Play,
} from "lucide-react";

const EvaluateWorkspacePage = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const { entitlements } = useAuth();
  const { data: caseData, isLoading: caseLoading } = useCase(caseId);
  const { data: evalCompletion } = useModuleCompletion(caseId, "evaluateiq");
  const eligibility = useEvaluateEligibility(caseId);
  const startEvaluate = useStartEvaluate();
  const completeEvaluate = useCompleteEvaluate();
  const reopenEvaluate = useReopenEvaluate();
  const { snapshot } = useEvaluateIntakeSnapshot(caseId);

  const hasModule = isEntitlementActive(entitlements, ModuleId.EvaluateIQ);
  const moduleState = deriveEvaluateState(evalCompletion?.status);
  const cta = getEvaluateCTA(moduleState);
  const isWorkspaceActive = eligibility.eligible && moduleState !== EvaluateModuleState.NotStarted;

  // Upstream freshness
  const upstreamModuleId = eligibility.inputSource === "revieweriq" ? "revieweriq" : "demandiq";
  const { data: upstreamFreshness } = useIsUpstreamCurrent(caseId, "evaluateiq", upstreamModuleId);
  const isStale = isWorkspaceActive && upstreamFreshness ? !upstreamFreshness.isCurrent : false;

  const [activeTab, setActiveTab] = useState<EvalTab>("overview");

  if (caseLoading) return <PageLoading message="Loading case…" />;

  if (!hasModule) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-16">
        <EmptyState
          icon={Lock}
          title="EvaluateIQ Not Enabled"
          description="This module is not included in your current plan. Contact your administrator to enable EvaluateIQ."
        />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="p-8">
        <Link to="/cases" className="text-sm text-primary hover:underline flex items-center gap-1 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Cases
        </Link>
        <EmptyState icon={Inbox} title="Case not found" description="This case may have been removed or you don't have access." />
      </div>
    );
  }

  const handleCTA = () => {
    if (!caseId) return;
    if (cta?.action === "start" || cta?.action === "resume") {
      startEvaluate.mutate(caseId);
    } else if (cta?.action === "complete" && snapshot) {
      const validation = validateEvaluateCompletion(snapshot, evalCompletion?.status);
      if (!validation.valid) {
        validation.errors.forEach((e) => toast.error(e));
        return;
      }
      completeEvaluate.mutate({
        caseId,
        snapshot,
        sourceModule: eligibility.inputSource ?? "demandiq",
        sourceVersion: eligibility.sourceVersion ?? 1,
        explanationLedger: null,
      });
    }
  };

  const isPending = startEvaluate.isPending || completeEvaluate.isPending;
  const claimVsInsured = caseData.title || `${caseData.claimant} v. ${caseData.insured}`;

  return (
    <div className="flex flex-col h-full">
      {/* ── Top Header ────────────────────────────── */}
      <div className="shrink-0 bg-card border-b border-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={`/cases/${caseId}`} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calculator className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground">EvaluateIQ</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {claimVsInsured} · {caseData.case_number}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {eligibility.inputSource && (
              <span className="text-[10px] font-medium text-muted-foreground bg-accent px-2 py-1 rounded-md">
                Source: {eligibility.inputSource === "revieweriq" ? "ReviewerIQ" : "DemandIQ"} v{eligibility.sourceVersion}
              </span>
            )}
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md ${EVALUATE_STATE_BADGE_CLASS[moduleState]}`}>
              {EVALUATE_STATE_LABEL[moduleState]}
            </span>
          </div>
        </div>

        {isWorkspaceActive && (
          <div className="mt-2 -mb-3 border-t border-border pt-2">
            <EvaluateWorkspaceTabs active={activeTab} onChange={setActiveTab} />
          </div>
        )}
      </div>

      {/* ── Body: Three-Panel Layout ──────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel — only when workspace is active */}
        {isWorkspaceActive && (
          <EvalLeftPanel
            snapshot={snapshot}
            moduleState={moduleState}
            caseNumber={caseData.case_number}
            claimVsInsured={claimVsInsured}
            inputSource={eligibility.inputSource}
            sourceVersion={eligibility.sourceVersion}
            isStale={isStale}
          />
        )}

        {/* Center panel */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-5xl mx-auto">
            {/* Blocked */}
            {!eligibility.eligible && (
              <div className="mt-12">
                <EmptyState
                  icon={AlertTriangle}
                  title="Upstream Package Required"
                  description={eligibility.blockerReason || "An upstream module must be completed before evaluation can begin."}
                />
              </div>
            )}

            {/* Not started */}
            {eligibility.eligible && moduleState === EvaluateModuleState.NotStarted && (
              <div className="space-y-8">
                <div className="mt-8">
                  <EmptyState
                    icon={Calculator}
                    title="Ready to Evaluate"
                    description={`This case has a completed ${eligibility.inputSource === "revieweriq" ? "ReviewerIQ" : "DemandIQ"} package (v${eligibility.sourceVersion}). Click "Start Evaluate" to begin the valuation workflow.`}
                    action={
                      <button onClick={handleCTA} disabled={startEvaluate.isPending} className="btn-primary">
                        <Play className="h-3.5 w-3.5" /> Start Evaluate
                      </button>
                    }
                  />
                </div>
                {/* Show placeholder valuation cards before starting */}
                <EvalValuationCards />
              </div>
            )}

            {/* Active workspace */}
            {isWorkspaceActive && snapshot && (
              <div className="space-y-5">
                <EvalIntakeReadinessCard
                  validation={null}
                  packageVersion={eligibility.sourceVersion}
                  sourceModule={eligibility.inputSource ?? "demandiq"}
                  publishedAt={null}
                  isProvisional={false}
                />

                <EvalStaleDataBanner
                  isStale={isStale}
                  staleReason=""
                  upstreamModule={upstreamModuleId}
                  upstreamVersion={eligibility.sourceVersion}
                  onRefresh={() => {
                    toast.info("Refreshing inputs from upstream package…");
                  }}
                />

                {activeTab === "overview" && <EvalOverviewTab snapshot={snapshot} />}
                {activeTab === "drivers" && <EvalDriversTab snapshot={snapshot} />}
                {activeTab === "range" && <EvalRangeTab snapshot={snapshot} />}
                {activeTab === "explanation" && <EvalExplanationTab snapshot={snapshot} />}
                {activeTab === "evidence" && <EvalEvidenceTab snapshot={snapshot} />}
                {activeTab === "calibration" && <EvalPlaceholderTab tab="calibration" />}
                {activeTab === "handoff" && <EvalHandoffTab snapshot={snapshot} />}
              </div>
            )}
          </div>
        </div>

        {/* Right panel — only when workspace is active */}
        {isWorkspaceActive && (
          <EvalRightPanel snapshot={snapshot} caseId={caseId} />
        )}
      </div>

      {/* ── Sticky Actions ────────────────────────── */}
      {isWorkspaceActive && (
        <EvalStickyActions
          moduleState={moduleState}
          onCTA={handleCTA}
          isPending={isPending}
        />
      )}
    </div>
  );
};

export default EvaluateWorkspacePage;
