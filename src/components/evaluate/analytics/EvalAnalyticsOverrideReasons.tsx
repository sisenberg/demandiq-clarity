import { OVERRIDE_REASON_LABELS } from "@/lib/evaluateOverrideEngine";

const MOCK_DISTRIBUTION: { code: string; label: string; count: number }[] = [
  { code: "medical_evidence_update", label: OVERRIDE_REASON_LABELS.medical_evidence_update, count: 9 },
  { code: "adjuster_judgment", label: OVERRIDE_REASON_LABELS.adjuster_judgment, count: 7 },
  { code: "documentation_gap", label: OVERRIDE_REASON_LABELS.documentation_gap, count: 5 },
  { code: "comparative_fault_revision", label: OVERRIDE_REASON_LABELS.comparative_fault_revision, count: 4 },
  { code: "litigation_risk", label: OVERRIDE_REASON_LABELS.litigation_risk, count: 3 },
  { code: "policy_limits_adjustment", label: OVERRIDE_REASON_LABELS.policy_limits_adjustment, count: 2 },
  { code: "other", label: OVERRIDE_REASON_LABELS.other, count: 1 },
];

const total = MOCK_DISTRIBUTION.reduce((s, r) => s + r.count, 0);

const EvalAnalyticsOverrideReasons = () => (
  <div className="rounded-xl border border-border bg-card">
    <div className="px-5 py-4 border-b border-border">
      <h3 className="text-xs font-semibold text-foreground">Override Reason Code Distribution</h3>
      <p className="text-[10px] text-muted-foreground">Why adjusters deviated from system corridors</p>
    </div>
    <div className="px-5 py-3 space-y-2">
      {MOCK_DISTRIBUTION.map(r => {
        const pct = ((r.count / total) * 100).toFixed(0);
        return (
          <div key={r.code}>
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <span className="text-foreground">{r.label}</span>
              <span className="text-muted-foreground font-mono">{r.count} ({pct}%)</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
    <div className="px-5 py-2.5 border-t border-border bg-muted/20 rounded-b-xl">
      <p className="text-[10px] text-muted-foreground">
        Rationale quality matters more than override frequency. High-quality documented overrides strengthen file defensibility.
      </p>
    </div>
  </div>
);

export default EvalAnalyticsOverrideReasons;
