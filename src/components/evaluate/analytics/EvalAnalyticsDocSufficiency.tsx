import { FileCheck } from "lucide-react";

const MOCK = {
  avgScore: 72,
  topGaps: [
    { label: "IME reports", pct: 34 },
    { label: "Billing summaries", pct: 28 },
    { label: "Wage loss docs", pct: 22 },
  ],
  trend: +3,
};

const EvalAnalyticsDocSufficiency = () => (
  <div className="rounded-xl border border-border bg-card p-4">
    <div className="flex items-center gap-2 mb-3">
      <div className="h-7 w-7 rounded-lg bg-[hsl(var(--status-processing))]/10 flex items-center justify-center">
        <FileCheck className="h-3.5 w-3.5 text-[hsl(var(--status-processing))]" />
      </div>
      <h3 className="text-xs font-semibold text-foreground">Documentation Sufficiency</h3>
    </div>
    <div className="flex items-end gap-2 mb-2">
      <span className="text-2xl font-bold text-foreground">{MOCK.avgScore}%</span>
      <span className="text-[10px] text-[hsl(var(--status-approved))] mb-1">
        ↑ {MOCK.trend}pts vs prior
      </span>
    </div>
    <p className="text-[10px] text-muted-foreground mb-1.5">Top documentation gaps:</p>
    {MOCK.topGaps.map(g => (
      <div key={g.label} className="flex items-center gap-2 mb-1">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-[hsl(var(--status-attention))]" style={{ width: `${g.pct}%` }} />
        </div>
        <span className="text-[9px] text-muted-foreground w-24 text-right">{g.label} ({g.pct}%)</span>
      </div>
    ))}
  </div>
);

export default EvalAnalyticsDocSufficiency;
