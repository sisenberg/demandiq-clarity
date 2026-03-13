/**
 * EvaluateIQ — Corridor Override Dialog
 *
 * Modal for accepting, overriding, or replacing the system corridor.
 * Requires reason code + rationale. Shows before/after comparison.
 */

import { useState, useMemo } from "react";
import {
  type CorridorValues,
  type OverrideAction,
  type OverrideReasonCode,
  OVERRIDE_REASON_LABELS,
  computeBeforeAfter,
  checkSupervisoryReview,
  DEFAULT_SUPERVISORY_THRESHOLDS,
} from "@/lib/evaluateOverrideEngine";
import {
  CheckCircle2,
  ArrowRightLeft,
  Replace,
  AlertTriangle,
  ShieldAlert,
  X,
} from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  systemCorridor: CorridorValues;
  onSubmit: (
    action: OverrideAction,
    corridor: CorridorValues,
    reasonCode: OverrideReasonCode,
    rationale: string,
    evidenceNote: string | null,
  ) => void;
}

const ACTIONS: { key: OverrideAction; label: string; icon: React.ElementType; description: string }[] = [
  { key: "accept_recommended", label: "Accept Recommended", icon: CheckCircle2, description: "Accept the system-computed corridor as-is" },
  { key: "override_corridor", label: "Override Corridor", icon: ArrowRightLeft, description: "Adjust one or more corridor values" },
  { key: "replace_corridor", label: "Replace Corridor", icon: Replace, description: "Replace with entirely different values" },
];

const REASON_CODES = Object.entries(OVERRIDE_REASON_LABELS) as [OverrideReasonCode, string][];

