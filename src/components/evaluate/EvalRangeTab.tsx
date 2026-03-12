import { useMemo, useState } from "react";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import { extractValuationDrivers } from "@/lib/valuationDriverEngine";
import { computeSettlementRange, type RangeEngineOutput, type RangeWarning } from "@/lib/settlementRangeEngine";
import {
  Target,
  ArrowDownRight,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Info,
  Gauge,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Calculator,
  Shield,
  Scale,
  Activity,
  DollarSign,
} from "lucide-react";

interface Props {
  snapshot: EvaluateIntakeSnapshot;
}

const fmt = (n: number) => `$${n.toLocaleString()}`;

const EvalRangeTab = ({ snapshot }: Props) => {
  const range = useMemo(() => {
    const drivers = extractValuationDrivers(snapshot);
    return computeSettlementRange(snapshot, drivers);
  }, [snapshot]);

  const [workingRange, setWorkingRange] = useState<"floor" | "likely" | "stretch">("likely");
  const [showComposition, setShowComposition] = useState(false);

  const selected = { floor: range.floor, likely: range.likely, stretch: range.stretch }[workingRange];

  const confColor = range.confidence_label === "high"
    ? "text-[hsl(var(--status-approved))]"
    : range.confidence_label === "moderate"
      ? "text-[hsl(var(--status-attention))]"
      : "text-destructive";

  const confBgColor = range.confidence_label === "high"
    ? "bg-[hsl(var(--status-approved))]/10"
    : range.confidence_label === "moderate"
      ? "bg-[hsl(var(--status-attention))]/10"
      : "bg-destructive/10";

  return (
    <div className="space-y-5">
      {/* ── Warnings ─────────────────────────────── */}
      {range.warnings.length > 0 && (
        <div className="space-y-2">
          {range.warnings.map((w) => (
            <WarningBanner key={w.code} warning={w} />
          ))}
        </div>
      )}

      {/* ── Range Visualization ──────────────────── */}
      <div className="card-elevated p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h2 className="text-[14px] font-semibold text-foreground">Settlement Range</h2>
            <span className="text-[9px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
              {range.engine_version}
            </span>
          </div>
          <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg ${confBgColor}`}>
            <Gauge className="h-3 w-3" />
            <span className={`text-[10px] font-semibold ${confColor}`}>
              {range.confidence}% Confidence — {range.confidence_label.replace("_", " ").toUpperCase()}
            </span>
          </div>
        </div>

        {/* Range bar with proportional widths */}
        <RangeBar floor={range.floor} likely={range.likely} stretch={range.stretch} />

        {/* Range cards */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <RangeCard
            label="Floor"
            value={fmt(range.floor)}
            icon={ArrowDownRight}
            description="Conservative estimate assuming defense-favorable interpretation of disputed facts."
            selected={workingRange === "floor"}
            onClick={() => setWorkingRange("floor")}
          />
          <RangeCard
            label="Likely"
            value={fmt(range.likely)}
            icon={Target}
            description="Most probable settlement value given current liability posture and medical documentation."
            selected={workingRange === "likely"}
            onClick={() => setWorkingRange("likely")}
            primary
          />
          <RangeCard
            label="Stretch"
            value={fmt(range.stretch)}
            icon={ArrowUpRight}
            description="Upper range assuming claimant-favorable outcomes on disputed issues."
            selected={workingRange === "stretch"}
            onClick={() => setWorkingRange("stretch")}
          />
        </div>
      </div>

      {/* ── Working Range ────────────────────────── */}
      <div className="card-elevated p-5">
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Selected Working Range</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-[11px] text-muted-foreground mb-1">
              The <span className="font-semibold text-foreground capitalize">{workingRange}</span> range has been selected as the working valuation basis.
            </p>
            <p className="text-[24px] font-bold text-primary tracking-tight">{fmt(selected)}</p>
          </div>
          <div className="shrink-0">
            <button className="btn-secondary text-[10px]" disabled>
              <CheckCircle2 className="h-3 w-3" /> Override Range
            </button>
            <p className="text-[9px] text-muted-foreground mt-1 text-center">Manual overrides coming soon</p>
          </div>
        </div>
      </div>

      {/* ── Composition Breakdown ────────────────── */}
      <div className="card-elevated">
        <button
          onClick={() => setShowComposition(!showComposition)}
          className="w-full p-5 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-[13px] font-semibold text-foreground">Range Composition</h3>
            <span className="text-[10px] text-muted-foreground">How the range was built</span>
          </div>
          {showComposition ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>

        {showComposition && (
          <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
            {/* Economic Base */}
            <CompositionRow
              icon={DollarSign}
              label={range.composition.economic_base.label}
              value={fmt(range.composition.economic_base.likely)}
              details={range.composition.economic_base.details}
            />

            {/* Severity Multiplier */}
            <CompositionRow
              icon={Activity}
              label={range.composition.severity_multiplier.label}
              value={`${range.composition.severity_multiplier.floor_mult.toFixed(1)}x / ${range.composition.severity_multiplier.likely_mult.toFixed(1)}x / ${range.composition.severity_multiplier.stretch_mult.toFixed(1)}x`}
              details={range.composition.severity_multiplier.reasons}
              isMultiplier
            />

            {/* Liability Factor */}
            <CompositionRow
              icon={Scale}
              label={range.composition.liability_factor.label}
              value={`${Math.round(range.composition.liability_factor.factor * 100)}%`}
              details={range.composition.liability_factor.reasons}
              isReducer={range.composition.liability_factor.factor < 0.9}
            />

            {/* Treatment Reliability */}
            <CompositionRow
              icon={Shield}
              label={range.composition.treatment_reliability.label}
              value={`${Math.round(range.composition.treatment_reliability.factor * 100)}%`}
              details={range.composition.treatment_reliability.reasons}
              isReducer={range.composition.treatment_reliability.factor < 0.95}
            />

            {/* Policy Cap */}
            {range.composition.policy_cap.max_coverage && (
              <CompositionRow
                icon={Shield}
                label="Policy Cap"
                value={range.composition.policy_cap.applied ? "APPLIED" : "Not applied"}
                details={[range.composition.policy_cap.detail]}
                isReducer={range.composition.policy_cap.applied}
              />
            )}

            {/* Formula summary */}
            <div className="rounded-lg border border-border bg-accent/30 p-3">
              <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                Range = Economic Base × Severity Multiplier × Liability ({Math.round(range.composition.liability_factor.factor * 100)}%) × Reliability ({Math.round(range.composition.treatment_reliability.factor * 100)}%)
                {range.composition.policy_cap.applied && " → Policy Cap"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Key Expanders & Reducers ─────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {range.rationale.key_expanders.length > 0 && (
          <div className="card-elevated p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-3.5 w-3.5 text-[hsl(var(--status-attention))]" />
              <h3 className="text-[12px] font-semibold text-foreground">Top Range Expanders</h3>
            </div>
            <ul className="space-y-2">
              {range.rationale.key_expanders.map((e, i) => (
                <li key={i} className="text-[10px] text-foreground/80 leading-snug pl-3 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:h-1.5 before:w-1.5 before:rounded-full before:bg-[hsl(var(--status-attention))]/40">
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        {range.rationale.key_reducers.length > 0 && (
          <div className="card-elevated p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="h-3.5 w-3.5 text-[hsl(var(--status-approved))]" />
              <h3 className="text-[12px] font-semibold text-foreground">Top Range Reducers</h3>
            </div>
            <ul className="space-y-2">
              {range.rationale.key_reducers.map((r, i) => (
                <li key={i} className="text-[10px] text-foreground/80 leading-snug pl-3 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:h-1.5 before:w-1.5 before:rounded-full before:bg-[hsl(var(--status-approved))]/40">
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Assumptions ──────────────────────────── */}
      <div className="card-elevated p-5">
        <div className="flex items-center gap-2 mb-3">
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-[13px] font-semibold text-foreground">Assumptions Affecting Range</h3>
          <span className="text-[10px] text-muted-foreground">{range.top_assumptions.length} active</span>
        </div>
        <div className="space-y-2">
          {range.top_assumptions.map((a, i) => (
            <div key={i} className="flex items-start gap-2.5 py-1.5">
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${
                a.impact === "expander"
                  ? "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]"
                  : a.impact === "reducer"
                    ? "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]"
                    : "bg-accent text-muted-foreground"
              }`}>
                {a.impact === "expander" ? "↑" : a.impact === "reducer" ? "↓" : "–"}
              </span>
              <div>
                <p className="text-[11px] text-foreground leading-snug font-medium">{a.label}</p>
                <p className="text-[10px] text-muted-foreground leading-snug">{a.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Range Rationale Summary ──────────────── */}
      <div className="card-elevated p-5">
        <div className="flex items-center gap-2 mb-3">
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-[13px] font-semibold text-foreground">Range Rationale</h3>
        </div>
        <div className="space-y-2">
          <p className="text-[11px] text-foreground leading-relaxed">{range.rationale.summary}</p>
          <p className="text-[10px] text-muted-foreground leading-relaxed">{range.rationale.economic_narrative}</p>
          <p className="text-[10px] text-muted-foreground leading-relaxed">{range.rationale.severity_narrative}</p>
          <p className="text-[10px] text-muted-foreground leading-relaxed">{range.rationale.adjustment_narrative}</p>
        </div>
      </div>

      {/* Methodology note */}
      <div className="rounded-xl border border-border bg-accent/30 p-4">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <span className="font-semibold">Methodology ({range.engine_version}):</span> Range = Economic Base × Non-Economic Severity Multiplier × Liability Factor × Treatment Reliability Factor, 
          constrained by policy limits when applicable. Economic base uses {range.inputs_summary.total_reviewed !== null ? "reviewer-assessed" : "billed"} medicals. 
          Severity multipliers are tiered by injury profile with additive clinical adjustments. All inputs are traceable to source evidence. 
          Values are rounded to negotiation-friendly increments. This is a transparent composition model — no black-box components.
        </p>
      </div>
    </div>
  );
};

