import { useAuth } from "@/contexts/AuthContext";
import { isEntitlementActive } from "@/hooks/useModuleEntitlements";
import { useModuleCompletion } from "@/hooks/useModuleCompletion";
import { useEvaluateEligibility } from "@/hooks/useEvaluateEligibility";
import { useStartEvaluate, deriveEvaluateState } from "@/hooks/useEvaluateState";
import { ModuleId } from "@/types";
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
} from "lucide-react";

interface Props {
  caseId: string;
}

const EvaluateInlineWorkspace = ({ caseId }: Props) => {
  const { entitlements } = useAuth();
  const hasModule = isEntitlementActive(entitlements, ModuleId.EvaluateIQ);
  const { data: evalCompletion } = useModuleCompletion(caseId, "evaluateiq");
  const eligibility = useEvaluateEligibility(caseId);
  const startEvaluate = useStartEvaluate();

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
      startEvaluate.mutate(caseId);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[hsl(var(--status-approved))]/10 flex items-center justify-center">
            <Calculator className="h-4 w-4 text-[hsl(var(--status-approved))]" />
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

      {eligibility.eligible && moduleState !== EvaluateModuleState.NotStarted && moduleState !== EvaluateModuleState.Completed && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
