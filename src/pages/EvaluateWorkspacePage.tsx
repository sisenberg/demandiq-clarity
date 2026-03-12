import { useParams, Link } from "react-router-dom";
import { useCase } from "@/hooks/useCases";
import { useAuth } from "@/contexts/AuthContext";
import { useModuleCompletion } from "@/hooks/useModuleCompletion";
import { useEvaluateEligibility } from "@/hooks/useEvaluateEligibility";
import { useStartEvaluate, deriveEvaluateState } from "@/hooks/useEvaluateState";
import { useEvaluateIntakeSnapshot } from "@/hooks/useEvaluateIntakeSnapshot";
import { isEntitlementActive } from "@/hooks/useModuleEntitlements";
import { ModuleId, ModuleCompletionStatus } from "@/types";
import EvaluateIntakeSummaryPanel from "@/components/case/EvaluateIntakeSummaryPanel";
import {
  EvaluateModuleState,
  EVALUATE_STATE_LABEL,
  EVALUATE_STATE_BADGE_CLASS,
  getEvaluateCTA,
} from "@/types/evaluateiq";
import { PageLoading } from "@/components/ui/LoadingSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import {
  ArrowLeft,
  Calculator,
  Inbox,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Play,
  RotateCcw,
} from "lucide-react";

const EvaluateWorkspacePage = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const { entitlements } = useAuth();
  const { data: caseData, isLoading: caseLoading } = useCase(caseId);
  const { data: evalCompletion } = useModuleCompletion(caseId, "evaluateiq");
  const eligibility = useEvaluateEligibility(caseId);
  const startEvaluate = useStartEvaluate();

  const hasModule = isEntitlementActive(entitlements, ModuleId.EvaluateIQ);
  const moduleState = deriveEvaluateState(evalCompletion?.status);
  const cta = getEvaluateCTA(moduleState);
  const { snapshot } = useEvaluateIntakeSnapshot(caseId);

  if (caseLoading) return <PageLoading message="Loading case…" />;

  // Module not subscribed
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
    }
    // "complete" will be handled in the full implementation
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={`/cases/${caseId}`} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="h-8 w-8 rounded-lg bg-[hsl(var(--status-approved))]/10 flex items-center justify-center">
              <Calculator className="h-4 w-4 text-[hsl(var(--status-approved))]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-foreground">EvaluateIQ</h1>
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${EVALUATE_STATE_BADGE_CLASS[moduleState]}`}>
                  {EVALUATE_STATE_LABEL[moduleState]}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {caseData.title || `${caseData.claimant} v. ${caseData.insured}`} · {caseData.case_number}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Source badge */}
            {eligibility.inputSource && (
              <span className="text-[10px] font-medium text-muted-foreground bg-accent px-2 py-1 rounded-md">
                Source: {eligibility.inputSource === "revieweriq" ? "ReviewerIQ" : "DemandIQ"} v{eligibility.sourceVersion}
              </span>
            )}

            {/* CTA */}
            {cta && eligibility.eligible && (
              <button
                onClick={handleCTA}
                disabled={startEvaluate.isPending}
                className="flex items-center gap-1.5 text-[11px] font-semibold px-3.5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all disabled:opacity-50"
              >
                {cta.action === "start" && <Play className="h-3.5 w-3.5" />}
                {cta.action === "resume" && <RotateCcw className="h-3.5 w-3.5" />}
                {cta.action === "complete" && <CheckCircle2 className="h-3.5 w-3.5" />}
                {cta.label}
              </button>
            )}

            {moduleState === EvaluateModuleState.Completed && evalCompletion && (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold px-3.5 py-2 rounded-lg border border-[hsl(var(--status-approved))]/25 bg-[hsl(var(--status-approved))]/8 text-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Evaluate Completed · v{evalCompletion.version}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-4xl mx-auto">
          {/* Blocked state — not eligible */}
          {!eligibility.eligible && (
            <div className="mt-12">
              <EmptyState
                icon={AlertTriangle}
                title="Upstream Package Required"
                description={eligibility.blockerReason || "An upstream module must be completed before evaluation can begin."}
              />
            </div>
          )}

          {/* Eligible but not started */}
          {eligibility.eligible && moduleState === EvaluateModuleState.NotStarted && (
            <div className="mt-12">
              <EmptyState
                icon={Calculator}
                title="Ready to Evaluate"
                description={`This case has a completed ${eligibility.inputSource === "revieweriq" ? "ReviewerIQ" : "DemandIQ"} package (v${eligibility.sourceVersion}). Click "Start Evaluate" to begin the valuation workflow.`}
                action={
                  <button
                    onClick={handleCTA}
                    disabled={startEvaluate.isPending}
                    className="btn-primary"
                  >
                    <Play className="h-3.5 w-3.5" /> Start Evaluate
                  </button>
                }
              />
            </div>
          )}

          {eligibility.eligible && moduleState !== EvaluateModuleState.NotStarted && moduleState !== EvaluateModuleState.Completed && (
            <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
              {snapshot && (
                <div className="lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto">
                  <EvaluateIntakeSummaryPanel snapshot={snapshot} />
                </div>
              )}
              <div className="space-y-4">
                {[
                  { title: "Damages Summary", desc: "Economic and non-economic damages breakdown" },
                  { title: "Comparable Verdicts", desc: "Jurisdiction-specific verdict and settlement data" },
                  { title: "Settlement Range", desc: "Modeled settlement range with confidence intervals" },
                  { title: "Risk Factors", desc: "Liability, coverage, and documentation risk adjustments" },
                ].map((card) => (
                  <div key={card.title} className="rounded-xl border border-border bg-card p-5">
                    <h3 className="text-[13px] font-semibold text-foreground mb-1">{card.title}</h3>
                    <p className="text-[11px] text-muted-foreground mb-4">{card.desc}</p>
                    <div className="h-24 rounded-lg bg-accent/50 border border-dashed border-border flex items-center justify-center">
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Coming Soon</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed state */}
          {moduleState === EvaluateModuleState.Completed && (
            <div className="mt-12">
              <EmptyState
                icon={CheckCircle2}
                title="Evaluation Complete"
                description={`Evaluation completed as version ${evalCompletion?.version}. The valuation package has been handed off to downstream modules.`}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EvaluateWorkspacePage;