const EvalOverrideDialog = ({ isOpen, onClose, systemCorridor, onSubmit }: Props) => {
  const [action, setAction] = useState<OverrideAction>("accept_recommended");
  const [low, setLow] = useState(String(systemCorridor.low));
  const [mid, setMid] = useState(String(systemCorridor.mid));
  const [high, setHigh] = useState(String(systemCorridor.high));
  const [reasonCode, setReasonCode] = useState<OverrideReasonCode>("adjuster_judgment");
  const [rationale, setRationale] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");

  const overrideCorridor: CorridorValues = {
    low: parseInt(low, 10) || 0,
    mid: parseInt(mid, 10) || 0,
    high: parseInt(high, 10) || 0,
  };

  const isAccept = action === "accept_recommended";
  const effectiveCorridor = isAccept ? systemCorridor : overrideCorridor;

  const comparison = useMemo(() => {
    if (isAccept) return null;
    return computeBeforeAfter(systemCorridor, overrideCorridor);
  }, [systemCorridor, overrideCorridor, isAccept]);

  const supervisorCheck = useMemo(() => {
    if (isAccept) return { required: false, reasons: [] };
    return checkSupervisoryReview(systemCorridor, overrideCorridor, reasonCode, DEFAULT_SUPERVISORY_THRESHOLDS);
  }, [systemCorridor, overrideCorridor, reasonCode, isAccept]);

  const canSubmit = rationale.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(action, effectiveCorridor, reasonCode, rationale.trim(), evidenceNote.trim() || null);
    onClose();
    // Reset
    setAction("accept_recommended");
    setRationale("");
    setEvidenceNote("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Corridor Override</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Action Selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Action</label>
            <div className="space-y-1.5">
              {ACTIONS.map(a => (
                <button
                  key={a.key}
                  onClick={() => {
                    setAction(a.key);
                    if (a.key === "accept_recommended") {
                      setLow(String(systemCorridor.low));
                      setMid(String(systemCorridor.mid));
                      setHigh(String(systemCorridor.high));
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                    action === a.key
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent/30"
                  }`}
                >
                  <a.icon className={`h-4 w-4 shrink-0 ${action === a.key ? "text-primary" : "text-muted-foreground"}`} />
                  <div>
                    <p className="text-[11px] font-medium text-foreground">{a.label}</p>
                    <p className="text-[9px] text-muted-foreground">{a.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Corridor Values (editable when not accepting) */}
          {!isAccept && (
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Override Values</label>
              <div className="grid grid-cols-3 gap-3">
                <CorridorInput label="Floor" value={low} onChange={setLow} systemValue={systemCorridor.low} />
                <CorridorInput label="Midpoint" value={mid} onChange={setMid} systemValue={systemCorridor.mid} highlight />
                <CorridorInput label="Ceiling" value={high} onChange={setHigh} systemValue={systemCorridor.high} />
              </div>
            </div>
          )}

          {/* Before/After Comparison */}
          {comparison && !isAccept && (
            <div className="rounded-lg border border-border p-3">
              <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Before → After</div>
              <div className="grid grid-cols-3 gap-3">
                <DeltaCell label="Floor" before={systemCorridor.low} after={overrideCorridor.low} delta={comparison.low_delta} pct={comparison.low_pct} />
                <DeltaCell label="Midpoint" before={systemCorridor.mid} after={overrideCorridor.mid} delta={comparison.mid_delta} pct={comparison.mid_pct} highlight />
                <DeltaCell label="Ceiling" before={systemCorridor.high} after={overrideCorridor.high} delta={comparison.high_delta} pct={comparison.high_pct} />
              </div>
            </div>
          )}

          {/* Supervisory Review Warning */}
          {supervisorCheck.required && (
            <div className="rounded-lg border border-[hsl(var(--status-attention))]/30 bg-[hsl(var(--status-attention))]/5 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-[hsl(var(--status-attention))]" />
                <span className="text-[10px] font-semibold text-[hsl(var(--status-attention))]">Supervisory Review Required</span>
              </div>
              <ul className="space-y-0.5">
                {supervisorCheck.reasons.map((r, i) => (
                  <li key={i} className="text-[9px] text-muted-foreground flex items-start gap-1.5">
                    <AlertTriangle className="h-2.5 w-2.5 text-[hsl(var(--status-attention))] shrink-0 mt-0.5" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reason Code */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Reason Code *</label>
            <select
              value={reasonCode}
              onChange={e => setReasonCode(e.target.value as OverrideReasonCode)}
              className="w-full px-3 py-2 text-[11px] rounded-lg border border-border bg-background text-foreground"
            >
              {REASON_CODES.map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>

          {/* Rationale */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Rationale * <span className="text-muted-foreground/60">(min 5 chars)</span></label>
            <textarea
              value={rationale}
              onChange={e => setRationale(e.target.value)}
              rows={3}
              placeholder="Explain why this override is appropriate…"
              className="w-full px-3 py-2 text-[11px] rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground/50 resize-none"
            />
          </div>

          {/* Evidence Note (optional) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Evidence Note <span className="text-muted-foreground/60">(optional)</span></label>
            <input
              type="text"
              value={evidenceNote}
              onChange={e => setEvidenceNote(e.target.value)}
              placeholder="Reference specific evidence supporting this decision…"
              className="w-full px-3 py-2 text-[11px] rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border bg-accent/20">
          <button onClick={onClose} className="px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground rounded-md transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[11px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAccept ? (
              <><CheckCircle2 className="h-3 w-3" /> Accept Corridor</>
            ) : (
              <><ArrowRightLeft className="h-3 w-3" /> Submit Override</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

function CorridorInput({ label, value, onChange, systemValue, highlight }: {
  label: string; value: string; onChange: (v: string) => void; systemValue: number; highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[9px] text-muted-foreground mb-1">{label}</p>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full px-2 py-1.5 text-[11px] rounded border bg-background text-foreground ${
          highlight ? "border-primary/40 font-semibold" : "border-border"
        }`}
      />
      <p className="text-[8px] text-muted-foreground mt-0.5">System: {systemValue}</p>
    </div>
  );
}

function DeltaCell({ label, before, after, delta, pct, highlight }: {
  label: string; before: number; after: number; delta: number; pct: number; highlight?: boolean;
}) {
  const isUp = delta > 0;
  const isDown = delta < 0;
  const unchanged = delta === 0;
  return (
    <div className={`text-center ${highlight ? "font-semibold" : ""}`}>
      <p className="text-[8px] text-muted-foreground">{label}</p>
      <p className="text-[10px] text-muted-foreground">{before}</p>
      <p className={`text-[11px] font-bold ${highlight ? "text-primary" : "text-foreground"}`}>{after}</p>
      {!unchanged && (
        <p className={`text-[8px] font-semibold ${isUp ? "text-[hsl(var(--status-attention))]" : "text-[hsl(var(--status-approved))]"}`}>
          {isUp ? "+" : ""}{delta} ({pct >= 0 ? "+" : ""}{pct.toFixed(1)}%)
        </p>
      )}
    </div>
  );
}

export default EvalOverrideDialog;
