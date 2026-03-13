/**
 * EvaluateIQ — Ranked Factor Summaries Panel
 *
 * Shows top drivers, top suppressors, and top uncertainty contributors
 * from the factor scoring result.
 */

import { useMemo } from "react";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import type { RankedFactorSummary, FactorDirection } from "@/types/factor-taxonomy";
import { scoreAllFactors } from "@/lib/factorScoringEngine";
import {
  TrendingUp,
  TrendingDown,
  HelpCircle,
  AlertTriangle,
  Shield,
  Minus,
} from "lucide-react";

interface Props {
  snapshot: EvaluateIntakeSnapshot;
}

const EvalScoringRankedSummary = ({ snapshot }: Props) => {
  const result = useMemo(() => scoreAllFactors(snapshot), [snapshot]);

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Applicable" value={result.applicable_count} />
        <StatCard label="Evidenced" value={result.evidenced_count} />
        <StatCard label="Suppressed" value={result.suppressed_count} />
        <StatCard label="Issues" value={result.total_issue_count} variant={result.total_issue_count > 0 ? "warning" : "default"} />
      </div>

      {/* Three ranked lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RankedList
          title="Strongest Drivers"
          icon={TrendingUp}
          iconClass="text-[hsl(var(--status-attention))]"
          items={result.top_drivers}
          emptyMessage="No positive drivers identified."
        />
        <RankedList
          title="Strongest Suppressors"
          icon={TrendingDown}
          iconClass="text-[hsl(var(--status-approved))]"
          items={result.top_suppressors}
          emptyMessage="No suppressors identified."
        />
        <RankedList
          title="Uncertainty Contributors"
          icon={HelpCircle}
          iconClass="text-destructive"
          items={result.top_uncertainty_contributors}
          emptyMessage="No significant uncertainty."
        />
      </div>
    </div>
  );
};

// ─── Stat Card ──────────────────────────────────────────

function StatCard({ label, value, variant = "default" }: { label: string; value: number; variant?: "default" | "warning" }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${
      variant === "warning" && value > 0
        ? "border-destructive/20 bg-destructive/5"
        : "border-border bg-card"
    }`}>
      <div className={`text-[20px] font-bold ${variant === "warning" && value > 0 ? "text-destructive" : "text-foreground"}`}>
        {value}
      </div>
      <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

// ─── Ranked List ────────────────────────────────────────

function RankedList({ title, icon: Icon, iconClass, items, emptyMessage }: {
  title: string;
  icon: React.ElementType;
  iconClass: string;
  items: RankedFactorSummary[];
  emptyMessage: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconClass}`} />
        <h3 className="text-[12px] font-semibold text-foreground">{title}</h3>
        <span className="text-[9px] text-muted-foreground ml-auto">{items.length}</span>
      </div>
      <div className="divide-y divide-border">
        {items.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-[11px] text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          items.map((item, idx) => (
            <RankedRow key={item.factor_id} item={item} rank={idx + 1} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Ranked Row ─────────────────────────────────────────

function RankedRow({ item, rank }: { item: RankedFactorSummary; rank: number }) {
  const DirIcon = directionIcon(item.direction);
  const dirColor = directionColor(item.direction);
  const confColor = item.confidence === "high"
    ? "bg-[hsl(var(--status-approved))]"
    : item.confidence === "moderate"
      ? "bg-[hsl(var(--status-attention))]"
      : "bg-muted-foreground/30";

  return (
    <div className="px-4 py-3 hover:bg-accent/20 transition-colors">
      <div className="flex items-start gap-2.5">
        <span className="text-[10px] font-bold text-muted-foreground mt-0.5 w-4 shrink-0">#{rank}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-foreground truncate">{item.factor_name}</span>
            <DirIcon className={`h-3 w-3 ${dirColor} shrink-0`} />
          </div>
          <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{item.narrative}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[9px] text-muted-foreground">L{item.layer}</span>
            <span className="text-[9px] font-semibold text-foreground">
              {item.direction === "constraint" ? `$${item.score.toLocaleString()}` : `${item.score}/5`}
            </span>
            <div className={`h-1.5 w-1.5 rounded-full ${confColor}`} />
            {item.issue_count > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] text-destructive">
                <AlertTriangle className="h-2.5 w-2.5" /> {item.issue_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Direction helpers ──────────────────────────────────

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

export default EvalScoringRankedSummary;
