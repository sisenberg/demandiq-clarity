/**
 * EvaluateIQ — Corridor Summary Hero
 *
 * Dense, at-a-glance summary card showing merits corridor, adjusted
 * settlement corridor, confidence level, and documentation sufficiency
 * in a single horizontal layout.
 */

import { useMemo } from "react";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import { classifyClaimProfile } from "@/lib/claimProfileClassifier";
import { scoreAllFactors } from "@/lib/factorScoringEngine";
import { computeWeightedMeritsScore } from "@/lib/profileWeightingEngine";
import { computeMeritsCorridor } from "@/lib/meritsCorridorEngine";
import { computePostMeritAdjustments } from "@/lib/postMeritAdjustmentEngine";
import { computeDocumentSufficiency } from "@/lib/documentSufficiencyEngine";
import {
  Target,
  TrendingUp,
  FileSearch,
  Gauge,
  ArrowRight,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";

interface Props {
  snapshot: EvaluateIntakeSnapshot;
  isProvisional?: boolean;
}

const EvalCorridorSummary = ({ snapshot, isProvisional }: Props) => {
  const data = useMemo(() => {
    const profile = classifyClaimProfile(snapshot);
    const scoring = scoreAllFactors(snapshot);
    const merits = computeWeightedMeritsScore(scoring, profile.primary);
    const corridor = computeMeritsCorridor(merits, scoring.top_drivers, scoring.top_suppressors);
    const adjusted = computePostMeritAdjustments(corridor, snapshot);
    const docSuff = computeDocumentSufficiency(snapshot);
    return { merits, corridor, adjusted, docSuff, profile };
  }, [snapshot]);

  const { corridor, adjusted, docSuff, merits } = data;

  const confLevel = merits.confidence;
  const confColor = confLevel === "high"
    ? "text-[hsl(var(--status-approved))]"
    : confLevel === "moderate"
      ? "text-[hsl(var(--status-attention))]"
      : "text-destructive";
  const confBg = confLevel === "high"
    ? "bg-[hsl(var(--status-approved))]/10"
    : confLevel === "moderate"
      ? "bg-[hsl(var(--status-attention))]/10"
      : "bg-destructive/10";

  const docColor = docSuff.overall_label === "strong"
    ? "text-[hsl(var(--status-approved))]"
    : docSuff.overall_label === "adequate"
      ? "text-primary"
      : docSuff.overall_label === "limited"
        ? "text-[hsl(var(--status-attention))]"
        : "text-destructive";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Provisional banner */}
      {isProvisional && (
        <div className="px-5 py-2 bg-[hsl(var(--status-attention))]/10 border-b border-[hsl(var(--status-attention))]/20 flex items-center gap-2">
          <AlertTriangle className="h-3 w-3 text-[hsl(var(--status-attention))]" />
          <span className="text-[10px] font-semibold text-[hsl(var(--status-attention))]">
            Provisional Evaluation — readiness gates not fully met
          </span>
        </div>
      )}

      <div className="p-5">
        {/* 4-column summary */}
        <div className="grid grid-cols-4 gap-4">
          {/* Merits Score */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Merits Score</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-foreground tracking-tight">{merits.merits_score}</span>
              <span className="text-[10px] text-muted-foreground">/100</span>
            </div>
            <span className={`inline-block text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
              merits.merits_score >= 70 ? "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]"
              : merits.merits_score >= 40 ? "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]"
              : "bg-destructive/10 text-destructive"
            }`}>
              {merits.merits_score >= 70 ? "strong" : merits.merits_score >= 50 ? "moderate" : merits.merits_score >= 30 ? "below avg" : "weak"}
            </span>
          </div>

          {/* Merits Corridor */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Target className="h-3 w-3 text-muted-foreground" />
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Merits Corridor</span>
            </div>
            <div className="flex items-center gap-2">
              <CorridorPill low={corridor.low} mid={corridor.mid} high={corridor.high} />
            </div>
            <MiniBar low={corridor.low} mid={corridor.mid} high={corridor.high} color="bg-muted-foreground/40" />
          </div>

          {/* Adjusted Corridor */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <ArrowRight className="h-3 w-3 text-primary" />
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Adjusted Corridor</span>
            </div>
            <div className="flex items-center gap-2">
              <CorridorPill
                low={adjusted.adjusted.low}
                mid={adjusted.adjusted.mid}
                high={adjusted.adjusted.high}
                highlight
              />
            </div>
            <MiniBar low={adjusted.adjusted.low} mid={adjusted.adjusted.mid} high={adjusted.adjusted.high} color="bg-primary" />
          </div>

          {/* Confidence + Doc Sufficiency */}
          <div className="space-y-2.5">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Gauge className="h-3 w-3 text-muted-foreground" />
                <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Confidence</span>
              </div>
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded ${confBg} ${confColor}`}>
                <ShieldCheck className="h-3 w-3" />
                {confLevel.toUpperCase()}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <FileSearch className="h-3 w-3 text-muted-foreground" />
                <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Documentation</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${docColor}`}>{docSuff.overall_score}</span>
                <span className={`text-[9px] font-semibold uppercase tracking-wider ${docColor}`}>
                  {docSuff.overall_label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Net adjustment indicator */}
        {adjusted.applied_adjustments.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border flex items-center gap-3 text-[10px]">
            <span className="text-muted-foreground">
              {adjusted.applied_adjustments.length} post-merit adjustment(s):
            </span>
            {adjusted.applied_adjustments.slice(0, 3).map(adj => (
              <span key={adj.id} className={`px-1.5 py-0.5 rounded font-medium ${
                adj.direction === "positive" ? "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]"
                : adj.direction === "negative" ? "bg-destructive/10 text-destructive"
                : adj.direction === "widening" ? "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]"
                : "bg-accent text-muted-foreground"
              }`}>
                {adj.label}
              </span>
            ))}
            {adjusted.applied_adjustments.length > 3 && (
              <span className="text-muted-foreground">+{adjusted.applied_adjustments.length - 3} more</span>
            )}
          </div>
        )}

        {/* Critical doc warnings */}
        {docSuff.critical_weakness_count > 0 && (
          <div className="mt-2 flex items-center gap-2 text-[10px] text-[hsl(var(--status-attention))]">
            <AlertTriangle className="h-3 w-3" />
            {docSuff.critical_weakness_count} documentation weakness(es) affecting valuation
          </div>
        )}
      </div>
    </div>
  );
};

function CorridorPill({ low, mid, high, highlight }: { low: number; mid: number; high: number; highlight?: boolean }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-[10px] text-muted-foreground">{low}</span>
      <span className="text-[8px] text-muted-foreground/50">—</span>
      <span className={`text-sm font-bold ${highlight ? "text-primary" : "text-foreground"}`}>{mid}</span>
      <span className="text-[8px] text-muted-foreground/50">—</span>
      <span className="text-[10px] text-muted-foreground">{high}</span>
    </div>
  );
}

function MiniBar({ low, mid, high, color }: { low: number; mid: number; high: number; color: string }) {
  return (
    <div className="relative h-1.5 rounded-full bg-accent overflow-hidden">
      <div
        className={`absolute top-0 bottom-0 ${color} opacity-30 rounded-full`}
        style={{ left: `${low}%`, width: `${Math.max(1, high - low)}%` }}
      />
      <div
        className={`absolute top-0 bottom-0 w-0.5 ${color}`}
        style={{ left: `${mid}%` }}
      />
    </div>
  );
}

export default EvalCorridorSummary;
