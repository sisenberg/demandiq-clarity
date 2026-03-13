/**
 * NegotiateIQ — Representation Context Panel
 *
 * Displays current representation status, transition history,
 * attorney-retention risk, and timeline of representation changes.
 */

import type { NegotiateRepresentationView } from "@/lib/negotiateViewModel";
import type { NegotiateRepresentationContext, RepresentationChangeRecord } from "@/types/negotiate-persistence";
import {
  UserCheck,
  UserX,
  HelpCircle,
  AlertTriangle,
  ArrowRightLeft,
  Scale,
  Clock,
  ShieldAlert,
} from "lucide-react";

interface NegotiateRepresentationPanelProps {
  representation: NegotiateRepresentationView;
  sessionContext?: NegotiateRepresentationContext | null;
  onRefreshStrategy?: () => void;
  strategyRefreshAvailable?: boolean;
}

const STATUS_CONFIG: Record<string, {
  icon: React.ElementType;
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}> = {
  represented: {
    icon: UserCheck,
    label: "Represented",
    bgClass: "bg-primary/10",
    textClass: "text-primary",
    borderClass: "border-primary/20",
  },
  unrepresented: {
    icon: UserX,
    label: "Unrepresented",
    bgClass: "bg-[hsl(var(--status-attention))]/10",
    textClass: "text-[hsl(var(--status-attention))]",
    borderClass: "border-[hsl(var(--status-attention))]/20",
  },
  unknown: {
    icon: HelpCircle,
    label: "Unknown",
    bgClass: "bg-muted",
    textClass: "text-muted-foreground",
    borderClass: "border-border",
  },
};

const NegotiateRepresentationPanel = ({
  representation,
  sessionContext,
  onRefreshStrategy,
  strategyRefreshAvailable,
}: NegotiateRepresentationPanelProps) => {
  const config = STATUS_CONFIG[representation.status] ?? STATUS_CONFIG.unknown;
  const StatusIcon = config.icon;

  const retentionRiskLevel =
    representation.retentionRisk >= 70
      ? "high"
      : representation.retentionRisk >= 40
        ? "moderate"
        : "low";

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center gap-1.5">
        <Scale className="h-3 w-3 text-muted-foreground" />
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Representation
        </h3>
      </div>

      {/* Status Badge */}
      <div className={`rounded-xl border ${config.borderClass} ${config.bgClass} p-3`}>
        <div className="flex items-center gap-2">
          <div className={`h-6 w-6 rounded-lg ${config.bgClass} flex items-center justify-center`}>
            <StatusIcon className={`h-3 w-3 ${config.textClass}`} />
          </div>
          <div>
            <p className={`text-[11px] font-semibold ${config.textClass}`}>
              {config.label}
            </p>
            {representation.attorneyName && (
              <p className="text-[9px] text-muted-foreground mt-0.5">
                {representation.attorneyName}
                {representation.firmName ? ` · ${representation.firmName}` : ""}
              </p>
            )}
          </div>
        </div>

        {/* Transition Flag */}
        {representation.transitioned && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
            <ArrowRightLeft className="h-3 w-3 text-[hsl(var(--status-attention))]" />
            <p className="text-[9px] font-medium text-[hsl(var(--status-attention))]">
              Representation changed during claim
            </p>
          </div>
        )}
      </div>

      {/* Retention Risk (unrepresented) */}
      {representation.status === "unrepresented" && representation.retentionRisk > 0 && (
        <div className={`rounded-lg border px-3 py-2 ${
          retentionRiskLevel === "high"
            ? "border-destructive/30 bg-destructive/5"
            : retentionRiskLevel === "moderate"
              ? "border-[hsl(var(--status-attention))]/30 bg-[hsl(var(--status-attention))]/5"
              : "border-border bg-card"
        }`}>
          <div className="flex items-center gap-1.5">
            <ShieldAlert className={`h-3 w-3 ${
              retentionRiskLevel === "high"
                ? "text-destructive"
                : retentionRiskLevel === "moderate"
                  ? "text-[hsl(var(--status-attention))]"
                  : "text-muted-foreground"
            }`} />
            <p className="text-[9px] font-semibold text-foreground">
              Attorney Retention Risk: {retentionRiskLevel.charAt(0).toUpperCase() + retentionRiskLevel.slice(1)}
            </p>
            <span className="text-[8px] text-muted-foreground ml-auto">
              {representation.retentionRisk}%
            </span>
          </div>
          <p className="text-[8px] text-muted-foreground mt-1 leading-relaxed">
            {retentionRiskLevel === "high"
              ? "Delay may increase the likelihood of attorney retention, which could shift negotiation dynamics."
              : retentionRiskLevel === "moderate"
                ? "Moderate risk of attorney retention. Consider proactive direct-resolution approach."
                : "Low retention risk at this time."}
          </p>
        </div>
      )}

      {/* Quick Facts */}
      <div className="grid grid-cols-2 gap-1.5">
        <QuickFact
          label="History Events"
          value={representation.historyCount.toString()}
          icon={Clock}
        />
        <QuickFact
          label="Retained During Claim"
          value={representation.attorneyRetainedDuringClaim ? "Yes" : "No"}
          icon={UserCheck}
          highlight={representation.attorneyRetainedDuringClaim}
        />
        {representation.attorneyRetainedAfterInitialOffer && (
          <QuickFact
            label="Retained After Offer"
            value="Yes"
            icon={AlertTriangle}
            highlight
          />
        )}
      </div>

      {/* Strategy Refresh CTA */}
      {strategyRefreshAvailable && onRefreshStrategy && (
        <button
          onClick={onRefreshStrategy}
          className="w-full flex items-center justify-center gap-1.5 text-[10px] font-semibold px-3 py-2 rounded-lg border border-[hsl(var(--status-attention))]/30 bg-[hsl(var(--status-attention))]/5 text-[hsl(var(--status-attention))] hover:bg-[hsl(var(--status-attention))]/10 transition-colors"
        >
          <AlertTriangle className="h-3 w-3" />
          Representation Changed — Refresh Strategy
        </button>
      )}

      {/* Session Change History */}
      {sessionContext && sessionContext.representation_changes.length > 0 && (
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Changes During Negotiation
          </p>
          <div className="space-y-1">
            {sessionContext.representation_changes.map((change, i) => (
              <RepresentationChangeEntry key={i} change={change} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

function QuickFact({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-2 py-1.5">
      <div className="flex items-center gap-1">
        <Icon className={`h-2.5 w-2.5 ${highlight ? "text-[hsl(var(--status-attention))]" : "text-muted-foreground"}`} />
        <span className="text-[8px] text-muted-foreground">{label}</span>
      </div>
      <p className={`text-[10px] font-semibold mt-0.5 ${highlight ? "text-[hsl(var(--status-attention))]" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function RepresentationChangeEntry({ change }: { change: RepresentationChangeRecord }) {
  return (
    <div className="flex gap-2 py-1 px-2 rounded-md bg-accent/30">
      <ArrowRightLeft className="h-2.5 w-2.5 text-[hsl(var(--status-attention))] mt-0.5 shrink-0" />
      <div>
        <p className="text-[9px] text-foreground">
          <span className="font-medium">{change.previous_status}</span>
          {" → "}
          <span className="font-medium">{change.new_status}</span>
          {change.attorney_name ? ` (${change.attorney_name})` : ""}
        </p>
        <p className="text-[7px] text-muted-foreground mt-0.5">
          {new Date(change.occurred_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>
    </div>
  );
}

export default NegotiateRepresentationPanel;
