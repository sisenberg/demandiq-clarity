/**
 * Demand Chronology Panel
 *
 * Shows all demand letters for a case in chronological order with
 * date, amount, attorney, and active status. Allows switching the active demand.
 */

import {
  FileText, CheckCircle2, Clock, DollarSign,
  Briefcase, ChevronRight, Zap, ArrowRight,
} from "lucide-react";
import {
  useCaseDemands,
  useActivateDemand,
  type DemandRow,
} from "@/hooks/useDemands";

interface Props {
  caseId: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(amount: number | null): string {
  if (amount == null) return "—";
  return `$${amount.toLocaleString()}`;
}

const DemandChronologyPanel = ({ caseId }: Props) => {
  const { data: demands = [], isLoading } = useCaseDemands(caseId);
  const activateDemand = useActivateDemand();

  if (isLoading) {
    return (
      <div className="card-elevated p-5 flex items-center justify-center">
        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (demands.length === 0) return null;

  // Sort by demand_date ascending for chronological display
  const sorted = [...demands].sort(
    (a, b) => new Date(a.demand_date).getTime() - new Date(b.demand_date).getTime()
  );

  return (
    <div className="card-elevated overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Demand Chronology</h3>
          <span className="text-[9px] font-mono text-muted-foreground tabular-nums">
            {demands.length} demand{demands.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="divide-y divide-border">
        {sorted.map((demand, idx) => (
          <DemandTimelineRow
            key={demand.id}
            demand={demand}
            index={idx}
            total={sorted.length}
            onActivate={() => activateDemand.mutate({ demandId: demand.id, caseId })}
            isActivating={activateDemand.isPending}
          />
        ))}
      </div>
    </div>
  );
};

function DemandTimelineRow({
  demand, index, total, onActivate, isActivating,
}: {
  demand: DemandRow;
  index: number;
  total: number;
  onActivate: () => void;
  isActivating: boolean;
}) {
  const isActive = demand.is_active;

  return (
    <div className={`px-5 py-3 flex items-start gap-3 transition-colors ${isActive ? "bg-primary/5" : "hover:bg-accent/30"}`}>
      {/* Timeline dot + connector */}
      <div className="flex flex-col items-center shrink-0 pt-1">
        <div className={`h-2.5 w-2.5 rounded-full border-2 ${
          isActive
            ? "border-primary bg-primary"
            : "border-muted-foreground/40 bg-background"
        }`} />
        {index < total - 1 && (
          <div className="w-px flex-1 min-h-[24px] bg-border mt-1" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-semibold text-foreground">
            {formatDate(demand.demand_date)}
          </span>
          {isActive && (
            <span className="text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))] border border-[hsl(var(--status-approved))]/20">
              Active
            </span>
          )}
          {!isActive && (
            <span className="text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-accent text-muted-foreground border border-border">
              Historical
            </span>
          )}
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-1.5">
          <DetailCell icon={DollarSign} label="Amount" value={formatCurrency(demand.demand_amount)} />
          <DetailCell icon={Briefcase} label="Attorney" value={demand.attorney_name || "—"} />
          <DetailCell icon={Clock} label="Deadline" value={formatDate(demand.demand_deadline)} />
          <DetailCell icon={FileText} label="Representation" value={demand.represented_status || "—"} />
        </div>

        {demand.law_firm_name && (
          <p className="text-[9px] text-muted-foreground mt-1">
            {demand.law_firm_name}
          </p>
        )}
      </div>

      {/* Activate action */}
      {!isActive && (
        <button
          onClick={onActivate}
          disabled={isActivating}
          className="shrink-0 inline-flex items-center gap-1 text-[9px] font-medium px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-colors disabled:opacity-50"
          title="Set as active demand — will reassemble intake package"
        >
          <ArrowRight className="h-3 w-3" />
          Set Active
        </button>
      )}
    </div>
  );
}

function DetailCell({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
        <p className="text-[10px] text-foreground font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

export default DemandChronologyPanel;
