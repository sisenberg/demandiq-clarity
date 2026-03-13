/**
 * EvaluateIQ — Profile Weighting & Merits Score Card
 *
 * Displays the applied weighting profile, category breakdown,
 * and computed merits score with explanation.
 */

import { useMemo } from "react";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import type { ClaimProfileCode } from "@/lib/claimProfileClassifier";
import { classifyClaimProfile, PROFILE_META } from "@/lib/claimProfileClassifier";
import { scoreAllFactors } from "@/lib/factorScoringEngine";
import {
  computeWeightedMeritsScore,
  type WeightedMeritsResult,
  type CategoryScore,
} from "@/lib/profileWeightingEngine";
import {
  Gauge,
  Weight,
  Info,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";

interface Props {
  snapshot: EvaluateIntakeSnapshot;
}

const EvalMeritsScoreCard = ({ snapshot }: Props) => {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const result = useMemo(() => {
    const profile = classifyClaimProfile(snapshot);
    const scoring = scoreAllFactors(snapshot);
    return computeWeightedMeritsScore(scoring, profile.primary);
  }, [snapshot]);

  const profileMeta = PROFILE_META[result.profile];
  const scoreColor = meritsColor(result.merits_score);

  return (
    <div className="card-elevated overflow-hidden">
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Gauge className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-foreground">Merits Score</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Profile {result.profile} — {profileMeta.label}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className={`text-[28px] font-bold tracking-tight ${scoreColor}`}>
              {result.merits_score}
            </div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              / 100
            </div>
          </div>
        </div>

        {/* Provisional warning */}
        {result.is_provisional && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/5 border border-destructive/15 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
            <p className="text-[10px] text-destructive">
              Provisional score — readiness gates have not all passed.
            </p>
          </div>
        )}

        {/* Confidence & status */}
        <div className="flex items-center gap-3 mt-3">
          <ConfidencePill confidence={result.confidence} />
          {result.gates_passed && (
            <span className="flex items-center gap-1 text-[9px] font-semibold text-[hsl(var(--status-approved))]">
              <CheckCircle2 className="h-3 w-3" /> Gates Passed
            </span>
          )}
          <span className="text-[9px] text-muted-foreground ml-auto">
            v{result.weight_band.version}
          </span>
        </div>

        {/* Score bar */}
        <div className="mt-4">
          <div className="h-3 rounded-full bg-accent overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${scoreBarColor(result.merits_score)}`}
              style={{ width: `${result.merits_score}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[8px] text-muted-foreground">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
        </div>
      </div>

      {/* Category breakdown toggle */}
      <button
        onClick={() => setShowBreakdown(!showBreakdown)}
        className="w-full px-5 py-3 border-t border-border flex items-center justify-between hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Weight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold text-foreground">Category Breakdown</span>
        </div>
        {showBreakdown ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {showBreakdown && (
        <div className="px-5 pb-4 space-y-2.5 border-t border-border pt-3">
          {result.category_scores.map(cs => (
            <CategoryRow key={cs.category} score={cs} />
          ))}
        </div>
      )}

      {/* Weight explanation toggle */}
      <button
        onClick={() => setShowExplanation(!showExplanation)}
        className="w-full px-5 py-3 border-t border-border flex items-center justify-between hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold text-foreground">Why This Weighting?</span>
        </div>
        {showExplanation ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {showExplanation && (
        <div className="px-5 pb-4 border-t border-border pt-3 space-y-3">
          <p className="text-[10px] text-foreground leading-relaxed">{result.weighting_explanation}</p>

          {/* Weight comparison table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-accent/50">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Category</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Weight</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Score</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Contribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.category_scores.map(cs => (
                  <tr key={cs.category} className="hover:bg-accent/20">
                    <td className="px-3 py-2 text-foreground font-medium">{cs.label}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{Math.round(cs.weight * 100)}%</td>
                    <td className="px-3 py-2 text-right text-foreground">{cs.normalized.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-foreground">{cs.weighted_contribution.toFixed(1)}</td>
                  </tr>
                ))}
                <tr className="bg-accent/30 font-bold">
                  <td className="px-3 py-2 text-foreground">Total</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">100%</td>
                  <td className="px-3 py-2 text-right"></td>
                  <td className="px-3 py-2 text-right text-foreground">{result.merits_score}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Category Row ──────────────────────────────────────

function CategoryRow({ score }: { score: CategoryScore }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-foreground">{score.label}</span>
          <span className="text-[9px] text-muted-foreground">
            {score.applicable_count}/{score.factor_count} factors
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground">{Math.round(score.weight * 100)}%</span>
          <span className="text-[11px] font-semibold text-foreground">{score.weighted_contribution.toFixed(1)}</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-accent overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(100, score.normalized)}%` }}
        />
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────

function ConfidencePill({ confidence }: { confidence: "high" | "moderate" | "low" }) {
  const cls = confidence === "high"
    ? "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]"
    : confidence === "moderate"
      ? "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]"
      : "bg-destructive/10 text-destructive";
  return (
    <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${cls}`}>
      {confidence} confidence
    </span>
  );
}

function meritsColor(score: number): string {
  if (score >= 70) return "text-[hsl(var(--status-attention))]";
  if (score >= 40) return "text-foreground";
  return "text-muted-foreground";
}

function scoreBarColor(score: number): string {
  if (score >= 70) return "bg-[hsl(var(--status-attention))]";
  if (score >= 40) return "bg-primary";
  return "bg-muted-foreground/40";
}

export default EvalMeritsScoreCard;
