import { AlertTriangle } from "lucide-react";

const MOCK = {
  totalEvals: 98,
  withOverride: 31,
  supervisorReview: 8,
  avgDeviationPct: 14.2,
  /** Anti-rigidity: NOT a primary KPI */
  withinRangePct: 68,
};

const EvalAnalyticsOverrideFrequency = () => {
  const overridePct = ((MOCK.withOverride / MOCK.totalEvals) * 100).toFixed(0);
  const reviewPct = ((MOCK.supervisorReview / MOCK.withOverride) * 100).toFixed(0);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-[hsl(var(--status-attention))]/10 flex items-center justify-center">
            <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--status-attention))]" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-foreground">Override Frequency</h3>
            <p className="text-[10px] text-muted-foreground">How often adjusters deviate from system corridors</p>
          </div>
        </div>
      </div>
      <div className="px-5 py-3 grid grid-cols-3 gap-3">
        <StatCell label="Evaluations" value={MOCK.totalEvals} />
        <StatCell label="With Override" value={`${MOCK.withOverride} (${overridePct}%)`} />
        <StatCell label="Flagged for Review" value={`${MOCK.supervisorReview} (${reviewPct}%)`} variant="attention" />
      </div>
      <div className="px-5 py-3 border-t border-border">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Average corridor deviation</span>
          <span className="font-semibold text-foreground">{MOCK.avgDeviationPct}%</span>
        </div>
        {/* Anti-rigidity: secondary, contextual only */}
        <div className="mt-2 p-2 rounded-md bg-muted/30 border border-border">
          <p className="text-[9px] text-muted-foreground italic">
            ℹ️ <strong>Context note:</strong> {MOCK.withinRangePct}% of final values fell within system-recommended corridors.
            This metric is provided as operational context only — it is not an adjuster quality measure.
            Override frequency reflects professional judgment, not compliance failure.
          </p>
        </div>
      </div>
    </div>
  );
};

function StatCell({ label, value, variant }: { label: string; value: string | number; variant?: "attention" }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-bold ${variant === "attention" ? "text-[hsl(var(--status-attention))]" : "text-foreground"}`}>
        {value}
      </p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}

export default EvalAnalyticsOverrideFrequency;
