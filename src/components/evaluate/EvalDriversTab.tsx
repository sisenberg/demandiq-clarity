import { useMemo, useState } from "react";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import {
  extractValuationDrivers,
  type ExtractedDriver,
  type FamilySummary,
  type DriverDirection,
} from "@/lib/valuationDriverEngine";
import {
  TrendingUp,
  TrendingDown,
  FileText,
  ExternalLink,
  Bone,
  Activity,
  Scale,
  Shield,
  DollarSign,
  Brain,
  Syringe,
  ScanLine,
  AlertTriangle,
  MapPin,
  UserX,
  HeartPulse,
  ChevronDown,
  ChevronRight,
  Filter,
} from "lucide-react";
import type { DriverFamily } from "@/types/evaluate-persistence";

interface Props {
  snapshot: EvaluateIntakeSnapshot;
}

// ─── Icons by family ────────────────────────────────────

const familyIcon: Record<DriverFamily, React.ElementType> = {
  injury_severity: Bone,
  treatment_intensity: Activity,
  liability: Scale,
  credibility: UserX,
  venue: MapPin,
  policy_limits: Shield,
  wage_loss: DollarSign,
  future_treatment: HeartPulse,
  permanency: AlertTriangle,
  surgery: Syringe,
  imaging: ScanLine,
  pre_existing: Brain,
  other: FileText,
};

// ─── Component ──────────────────────────────────────────

const EvalDriversTab = ({ snapshot }: Props) => {
  const result = useMemo(() => extractValuationDrivers(snapshot), [snapshot]);
  const [filterDirection, setFilterDirection] = useState<DriverDirection | "all">("all");
  const [expandedFamily, setExpandedFamily] = useState<DriverFamily | null>(null);

  const filtered = filterDirection === "all"
    ? result.drivers
    : result.drivers.filter((d) => d.direction === filterDirection);

  const expanderCount = result.drivers.filter((d) => d.direction === "expander").length;
  const reducerCount = result.drivers.filter((d) => d.direction === "reducer").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-semibold text-foreground">Valuation Drivers</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {result.drivers.length} drivers extracted from upstream data. Each is traceable to source evidence.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <button
            onClick={() => setFilterDirection(filterDirection === "expander" ? "all" : "expander")}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${filterDirection === "expander" ? "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]" : "hover:bg-accent"}`}
          >
            <TrendingUp className="h-3 w-3" /> {expanderCount} Expanders
          </button>
          <button
            onClick={() => setFilterDirection(filterDirection === "reducer" ? "all" : "reducer")}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${filterDirection === "reducer" ? "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]" : "hover:bg-accent"}`}
          >
            <TrendingDown className="h-3 w-3" /> {reducerCount} Reducers
          </button>
          {filterDirection !== "all" && (
            <button onClick={() => setFilterDirection("all")} className="text-muted-foreground hover:text-foreground">
              <Filter className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Family summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {result.family_summaries.map((fs) => (
          <FamilySummaryCard
            key={fs.family}
            summary={fs}
            isExpanded={expandedFamily === fs.family}
            onToggle={() => setExpandedFamily(expandedFamily === fs.family ? null : fs.family)}
          />
        ))}
      </div>

      {/* Driver cards */}
      <div className="space-y-3">
        {filtered.map((driver) => (
          <DriverCard key={driver.id} driver={driver} />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8">
            <p className="text-[12px] text-muted-foreground">No drivers match the current filter.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Family Summary Card ────────────────────────────────

function FamilySummaryCard({ summary, isExpanded, onToggle }: {
  summary: FamilySummary;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const Icon = familyIcon[summary.family] ?? FileText;
  const DirIcon = summary.net_direction === "expander" ? TrendingUp : summary.net_direction === "reducer" ? TrendingDown : Scale;
  const dirColor = summary.net_direction === "expander"
    ? "text-[hsl(var(--status-attention))]"
    : summary.net_direction === "reducer"
      ? "text-[hsl(var(--status-approved))]"
      : "text-muted-foreground";

  return (
    <button
      onClick={onToggle}
      className={`card-elevated p-3 text-left transition-all hover:shadow-md ${isExpanded ? "ring-1 ring-primary/30" : ""}`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-[10px] font-semibold text-foreground truncate">{summary.label}</span>
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[16px] font-bold text-foreground">{summary.avg_score}</span>
          <DirIcon className={`h-3 w-3 ${dirColor}`} />
        </div>
        <span className="text-[9px] text-muted-foreground">{summary.driver_count} driver{summary.driver_count !== 1 ? "s" : ""}</span>
      </div>
    </button>
  );
}

// ─── Driver Card ────────────────────────────────────────

function DriverCard({ driver }: { driver: ExtractedDriver }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = familyIcon[driver.family] ?? FileText;

  const dirColor = driver.direction === "expander"
    ? "border-l-[hsl(var(--status-attention))]"
    : driver.direction === "reducer"
      ? "border-l-[hsl(var(--status-approved))]"
      : "border-l-muted-foreground/30";

  const DirIcon = driver.direction === "expander" ? TrendingUp : driver.direction === "reducer" ? TrendingDown : Scale;
  const dirTextColor = driver.direction === "expander"
    ? "text-[hsl(var(--status-attention))]"
    : driver.direction === "reducer"
      ? "text-[hsl(var(--status-approved))]"
      : "text-muted-foreground";

  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <div className={`card-elevated border-l-[3px] ${dirColor}`}>
      <button onClick={() => setExpanded(!expanded)} className="w-full p-5 text-left">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-[12px] font-semibold text-foreground">{driver.title}</h4>
                <DirIcon className={`h-3.5 w-3.5 ${dirTextColor}`} />
                <span className="text-[9px] font-medium text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
                  {driver.driver_key}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{driver.narrative}</p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-3">
            <div className="text-center">
              <div className={`text-[18px] font-bold tracking-tight ${driver.score >= 70 ? "text-foreground" : "text-muted-foreground"}`}>
                {driver.score}
              </div>
              <p className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">Impact</p>
            </div>
            <Chevron className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-0 border-t border-border mt-0">
          <div className="pt-3 space-y-3">
            {/* Raw input */}
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground w-20">Raw Input</span>
              <span className="text-[11px] text-foreground font-mono bg-accent px-2 py-1 rounded">{driver.raw_input}</span>
            </div>

            {/* Weight */}
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground w-20">Weight</span>
              <span className="text-[11px] text-foreground">{Math.round(driver.weight * 100)}% max family contribution</span>
            </div>

            {/* Details */}
            {driver.details.length > 0 && (
              <div>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">Supporting Details</span>
                <ul className="space-y-1">
                  {driver.details.slice(0, 8).map((d, i) => (
                    <li key={i} className="text-[10px] text-foreground/80 leading-snug pl-3 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:h-1 before:w-1 before:rounded-full before:bg-muted-foreground/30">
                      {d}
                    </li>
                  ))}
                  {driver.details.length > 8 && (
                    <li className="text-[10px] text-muted-foreground pl-3">+{driver.details.length - 8} more</li>
                  )}
                </ul>
              </div>
            )}

            {/* Evidence refs */}
            {driver.evidence_ref_ids.length > 0 && (
              <div className="flex items-center gap-1.5 pt-1">
                <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                <span className="text-[9px] text-muted-foreground">
                  {driver.evidence_ref_ids.length} evidence reference{driver.evidence_ref_ids.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default EvalDriversTab;
