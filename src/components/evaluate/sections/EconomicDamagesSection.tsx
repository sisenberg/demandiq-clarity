/**
 * EvaluateIQ — Economic Damages Inputs Section
 */

import type { EconomicDamagesInputs } from "@/types/valuation-input";
import { DollarSign, TrendingUp, Briefcase, Heart } from "lucide-react";

interface Props {
  data: EconomicDamagesInputs;
  onChange: (patch: Partial<EconomicDamagesInputs>) => void;
}

const fmt = (n: number | null) => n !== null ? `$${n.toLocaleString()}` : "—";

const EconomicDamagesSection = ({ data, onChange }: Props) => {
  // Summary calculations
  const totalClaimed = (data.medical_specials_claimed ?? 0) + (data.wage_loss_claimed ?? 0) + (data.future_medical_claimed ?? 0) + (data.other_out_of_pocket ?? 0);
  const totalAllowed = (data.medical_specials_allowed ?? 0) + (data.wage_loss_allowed ?? 0) + (data.future_medical_allowed ?? 0) + (data.other_out_of_pocket ?? 0);

  return (
    <div className="space-y-4">
      {/* Summary Strip */}
      <div className="card-elevated p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryMetric label="Total Claimed" value={fmt(totalClaimed)} />
          <SummaryMetric label="Total Allowed" value={fmt(totalAllowed)} highlight />
          <SummaryMetric label="Variance" value={fmt(totalClaimed - totalAllowed)} />
          <SummaryMetric
            label="Reduction"
            value={totalClaimed > 0 ? `${Math.round(((totalClaimed - totalAllowed) / totalClaimed) * 100)}%` : "—"}
          />
        </div>
      </div>

      {/* Medical Specials */}
      <div className="card-elevated p-5">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Heart className="h-4 w-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Medical Specials</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <CurrencyField label="Medical Specials Claimed" value={data.medical_specials_claimed} onChange={v => onChange({ medical_specials_claimed: v })} />
          <CurrencyField label="Medical Specials Allowed" value={data.medical_specials_allowed} onChange={v => onChange({ medical_specials_allowed: v })} highlight />
        </div>
        {data.medical_specials_claimed !== null && data.medical_specials_allowed !== null && data.medical_specials_claimed > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1">
              <span>Allowed vs Claimed</span>
              <span>{Math.round((data.medical_specials_allowed / data.medical_specials_claimed) * 100)}%</span>
            </div>
            <div className="h-2 bg-accent rounded-full overflow-hidden">
              <div
                className="h-full bg-primary/70 rounded-full transition-all"
                style={{ width: `${Math.min(100, (data.medical_specials_allowed / data.medical_specials_claimed) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Wage Loss */}
      <div className="card-elevated p-5">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Briefcase className="h-4 w-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Wage & Earnings Loss</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <CurrencyField label="Wage Loss Claimed" value={data.wage_loss_claimed} onChange={v => onChange({ wage_loss_claimed: v })} />
          <CurrencyField label="Wage Loss Allowed" value={data.wage_loss_allowed} onChange={v => onChange({ wage_loss_allowed: v })} highlight />
        </div>
      </div>

      {/* Future Medical */}
      <div className="card-elevated p-5">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Future Medical & Other Damages</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <CurrencyField label="Future Medical Claimed" value={data.future_medical_claimed} onChange={v => onChange({ future_medical_claimed: v })} />
          <CurrencyField label="Future Medical Allowed" value={data.future_medical_allowed} onChange={v => onChange({ future_medical_allowed: v })} highlight />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <CurrencyField label="Other Out-of-Pocket" value={data.other_out_of_pocket} onChange={v => onChange({ other_out_of_pocket: v })} />
        </div>
      </div>
    </div>
  );
};

function SummaryMetric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-[18px] font-bold tracking-tight mt-0.5 ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function CurrencyField({ label, value, onChange, highlight }: { label: string; value: number | null; onChange: (v: number | null) => void; highlight?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className={`text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 ${highlight ? "text-primary" : "text-muted-foreground"}`}>
        <DollarSign className="h-3 w-3" /> {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">$</span>
        <input
          type="number"
          value={value ?? ""}
          onChange={e => onChange(e.target.value ? parseFloat(e.target.value) : null)}
          className={`w-full rounded-md border bg-background pl-7 pr-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring transition-colors ${
            highlight ? "border-primary/30" : "border-border"
          }`}
          placeholder="0.00"
        />
      </div>
    </div>
  );
}

export default EconomicDamagesSection;
