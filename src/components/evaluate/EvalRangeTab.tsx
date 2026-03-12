import { useMemo, useState } from "react";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import { extractValuationDrivers } from "@/lib/valuationDriverEngine";
import { computeSettlementRange, type RangeEngineOutput, type RangeWarning } from "@/lib/settlementRangeEngine";
import { useAssumptionOverrides, type WorkingRangeSelection } from "@/hooks/useAssumptionOverrides";
import EvalAssumptionsPanel from "./EvalAssumptionsPanel";
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
  Save,
  Diff,
  FileText,
} from "lucide-react";

interface Props {
  snapshot: EvaluateIntakeSnapshot;
}

const fmt = (n: number) => `$${n.toLocaleString()}`;

const EvalRangeTab = ({ snapshot }: Props) => {
  const {
    state: assumptionState,
    overrides,
    changeLog,
    workingRange,
    setOverride,
    resetOverride,
    resetAll,
    setWorkingRange,
  } = useAssumptionOverrides();

  // Compute system baseline (no overrides) for comparison
  const systemRange = useMemo(() => {
    const drivers = extractValuationDrivers(snapshot);
    return computeSettlementRange(snapshot, drivers);
  }, [snapshot]);

  // Compute current range with human overrides applied
  const currentRange = useMemo(() => {
    const drivers = extractValuationDrivers(snapshot);
    return computeSettlementRange(snapshot, drivers, assumptionState.hasOverrides ? overrides : null);
  }, [snapshot, overrides, assumptionState.hasOverrides]);

  const range = currentRange;
  const hasChanged = assumptionState.hasOverrides;
  const [showComposition, setShowComposition] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showWorkingRangeForm, setShowWorkingRangeForm] = useState(false);
  const [reviewerNotes, setReviewerNotes] = useState(workingRange.reviewer_notes);
  const [managerNotes, setManagerNotes] = useState(workingRange.manager_notes);
  const [authorityRec, setAuthorityRec] = useState(workingRange.authority_recommendation?.toString() ?? "");

  // Determine selected amount
  const selectedAmount = workingRange.selected_band === "custom" && workingRange.custom_amount !== null
    ? workingRange.custom_amount
    : { floor: range.floor, likely: range.likely, stretch: range.stretch }[workingRange.selected_band === "custom" ? "likely" : workingRange.selected_band];

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

      {/* ── Assumptions Panel ────────────────────── */}
      <EvalAssumptionsPanel
        snapshot={snapshot}
        overrides={overrides}
        changeLog={changeLog}
        activeOverrideCount={assumptionState.activeOverrideCount}
        onSetOverride={setOverride}
        onResetOverride={resetOverride}
        onResetAll={resetAll}
      />

      {/* ── System vs Revised Comparison ─────────── */}
      {hasChanged && (
        <div className="card-elevated">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="w-full p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Diff className="h-3.5 w-3.5 text-primary" />
              <span className="text-[12px] font-semibold text-foreground">System vs Revised Range</span>
              <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                {assumptionState.activeOverrideCount} override{assumptionState.activeOverrideCount !== 1 ? "s" : ""} applied
              </span>
            </div>
            {showComparison ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          {showComparison && (
            <div className="px-4 pb-4 border-t border-border pt-3">
              <div className="grid grid-cols-2 gap-4">
                <ComparisonColumn
                  label="System Output"
                  floor={systemRange.floor}
                  likely={systemRange.likely}
                  stretch={systemRange.stretch}
                  confidence={systemRange.confidence}
                  muted
                />
                <ComparisonColumn
                  label="Revised Output"
                  floor={currentRange.floor}
                  likely={currentRange.likely}
                  stretch={currentRange.stretch}
                  confidence={currentRange.confidence}
                />
              </div>
              <div className="mt-3 rounded-lg bg-accent/30 border border-border p-3">
                <p className="text-[10px] text-muted-foreground">
                  <span className="font-semibold">Delta:</span>{" "}
                  Floor {formatDelta(systemRange.floor, currentRange.floor)} · 
                  Likely {formatDelta(systemRange.likely, currentRange.likely)} · 
                  Stretch {formatDelta(systemRange.stretch, currentRange.stretch)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Range Visualization ──────────────────── */}
      <div className="card-elevated p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h2 className="text-[14px] font-semibold text-foreground">
              {hasChanged ? "Revised Settlement Range" : "Settlement Range"}
            </h2>
            <span className="text-[9px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
              {range.engine_version}
            </span>
            {hasChanged && (
              <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                REVISED
              </span>
            )}
          </div>
          <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg ${confBgColor}`}>
            <Gauge className="h-3 w-3" />
            <span className={`text-[10px] font-semibold ${confColor}`}>
              {range.confidence}% Confidence — {range.confidence_label.replace("_", " ").toUpperCase()}
            </span>
          </div>
        </div>

        <RangeBar floor={range.floor} likely={range.likely} stretch={range.stretch} />

        <div className="grid grid-cols-3 gap-3 mt-5">
          <RangeCard
            label="Floor"
            value={fmt(range.floor)}
            icon={ArrowDownRight}
            description="Conservative estimate assuming defense-favorable interpretation."
            selected={workingRange.selected_band === "floor"}
            onClick={() => setWorkingRange({ selected_band: "floor", custom_amount: null })}
          />
          <RangeCard
            label="Likely"
            value={fmt(range.likely)}
            icon={Target}
            description="Most probable settlement value given current posture."
            selected={workingRange.selected_band === "likely"}
            onClick={() => setWorkingRange({ selected_band: "likely", custom_amount: null })}
            primary
          />
          <RangeCard
            label="Stretch"
            value={fmt(range.stretch)}
            icon={ArrowUpRight}
            description="Upper range assuming claimant-favorable outcomes."
            selected={workingRange.selected_band === "stretch"}
            onClick={() => setWorkingRange({ selected_band: "stretch", custom_amount: null })}
          />
        </div>
      </div>

      {/* ── Selected Working Range ───────────────── */}
      <div className="card-elevated p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Gauge className="h-3.5 w-3.5 text-primary" />
            <h3 className="text-[13px] font-semibold text-foreground">Selected Working Range</h3>
            {workingRange.selected_at && (
              <span className="text-[9px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
                Saved {new Date(workingRange.selected_at).toLocaleDateString()}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowWorkingRangeForm(!showWorkingRangeForm)}
            className="btn-ghost text-[10px]"
          >
            <FileText className="h-3 w-3" /> {showWorkingRangeForm ? "Collapse" : "Edit Selection"}
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-[11px] text-muted-foreground mb-1">
              The <span className="font-semibold text-foreground capitalize">
                {workingRange.selected_band === "custom" ? "custom" : workingRange.selected_band}
              </span> range has been selected as the working valuation basis.
            </p>
            <p className="text-[24px] font-bold text-primary tracking-tight">{fmt(selectedAmount)}</p>
          </div>
        </div>

        {showWorkingRangeForm && (
          <div className="mt-4 space-y-3 border-t border-border pt-4">
            {/* Custom amount */}
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Custom Working Amount (optional)</label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-muted-foreground">$</span>
                <input
                  type="number"
                  min={0}
                  value={workingRange.custom_amount ?? ""}
                  onChange={(e) => {
                    const v = e.target.value ? parseFloat(e.target.value) : null;
                    setWorkingRange({ selected_band: v !== null ? "custom" : "likely", custom_amount: v });
                  }}
                  placeholder="Enter custom amount"
                  className="w-40 px-2 py-1.5 text-[11px] rounded border border-border bg-background text-foreground"
                />
              </div>
            </div>

            {/* Authority recommendation */}
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Authority Recommendation</label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-muted-foreground">$</span>
                <input
                  type="number"
                  min={0}
                  value={authorityRec}
                  onChange={(e) => setAuthorityRec(e.target.value)}
                  placeholder="Recommended authority level"
                  className="w-40 px-2 py-1.5 text-[11px] rounded border border-border bg-background text-foreground"
                />
              </div>
            </div>

            {/* Reviewer notes */}
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Reviewer Notes</label>
              <textarea
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                placeholder="Document your rationale for the selected working range..."
                rows={3}
                className="w-full mt-1 px-2 py-1.5 text-[11px] rounded border border-border bg-background text-foreground placeholder:text-muted-foreground/50 resize-none"
              />
            </div>

            {/* Manager notes */}
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Manager Notes (optional)</label>
              <textarea
                value={managerNotes}
                onChange={(e) => setManagerNotes(e.target.value)}
                placeholder="Manager review notes..."
                rows={2}
                className="w-full mt-1 px-2 py-1.5 text-[11px] rounded border border-border bg-background text-foreground placeholder:text-muted-foreground/50 resize-none"
              />
            </div>

            <button
              onClick={() => {
                setWorkingRange({
                  reviewer_notes: reviewerNotes,
                  manager_notes: managerNotes,
                  authority_recommendation: authorityRec ? parseFloat(authorityRec) : null,
                });
                setShowWorkingRangeForm(false);
              }}
              className="btn-primary text-[10px]"
            >
              <Save className="h-3 w-3" /> Save Working Range Selection
            </button>
          </div>
        )}
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
            <CompositionRow
              icon={DollarSign}
              label={range.composition.economic_base.label}
              value={fmt(range.composition.economic_base.likely)}
              details={range.composition.economic_base.details}
            />
            <CompositionRow
              icon={Activity}
              label={range.composition.severity_multiplier.label}
              value={`${range.composition.severity_multiplier.floor_mult.toFixed(1)}x / ${range.composition.severity_multiplier.likely_mult.toFixed(1)}x / ${range.composition.severity_multiplier.stretch_mult.toFixed(1)}x`}
              details={range.composition.severity_multiplier.reasons}
              isMultiplier
            />
            <CompositionRow
              icon={Scale}
              label={range.composition.liability_factor.label}
              value={`${Math.round(range.composition.liability_factor.factor * 100)}%`}
              details={range.composition.liability_factor.reasons}
              isReducer={range.composition.liability_factor.factor < 0.9}
            />
            <CompositionRow
              icon={Shield}
              label={range.composition.treatment_reliability.label}
              value={`${Math.round(range.composition.treatment_reliability.factor * 100)}%`}
              details={range.composition.treatment_reliability.reasons}
              isReducer={range.composition.treatment_reliability.factor < 0.95}
            />
            {range.composition.policy_cap.max_coverage && (
              <CompositionRow
                icon={Shield}
                label="Policy Cap"
                value={range.composition.policy_cap.applied ? "APPLIED" : "Not applied"}
                details={[range.composition.policy_cap.detail]}
                isReducer={range.composition.policy_cap.applied}
              />
            )}
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
          <h3 className="text-[13px] font-semibold text-foreground">Active Assumptions</h3>
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

      {/* ── Range Rationale ──────────────────────── */}
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
          constrained by policy limits when applicable. {hasChanged && "Human-adopted assumptions have been applied to the system baseline. "}
          Original system output is preserved for audit comparison. All inputs are traceable to source evidence.
        </p>
      </div>
    </div>
  );
};

// ─── Sub-components ─────────────────────────────────────

function ComparisonColumn({ label, floor, likely, stretch, confidence, muted }: {
  label: string; floor: number; likely: number; stretch: number; confidence: number; muted?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${muted ? "border-border bg-accent/30" : "border-primary/30 bg-primary/3"}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${muted ? "text-muted-foreground" : "text-primary"}`}>{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-[10px] text-muted-foreground">Floor</span>
          <span className={`text-[11px] font-semibold ${muted ? "text-muted-foreground" : "text-foreground"}`}>{fmt(floor)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-muted-foreground">Likely</span>
          <span className={`text-[11px] font-bold ${muted ? "text-muted-foreground" : "text-primary"}`}>{fmt(likely)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-muted-foreground">Stretch</span>
          <span className={`text-[11px] font-semibold ${muted ? "text-muted-foreground" : "text-foreground"}`}>{fmt(stretch)}</span>
        </div>
        <div className="flex justify-between pt-1 border-t border-border mt-1">
          <span className="text-[9px] text-muted-foreground">Confidence</span>
          <span className="text-[10px] font-semibold text-muted-foreground">{confidence}%</span>
        </div>
      </div>
    </div>
  );
}

function formatDelta(a: number, b: number): string {
  const d = b - a;
  if (d === 0) return "—";
  const pct = a > 0 ? Math.round((d / a) * 100) : 0;
  return `${d > 0 ? "+" : ""}${fmt(d)} (${d > 0 ? "+" : ""}${pct}%)`;
}

function RangeBar({ floor, likely, stretch }: { floor: number; likely: number; stretch: number }) {
  const total = stretch || 1;
  const floorPct = Math.max(10, Math.round((floor / total) * 100));
  const likelyPct = Math.max(10, Math.round(((likely - floor) / total) * 100));
  const stretchPct = Math.max(10, 100 - floorPct - likelyPct);

  return (
    <div className="relative mb-8">
      <div className="h-4 rounded-full bg-accent overflow-hidden flex">
        <div className="h-full bg-[hsl(var(--status-approved))]/25 rounded-l-full transition-all" style={{ width: `${floorPct}%` }} />
        <div className="h-full bg-primary/30 transition-all" style={{ width: `${likelyPct}%` }} />
        <div className="h-full bg-[hsl(var(--status-attention))]/25 rounded-r-full transition-all" style={{ width: `${stretchPct}%` }} />
      </div>
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
