import { Clock } from "lucide-react";

const MOCK = { avg: 4.2, median: 3.8, p90: 7.1, trend: -0.6 };

const EvalAnalyticsCycleTime = () => (
  <div className="rounded-xl border border-border bg-card p-4">
    <div className="flex items-center gap-2 mb-3">
      <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
        <Clock className="h-3.5 w-3.5 text-primary" />
      </div>
      <h3 className="text-xs font-semibold text-foreground">Evaluation Cycle Time</h3>
    </div>
    <div className="grid grid-cols-3 gap-2">
      <Stat label="Avg" value={`${MOCK.avg}d`} />
      <Stat label="Median" value={`${MOCK.median}d`} />
      <Stat label="P90" value={`${MOCK.p90}d`} />
    </div>
    <p className="text-[10px] text-muted-foreground mt-2">
      {MOCK.trend < 0
        ? `↓ ${Math.abs(MOCK.trend)}d improvement vs prior period`
        : `↑ ${MOCK.trend}d slower vs prior period`}
    </p>
  </div>
);

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}

export default EvalAnalyticsCycleTime;