// ─── Sub-components ─────────────────────────────────────

function RangeBar({ floor, likely, stretch }: { floor: number; likely: number; stretch: number }) {
  // Calculate proportional widths
  const total = stretch || 1;
  const floorPct = Math.max(10, Math.round((floor / total) * 100));
  const likelyPct = Math.max(10, Math.round(((likely - floor) / total) * 100));
  const stretchPct = Math.max(10, 100 - floorPct - likelyPct);

  return (
    <div className="relative mb-8">
      <div className="h-4 rounded-full bg-accent overflow-hidden flex">
        <div
          className="h-full bg-[hsl(var(--status-approved))]/25 rounded-l-full transition-all"
          style={{ width: `${floorPct}%` }}
        />
        <div
          className="h-full bg-primary/30 transition-all"
          style={{ width: `${likelyPct}%` }}
        />
        <div
          className="h-full bg-[hsl(var(--status-attention))]/25 rounded-r-full transition-all"
          style={{ width: `${stretchPct}%` }}
        />
      </div>
      {/* Labels */}
      <div className="flex justify-between mt-2.5">
        <div className="text-center">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Floor</p>
          <p className="text-[15px] font-bold text-foreground mt-0.5">{fmt(floor)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Likely</p>
          <p className="text-[15px] font-bold text-primary mt-0.5">{fmt(likely)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Stretch</p>
          <p className="text-[15px] font-bold text-foreground mt-0.5">{fmt(stretch)}</p>
        </div>
      </div>
    </div>
  );
}

function RangeCard({ label, value, icon: Icon, description, selected, onClick, primary }: {
  label: string; value: string; icon: React.ElementType; description: string;
  selected: boolean; onClick: () => void; primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border p-4 transition-all ${
        selected
          ? primary
            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
            : "border-primary/50 bg-primary/3 ring-1 ring-primary/15"
          : "border-border bg-card hover:border-border hover:bg-accent/30"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-3.5 w-3.5 ${selected ? "text-primary" : "text-muted-foreground"}`} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className={`text-[16px] font-bold tracking-tight ${selected ? "text-primary" : "text-foreground"}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{description}</p>
    </button>
  );
}

function CompositionRow({ icon: Icon, label, value, details, isMultiplier, isReducer }: {
  icon: React.ElementType; label: string; value: string; details: string[];
  isMultiplier?: boolean; isReducer?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="h-7 w-7 rounded-lg bg-accent flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-foreground">{label}</span>
          <span className={`text-[11px] font-bold font-mono ${isReducer ? "text-[hsl(var(--status-approved))]" : isMultiplier ? "text-[hsl(var(--status-attention))]" : "text-foreground"}`}>
            {value}
          </span>
        </div>
        <ul className="mt-1 space-y-0.5">
          {details.map((d, i) => (
            <li key={i} className="text-[10px] text-muted-foreground leading-snug">{d}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function WarningBanner({ warning }: { warning: RangeWarning }) {
  const isCritical = warning.severity === "critical";
  return (
    <div className={`flex items-start gap-2.5 px-4 py-3 rounded-lg border ${
      isCritical
        ? "bg-destructive/5 border-destructive/20"
        : warning.severity === "warning"
          ? "bg-[hsl(var(--status-attention))]/5 border-[hsl(var(--status-attention))]/20"
          : "bg-accent border-border"
    }`}>
      <AlertTriangle className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
        isCritical ? "text-destructive" : warning.severity === "warning" ? "text-[hsl(var(--status-attention))]" : "text-muted-foreground"
      }`} />
      <div>
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{warning.code}</span>
        <p className="text-[11px] text-foreground leading-snug">{warning.message}</p>
      </div>
    </div>
  );
}

export default EvalRangeTab;
