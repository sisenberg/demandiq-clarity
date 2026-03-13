const MOCK_QUALITY = [
  { tier: "Strong (≥3 matches, ≥70% similarity)", count: 42, pct: 43 },
  { tier: "Moderate (2 matches, ≥50% similarity)", count: 31, pct: 32 },
  { tier: "Weak (1 match or <50% similarity)", count: 18, pct: 18 },
  { tier: "No Match (no corpus support)", count: 7, pct: 7 },
];

const TIER_COLORS = [
  "bg-[hsl(var(--status-approved))]",
  "bg-primary",
  "bg-[hsl(var(--status-attention))]",
  "bg-[hsl(var(--status-failed))]",
];

const EvalAnalyticsBenchmarkQuality = () => (
  <div className="rounded-xl border border-border bg-card">
    <div className="px-5 py-4 border-b border-border">
      <h3 className="text-xs font-semibold text-foreground">Benchmark Support Quality</h3>
      <p className="text-[10px] text-muted-foreground">
        Calibration corpus match strength across completed evaluations
      </p>
    </div>
    <div className="px-5 py-3">
      {/* Stacked bar */}
      <div className="h-4 rounded-full overflow-hidden flex mb-3">
        {MOCK_QUALITY.map((q, i) => (
          <div key={q.tier} className={`${TIER_COLORS[i]} h-full`} style={{ width: `${q.pct}%` }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {MOCK_QUALITY.map((q, i) => (
          <div key={q.tier} className="flex items-center gap-2 text-[10px]">
            <span className={`h-2 w-2 rounded-full ${TIER_COLORS[i]}`} />
            <span className="text-foreground">{q.tier}</span>
            <span className="text-muted-foreground ml-auto font-mono">{q.count}</span>
          </div>
        ))}
      </div>
    </div>
    <div className="px-5 py-2.5 border-t border-border bg-muted/20 rounded-b-xl">
      <p className="text-[10px] text-muted-foreground">
        Weak or missing benchmark support may indicate corpus gaps for this claim profile. Consider expanding calibration data.
      </p>
    </div>
  </div>
);

export default EvalAnalyticsBenchmarkQuality;
