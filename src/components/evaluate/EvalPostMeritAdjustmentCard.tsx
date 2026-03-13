/**
 * EvaluateIQ — Post-Merit Adjustment Card
 *
 * Shows the before-and-after corridor, each adjustment independently,
 * and a full audit trail.
 */

import { useMemo, useState } from "react";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import { classifyClaimProfile } from "@/lib/claimProfileClassifier";
import { scoreAllFactors } from "@/lib/factorScoringEngine";
import { computeWeightedMeritsScore } from "@/lib/profileWeightingEngine";
import { computeMeritsCorridor } from "@/lib/meritsCorridorEngine";
import {
  computePostMeritAdjustments,
  type AdjustedSettlementCorridor,
  type PostMeritAdjustment,
  type AdjustmentDirection,
} from "@/lib/postMeritAdjustmentEngine";
import {
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Expand,
  ClipboardList,
  ShieldCheck,
  ShieldAlert,
  Eye,
} from "lucide-react";

interface Props {
  snapshot: EvaluateIntakeSnapshot;
}

const EvalPostMeritAdjustmentCard = ({ snapshot }: Props) => {
  const [showAdjustments, setShowAdjustments] = useState(true);
  const [showAudit, setShowAudit] = useState(false);

  const result = useMemo(() => {
    const profile = classifyClaimProfile(snapshot);
    const scoring = scoreAllFactors(snapshot);
    const merits = computeWeightedMeritsScore(scoring, profile.primary);
    const corridor = computeMeritsCorridor(merits, scoring.top_drivers, scoring.top_suppressors);
    return computePostMeritAdjustments(corridor, snapshot);
  }, [snapshot]);

  return (
    <div className="card-elevated overflow-hidden">
      {/* Header */}
      <div className="p-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-foreground">Post-Merit Adjustments</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {result.applied_adjustments.length} adjustment(s) applied • Net: <DirectionBadge direction={result.net_direction} />
            </p>
          </div>
        </div>

        {/* Before → After visualization */}
        <div className="mt-4">
          <BeforeAfterComparison result={result} />
        </div>

        {/* Summary */}
        <p className="mt-3 text-[10px] text-muted-foreground leading-relaxed">
          {result.summary}
        </p>
      </div>

      {/* Individual adjustments */}
      <button
        onClick={() => setShowAdjustments(!showAdjustments)}
        className="w-full px-5 py-3 border-t border-border flex items-center justify-between hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold text-foreground">
            Adjustment Details ({result.adjustments.length})
          </span>
        </div>
        {showAdjustments ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {showAdjustments && (
        <div className="px-5 pb-4 border-t border-border pt-3 space-y-3">
          {result.adjustments.map(adj => (
            <AdjustmentRow key={adj.id} adjustment={adj} />
          ))}
        </div>
      )}

      {/* Audit trail */}
      <button
        onClick={() => setShowAudit(!showAudit)}
        className="w-full px-5 py-3 border-t border-border flex items-center justify-between hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold text-foreground">Audit Trail</span>
        </div>
        {showAudit ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {showAudit && (
        <div className="px-5 pb-4 border-t border-border pt-3">
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-accent/50">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Adjustment</th>
                  <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Applied</th>
                  <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Direction</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Effect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.audit_trail.map((entry, i) => (
                  <tr key={i} className="hover:bg-accent/20">
                    <td className="px-3 py-2 text-foreground font-medium capitalize">
                      {entry.category.replace(/_/g, " ")}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {entry.applied
                        ? <ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--status-approved))] inline" />
                        : <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground inline" />}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <DirectionBadge direction={entry.direction} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{entry.effect_summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Sub-components ────────────────────────────────────

function BeforeAfterComparison({ result }: { result: AdjustedSettlementCorridor }) {
  const { merits_corridor: before, adjusted: after } = result;
  const hasChange = before.low !== after.low || before.mid !== after.mid || before.high !== after.high;

  return (
    <div className="flex items-center gap-3">
      {/* Before */}
      <div className="flex-1 rounded-lg border border-border p-3">
        <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Merits Corridor</p>
        <div className="flex items-center justify-between">
          <BandValue label="Low" value={before.low} />
          <BandValue label="Mid" value={before.mid} highlight />
          <BandValue label="High" value={before.high} />
        </div>
        <MiniBar low={before.low} mid={before.mid} high={before.high} />
      </div>

      {/* Arrow */}
      <ArrowRight className={`h-5 w-5 shrink-0 ${hasChange ? "text-primary" : "text-muted-foreground/30"}`} />

      {/* After */}
      <div className={`flex-1 rounded-lg border p-3 ${hasChange ? "border-primary/30 bg-primary/5" : "border-border"}`}>
        <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Adjusted Corridor</p>
        <div className="flex items-center justify-between">
          <BandValue label="Low" value={after.low} delta={result.net_delta.low_delta} />
          <BandValue label="Mid" value={after.mid} delta={result.net_delta.mid_delta} highlight />
          <BandValue label="High" value={after.high} delta={result.net_delta.high_delta} />
        </div>
        <MiniBar low={after.low} mid={after.mid} high={after.high} />
      </div>
    </div>
  );
}

function BandValue({ label, value, delta, highlight }: { label: string; value: number; delta?: number; highlight?: boolean }) {
  return (
    <div className="text-center">
      <div className="text-[9px] text-muted-foreground">{label}</div>
      <div className={`text-sm font-bold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</div>
      {delta !== undefined && delta !== 0 && (
        <div className={`text-[8px] font-semibold ${delta > 0 ? "text-[hsl(var(--status-approved))]" : "text-destructive"}`}>
          {delta > 0 ? `+${delta}` : delta}
        </div>
      )}
    </div>
  );
}

function MiniBar({ low, mid, high }: { low: number; mid: number; high: number }) {
  return (
    <div className="relative h-2 rounded-full bg-accent overflow-hidden mt-2">
      <div
        className="absolute top-0 bottom-0 bg-primary/20 border-l border-r border-primary/30"
        style={{ left: `${low}%`, width: `${Math.max(1, high - low)}%` }}
      />
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-primary"
        style={{ left: `${mid}%` }}
      />
    </div>
  );
}

function AdjustmentRow({ adjustment }: { adjustment: PostMeritAdjustment }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = directionIcon(adjustment.direction);
  const dirColor = directionColor(adjustment.direction);

  return (
    <div className={`rounded-lg border ${adjustment.applied ? "border-border" : "border-border/50 opacity-60"}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-accent/20 transition-colors"
      >
        <Icon className={`h-4 w-4 shrink-0 ${dirColor}`} />
        <div className="flex-1 text-left">
          <span className="text-[11px] font-medium text-foreground">{adjustment.label}</span>
          {!adjustment.applied && (
            <span className="ml-2 text-[9px] text-muted-foreground italic">skipped</span>
          )}
        </div>
        {adjustment.applied && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[9px] text-muted-foreground">
              L{fmtD(adjustment.effect.low_delta)} M{fmtD(adjustment.effect.mid_delta)} H{fmtD(adjustment.effect.high_delta)}
            </span>
            <ConfidenceDot confidence={adjustment.confidence} />
          </div>
        )}
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
          <p className="text-[10px] text-muted-foreground leading-relaxed">{adjustment.explanation}</p>
          {adjustment.skip_reason && (
            <p className="text-[10px] text-muted-foreground italic">Reason: {adjustment.skip_reason}</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {adjustment.inputs.map((input, i) => (
              <span key={i} className="text-[9px] bg-accent px-2 py-0.5 rounded-md text-muted-foreground">
                {input}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DirectionBadge({ direction }: { direction: AdjustmentDirection }) {
  const cls = direction === "positive"
    ? "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]"
    : direction === "negative"
      ? "bg-destructive/10 text-destructive"
      : direction === "widening"
        ? "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]"
        : "bg-muted-foreground/10 text-muted-foreground";

  return (
    <span className={`inline-flex text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${cls}`}>
      {direction}
    </span>
  );
}

function ConfidenceDot({ confidence }: { confidence: "high" | "moderate" | "low" }) {
  const cls = confidence === "high"
    ? "bg-[hsl(var(--status-approved))]"
    : confidence === "moderate"
      ? "bg-[hsl(var(--status-attention))]"
      : "bg-destructive";
  return <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cls}`} />;
}

function directionIcon(dir: AdjustmentDirection) {
  switch (dir) {
    case "positive": return TrendingUp;
    case "negative": return TrendingDown;
    case "widening": return Expand;
    default: return Minus;
  }
}

function directionColor(dir: AdjustmentDirection) {
  switch (dir) {
    case "positive": return "text-[hsl(var(--status-approved))]";
    case "negative": return "text-destructive";
    case "widening": return "text-[hsl(var(--status-attention))]";
    default: return "text-muted-foreground";
  }
}

function fmtD(d: number): string {
  if (d === 0) return "±0";
  return d > 0 ? `+${d}` : `${d}`;
}

export default EvalPostMeritAdjustmentCard;
