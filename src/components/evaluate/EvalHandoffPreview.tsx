/**
 * EvaluateIQ — Handoff Preview Card
 *
 * Renders a structured preview of the NegotiateIQ handoff object
 * within the EvaluateIQ workspace. Shows corridor, authority zones,
 * strengths/weaknesses, gaps, and unresolved issues.
 */

import type { EvalNegotiationHandoff, EvalHandoffPoint, EvalHandoffGap, EvalHandoffIssue } from "@/types/evaluate-package-v1";
import {
  ArrowRight,
  Target,
  Shield,
  TrendingUp,
  TrendingDown,
  HelpCircle,
  FileWarning,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Scale,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

interface Props {
  handoff: EvalNegotiationHandoff;
}

const EvalHandoffPreview = ({ handoff }: Props) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["corridor", "zones"]));

  const toggle = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const isOpen = (key: string) => expandedSections.has(key);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <ArrowRight className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">NegotiateIQ Handoff</h3>
            <p className="text-[10px] text-muted-foreground">Structured outputs for downstream consumption</p>
          </div>
        </div>
        <ConfidenceBadge level={handoff.confidence_level} score={handoff.confidence_score} />
      </div>

      {/* Adjusted Corridor */}
      <CollapsibleSection
        title="Adjusted Settlement Corridor"
        icon={<DollarSign className="h-3.5 w-3.5" />}
        isOpen={isOpen("corridor")}
        onToggle={() => toggle("corridor")}
        badge={handoff.adjusted_corridor.is_overridden ? "Overridden" : undefined}
        badgeVariant={handoff.adjusted_corridor.is_overridden ? "attention" : undefined}
      >
        <div className="grid grid-cols-3 gap-3">
          <CorridorCell label="Floor" value={handoff.adjusted_corridor.floor} />
          <CorridorCell label="Likely" value={handoff.adjusted_corridor.likely} highlight />
          <CorridorCell label="Stretch" value={handoff.adjusted_corridor.stretch} />
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border">
          <span>Reviewed Specials: {fmtCurrency(handoff.total_reviewed_specials)}</span>
          <span>Billed: {fmtCurrency(handoff.total_billed_specials)}</span>
          {handoff.policy_limits != null && <span>Policy Limits: {fmtCurrency(handoff.policy_limits)}</span>}
        </div>
      </CollapsibleSection>

      {/* Authority Zones */}
      <CollapsibleSection
        title="Authority Zones"
        icon={<Target className="h-3.5 w-3.5" />}
        isOpen={isOpen("zones")}
        onToggle={() => toggle("zones")}
      >
        <div className="space-y-3">
          <ZoneRow
            label="Opening Zone"
            anchor={handoff.recommended_opening_zone.anchor}
            ceiling={handoff.recommended_opening_zone.ceiling}
            rationale={handoff.recommended_opening_zone.rationale}
            color="primary"
          />
          <ZoneRow
            label="Target Zone"
            anchor={handoff.target_settlement_zone.floor}
            ceiling={handoff.target_settlement_zone.target}
            rationale={handoff.target_settlement_zone.rationale}
            color="approved"
          />
          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 text-xs">
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium text-foreground">Walk-Away Floor</span>
            </div>
            <span className="font-bold text-foreground">{handoff.walk_away_floor != null ? fmtCurrency(handoff.walk_away_floor) : "—"}</span>
          </div>
        </div>
      </CollapsibleSection>

      {/* Escalation */}
      {handoff.escalation_threshold.review_required && (
        <div className="rounded-lg border border-[hsl(var(--status-attention))]/30 bg-[hsl(var(--status-attention))]/5 p-3">
          <div className="flex items-center gap-2 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--status-attention))]" />
            <span className="font-semibold text-[hsl(var(--status-attention))]">Escalation Threshold</span>
            <span className="ml-auto font-bold text-foreground">{handoff.escalation_threshold.amount != null ? fmtCurrency(handoff.escalation_threshold.amount) : "—"}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 ml-5">{handoff.escalation_threshold.rationale}</p>
        </div>
      )}

      {/* Strengths */}
      <CollapsibleSection
        title={`Key Strengths (${handoff.key_strengths.length})`}
        icon={<TrendingUp className="h-3.5 w-3.5" />}
        isOpen={isOpen("strengths")}
        onToggle={() => toggle("strengths")}
        badgeCount={handoff.key_strengths.length}
      >
        {handoff.key_strengths.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">No key strengths identified</p>
        ) : (
          <div className="space-y-1.5">
            {handoff.key_strengths.map((pt, i) => <HandoffPointRow key={i} point={pt} variant="strength" />)}
          </div>
        )}
      </CollapsibleSection>

      {/* Weaknesses */}
      <CollapsibleSection
        title={`Key Weaknesses (${handoff.key_weaknesses.length})`}
        icon={<TrendingDown className="h-3.5 w-3.5" />}
        isOpen={isOpen("weaknesses")}
        onToggle={() => toggle("weaknesses")}
        badgeCount={handoff.key_weaknesses.length}
      >
        {handoff.key_weaknesses.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">No key weaknesses identified</p>
        ) : (
          <div className="space-y-1.5">
            {handoff.key_weaknesses.map((pt, i) => <HandoffPointRow key={i} point={pt} variant="weakness" />)}
          </div>
        )}
      </CollapsibleSection>

      {/* Uncertainties */}
      {handoff.key_uncertainties.length > 0 && (
        <CollapsibleSection
          title={`Uncertainty Drivers (${handoff.key_uncertainties.length})`}
          icon={<HelpCircle className="h-3.5 w-3.5" />}
          isOpen={isOpen("uncertainties")}
          onToggle={() => toggle("uncertainties")}
        >
          <div className="space-y-1.5">
            {handoff.key_uncertainties.map((pt, i) => <HandoffPointRow key={i} point={pt} variant="uncertainty" />)}
          </div>
        </CollapsibleSection>
      )}

      {/* Documentation Gaps */}
      {handoff.documentation_gaps.length > 0 && (
        <CollapsibleSection
          title={`Documentation Gaps (${handoff.documentation_gaps.length})`}
          icon={<FileWarning className="h-3.5 w-3.5" />}
          isOpen={isOpen("gaps")}
          onToggle={() => toggle("gaps")}
          badgeVariant="attention"
        >
          <div className="space-y-1.5">
            {handoff.documentation_gaps.map((gap, i) => <GapRow key={i} gap={gap} />)}
          </div>
        </CollapsibleSection>
      )}

      {/* Unresolved Issues */}
      {handoff.unresolved_issues.length > 0 && (
        <CollapsibleSection
          title={`Unresolved Issues (${handoff.unresolved_issues.length})`}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          isOpen={isOpen("issues")}
          onToggle={() => toggle("issues")}
          badgeVariant={handoff.unresolved_issues.some(i => i.severity === "critical") ? "destructive" : "attention"}
        >
          <div className="space-y-1.5">
            {handoff.unresolved_issues.map((issue, i) => <IssueRow key={i} issue={issue} />)}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
};

// ─── Sub-components ──────────────────────────────────────

function ConfidenceBadge({ level, score }: { level: string; score: number | null }) {
  const colors: Record<string, string> = {
    high: "text-[hsl(var(--status-approved))] bg-[hsl(var(--status-approved))]/10 border-[hsl(var(--status-approved))]/20",
    moderate: "text-primary bg-primary/10 border-primary/20",
    low: "text-[hsl(var(--status-attention))] bg-[hsl(var(--status-attention))]/10 border-[hsl(var(--status-attention))]/20",
    insufficient: "text-destructive bg-destructive/10 border-destructive/20",
  };
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${colors[level] ?? colors.insufficient}`}>
      {level} {score != null ? `(${(score * 100).toFixed(0)}%)` : ""}
    </span>
  );
}

function CollapsibleSection({
  title,
  icon,
  isOpen,
  onToggle,
  children,
  badge,
  badgeVariant,
  badgeCount,
}: {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: string;
  badgeVariant?: "attention" | "destructive";
  badgeCount?: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-accent/50 transition-colors text-left">
        <span className="text-primary">{icon}</span>
        <span className="text-[11px] font-semibold text-foreground flex-1">{title}</span>
        {badge && (
          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
            badgeVariant === "destructive"
              ? "text-destructive bg-destructive/10"
              : badgeVariant === "attention"
              ? "text-[hsl(var(--status-attention))] bg-[hsl(var(--status-attention))]/10"
              : "text-muted-foreground bg-muted"
          }`}>
            {badge}
          </span>
        )}
        {isOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
      </button>
      {isOpen && <div className="px-4 pb-3 pt-1">{children}</div>}
    </div>
  );
}

