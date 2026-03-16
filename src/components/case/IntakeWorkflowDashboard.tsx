/**
 * Intake Workflow Dashboard
 *
 * Displays the simplified 8-step pipeline flow with a
 * collapsible detailed 10-step view underneath.
 */

import { useState } from "react";
import {
  CheckCircle2, Circle, Loader2,
  ChevronDown, ChevronRight,
  ArrowRight, ClipboardCheck,
} from "lucide-react";
import type { DocumentRow } from "@/hooks/useDocuments";
import {
  useIntakeWorkflow,
  type IntakeWorkflowResult,
} from "@/hooks/useIntakeWorkflow";
import {
  INTAKE_STATE_LABEL,
  INTAKE_STATE_CONFIG,
  type SimplifiedStepStatus,
  type CaseIntakeState,
} from "@/lib/intakeWorkflowEngine";
import {
  useIntakeProgress,
  computeExtractionSummary,
} from "@/hooks/useIntakeOrchestration";

interface Props {
  caseId: string;
  documents: DocumentRow[];
  onNavigate?: (section: string) => void;
}

const JOB_TYPE_LABELS: Record<string, string> = {
  demand_extraction: "Demand Extraction",
  specials_extraction: "Specials Extraction",
  treatment_extraction: "Treatment Extraction",
  injury_extraction: "Injury Extraction",
  general_review: "General Review",
};

const IntakeWorkflowDashboard = ({ caseId, documents, onNavigate }: Props) => {
  const workflow = useIntakeWorkflow(caseId, documents);
  const { state, simplifiedSteps, input, isLoading } = workflow;
  const [showDetailed, setShowDetailed] = useState(false);
  const { data: intakeJobs } = useIntakeProgress(caseId);
  const extractionSummary = intakeJobs ? computeExtractionSummary(intakeJobs) : {};

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
  const completedSteps = simplifiedSteps.filter((s) => s.status === "complete").length;

  return (
    <div className={`card-elevated overflow-hidden border ${config.border}`}>
      {/* ── Header ── */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[13px] font-semibold text-foreground">Intake Workflow</h3>
          <span className={`text-[8px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${config.bg} ${config.color}`}>
            {INTAKE_STATE_LABEL[state]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-accent overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(completedSteps / simplifiedSteps.length) * 100}%` }}
            />
          </div>
          <span className="text-[9px] font-mono text-muted-foreground tabular-nums shrink-0">
            {completedSteps}/{simplifiedSteps.length}
          </span>
        </div>
      </div>

      {/* ── Simplified 8-step flow ── */}
      <div className="px-5 py-4">
        {simplifiedSteps.map((step, idx) => (
          <SimplifiedStepNode
            key={step.step}
            step={step}
            isLast={idx === simplifiedSteps.length - 1}
          />
        ))}
      </div>

      {/* ── Active extraction jobs ── */}
      {Object.keys(extractionSummary).length > 0 && (
        <div className="px-5 py-3 border-t border-border">
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Extraction Jobs</p>
          <div className="space-y-1">
            {Object.entries(extractionSummary).map(([jobType, info]) => (
              <div key={jobType} className="flex items-center gap-2 py-0.5">
                {info.status === "completed" && <CheckCircle2 className="h-3 w-3 text-[hsl(var(--status-approved))]" />}
                {info.status === "running" && <Loader2 className="h-3 w-3 text-[hsl(var(--status-processing))] animate-spin" />}
                {info.status === "queued" && <Circle className="h-3 w-3 text-muted-foreground/40" />}
                {info.status === "failed" && <Circle className="h-3 w-3 text-destructive" />}
                <span className={`text-[10px] ${info.status === "completed" ? "text-foreground" : "text-muted-foreground"}`}>
                  {JOB_TYPE_LABELS[jobType] || jobType}
                </span>
                {info.status === "failed" && info.error && (
                  <span className="text-[9px] text-destructive truncate max-w-[120px]">{info.error}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Detailed toggle ── */}
      <div className="px-5 pb-3">
        <button
          onClick={() => setShowDetailed(!showDetailed)}
          className="flex items-center gap-1.5 text-[9px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {showDetailed ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Show detailed pipeline ({workflow.steps.length} steps)
        </button>
        {showDetailed && (
          <div className="mt-2 pl-1 space-y-0.5">
            {workflow.steps.map((step) => (
              <DetailedStepRow key={step.step} step={step} />
            ))}
          </div>
        )}
      </div>

      {/* ── Action hints ── */}
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

function SimplifiedStepNode({ step, isLast }: { step: SimplifiedStepStatus; isLast: boolean }) {
  const icon = {
    complete: <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-approved))]" />,
    in_progress: <Loader2 className="h-4 w-4 text-[hsl(var(--status-processing))] animate-spin" />,
    pending: <Circle className="h-4 w-4 text-muted-foreground/30" />,
  }[step.status];

  return (
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-3 py-1">
        <div className="shrink-0 w-5 flex justify-center">{icon}</div>
        <span className={`text-[11px] font-medium ${
          step.status === "complete" ? "text-foreground" : "text-muted-foreground"
        }`}>
          {step.label}
        </span>
        {step.detail && (
          <span className="text-[9px] tabular-nums text-muted-foreground">{step.detail}</span>
        )}
      </div>
      {!isLast && (
        <div className="w-5 flex justify-center">
          <div className={`w-px h-3 ${step.status === "complete" ? "bg-[hsl(var(--status-approved))]/40" : "bg-border"}`} />
        </div>
      )}
    </div>
  );
}

function DetailedStepRow({ step }: { step: { step: string; label: string; status: string; detail?: string } }) {
  const icon = {
    complete: <CheckCircle2 className="h-3 w-3 text-[hsl(var(--status-approved))]" />,
    in_progress: <Loader2 className="h-3 w-3 text-[hsl(var(--status-processing))] animate-spin" />,
    pending: <Circle className="h-3 w-3 text-muted-foreground/40" />,
    blocked: <Circle className="h-3 w-3 text-destructive" />,
    skipped: <Circle className="h-3 w-3 text-muted-foreground/20" />,
  }[step.status] ?? <Circle className="h-3 w-3 text-muted-foreground/40" />;

  return (
    <div className="flex items-center gap-2 py-1">
      {icon}
      <span className={`text-[10px] ${step.status === "complete" ? "text-foreground" : "text-muted-foreground"}`}>
        {step.label}
      </span>
      {step.detail && <span className="text-[9px] text-muted-foreground tabular-nums">{step.detail}</span>}
    </div>
  );
}

export default IntakeWorkflowDashboard;
