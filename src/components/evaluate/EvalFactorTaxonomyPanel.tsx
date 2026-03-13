/**
 * EvaluateIQ — Registry-Driven Factor Panel
 *
 * Renders scored factors grouped by layer using definitions from the
 * factor registry. Not hard-coded — all labels, descriptions, and
 * structure come from the registry.
 *
 * Shows evidence citations, confirmation state, extraction confidence,
 * issue flags, and suppression state per factor.
 */

import { useState, useMemo } from "react";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import type {
  FactorLayer,
  ScoredFactor,
  LayerSummary,
  FactorDirection,
  FactorIssueFlag,
} from "@/types/factor-taxonomy";
import { FACTOR_LAYER_META } from "@/types/factor-taxonomy";
import { scoreAllFactors } from "@/lib/factorScoringEngine";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  Lock,
  Layers,
  Info,
  FileText,
  Eye,
  ShieldAlert,
  CircleDot,
} from "lucide-react";

interface Props {
  snapshot: EvaluateIntakeSnapshot;
}

const EvalFactorTaxonomyPanel = ({ snapshot }: Props) => {
  const result = useMemo(() => scoreAllFactors(snapshot), [snapshot]);
  const [expandedLayer, setExpandedLayer] = useState<FactorLayer | null>(null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Factor Taxonomy
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {result.applicable_count} factors scored · {result.evidenced_count} with evidence · {result.suppressed_count} suppressed · {result.total_issue_count} issue(s)
          </p>
        </div>

        {/* Gate status */}
        <div className={`flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-md ${
          result.gates_passed
            ? "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]"
            : "bg-destructive/10 text-destructive"
        }`}>
          {result.gates_passed ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {result.gates_passed ? "All Gates Passed" : `${result.gate_failures.length} Gate Failure(s)`}
        </div>
      </div>

      {/* Gate failures */}
      {!result.gates_passed && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-1">
          <p className="text-[10px] font-semibold text-destructive">Readiness Gate Failures:</p>
          {result.gate_failures.map((name, i) => (
            <p key={i} className="text-[10px] text-destructive/80 pl-3">• {name}</p>
          ))}
        </div>
      )}

      {/* Layer cards */}
      <div className="space-y-2">
        {result.layer_summaries.map((ls) => (
          <LayerCard
            key={ls.layer}
            summary={ls}
            factors={result.scored_factors.filter(f => f.definition.layer === ls.layer)}
            expanded={expandedLayer === ls.layer}
            onToggle={() => setExpandedLayer(expandedLayer === ls.layer ? null : ls.layer)}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Layer Card ─────────────────────────────────────────

function LayerCard({ summary, factors, expanded, onToggle }: {
  summary: LayerSummary;
  factors: ScoredFactor[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const DirIcon = directionIcon(summary.net_direction);
  const dirColor = directionColor(summary.net_direction);
  const isGateLayer = summary.layer === 0;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button onClick={onToggle} className="w-full p-4 text-left hover:bg-accent/30 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-[12px] font-bold text-primary">L{summary.layer}</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-[12px] font-semibold text-foreground">{summary.label}</h3>
              <p className="text-[10px] text-muted-foreground">{FACTOR_LAYER_META[summary.layer].description}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {summary.issue_count > 0 && (
              <span className="flex items-center gap-1 text-[9px] text-destructive">
                <AlertTriangle className="h-2.5 w-2.5" /> {summary.issue_count}
              </span>
            )}
            {summary.suppressed_count > 0 && (
              <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                <Lock className="h-2.5 w-2.5" /> {summary.suppressed_count}
              </span>
            )}
            {isGateLayer && summary.gate_passed !== null && (
              <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                summary.gate_passed
                  ? "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]"
                  : "bg-destructive/10 text-destructive"
              }`}>
                {summary.gate_passed ? "Passed" : "Failed"}
              </span>
            )}
            {!isGateLayer && summary.avg_score !== null && (
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-bold text-foreground">{summary.avg_score}</span>
                <DirIcon className={`h-3 w-3 ${dirColor}`} />
              </div>
            )}
            <span className="text-[9px] text-muted-foreground">{summary.scored_count}/{summary.factor_count}</span>
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {factors.map(f => <FactorRow key={f.factor_id} factor={f} />)}
        </div>
      )}
    </div>
  );
}

// ─── Factor Row ─────────────────────────────────────────

function FactorRow({ factor }: { factor: ScoredFactor }) {
  const [showDetail, setShowDetail] = useState(false);
  const def = factor.definition;
  const DirIcon = directionIcon(factor.direction);
  const dirColor = directionColor(factor.direction);

  return (
    <div className="bg-card">
      <button onClick={() => setShowDetail(!showDetail)} className="w-full px-4 py-3 text-left hover:bg-accent/20 transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {factor.suppressed && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
            {!factor.applicable && !factor.suppressed && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-foreground">{def.name}</span>
              {factor.suppressed && (
                <span className="text-[9px] text-destructive/70 ml-2">(suppressed)</span>
              )}
              {!factor.applicable && !factor.suppressed && (
                <span className="text-[9px] text-muted-foreground ml-2">({factor.inapplicable_reason})</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {factor.issue_flags.length > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] text-destructive">
                <AlertTriangle className="h-2.5 w-2.5" /> {factor.issue_flags.length}
              </span>
            )}
            {factor.applicable && !factor.suppressed && def.score_type === "ordinal_0_5" && (
              <OrdinalBar score={factor.score} max={5} />
            )}
            {factor.applicable && !factor.suppressed && def.score_type === "binary" && (
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${factor.score >= 1 ? "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]" : "bg-destructive/10 text-destructive"}`}>
                {factor.score >= 1 ? "Pass" : "Fail"}
              </span>
            )}
            {factor.applicable && !factor.suppressed && def.score_type === "percentage" && (
              <span className="text-[11px] font-semibold text-foreground">{factor.score}%</span>
            )}
            {factor.applicable && !factor.suppressed && (
              <DirIcon className={`h-3 w-3 ${dirColor}`} />
            )}
            <ConfirmationBadge state={factor.confirmation.state} />
            <ConfidenceDot confidence={factor.confidence} />
          </div>
        </div>
      </button>

      {showDetail && (
        <div className="px-4 pb-3 space-y-2.5 bg-muted/20">
          {/* Description */}
          <div className="flex items-start gap-2">
            <Info className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">{def.description}</p>
          </div>

          {/* Narrative */}
          <p className="text-[10px] text-foreground leading-relaxed">{factor.narrative}</p>

          {/* Metadata row */}
          <div className="flex items-center gap-4 text-[9px] text-muted-foreground flex-wrap">
            <span>Input: <code className="bg-accent px-1 py-0.5 rounded">{factor.raw_input}</code></span>
            <span>Evidence: {factor.evidence_ref_ids.length} ref(s)</span>
            <span>v{def.version}</span>
          </div>

          {/* Citations */}
          {factor.citations.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Citations ({factor.citations.length})</span>
              </div>
              {factor.citations.slice(0, 5).map((c, i) => (
                <div key={i} className="pl-5 text-[9px] text-foreground/70 flex items-start gap-1.5">
                  <span className={`shrink-0 px-1 py-0.5 rounded text-[8px] font-semibold uppercase ${
                    c.relevance_type === "direct" ? "bg-primary/10 text-primary" :
                    c.relevance_type === "corroborating" ? "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {c.relevance_type}
                  </span>
                  <span className="truncate">{c.quoted_text}</span>
                </div>
              ))}
              {factor.citations.length > 5 && (
                <p className="pl-5 text-[9px] text-muted-foreground">+{factor.citations.length - 5} more</p>
              )}
            </div>
          )}

          {/* Extraction confidence */}
          {factor.extraction_confidence && (
            <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
              <Eye className="h-3 w-3" />
              <span>Extraction confidence: <strong className="text-foreground">{factor.extraction_confidence.label}</strong></span>
              {factor.extraction_confidence.score !== null && (
                <span>({factor.extraction_confidence.score}%)</span>
              )}
              {factor.extraction_confidence.source_field && (
                <span>from <code className="bg-accent px-1 py-0.5 rounded">{factor.extraction_confidence.source_field}</code></span>
              )}
            </div>
          )}

          {/* Confirmation state */}
          <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
            <CircleDot className="h-3 w-3" />
            <span>Confirmation: <strong className="text-foreground">{confirmationLabel(factor.confirmation.state)}</strong></span>
            {factor.confirmation.reviewed_by && (
              <span>by {factor.confirmation.reviewed_by}</span>
            )}
            {factor.confirmation.adjustment_notes && (
              <span className="text-foreground/70">— {factor.confirmation.adjustment_notes}</span>
            )}
          </div>

          {/* Issue flags */}
          {factor.issue_flags.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="h-3 w-3 text-destructive" />
                <span className="text-[9px] font-semibold uppercase tracking-wider text-destructive">Issues ({factor.issue_flags.length})</span>
              </div>
              {factor.issue_flags.map((flag) => (
                <IssueFlagRow key={flag.id} flag={flag} />
              ))}
            </div>
          )}

          {/* Suppression info */}
          {factor.suppressed && factor.suppression_reason && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/5 border border-destructive/10 px-3 py-2">
              <Lock className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
              <p className="text-[9px] text-destructive">{factor.suppression_reason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Issue Flag Row ─────────────────────────────────────

function IssueFlagRow({ flag }: { flag: FactorIssueFlag }) {
  const sevColor = flag.severity === "critical" ? "text-destructive" :
    flag.severity === "high" ? "text-destructive/80" :
    flag.severity === "medium" ? "text-[hsl(var(--status-attention))]" :
    "text-muted-foreground";

  return (
    <div className="pl-5 flex items-start gap-2 text-[9px]">
      <span className={`shrink-0 font-semibold uppercase ${sevColor}`}>{flag.severity}</span>
      <span className="text-foreground/70">{flag.description}</span>
    </div>
  );
}

// ─── Confirmation Badge ─────────────────────────────────

function ConfirmationBadge({ state }: { state: string }) {
  if (state === "ai_scored") return null; // default, don't show
  const cls = state === "reviewer_accepted"
    ? "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]"
    : state === "reviewer_adjusted"
      ? "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]"
      : "bg-muted text-muted-foreground";
  return (
    <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded ${cls}`}>
      {confirmationLabel(state)}
    </span>
  );
}

function confirmationLabel(state: string): string {
  switch (state) {
    case "ai_scored": return "AI Scored";
    case "reviewer_accepted": return "Reviewer Accepted";
    case "reviewer_adjusted": return "Reviewer Adjusted";
    case "unreviewed": return "Unreviewed";
    default: return state;
  }
}

// ─── Ordinal Bar ────────────────────────────────────────

function OrdinalBar({ score, max }: { score: number; max: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`h-2.5 w-3 rounded-sm ${
            i < score
              ? score >= 4 ? "bg-[hsl(var(--status-attention))]" : score >= 2 ? "bg-primary" : "bg-muted-foreground/40"
              : "bg-accent"
          }`}
        />
      ))}
      <span className="text-[9px] font-semibold text-foreground ml-1">{score}/{max}</span>
    </div>
  );
}

// ─── Confidence Dot ─────────────────────────────────────

function ConfidenceDot({ confidence }: { confidence: string }) {
  const cls = confidence === "high" ? "bg-[hsl(var(--status-approved))]" : confidence === "moderate" ? "bg-[hsl(var(--status-attention))]" : "bg-muted-foreground/30";
  return <div className={`h-2 w-2 rounded-full ${cls}`} title={`${confidence} confidence`} />;
}

// ─── Direction Helpers ──────────────────────────────────

function directionIcon(dir: FactorDirection) {
  switch (dir) {
    case "expander": return TrendingUp;
    case "reducer": return TrendingDown;
    case "constraint": return Shield;
    default: return Minus;
  }
}

function directionColor(dir: FactorDirection) {
  switch (dir) {
    case "expander": return "text-[hsl(var(--status-attention))]";
    case "reducer": return "text-[hsl(var(--status-approved))]";
    case "constraint": return "text-destructive";
    default: return "text-muted-foreground";
  }
}

export default EvalFactorTaxonomyPanel;
