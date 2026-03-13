import { TrendingUp } from "lucide-react";

const MOCK = { total: 127, completed: 98, provisional: 18, notStarted: 11 };

const EvalAnalyticsCompletionRate = () => {
  const completedPct = ((MOCK.completed / MOCK.total) * 100).toFixed(0);
  const provisionalPct = ((MOCK.provisional / MOCK.total) * 100).toFixed(0);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-7 w-7 rounded-lg bg-[hsl(var(--status-approved))]/10 flex items-center justify-center">
          <TrendingUp className="h-3.5 w-3.5 text-[hsl(var(--status-approved))]" />
        </div>
        <h3 className="text-xs font-semibold text-foreground">Provisional vs Completed</h3>
      </div>
      {/* Bar */}
      <div className="h-3 rounded-full bg-muted overflow-hidden flex">
        <div className="bg-[hsl(var(--status-approved))]" style={{ width: `${completedPct}%` }} />
        <div className="bg-[hsl(var(--status-attention))]" style={{ width: `${provisionalPct}%` }} />
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[hsl(var(--status-approved))]" /> Completed {completedPct}%
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[hsl(var(--status-attention))]" /> Provisional {provisionalPct}%
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">{MOCK.total} total evaluations this period</p>
    </div>
  );
};

export default EvalAnalyticsCompletionRate;
