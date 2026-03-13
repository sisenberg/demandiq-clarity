/**
 * EvaluateIQ — Intake Readiness Card
 *
 * Shows the upstream package status, completeness, unresolved issues,
 * and provisional evaluation flags.
 */

import type { PackageValidationResult, PackageReadinessState, ValidationFinding } from "@/lib/reviewPackageValidator";
import {
  Package,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Clock,
  Shield,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";

interface Props {
  validation: PackageValidationResult | null;
  packageVersion: number | null;
  sourceModule: string;
  publishedAt: string | null;
  isProvisional: boolean;
  onRefresh?: () => void;
}

const READINESS_CONFIG: Record<PackageReadinessState, {
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  evaluation_ready: {
    label: "Evaluation Ready",
    icon: CheckCircle2,
    color: "text-[hsl(var(--status-approved))]",
    bgColor: "bg-[hsl(var(--status-approved))]/10",
    borderColor: "border-[hsl(var(--status-approved))]/30",
  },
  provisional: {
    label: "Provisional",
    icon: AlertTriangle,
    color: "text-[hsl(var(--status-attention))]",
    bgColor: "bg-[hsl(var(--status-attention))]/10",
    borderColor: "border-[hsl(var(--status-attention))]/30",
  },
  not_ready: {
    label: "Not Ready",
    icon: XCircle,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive/30",
  },
  contract_mismatch: {
    label: "Contract Mismatch",
    icon: Shield,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive/30",
  },
};

const EvalIntakeReadinessCard = ({
  validation,
  packageVersion,
  sourceModule,
  publishedAt,
  isProvisional,
  onRefresh,
}: Props) => {
  const [showFindings, setShowFindings] = useState(false);

  if (!validation) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Package className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-[12px] font-semibold text-foreground">Intake Readiness</h3>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span className="text-[11px]">Awaiting upstream package…</span>
        </div>
      </div>
    );
  }

  const config = READINESS_CONFIG[validation.readiness];
  const StatusIcon = config.icon;
  const sourceLabel = sourceModule === "revieweriq" ? "ReviewerIQ" : "DemandIQ";

  return (
    <div className={`rounded-xl border bg-card overflow-hidden ${config.borderColor}`}>
      {/* Header */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <h3 className="text-[12px] font-semibold text-foreground">Intake Readiness</h3>
          </div>
          {onRefresh && (
            <button onClick={onRefresh} className="btn-ghost text-[10px]" title="Refresh from upstream">
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 mb-3">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md ${config.bgColor}`}>
            <StatusIcon className={`h-3.5 w-3.5 ${config.color}`} />
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${config.color}`}>
              {config.label}
            </span>
          </div>
          {isProvisional && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]">
              Provisional Evaluation
            </span>
          )}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricItem label="Source" value={`${sourceLabel} v${packageVersion ?? "—"}`} />
          <MetricItem label="Completeness" value={`${validation.completeness_score}%`} accent={validation.completeness_score >= 80} />
          <MetricItem label="Unresolved Issues" value={String(validation.unresolved_issue_count)} warn={validation.unresolved_issue_count > 0} />
          <MetricItem label="Published" value={publishedAt ? new Date(publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"} />
        </div>

        {/* Finding counts */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
          {validation.error_count > 0 && (
            <FindingCount icon={XCircle} count={validation.error_count} label="errors" color="text-destructive" />
          )}
          {validation.warning_count > 0 && (
            <FindingCount icon={AlertTriangle} count={validation.warning_count} label="warnings" color="text-[hsl(var(--status-attention))]" />
          )}
          {validation.info_count > 0 && (
            <FindingCount icon={Info} count={validation.info_count} label="info" color="text-muted-foreground" />
          )}
          <div className="flex-1" />
          {validation.findings.length > 0 && (
            <button
              onClick={() => setShowFindings(!showFindings)}
              className="flex items-center gap-1 text-[10px] text-primary font-medium hover:underline"
            >
              {showFindings ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {showFindings ? "Hide" : "View"} findings
            </button>
          )}
        </div>
      </div>

      {/* Findings detail */}
      {showFindings && validation.findings.length > 0 && (
        <div className="border-t border-border bg-accent/20 px-5 py-3 space-y-1.5 max-h-64 overflow-y-auto">
          {validation.findings.map((f, i) => (
            <FindingRow key={i} finding={f} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Sub-components ─────────────────────────────────────

function MetricItem({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div>
      <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      <p className={`text-[13px] font-bold mt-0.5 ${
        warn ? "text-[hsl(var(--status-attention))]" : accent ? "text-primary" : "text-foreground"
      }`}>
        {value}
      </p>
    </div>
  );
}

function FindingCount({ icon: Icon, count, label, color }: { icon: React.ElementType; count: number; label: string; color: string }) {
  return (
    <div className={`flex items-center gap-1 ${color}`}>
      <Icon className="h-3 w-3" />
      <span className="text-[10px] font-semibold">{count} {label}</span>
    </div>
  );
}

function FindingRow({ finding }: { finding: ValidationFinding }) {
  const iconMap = { error: XCircle, warning: AlertTriangle, info: Info };
  const colorMap = { error: "text-destructive", warning: "text-[hsl(var(--status-attention))]", info: "text-muted-foreground" };
  const Icon = iconMap[finding.severity];

  return (
    <div className="flex items-start gap-2 py-1">
      <Icon className={`h-3 w-3 shrink-0 mt-0.5 ${colorMap[finding.severity]}`} />
      <div className="min-w-0 flex-1">
        <span className="text-[10px] font-mono text-muted-foreground">{finding.field}</span>
        <p className="text-[10px] text-foreground leading-snug">{finding.message}</p>
      </div>
    </div>
  );
}

export default EvalIntakeReadinessCard;
