/**
 * EvaluateIQ — Benchmark Matching Card
 *
 * Shows comparable outcome support: match quality, selected cases,
 * settlement distribution, match/difference reasons, and outlier indicators.
 */

import { useMemo, useState } from "react";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import {
  computeBenchmarkMatching,
  type BenchmarkSummary,
  type BenchmarkMatchResult,
  type MatchQuality,
} from "@/lib/benchmarkMatchingEngine";
import {
  Scale,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  BarChart3,
  Users,
  Target,
  Info,
} from "lucide-react";

interface Props {
  snapshot: EvaluateIntakeSnapshot;
}

const EvalBenchmarkCard = ({ snapshot }: Props) => {
  const [showMatches, setShowMatches] = useState(true);
  const [showDimensions, setShowDimensions] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);

  const result = useMemo(() => computeBenchmarkMatching(snapshot), [snapshot]);

  return (
    <div className="card-elevated overflow-hidden">
      {/* Header */}
      <div className="p-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Scale className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-[13px] font-semibold text-foreground">Benchmark Comparables</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {result.selected_count} match(es) from {result.candidate_count} candidates
              {result.outlier_count > 0 && ` • ${result.outlier_count} outlier(s)`}
            </p>
          </div>
          <QualityBadge quality={result.match_quality} />
        </div>

        {/* Settlement Stats */}
        {result.settlement_stats.median !== null && (
          <div className="mt-4 grid grid-cols-4 gap-2">
            <StatCell label="P25" value={result.settlement_stats.p25} />
            <StatCell label="Median" value={result.settlement_stats.median} highlight />
            <StatCell label="P75" value={result.settlement_stats.p75} />
            <StatCell label="Mean" value={result.settlement_stats.mean} />
          </div>
        )}

        {/* Confidence */}
        <p className="mt-3 text-[10px] text-muted-foreground leading-relaxed">
          {result.confidence_explanation}
        </p>

        {/* Top reasons / differences */}
        {(result.top_match_reasons.length > 0 || result.top_differences.length > 0) && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {result.top_match_reasons.length > 0 && (
              <div>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Top Match Reasons</p>
                {result.top_match_reasons.slice(0, 3).map((r, i) => (
                  <div key={i} className="flex items-start gap-1.5 mt-1">
                    <CheckCircle2 className="h-2.5 w-2.5 text-[hsl(var(--status-approved))] shrink-0 mt-0.5" />
                    <span className="text-[9px] text-muted-foreground">{r}</span>
                  </div>
                ))}
              </div>
            )}
            {result.top_differences.length > 0 && (
              <div>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Key Differences</p>
                {result.top_differences.slice(0, 3).map((d, i) => (
                  <div key={i} className="flex items-start gap-1.5 mt-1">
                    <AlertTriangle className="h-2.5 w-2.5 text-[hsl(var(--status-attention))] shrink-0 mt-0.5" />
                    <span className="text-[9px] text-muted-foreground">{d}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Matches */}
      <SectionToggle
        label={`Close Matches (${result.selected_count})`}
        icon={<Users className="h-3.5 w-3.5 text-muted-foreground" />}
        open={showMatches}
        onToggle={() => setShowMatches(!showMatches)}
      />
      {showMatches && (
        <div className="px-5 pb-4 border-t border-border pt-3 space-y-2">
          {result.selected_matches.length === 0 ? (
            <div className="text-center py-4">
              <Info className="h-5 w-5 text-muted-foreground mx-auto mb-1.5" />
              <p className="text-[10px] text-muted-foreground">No close matches found in current corpus.</p>
            </div>
          ) : (
            result.selected_matches.map(m => (
              <MatchRow key={m.case_id} match={m} />
            ))
          )}
        </div>
      )}

      {/* Matching Dimensions */}
      <SectionToggle
        label={`Matching Dimensions (${result.dimensions.length})`}
        icon={<Target className="h-3.5 w-3.5 text-muted-foreground" />}
        open={showDimensions}
        onToggle={() => setShowDimensions(!showDimensions)}
      />
      {showDimensions && (
        <div className="px-5 pb-4 border-t border-border pt-3">
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-accent/50">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Dimension</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Current Value</th>
                  <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Weight</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.dimensions.map(dim => (
                  <tr key={dim.key} className="hover:bg-accent/20">
                    <td className="px-3 py-2 text-foreground font-medium">{dim.label}</td>
                    <td className="px-3 py-2 text-muted-foreground">{dim.current_value}</td>
                    <td className="px-3 py-2 text-center text-foreground">{dim.weight}%</td>
                    <td className="px-3 py-2 text-muted-foreground">{dim.scoring_method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Excluded Cases */}
      {result.all_candidates.filter(c => !c.selected).length > 0 && (
        <>
          <SectionToggle
            label={`Excluded Cases (${result.candidate_count - result.selected_count})`}
            icon={<XCircle className="h-3.5 w-3.5 text-muted-foreground" />}
            open={showExcluded}
            onToggle={() => setShowExcluded(!showExcluded)}
          />
          {showExcluded && (
            <div className="px-5 pb-4 border-t border-border pt-3 space-y-1.5">
              {result.all_candidates.filter(c => !c.selected).map(m => (
                <div key={m.case_id} className="flex items-center gap-2 py-1.5 px-2 rounded bg-accent/30">
                  <span className="text-[10px] font-medium text-muted-foreground flex-1">{m.claim_number}</span>
                  <span className="text-[9px] text-muted-foreground">{m.overall_similarity}% similar</span>
                  <span className="text-[8px] text-muted-foreground italic">{m.exclusion_reason}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Sub-components ────────────────────────────────────

function QualityBadge({ quality }: { quality: MatchQuality }) {
  const cls = quality === "strong"
    ? "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]"
    : quality === "moderate"
      ? "bg-primary/10 text-primary"
      : quality === "weak"
        ? "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]"
        : "bg-destructive/10 text-destructive";

  return (
    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {quality}
    </span>
  );
}

function StatCell({ label, value, highlight }: { label: string; value: number | null; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-2 text-center ${highlight ? "bg-primary/5 border border-primary/20" : "bg-accent/50"}`}>
      <div className="text-[9px] text-muted-foreground">{label}</div>
      <div className={`text-sm font-bold ${highlight ? "text-primary" : "text-foreground"}`}>
        {value !== null ? `$${value.toLocaleString()}` : "—"}
      </div>
    </div>
  );
}

function MatchRow({ match }: { match: BenchmarkMatchResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-lg border ${match.is_outlier ? "border-[hsl(var(--status-attention))]/50" : "border-border"}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-accent/20 transition-colors"
      >
        <div className="flex-1 text-left">
          <span className="text-[11px] font-medium text-foreground">{match.claim_number}</span>
          {match.is_outlier && (
            <span className="ml-1.5 text-[8px] font-semibold text-[hsl(var(--status-attention))] uppercase">Outlier</span>
          )}
        </div>
        <span className="text-[10px] font-bold text-foreground">
          ${match.settlement_amount.toLocaleString()}
        </span>
        <SimilarityPill value={match.overall_similarity} />
        {expanded
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-border pt-2 space-y-2.5">
          {match.is_outlier && match.outlier_reason && (
            <div className="flex items-start gap-1.5 rounded bg-[hsl(var(--status-attention-bg))] p-2">
              <AlertTriangle className="h-3 w-3 text-[hsl(var(--status-attention))] shrink-0 mt-0.5" />
              <p className="text-[9px] text-[hsl(var(--status-attention-foreground))]">{match.outlier_reason}</p>
            </div>
          )}

          {/* Dimension breakdown */}
          <div className="space-y-1">
            {match.dimension_scores.map(ds => (
              <div key={ds.dimension} className="flex items-center gap-2">
                <span className="text-[9px] text-muted-foreground w-28 shrink-0">{ds.label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-accent overflow-hidden">
                  <div
                    className={`h-full rounded-full ${ds.similarity >= 70 ? "bg-[hsl(var(--status-approved))]" : ds.similarity >= 40 ? "bg-[hsl(var(--status-attention))]" : "bg-destructive"}`}
                    style={{ width: `${ds.similarity}%` }}
                  />
                </div>
                <span className="text-[9px] text-foreground font-medium w-8 text-right">{ds.similarity}%</span>
              </div>
            ))}
          </div>

          {/* Values comparison */}
          <div className="grid grid-cols-2 gap-2 text-[9px]">
            {match.dimension_scores.slice(0, 4).map(ds => (
              <div key={ds.dimension} className="flex items-center gap-1.5">
                <span className="text-muted-foreground">{ds.label}:</span>
                <span className="text-foreground">{ds.benchmark_value}</span>
              </div>
            ))}
          </div>

          {/* Reasons */}
          {match.match_reasons.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {match.match_reasons.map((r, i) => (
                <span key={i} className="text-[8px] bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))] px-1.5 py-0.5 rounded">
                  {r}
                </span>
              ))}
            </div>
          )}
          {match.key_differences.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {match.key_differences.map((d, i) => (
                <span key={i} className="text-[8px] bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))] px-1.5 py-0.5 rounded">
                  {d}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SimilarityPill({ value }: { value: number }) {
  const cls = value >= 70
    ? "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]"
    : value >= 45
      ? "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]"
      : "bg-destructive/10 text-destructive";

  return (
    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${cls}`}>
      {value}%
    </span>
  );
}

function SectionToggle({ label, icon, open, onToggle }: {
  label: string; icon: React.ReactNode; open: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full px-5 py-3 border-t border-border flex items-center justify-between hover:bg-accent/30 transition-colors"
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[11px] font-semibold text-foreground">{label}</span>
      </div>
      {open
        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
        : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </button>
  );
}

export default EvalBenchmarkCard;
