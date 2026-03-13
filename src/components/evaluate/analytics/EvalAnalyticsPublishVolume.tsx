import { Package } from "lucide-react";

const MOCK = { thisMonth: 24, lastMonth: 19, avgVersions: 1.3 };

const EvalAnalyticsPublishVolume = () => (
  <div className="rounded-xl border border-border bg-card p-4">
    <div className="flex items-center gap-2 mb-3">
      <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
        <Package className="h-3.5 w-3.5 text-primary" />
      </div>
      <h3 className="text-xs font-semibold text-foreground">Published Evaluations</h3>
    </div>
    <div className="flex items-end gap-2 mb-2">
      <span className="text-2xl font-bold text-foreground">{MOCK.thisMonth}</span>
      <span className="text-[10px] text-muted-foreground mb-1">this period</span>
    </div>
    <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
      <span>Prior period: {MOCK.lastMonth}</span>
      <span>Avg versions/case: {MOCK.avgVersions}</span>
    </div>
  </div>
);

export default EvalAnalyticsPublishVolume;
