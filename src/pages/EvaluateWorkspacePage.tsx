import { useState, useMemo } from "react";
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
import EvalValuationCards from "@/components/evaluate/EvalValuationCards";
import EvalIntakeReadinessCard from "@/components/evaluate/EvalIntakeReadinessCard";
import EvalStickyActions from "@/components/evaluate/EvalStickyActions";
import EvalStaleDataBanner from "@/components/evaluate/EvalStaleDataBanner";
import EvalClaimProfileCard from "@/components/evaluate/EvalClaimProfileCard";
import { classifyClaimProfile } from "@/lib/claimProfileClassifier";
import EvalFactorTaxonomyPanel from "@/components/evaluate/EvalFactorTaxonomyPanel";
import EvalScoringRankedSummary from "@/components/evaluate/EvalScoringRankedSummary";
import EvalMeritsScoreCard from "@/components/evaluate/EvalMeritsScoreCard";
import EvalMeritsCorridorCard from "@/components/evaluate/EvalMeritsCorridorCard";
import EvalPostMeritAdjustmentCard from "@/components/evaluate/EvalPostMeritAdjustmentCard";
import EvalDocSufficiencyCard from "@/components/evaluate/EvalDocSufficiencyCard";
import EvalBenchmarkCard from "@/components/evaluate/EvalBenchmarkCard";
import EvalCorridorSummary from "@/components/evaluate/EvalCorridorSummary";
import {
  ArrowLeft,
  Calculator,
  Inbox,
  Lock,
  AlertTriangle,
  Play,
  Clock,
  Tag,
  Cpu,
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
  const isProvisional = moduleState === EvaluateModuleState.ProvisionalEvaluation;

  const claimProfile = useMemo(() => snapshot ? classifyClaimProfile(snapshot) : null, [snapshot]);

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
      {/* ── Top Header — Dense Enterprise Bar ────── */}
      <div className="shrink-0 bg-card border-b border-border">
        {/* Row 1: Identity + Status */}
        <div className="px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={`/cases/${caseId}`} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calculator className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-foreground">EvaluateIQ</h1>
                <span className="text-[10px] text-muted-foreground font-mono">·</span>
                <span className="text-[11px] text-muted-foreground truncate max-w-[240px]">{claimVsInsured}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[10px] text-muted-foreground font-mono">{caseData.case_number}</span>
                {caseData.jurisdiction_state && (
                  <span className="text-[10px] text-muted-foreground">{caseData.jurisdiction_state}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Engine version badge */}
            <span className="text-[9px] font-mono text-muted-foreground/70 bg-accent px-1.5 py-0.5 rounded flex items-center gap-1">
              <Cpu className="h-2.5 w-2.5" /> v1.0.0
            </span>

            {/* Source module */}
            {eligibility.inputSource && (
              <span className="text-[9px] font-medium text-muted-foreground bg-accent px-2 py-1 rounded-md flex items-center gap-1">
                <Tag className="h-2.5 w-2.5" />
                {eligibility.inputSource === "revieweriq" ? "ReviewerIQ" : "DemandIQ"} v{eligibility.sourceVersion}
              </span>
            )}

            {/* Provisional flag */}
            {isProvisional && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))] border border-[hsl(var(--status-attention))]/20 flex items-center gap-1">
                <AlertTriangle className="h-2.5 w-2.5" /> Provisional
              </span>
            )}

            {/* Module state */}
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md ${EVALUATE_STATE_BADGE_CLASS[moduleState]} bg-current/5 border border-current/15`}>
              {EVALUATE_STATE_LABEL[moduleState]}
            </span>
          </div>
        </div>

        {/* Row 2: Workspace Tabs */}
        {isWorkspaceActive && (
          <div className="px-6 border-t border-border pt-1 pb-0">
            <EvaluateWorkspaceTabs active={activeTab} onChange={setActiveTab} />
          </div>
        )}
      </div>

      {/* ── Body: Three-Panel Layout ──────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel */}
        {isWorkspaceActive && (
          <EvalLeftPanel
            snapshot={snapshot}
            moduleState={moduleState}
            caseNumber={caseData.case_number}
            claimVsInsured={claimVsInsured}
            inputSource={eligibility.inputSource}
            sourceVersion={eligibility.sourceVersion}
            isStale={isStale}
            claimProfile={claimProfile}
          />
        )}

        {/* Center panel */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 max-w-5xl mx-auto">
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
              <div className="space-y-6">
                <div className="mt-6">
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
                <EvalValuationCards />
              </div>
            )}

            {/* Active workspace */}
            {isWorkspaceActive && snapshot && (
              <div className="space-y-4">
                {/* Stale banner */}
                <EvalStaleDataBanner
                  isStale={isStale}
                  staleReason=""
                  upstreamModule={upstreamModuleId}
                  upstreamVersion={eligibility.sourceVersion}
                  onRefresh={() => {
                    toast.info("Refreshing inputs from upstream package…");
                  }}
                />

                {/* ── Overview Tab ────────────────────── */}
                {activeTab === "overview" && (
                  <div className="space-y-4">
                    {/* 1. Corridor summary hero */}
                    <EvalCorridorSummary snapshot={snapshot} isProvisional={isProvisional} />

                    {/* 2. Claim profile */}
                    {claimProfile && <EvalClaimProfileCard profile={claimProfile} />}

                    {/* 3. Merits + Corridor + Adjustments (dense grid) */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <EvalMeritsScoreCard snapshot={snapshot} />
                      <EvalMeritsCorridorCard snapshot={snapshot} />
                    </div>

                    {/* 4. Post-merit adjustments */}
                    <EvalPostMeritAdjustmentCard snapshot={snapshot} />

                    {/* 5. Documentation Sufficiency */}
                    <EvalDocSufficiencyCard snapshot={snapshot} />

                    {/* 6. Case facts overview */}
                    <EvalOverviewTab snapshot={snapshot} />
                  </div>
                )}

                {/* ── Drivers Tab ────────────────────── */}
                {activeTab === "drivers" && (
                  <div className="space-y-4">
                    <EvalScoringRankedSummary snapshot={snapshot} />
                    <EvalFactorTaxonomyPanel snapshot={snapshot} />
                    <EvalDriversTab snapshot={snapshot} />
                  </div>
                )}

                {/* ── Range Tab ──────────────────────── */}
                {activeTab === "range" && <EvalRangeTab snapshot={snapshot} />}

                {/* ── Explanation Tab ─────────────────── */}
                {activeTab === "explanation" && <EvalExplanationTab snapshot={snapshot} />}

                {/* ── Evidence Tab ────────────────────── */}
                {activeTab === "evidence" && <EvalEvidenceTab snapshot={snapshot} />}

                {/* ── Calibration Tab ─────────────────── */}
                {activeTab === "calibration" && <EvalBenchmarkCard snapshot={snapshot} />}

                {/* ── Handoff Tab ─────────────────────── */}
                {activeTab === "handoff" && <EvalHandoffTab snapshot={snapshot} />}
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
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
          onAccept={() => toast.info("Package accepted. Ready for publish.")}
          onPublish={() => toast.info("Publishing evaluation package…")}
        />
      )}
    </div>
  );
};

export default EvaluateWorkspacePage;
