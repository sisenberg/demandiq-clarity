/**
 * EvaluateIQ — Merits Corridor Card
 *
 * Renders the merits corridor with bands, top contributors,
 * and corridor explanation. Clearly separated from post-merit adjustments.
 */

import { useMemo, useState } from "react";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import { classifyClaimProfile } from "@/lib/claimProfileClassifier";
import { scoreAllFactors } from "@/lib/factorScoringEngine";
import { computeWeightedMeritsScore } from "@/lib/profileWeightingEngine";
import {
  computeMeritsCorridor,
  CORRIDOR_LABEL_META,
  type MeritsCorridor,
  type CorridorContributor,
} from "@/lib/meritsCorridorEngine";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";

interface Props {
  snapshot: EvaluateIntakeSnapshot;
}

const EvalMeritsCorridorCard = ({ snapshot }: Props) => {
  const [showContributors, setShowContributors] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const corridor = useMemo(() => {
    const profile = classifyClaimProfile(snapshot);
    const scoring = scoreAllFactors(snapshot);
    const merits = computeWeightedMeritsScore(scoring, profile.primary);
    return computeMeritsCorridor(merits, scoring.top_drivers, scoring.top_suppressors);
  }, [snapshot]);

  const labelMeta = CORRIDOR_LABEL_META[corridor.corridor_label];

  return (
    <div className="card-elevated overflow-hidden">
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-foreground">Merits Corridor</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Pre-adjustment value zone • Profile {corridor.profile}
              </p>
            </div>
          </div>
          <CorridorBadge label={labelMeta.display} corridorLabel={corridor.corridor_label} />
        </div>

        {/* Provisional warning */}
        {corridor.is_provisional && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/5 border border-destructive/15 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
            <p className="text-[10px] text-destructive">
              Provisional corridor — readiness gates have not all passed.
            </p>
          </div>
        )}

        {/* Corridor visualization */}
        <div className="mt-4 space-y-2">
          <CorridorBar low={corridor.low} mid={corridor.mid} high={corridor.high} />

          {/* Band values */}
          <div className="flex justify-between text-[10px]">
            <div className="text-center">
              <div className="font-semibold text-muted-foreground">Low</div>
              <div className="text-foreground font-bold">{corridor.low}</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-primary">Mid</div>
              <div className="text-primary font-bold text-sm">{corridor.mid}</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-muted-foreground">High</div>
              <div className="text-foreground font-bold">{corridor.high}</div>
            </div>
          </div>
        </div>

        {/* Corridor summary */}
        <p className="mt-3 text-[10px] text-muted-foreground leading-relaxed">
          {labelMeta.description}
        </p>

        {/* Band width & confidence */}
        <div className="flex items-center gap-3 mt-3">
          <span className="text-[9px] text-muted-foreground">
            Band width: {corridor.band_width_pct}%
          </span>
          <ConfidenceDot confidence={corridor.confidence} />
          <span className="text-[9px] text-muted-foreground ml-auto">
            v{corridor.engine_version}
          </span>
        </div>
      </div>

      {/* Post-merit exclusion notice */}
      <div className="px-5 py-2.5 border-t border-border bg-accent/20">
        <div className="flex items-start gap-2">
          <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[9px] text-muted-foreground leading-relaxed">
            This corridor reflects <span className="font-semibold text-foreground">merit-based factors only</span>. Liability, venue, coverage, and causation adjustments are applied separately in the settlement range.
          </p>
        </div>
      </div>

      {/* Top contributors toggle */}
      <button
        onClick={() => setShowContributors(!showContributors)}
        className="w-full px-5 py-3 border-t border-border flex items-center justify-between hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold text-foreground">
            Top Contributors ({corridor.top_contributors.length})
          </span>
        </div>
        {showContributors ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {showContributors && (
        <div className="px-5 pb-4 border-t border-border pt-3 space-y-2">
          {corridor.top_contributors.map((c, i) => (
            <ContributorRow key={i} contributor={c} />
          ))}
        </div>
      )}

      {/* Explanation toggle */}
      <button
        onClick={() => setShowExplanation(!showExplanation)}
        className="w-full px-5 py-3 border-t border-border flex items-center justify-between hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold text-foreground">Corridor Reasoning</span>
        </div>
        {showExplanation ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {showExplanation && (
        <div className="px-5 pb-4 border-t border-border pt-3 space-y-3">
          <div className="space-y-2">
            <ExplanationSection title="Position" text={corridor.explanation.position_rationale} />
            <ExplanationSection title="Width" text={corridor.explanation.width_rationale} />
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Not included in this corridor
            </p>
            <ul className="space-y-0.5">
              {corridor.explanation.exclusions.map((ex, i) => (
                <li key={i} className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                  {ex}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Sub-components ────────────────────────────────────

function CorridorBar({ low, mid, high }: { low: number; mid: number; high: number }) {
  return (
    <div className="relative h-6 rounded-full bg-accent overflow-hidden">
      {/* Full track background gradient */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-muted-foreground/10 via-primary/20 to-primary/10" />

      {/* Corridor band */}
      <div
        className="absolute top-0 bottom-0 bg-primary/20 border-l border-r border-primary/30"
        style={{ left: `${low}%`, width: `${high - low}%` }}
      />

      {/* Mid marker */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-primary"
        style={{ left: `${mid}%` }}
      />

      {/* Scale marks */}
      {[0, 25, 50, 75, 100].map(v => (
        <div
          key={v}
          className="absolute top-0 bottom-0 w-px bg-border/50"
          style={{ left: `${v}%` }}
        />
      ))}
    </div>
  );
}

function CorridorBadge({ label, corridorLabel }: { label: string; corridorLabel: string }) {
  const colorClass =
    corridorLabel.includes("high") || corridorLabel === "above_mid"
      ? "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]"
      : corridorLabel === "mid"
        ? "bg-primary/10 text-primary"
        : "bg-muted-foreground/10 text-muted-foreground";

  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg shrink-0 ${colorClass}`}>
      {label}
    </span>
  );
}

function ContributorRow({ contributor }: { contributor: CorridorContributor }) {
  const Icon = contributor.direction === "expander" ? TrendingUp
    : contributor.direction === "reducer" ? TrendingDown
    : Minus;

  const dirColor = contributor.direction === "expander"
    ? "text-[hsl(var(--status-approved))]"
    : contributor.direction === "reducer"
      ? "text-destructive"
      : "text-muted-foreground";

  return (
    <div className="flex items-start gap-2">
      <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${dirColor}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-foreground truncate">{contributor.label}</span>
          <span className="text-[9px] text-muted-foreground shrink-0">{contributor.category}</span>
        </div>
        <p className="text-[9px] text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
          {contributor.narrative}
        </p>
      </div>
    </div>
  );
}

function ConfidenceDot({ confidence }: { confidence: "high" | "moderate" | "low" }) {
  const cls = confidence === "high"
    ? "bg-[hsl(var(--status-approved))]"
    : confidence === "moderate"
      ? "bg-[hsl(var(--status-attention))]"
      : "bg-destructive";

  return (
    <span className="flex items-center gap-1">
      <span className={`h-1.5 w-1.5 rounded-full ${cls}`} />
      <span className="text-[9px] text-muted-foreground">{confidence}</span>
    </span>
  );
}

function ExplanationSection({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="text-[9px] font-semibold text-foreground uppercase tracking-wider mb-0.5">{title}</p>
      <p className="text-[10px] text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

export default EvalMeritsCorridorCard;
