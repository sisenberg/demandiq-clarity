/**
 * Intake Quality Panel
 *
 * Displays validation state (ready / warning / blocked) with
 * blockers and warnings before publishing to EvaluateIQ.
 */

import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  XCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { useIntakeValidation } from "@/hooks/useIntakeValidation";
import type { IntakeQualityState, IntakeValidationFinding } from "@/lib/intakeValidationEngine";

interface Props {
  caseId: string;
}

const STATE_CONFIG: Record<
  IntakeQualityState,
  {
    label: string;
    icon: React.ElementType;
    color: string;
    bg: string;
    border: string;
    description: string;
  }
> = {
  ready: {
    label: "Ready to Publish",
    icon: ShieldCheck,
    color: "text-[hsl(var(--status-approved))]",
    bg: "bg-[hsl(var(--status-approved))]/10",
    border: "border-[hsl(var(--status-approved))]/30",
    description: "All validation checks passed. Safe to publish to EvaluateIQ.",
  },
  warning: {
    label: "Publishable with Warnings",
    icon: ShieldAlert,
    color: "text-[hsl(var(--status-attention))]",
    bg: "bg-[hsl(var(--status-attention))]/10",
    border: "border-[hsl(var(--status-attention))]/30",
    description:
      "Exceptions detected. Publishing is allowed but findings will be logged.",
  },
  blocked: {
    label: "Blocked",
    icon: ShieldX,
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    description:
      "Critical validation failures must be resolved before publishing.",
  },
};

const IntakeQualityPanel = ({ caseId }: Props) => {
  const { validation, isLoading } = useIntakeValidation(caseId);
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="card-elevated p-5">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-[11px] text-muted-foreground">
            Validating intake data…
          </span>
        </div>
      </div>
    );
  }

  const { state, blockers, warnings, score } = validation;
  const config = STATE_CONFIG[state];
  const StatusIcon = config.icon;
  const totalFindings = blockers.length + warnings.length;

  return (
    <div className={`card-elevated overflow-hidden border ${config.border}`}>
      {/* Header */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-4.5 w-4.5 ${config.color}`} />
            <h3 className="text-[13px] font-semibold text-foreground">
              Intake Quality
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[8px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${config.bg} ${config.color}`}
            >
              {config.label}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
              {score}/100
            </span>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground leading-relaxed mb-3">
          {config.description}
        </p>

        {/* Counts bar */}
        <div className="flex items-center gap-4">
          {blockers.length > 0 && (
            <div className="flex items-center gap-1 text-destructive">
              <XCircle className="h-3 w-3" />
              <span className="text-[10px] font-semibold">
                {blockers.length} blocker{blockers.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
          {warnings.length > 0 && (
            <div className="flex items-center gap-1 text-[hsl(var(--status-attention))]">
              <AlertTriangle className="h-3 w-3" />
              <span className="text-[10px] font-semibold">
                {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
          {totalFindings === 0 && (
            <div className="flex items-center gap-1 text-[hsl(var(--status-approved))]">
              <CheckCircle2 className="h-3 w-3" />
              <span className="text-[10px] font-semibold">All checks passed</span>
            </div>
          )}

          {totalFindings > 0 && (
            <>
              <div className="flex-1" />
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-[10px] text-primary font-medium hover:underline"
              >
                {expanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                {expanded ? "Hide" : "View"} details
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded findings */}
      {expanded && totalFindings > 0 && (
        <div className="border-t border-border bg-accent/20 px-5 py-3 space-y-1.5 max-h-64 overflow-y-auto">
          {blockers.map((f) => (
            <FindingRow key={f.code} finding={f} />
          ))}
          {warnings.map((f) => (
            <FindingRow key={f.code} finding={f} />
          ))}
        </div>
      )}
    </div>
  );
};

function FindingRow({ finding }: { finding: IntakeValidationFinding }) {
  const isBlocker = finding.severity === "blocker";
  return (
    <div className="flex items-start gap-2 py-1">
      {isBlocker ? (
        <XCircle className="h-3 w-3 shrink-0 mt-0.5 text-destructive" />
      ) : (
        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-[hsl(var(--status-attention))]" />
      )}
      <div className="min-w-0 flex-1">
        {finding.field && (
          <span className="text-[9px] font-mono text-muted-foreground">
            {finding.field}
          </span>
        )}
        <p className="text-[10px] text-foreground leading-snug">
          {finding.message}
        </p>
      </div>
    </div>
  );
}

export default IntakeQualityPanel;
