/**
 * EvaluateIQ — Liability / Collectibility Inputs Section
 */

import type { LiabilityInputs } from "@/types/valuation-input";
import { Shield, Percent, FileText } from "lucide-react";

interface Props {
  data: LiabilityInputs;
  onChange: (patch: Partial<LiabilityInputs>) => void;
}

const LiabilitySection = ({ data, onChange }: Props) => {
  return (
    <div className="space-y-4">
      {/* Fault Allocation */}
      <div className="card-elevated p-5">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Percent className="h-4 w-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Fault Allocation</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <PercentField
            label="Insured Fault %"
            value={data.insured_fault_percentage}
            onChange={v => onChange({ insured_fault_percentage: v })}
          />
          <PercentField
            label="Claimant Fault %"
            value={data.claimant_fault_percentage}
            onChange={v => onChange({ claimant_fault_percentage: v })}
          />
        </div>

        {/* Fault visual bar */}
        {(data.insured_fault_percentage !== null || data.claimant_fault_percentage !== null) && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Allocation</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden bg-accent flex">
              <div
                className="h-full bg-destructive/70 transition-all"
                style={{ width: `${data.insured_fault_percentage ?? 0}%` }}
              />
              <div
                className="h-full bg-[hsl(var(--status-attention))]/70 transition-all"
                style={{ width: `${data.claimant_fault_percentage ?? 0}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-destructive font-medium">Insured: {data.insured_fault_percentage ?? 0}%</span>
              <span className="text-[9px] text-[hsl(var(--status-attention))] font-medium">Claimant: {data.claimant_fault_percentage ?? 0}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Negligence & Mitigation Notes */}
      <div className="card-elevated p-5">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Negligence & Mitigation</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 mt-4">
          <TextArea label="Negligence Notes" value={data.negligence_notes} onChange={v => onChange({ negligence_notes: v })} />
          <TextArea label="Seatbelt / Mitigation Notes" value={data.seatbelt_mitigation_notes} onChange={v => onChange({ seatbelt_mitigation_notes: v })} />
        </div>
      </div>

      {/* Collectibility & Coverage */}
      <div className="card-elevated p-5">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Collectibility & Coverage</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 mt-4">
          <TextArea label="Collectible Constraints" value={data.collectible_constraints} onChange={v => onChange({ collectible_constraints: v })} placeholder="Coverage caps, excess layers, reinsurance, umbrella limits…" />
          <TextArea label="Coverage Constraints" value={data.coverage_constraints} onChange={v => onChange({ coverage_constraints: v })} placeholder="Exclusions, reservations of rights, coverage disputes…" />
          <TextArea label="Policy Limit Notes" value={data.policy_limit_notes} onChange={v => onChange({ policy_limit_notes: v })} />
        </div>
      </div>
    </div>
  );
};

function PercentField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Percent className="h-3 w-3" /> {label}
      </label>
      <div className="relative">
        <input
          type="number"
          min={0}
          max={100}
          value={value ?? ""}
          onChange={e => onChange(e.target.value ? parseFloat(e.target.value) : null)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 pr-8 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
          placeholder="0"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">%</span>
      </div>
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={2}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring transition-colors resize-none"
        placeholder={placeholder ?? `Enter ${label.toLowerCase()}`}
      />
    </div>
  );
}

export default LiabilitySection;