function CorridorCell({ label, value, highlight }: { label: string; value: number | null; highlight?: boolean }) {
  return (
    <div className={`text-center p-2.5 rounded-md ${highlight ? "bg-primary/5 border border-primary/20" : "bg-muted/30"}`}>
      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-sm font-bold ${highlight ? "text-primary" : "text-foreground"}`}>
        {value != null ? fmtCurrency(value) : "—"}
      </p>
    </div>
  );
}

function ZoneRow({
  label,
  anchor,
  ceiling,
  rationale,
  color,
}: {
  label: string;
  anchor: number | null;
  ceiling: number | null;
  rationale: string;
  color: "primary" | "approved";
}) {
  const colorClass = color === "primary" ? "text-primary" : "text-[hsl(var(--status-approved))]";
  return (
    <div className="py-2 px-3 rounded-lg bg-muted/30">
      <div className="flex items-center justify-between text-xs">
        <span className={`font-semibold ${colorClass}`}>{label}</span>
        <span className="font-bold text-foreground">
          {anchor != null ? fmtCurrency(anchor) : "—"}
          {ceiling != null && ceiling !== anchor ? ` — ${fmtCurrency(ceiling)}` : ""}
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5">{rationale}</p>
    </div>
  );
}

function HandoffPointRow({ point, variant }: { point: EvalHandoffPoint; variant: "strength" | "weakness" | "uncertainty" }) {
  const iconMap = {
    strength: <CheckCircle2 className="h-3 w-3 text-[hsl(var(--status-approved))]" />,
    weakness: <TrendingDown className="h-3 w-3 text-destructive" />,
    uncertainty: <HelpCircle className="h-3 w-3 text-[hsl(var(--status-attention))]" />,
  };
  const impactColors: Record<string, string> = {
    high: "text-foreground font-bold",
    medium: "text-muted-foreground font-medium",
    low: "text-muted-foreground",
  };

  return (
    <div className="flex items-start gap-2 py-1.5 px-2 rounded-md bg-muted/20">
      <div className="mt-0.5">{iconMap[variant]}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-foreground">{point.label}</span>
          <span className={`text-[9px] uppercase tracking-wider ${impactColors[point.impact]}`}>{point.impact}</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">{point.description}</p>
        {point.evidence_ref_ids.length > 0 && (
          <p className="text-[9px] text-muted-foreground/70 mt-0.5">{point.evidence_ref_ids.length} evidence ref{point.evidence_ref_ids.length > 1 ? "s" : ""}</p>
        )}
      </div>
    </div>
  );
}

function GapRow({ gap }: { gap: EvalHandoffGap }) {
  const severityColors: Record<string, string> = {
    critical: "text-destructive",
    moderate: "text-[hsl(var(--status-attention))]",
    minor: "text-muted-foreground",
  };
  return (
    <div className="flex items-start gap-2 py-1.5 px-2 rounded-md bg-muted/20">
      <FileWarning className={`h-3 w-3 mt-0.5 ${severityColors[gap.severity]}`} />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-foreground">{gap.label}</span>
          <span className={`text-[9px] uppercase tracking-wider ${severityColors[gap.severity]}`}>{gap.severity}</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">{gap.impact_on_valuation}</p>
      </div>
    </div>
  );
}

function IssueRow({ issue }: { issue: EvalHandoffIssue }) {
  const severityColors: Record<string, string> = {
    critical: "text-destructive",
    warning: "text-[hsl(var(--status-attention))]",
    info: "text-muted-foreground",
  };
  return (
    <div className="flex items-start gap-2 py-1.5 px-2 rounded-md bg-muted/20">
      <Scale className={`h-3 w-3 mt-0.5 ${severityColors[issue.severity]}`} />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-foreground capitalize">{issue.category}</span>
          <span className={`text-[9px] uppercase tracking-wider ${severityColors[issue.severity]}`}>{issue.severity}</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">{issue.description}</p>
        <p className="text-[10px] text-primary/80 mt-0.5 italic">{issue.recommendation}</p>
      </div>
    </div>
  );
}

function fmtCurrency(val: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

export default EvalHandoffPreview;
