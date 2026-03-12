/**
 * EvalAssumptionsPanel — Human-editable assumption controls
 *
 * Separates system-derived inputs from human-adopted assumptions.
 * Every change requires a reason note. Changes immediately re-run
 * the range engine.
 */

import { useState, useCallback } from "react";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import type {
  HumanAssumptionOverrides,
  MedicalBasePreference,
  VenueSeverity,
  CredibilityImpact,
  PriorConditionImpact,
  AssumptionChangeEntry,
} from "@/hooks/useAssumptionOverrides";
import {
  Settings2,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  MessageSquare,
  DollarSign,
  Scale,
  Shield,
  MapPin,
  AlertTriangle,
  Activity,
} from "lucide-react";

interface Props {
  snapshot: EvaluateIntakeSnapshot;
  overrides: HumanAssumptionOverrides;
  changeLog: AssumptionChangeEntry[];
  activeOverrideCount: number;
  onSetOverride: <K extends keyof HumanAssumptionOverrides>(
    field: K,
    value: HumanAssumptionOverrides[K],
    reason: string,
  ) => void;
  onResetOverride: (field: keyof HumanAssumptionOverrides) => void;
  onResetAll: () => void;
}

const EvalAssumptionsPanel = ({
  snapshot,
  overrides,
  changeLog,
  activeOverrideCount,
  onSetOverride,
  onResetOverride,
  onResetAll,
}: Props) => {
  const [showHistory, setShowHistory] = useState(false);

  // System-derived values for comparison
  const totalBilled = snapshot.medical_billing.reduce((s, b) => s + b.billed_amount, 0);
  const hasReviewed = snapshot.medical_billing.some((b) => b.reviewer_recommended_amount != null);
  const totalReviewed = hasReviewed
    ? snapshot.medical_billing.reduce((s, b) => s + (b.reviewer_recommended_amount ?? b.billed_amount), 0)
    : null;
  const systemCompNeg = snapshot.comparative_negligence.claimant_negligence_percentage.value;
  const systemWageLoss = snapshot.wage_loss.total_lost_wages.value;
  const systemFutureMedical = snapshot.future_treatment.future_medical_estimate.value;
  const hasPreExisting = snapshot.injuries.some((i) => i.is_pre_existing);
  const hasCredibilityConcerns = snapshot.upstream_concerns.some((c) => c.category === "credibility");

  return (
    <div className="card-elevated">
      {/* Header */}
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          <h2 className="text-[14px] font-semibold text-foreground">Assumptions & Overrides</h2>
          {activeOverrideCount > 0 && (
            <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
              {activeOverrideCount} adopted
            </span>
          )}
        </div>
        {activeOverrideCount > 0 && (
          <button onClick={onResetAll} className="btn-ghost text-[10px]">
            <RotateCcw className="h-3 w-3" /> Reset All
          </button>
        )}
      </div>

      <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
        {/* ── Liability ──────────────────────────── */}
        <AssumptionGroup icon={Scale} title="Liability & Negligence">
          <PercentageOverride
            label="Liability Percentage"
            systemValue="System-derived from fact ratio"
            currentValue={overrides.liability_percentage}
            field="liability_percentage"
            min={0}
            max={100}
            onSet={onSetOverride}
            onReset={onResetOverride}
          />
          <PercentageOverride
            label="Comparative Negligence"
            systemValue={systemCompNeg !== null ? `${systemCompNeg}% (from intake)` : "Not identified"}
            currentValue={overrides.comparative_negligence_percentage}
            field="comparative_negligence_percentage"
            min={0}
            max={100}
            onSet={onSetOverride}
            onReset={onResetOverride}
          />
        </AssumptionGroup>

        {/* ── Economic Base ──────────────────────── */}
        <AssumptionGroup icon={DollarSign} title="Economic Base">
          <SelectOverride
            label="Medical Base"
            systemValue={hasReviewed ? `Reviewed ($${totalReviewed?.toLocaleString()})` : `Billed ($${totalBilled.toLocaleString()})`}
            currentValue={overrides.medical_base_preference}
            field="medical_base_preference"
            options={[
              { value: null, label: "Auto (system default)" },
              { value: "reviewed" as MedicalBasePreference, label: `Reviewed ($${(totalReviewed ?? 0).toLocaleString()})`, disabled: !hasReviewed },
              { value: "billed" as MedicalBasePreference, label: `Billed ($${totalBilled.toLocaleString()})` },
            ]}
            onSet={onSetOverride}
            onReset={onResetOverride}
          />
          <AmountOverride
            label="Wage Loss"
            systemValue={systemWageLoss > 0 ? `$${systemWageLoss.toLocaleString()}` : "None identified"}
            currentValue={overrides.wage_loss_override}
            field="wage_loss_override"
            onSet={onSetOverride}
            onReset={onResetOverride}
          />
          <AmountOverride
            label="Future Medical"
            systemValue={systemFutureMedical > 0 ? `$${systemFutureMedical.toLocaleString()}` : "None identified"}
            currentValue={overrides.future_medical_override}
            field="future_medical_override"
            onSet={onSetOverride}
            onReset={onResetOverride}
          />
        </AssumptionGroup>

        {/* ── Claim Posture ──────────────────────── */}
        <AssumptionGroup icon={MapPin} title="Claim Posture">
          <SelectOverride
            label="Venue Severity"
            systemValue="Not assessed (system default: neutral)"
            currentValue={overrides.venue_severity}
            field="venue_severity"
            options={[
              { value: null, label: "Neutral (default)" },
              { value: "plaintiff_friendly" as VenueSeverity, label: "Plaintiff-Friendly (+5%)" },
              { value: "neutral" as VenueSeverity, label: "Neutral (no adjustment)" },
              { value: "defense_friendly" as VenueSeverity, label: "Defense-Friendly (−10%)" },
            ]}
            onSet={onSetOverride}
            onReset={onResetOverride}
          />
          <SelectOverride
            label="Credibility Impact"
            systemValue={hasCredibilityConcerns ? "Concerns flagged upstream" : "No concerns identified"}
            currentValue={overrides.credibility_impact}
            field="credibility_impact"
            options={[
              { value: null, label: "System default" },
              { value: "none" as CredibilityImpact, label: "None" },
              { value: "minor" as CredibilityImpact, label: "Minor (−2%)" },
              { value: "moderate" as CredibilityImpact, label: "Moderate (−5%)" },
              { value: "significant" as CredibilityImpact, label: "Significant (−10%)" },
            ]}
            onSet={onSetOverride}
            onReset={onResetOverride}
          />
          <SelectOverride
            label="Prior Condition Impact"
            systemValue={hasPreExisting ? `${snapshot.injuries.filter((i) => i.is_pre_existing).length} pre-existing condition(s)` : "None identified"}
            currentValue={overrides.prior_condition_impact}
            field="prior_condition_impact"
            options={[
              { value: null, label: "System default" },
              { value: "none" as PriorConditionImpact, label: "None" },
              { value: "minor" as PriorConditionImpact, label: "Minor (−3%)" },
              { value: "moderate" as PriorConditionImpact, label: "Moderate (−8%)" },
              { value: "significant" as PriorConditionImpact, label: "Significant (−15%)" },
            ]}
            onSet={onSetOverride}
            onReset={onResetOverride}
          />
        </AssumptionGroup>

        {/* ── Change History ─────────────────────── */}
        {changeLog.length > 0 && (
          <div className="border-t border-border pt-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 w-full text-left"
            >
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[12px] font-semibold text-foreground">Change History</span>
              <span className="text-[9px] bg-accent text-muted-foreground px-1.5 py-0.5 rounded">
                {changeLog.length}
              </span>
              {showHistory ? <ChevronDown className="h-3 w-3 ml-auto text-muted-foreground" /> : <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground" />}
            </button>

            {showHistory && (
              <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                {changeLog.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2.5 py-1.5 border-b border-border last:border-0">
                    <div className="h-5 w-5 rounded-full bg-accent flex items-center justify-center shrink-0 mt-0.5">
                      <User className="h-2.5 w-2.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-foreground">{entry.label}</span>
                        <span className="text-[9px] text-muted-foreground">
                          {formatValue(entry.previous_value)} → {formatValue(entry.new_value)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MessageSquare className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                        <p className="text-[10px] text-muted-foreground italic truncate">{entry.reason}</p>
                      </div>
                      <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                        {entry.changed_by_name} · {new Date(entry.changed_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Sub-components ─────────────────────────────────────

function AssumptionGroup({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-[12px] font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-3 pl-5">{children}</div>
    </div>
  );
}

/** Inline percentage override with reason prompt */
function PercentageOverride<K extends keyof HumanAssumptionOverrides>({
  label,
  systemValue,
  currentValue,
  field,
  min,
  max,
  onSet,
  onReset,
}: {
  label: string;
  systemValue: string;
  currentValue: number | null;
  field: K;
  min: number;
  max: number;
  onSet: (field: K, value: HumanAssumptionOverrides[K], reason: string) => void;
  onReset: (field: K) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(currentValue?.toString() ?? "");
  const [reason, setReason] = useState("");
  const isOverridden = currentValue !== null;

  const handleSave = useCallback(() => {
    const num = parseInt(tempValue, 10);
    if (isNaN(num) || num < min || num > max || !reason.trim()) return;
    onSet(field, num as HumanAssumptionOverrides[K], reason.trim());
    setEditing(false);
    setReason("");
  }, [tempValue, reason, field, min, max, onSet]);

  return (
    <div className={`rounded-lg border p-3 ${isOverridden ? "border-primary/30 bg-primary/3" : "border-border"}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium text-foreground">{label}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">
            System: {systemValue}
            {isOverridden && <span className="text-primary font-semibold"> → {currentValue}% (adopted)</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {isOverridden && (
            <button onClick={() => onReset(field)} className="text-[9px] text-muted-foreground hover:text-foreground">
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
          {!editing && (
            <button onClick={() => { setEditing(true); setTempValue(currentValue?.toString() ?? ""); }} className="btn-ghost text-[9px] px-2 py-1">
              Override
            </button>
          )}
        </div>
      </div>
      {editing && (
        <div className="mt-2 space-y-2 border-t border-border pt-2">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={min}
              max={max}
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              className="w-20 px-2 py-1 text-[11px] rounded border border-border bg-background text-foreground"
              placeholder="%"
            />
            <span className="text-[10px] text-muted-foreground">%</span>
          </div>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for override (required)"
            className="w-full px-2 py-1.5 text-[10px] rounded border border-border bg-background text-foreground placeholder:text-muted-foreground/50"
          />
          <div className="flex items-center gap-2">
            <button onClick={handleSave} disabled={!reason.trim() || !tempValue} className="btn-primary text-[9px] px-2 py-1">
              Adopt
            </button>
            <button onClick={() => setEditing(false)} className="btn-ghost text-[9px] px-2 py-1">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Dollar amount override */
function AmountOverride<K extends keyof HumanAssumptionOverrides>({
  label,
  systemValue,
  currentValue,
  field,
  onSet,
  onReset,
}: {
  label: string;
  systemValue: string;
  currentValue: number | null;
  field: K;
  onSet: (field: K, value: HumanAssumptionOverrides[K], reason: string) => void;
  onReset: (field: K) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(currentValue?.toString() ?? "");
  const [reason, setReason] = useState("");
  const isOverridden = currentValue !== null;

  const handleSave = useCallback(() => {
    const num = parseFloat(tempValue);
    if (isNaN(num) || num < 0 || !reason.trim()) return;
    onSet(field, num as HumanAssumptionOverrides[K], reason.trim());
    setEditing(false);
    setReason("");
  }, [tempValue, reason, field, onSet]);

  return (
    <div className={`rounded-lg border p-3 ${isOverridden ? "border-primary/30 bg-primary/3" : "border-border"}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium text-foreground">{label}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">
            System: {systemValue}
            {isOverridden && <span className="text-primary font-semibold"> → ${currentValue?.toLocaleString()} (adopted)</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {isOverridden && (
            <button onClick={() => onReset(field)} className="text-[9px] text-muted-foreground hover:text-foreground">
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
          {!editing && (
            <button onClick={() => { setEditing(true); setTempValue(currentValue?.toString() ?? ""); }} className="btn-ghost text-[9px] px-2 py-1">
              Override
            </button>
          )}
        </div>
      </div>
      {editing && (
        <div className="mt-2 space-y-2 border-t border-border pt-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">$</span>
            <input
              type="number"
              min={0}
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              className="w-28 px-2 py-1 text-[11px] rounded border border-border bg-background text-foreground"
              placeholder="0"
            />
          </div>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for override (required)"
            className="w-full px-2 py-1.5 text-[10px] rounded border border-border bg-background text-foreground placeholder:text-muted-foreground/50"
          />
          <div className="flex items-center gap-2">
            <button onClick={handleSave} disabled={!reason.trim() || !tempValue} className="btn-primary text-[9px] px-2 py-1">
              Adopt
            </button>
            <button onClick={() => setEditing(false)} className="btn-ghost text-[9px] px-2 py-1">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Select-based override with reason */
function SelectOverride<K extends keyof HumanAssumptionOverrides>({
  label,
  systemValue,
  currentValue,
  field,
  options,
  onSet,
  onReset,
}: {
  label: string;
  systemValue: string;
  currentValue: HumanAssumptionOverrides[K];
  field: K;
  options: { value: HumanAssumptionOverrides[K]; label: string; disabled?: boolean }[];
  onSet: (field: K, value: HumanAssumptionOverrides[K], reason: string) => void;
  onReset: (field: K) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState<string>(String(currentValue ?? ""));
  const [reason, setReason] = useState("");
  const isOverridden = currentValue !== null;
  const selectedLabel = options.find((o) => String(o.value) === String(currentValue))?.label;

  const handleSave = useCallback(() => {
    if (!reason.trim()) return;
    const selected = options.find((o) => String(o.value) === tempValue);
    if (!selected) return;
    if (selected.value === null) {
      onReset(field);
    } else {
      onSet(field, selected.value, reason.trim());
    }
    setEditing(false);
    setReason("");
  }, [tempValue, reason, field, options, onSet, onReset]);

  return (
    <div className={`rounded-lg border p-3 ${isOverridden ? "border-primary/30 bg-primary/3" : "border-border"}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium text-foreground">{label}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">
            System: {systemValue}
            {isOverridden && <span className="text-primary font-semibold"> → {selectedLabel} (adopted)</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {isOverridden && (
            <button onClick={() => onReset(field)} className="text-[9px] text-muted-foreground hover:text-foreground">
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
          {!editing && (
            <button onClick={() => { setEditing(true); setTempValue(String(currentValue ?? "")); }} className="btn-ghost text-[9px] px-2 py-1">
              Override
            </button>
          )}
        </div>
      </div>
      {editing && (
        <div className="mt-2 space-y-2 border-t border-border pt-2">
          <select
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            className="w-full px-2 py-1.5 text-[10px] rounded border border-border bg-background text-foreground"
          >
            {options.map((opt) => (
              <option key={String(opt.value)} value={String(opt.value)} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for change (required)"
            className="w-full px-2 py-1.5 text-[10px] rounded border border-border bg-background text-foreground placeholder:text-muted-foreground/50"
          />
          <div className="flex items-center gap-2">
            <button onClick={handleSave} disabled={!reason.trim()} className="btn-primary text-[9px] px-2 py-1">
              Adopt
            </button>
            <button onClick={() => setEditing(false)} className="btn-ghost text-[9px] px-2 py-1">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "default";
  if (typeof v === "number") return v.toString();
  return String(v);
}

export default EvalAssumptionsPanel;
