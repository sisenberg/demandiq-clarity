import { useAuth } from "@/contexts/AuthContext";
import { isEntitlementActive } from "@/hooks/useModuleEntitlements";
import { useModuleCompletion } from "@/hooks/useModuleCompletion";
import { useEvaluateEligibility } from "@/hooks/useEvaluateEligibility";
import { useStartEvaluate, deriveEvaluateState } from "@/hooks/useEvaluateState";
import { useEvaluateIntakeSnapshot } from "@/hooks/useEvaluateIntakeSnapshot";
import { ModuleId } from "@/types";
import EvaluateIntakeSummaryPanel from "@/components/case/EvaluateIntakeSummaryPanel";
import {
  EvaluateModuleState,
  EVALUATE_STATE_LABEL,
  EVALUATE_STATE_BADGE_CLASS,
  getEvaluateCTA,
} from "@/types/evaluateiq";
import EmptyState from "@/components/ui/EmptyState";
import {
  Calculator,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Play,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  caseId: string;
}

const EvaluateInlineWorkspace = ({ caseId }: Props) => {
  const { entitlements } = useAuth();
  const hasModule = isEntitlementActive(entitlements, ModuleId.EvaluateIQ);
  const { data: evalCompletion } = useModuleCompletion(caseId, "evaluateiq");
  const eligibility = useEvaluateEligibility(caseId);
  const startEvaluate = useStartEvaluate();
  const { snapshot } = useEvaluateIntakeSnapshot(caseId);

  const moduleState = deriveEvaluateState(evalCompletion?.status);
  const cta = getEvaluateCTA(moduleState);

  if (!hasModule) {
    return (
      <EmptyState
        icon={Lock}
        title="EvaluateIQ Not Enabled"
        description="This module is not included in your current plan. Contact your administrator to enable EvaluateIQ."
      />
    );
  }

  const handleCTA = () => {
    if (cta?.action === "start" || cta?.action === "resume") {
      startEvaluate.mutate({
        caseId,
        demandPackageId: eligibility.demandPackageId,
        demandPackageVersion: eligibility.demandPackageVersion,
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Calculator className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-foreground">EvaluateIQ</h3>
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${EVALUATE_STATE_BADGE_CLASS[moduleState]}`}>
              {EVALUATE_STATE_LABEL[moduleState]}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {eligibility.inputSource && (
            <span className="text-[10px] font-medium text-muted-foreground bg-accent px-2 py-1 rounded-md">
              Source: {eligibility.inputSource === "revieweriq" ? "ReviewerIQ" : "DemandIQ"} v{eligibility.sourceVersion}
            </span>
          )}

          {/* Open workspace link */}
          {eligibility.eligible && moduleState !== EvaluateModuleState.NotStarted && (
            <Link
              to={`/cases/${caseId}/evaluate`}
              className="btn-secondary"
            >
              <ExternalLink className="h-3 w-3" /> Open Workspace
            </Link>
          )}

          {cta && eligibility.eligible && (
            <button
              onClick={handleCTA}
              disabled={startEvaluate.isPending}
              className="btn-primary"
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
              Completed · v{evalCompletion.version}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {!eligibility.eligible && (
        <EmptyState
          icon={AlertTriangle}
          title="Upstream Package Required"
          description={eligibility.blockerReason || "An upstream module must be completed before evaluation can begin."}
        />
      )}

      {eligibility.eligible && moduleState === EvaluateModuleState.NotStarted && (
        <EmptyState
          icon={Calculator}
          title="Ready to Evaluate"
          description={`A completed ${eligibility.inputSource === "revieweriq" ? "ReviewerIQ" : "DemandIQ"} package (v${eligibility.sourceVersion}) is available. Click "Start Evaluate" to begin.`}
          action={
            <button onClick={handleCTA} disabled={startEvaluate.isPending} className="btn-primary">
              <Play className="h-3.5 w-3.5" /> Start Evaluate
            </button>
          }
        />
      )}

      {eligibility.eligible && moduleState !== EvaluateModuleState.NotStarted && moduleState !== EvaluateModuleState.Completed && snapshot && (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
          <div className="lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto">
            <EvaluateIntakeSummaryPanel snapshot={snapshot} />
          </div>
          <div className="space-y-4">
            <div className="card-elevated p-5 text-center">
              <p className="text-[11px] text-muted-foreground mb-3">
                Full valuation workspace is available in the dedicated view.
              </p>
              <Link to={`/cases/${caseId}/evaluate`} className="btn-primary">
                <ExternalLink className="h-3.5 w-3.5" /> Open Full Workspace
              </Link>
            </div>
          </div>
        </div>
      )}

      {moduleState === EvaluateModuleState.Completed && (
        <EmptyState
          icon={CheckCircle2}
          title="Evaluation Complete"
          description={`Evaluation completed as version ${evalCompletion?.version}.`}
        />
      )}
    </div>
  );
};

export default EvaluateInlineWorkspace;
