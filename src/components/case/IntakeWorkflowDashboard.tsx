/**
 * Intake Workflow Dashboard
 *
 * Displays the full intake pipeline progress (10 steps),
 * the 6-state workflow indicator, and what still needs review.
 */

import {
  CheckCircle2, Circle, Loader2, XCircle,
  Upload, Eye, FileText, Zap, DollarSign,
  Activity, Bone, Shield, ClipboardCheck, ArrowRight,
} from "lucide-react";
import type { DocumentRow } from "@/hooks/useDocuments";
import {
  useIntakeWorkflow,
  type IntakeWorkflowResult,
} from "@/hooks/useIntakeWorkflow";
import {
  INTAKE_STATE_LABEL,
  INTAKE_STATE_CONFIG,
  type CaseIntakeState,
  type PipelineStepStatus,
  type IntakePipelineStep,
} from "@/lib/intakeWorkflowEngine";

interface Props {
  caseId: string;
  documents: DocumentRow[];
  onNavigate?: (section: string) => void;
}

const STEP_ICONS: Record<IntakePipelineStep, React.ElementType> = {
  upload: Upload,
  ocr: Eye,
  classification: FileText,
  demand_extraction: Zap,
  specials_extraction: DollarSign,
  treatment_extraction: Activity,
  injury_extraction: Bone,
  validation: Shield,
  human_review: ClipboardCheck,
  publish: ArrowRight,
};

const IntakeWorkflowDashboard = ({ caseId, documents, onNavigate }: Props) => {
  const workflow = useIntakeWorkflow(caseId, documents);
  const { state, steps, input, isLoading } = workflow;

  if (isLoading) {
    return (
      <div className="card-elevated p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Computing workflow status…</span>
        </div>
      </div>
    );
  }

  const config = INTAKE_STATE_CONFIG[state];
  const completedSteps = steps.filter((s) => s.status === "complete").length;

  return (
    <div className={`card-elevated overflow-hidden border ${config.border}`}>
      {/* ── Header with state badge ── */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[13px] font-semibold text-foreground">Intake Workflow</h3>
          <span className={`text-[8px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${config.bg} ${config.color}`}>
            {INTAKE_STATE_LABEL[state]}
          </span>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-accent overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(completedSteps / steps.length) * 100}%` }}
            />
          </div>
          <span className="text-[9px] font-mono text-muted-foreground tabular-nums shrink-0">
            {completedSteps}/{steps.length}
          </span>
        </div>
      </div>

      {/* ── Pipeline steps ── */}
      <div className="px-5 py-3 space-y-0.5">
        {steps.map((step, idx) => (
          <PipelineStepRow
            key={step.step}
            step={step}
            isLast={idx === steps.length - 1}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      {/* ── Verification summary ── */}
      <div className="px-5 py-3 border-t border-border bg-accent/20">
        <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Section Verification
        </p>
        <div className="flex flex-wrap gap-1.5">
          <VerifyChip label="Demand" verified={input.demandVerified} onClick={() => onNavigate?.("intake-review")} />
          <VerifyChip label="Specials" verified={input.specialsVerified} onClick={() => onNavigate?.("intake-review")} />
          <VerifyChip label="Treatment" verified={input.treatmentVerified} onClick={() => onNavigate?.("intake-review")} />
          <VerifyChip label="Injury" verified={input.injuryVerified} onClick={() => onNavigate?.("intake-review")} />
        </div>
      </div>

      {/* ── Action hint ── */}
      {state === "review_needed" && (
        <div className="px-5 py-2.5 border-t border-border bg-[hsl(var(--status-attention))]/5">
          <button
            onClick={() => onNavigate?.("intake-review")}
            className="flex items-center gap-1.5 text-[10px] font-medium text-[hsl(var(--status-attention))] hover:underline"
          >
            <ClipboardCheck className="h-3 w-3" />
            Open Intake Review to verify and resolve
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}
      {state === "ready_for_evaluateiq" && (
        <div className="px-5 py-2.5 border-t border-border bg-[hsl(var(--status-approved))]/5">
          <p className="text-[10px] font-medium text-[hsl(var(--status-approved))]">
            ✓ All steps complete — ready to publish to EvaluateIQ
          </p>
        </div>
      )}
      {state === "published_to_evaluateiq" && (
        <div className="px-5 py-2.5 border-t border-border bg-primary/5">
          <p className="text-[10px] font-medium text-primary">
            ✓ Intake package published — EvaluateIQ can consume this data
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Sub-components ─────────────────────────────────────

function PipelineStepRow({ step, isLast, onNavigate }: {
  step: PipelineStepStatus;
  isLast: boolean;
  onNavigate?: (section: string) => void;
}) {
  const Icon = STEP_ICONS[step.step];
  const statusIcon = {
    complete: <CheckCircle2 className="h-3 w-3 text-[hsl(var(--status-approved))]" />,
    in_progress: <Loader2 className="h-3 w-3 text-[hsl(var(--status-processing))] animate-spin" />,
    pending: <Circle className="h-3 w-3 text-muted-foreground/40" />,
    blocked: <XCircle className="h-3 w-3 text-destructive" />,
    skipped: <Circle className="h-3 w-3 text-muted-foreground/20" />,
  }[step.status];

  return (
    <div className="flex items-center gap-3 py-1.5 group">
      {/* Status indicator */}
      <div className="shrink-0">{statusIcon}</div>

      {/* Step icon + label */}
      <Icon className={`h-3 w-3 shrink-0 ${
        step.status === "complete" ? "text-foreground" : "text-muted-foreground"
      }`} />
      <span className={`text-[10px] font-medium flex-1 ${
        step.status === "complete" ? "text-foreground" : step.status === "blocked" ? "text-destructive" : "text-muted-foreground"
      }`}>
        {step.label}
      </span>

      {/* Detail */}
      {step.detail && (
        <span className={`text-[9px] tabular-nums ${
          step.status === "blocked" ? "text-destructive" : "text-muted-foreground"
        }`}>
          {step.detail}
        </span>
      )}
    </div>
  );
}

function VerifyChip({ label, verified, onClick }: { label: string; verified: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 text-[8px] font-semibold px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
        verified
          ? "bg-[hsl(var(--status-approved))]/10 border-[hsl(var(--status-approved))]/20 text-[hsl(var(--status-approved))]"
          : "bg-accent border-border text-muted-foreground hover:border-primary/30 hover:text-primary"
      }`}
    >
      {verified ? <CheckCircle2 className="h-2.5 w-2.5" /> : <Circle className="h-2.5 w-2.5" />}
      {label}
    </button>
  );
}

export default IntakeWorkflowDashboard;
