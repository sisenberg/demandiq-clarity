/**
 * EvaluateIQ — Injury & Treatment Summary Section
 */

import type { InjuryTreatmentInputs } from "@/types/valuation-input";
import {
  Bone,
  Activity,
  Syringe,
  ScanLine,
  Heart,
  CheckCircle2,
  XCircle,
  Calendar,
  AlertTriangle,
} from "lucide-react";

interface Props {
  data: InjuryTreatmentInputs;
  onChange: (patch: Partial<InjuryTreatmentInputs>) => void;
}

const InjuryTreatmentSection = ({ data, onChange }: Props) => {
  return (
    <div className="space-y-4">
      {/* Injury List */}
      <div className="card-elevated p-5">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Bone className="h-4 w-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Injuries</h3>
          <span className="text-[9px] font-semibold bg-accent/60 text-muted-foreground px-1.5 py-0.5 rounded-md">
            {data.injuries.length}
          </span>
        </div>
        {data.injuries.length > 0 ? (
          <div className="mt-3 divide-y divide-border/40">
            {data.injuries.map((inj) => (
              <div key={inj.id} className="py-2.5 flex items-start gap-3">
                <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${
                  inj.severity === "severe" || inj.severity === "catastrophic" ? "bg-destructive"
                    : inj.severity === "moderate" ? "bg-[hsl(var(--status-attention))]"
                      : "bg-[hsl(var(--status-approved))]"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-medium text-foreground">{inj.body_part}</span>
                    <span className="text-[9px] text-muted-foreground font-mono">{inj.diagnosis_code}</span>
                    {inj.is_pre_existing && (
                      <span className="text-[8px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]">
                        Pre-existing
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{inj.injury_category} · {inj.severity}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 text-center py-6">
            <Bone className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-[11px] text-muted-foreground">No injuries populated from upstream data</p>
          </div>
        )}
      </div>

      {/* Treatment Summary */}
      <div className="card-elevated p-5">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Treatment Profile</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-3 w-3" /> Treatment Start
            </label>
            <input
              type="date"
              value={data.treatment_start_date ?? ""}
              onChange={e => onChange({ treatment_start_date: e.target.value || null })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-3 w-3" /> Treatment End
            </label>
            <input
              type="date"
              value={data.treatment_end_date ?? ""}
              onChange={e => onChange({ treatment_end_date: e.target.value || null })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Treatment types chips */}
        {data.treatment_types.length > 0 && (
          <div className="mt-3">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Treatment Types</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {data.treatment_types.map(t => (
                <span key={t} className="text-[10px] font-medium px-2.5 py-1 rounded-full border border-border bg-accent text-foreground">
                  {t.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Clinical Flags */}
      <div className="card-elevated p-5">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Clinical Indicators</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <ToggleFlag label="Surgery" active={data.has_surgery} onToggle={v => onChange({ has_surgery: v })} />
          <ToggleFlag label="Injections" active={data.has_injections} onToggle={v => onChange({ has_injections: v })} />
          <ToggleFlag label="Imaging" active={data.has_imaging} onToggle={v => onChange({ has_imaging: v })} />
          <ToggleFlag label="Hospitalization" active={data.has_hospitalization} onToggle={v => onChange({ has_hospitalization: v })} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          <ToggleFlag label="Permanency Claimed" active={data.permanency_claimed} onToggle={v => onChange({ permanency_claimed: v })} />
        </div>
      </div>

      {/* Residual / Functional */}
      <div className="card-elevated p-5">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Heart className="h-4 w-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Residual & Functional Status</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 mt-4">
          <TextArea label="Residual Complaints" value={data.residual_complaints} onChange={v => onChange({ residual_complaints: v })} />
          <TextArea label="Functional Limitations" value={data.functional_limitations} onChange={v => onChange({ functional_limitations: v })} />
        </div>
      </div>
    </div>
  );
};

function ToggleFlag({ label, active, onToggle }: { label: string; active: boolean; onToggle: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onToggle(!active)}
      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-[11px] font-medium transition-all ${
        active
          ? "bg-[hsl(var(--status-attention))]/10 border-[hsl(var(--status-attention))]/30 text-[hsl(var(--status-attention))]"
          : "bg-accent/50 border-border text-muted-foreground hover:bg-accent"
      }`}
    >
      {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5 opacity-40" />}
      {label}
    </button>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={2}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring transition-colors resize-none"
        placeholder={`Enter ${label.toLowerCase()}`}
      />
    </div>
  );
}

export default InjuryTreatmentSection;
