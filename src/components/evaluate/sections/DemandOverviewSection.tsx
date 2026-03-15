/**
 * EvaluateIQ — Demand-Linked Case Overview Section
 * Editable inputs for demand source, representation, policy, claimant context.
 */

import type { DemandOverviewInputs } from "@/types/valuation-input";
import {
  User,
  Calendar,
  MapPin,
  Shield,
  DollarSign,
  FileText,
  Scale,
  Briefcase,
  Users,
  Building2,
} from "lucide-react";

interface Props {
  data: DemandOverviewInputs;
  onChange: (patch: Partial<DemandOverviewInputs>) => void;
  sourceModule: string;
  sourceVersion: number | null;
}

const DemandOverviewSection = ({ data, onChange, sourceModule, sourceVersion }: Props) => {
  return (
    <div className="space-y-4">
      {/* Source badge */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[9px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md bg-primary/10 text-primary border border-primary/20">
          Source: {sourceModule === "revieweriq" ? "ReviewerIQ" : "DemandIQ"} v{sourceVersion}
        </span>
        {data.demand_source && (
          <span className="text-[10px] text-muted-foreground">{data.demand_source}</span>
        )}
      </div>

      {/* Claimant & Claim Identity */}
      <div className="card-elevated p-5">
        <SectionHeader icon={User} title="Claimant & Claim Identity" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Field label="Claimant Name" value={data.claimant_name} onChange={v => onChange({ claimant_name: v })} icon={User} />
          <Field label="Date of Loss" value={data.date_of_loss} onChange={v => onChange({ date_of_loss: v })} icon={Calendar} type="date" />
          <Field label="Jurisdiction / State" value={data.jurisdiction_state} onChange={v => onChange({ jurisdiction_state: v })} icon={MapPin} />
          <Field label="Venue / County" value={data.venue_county} onChange={v => onChange({ venue_county: v })} icon={MapPin} />
          <Field label="Claim Status" value={data.claim_status} onChange={v => onChange({ claim_status: v })} icon={FileText} />
          <Field label="Adjuster" value={data.adjuster_name} onChange={v => onChange({ adjuster_name: v })} icon={Briefcase} />
          <Field label="Supervisor" value={data.supervisor_name} onChange={v => onChange({ supervisor_name: v })} icon={Users} />
        </div>
      </div>

      {/* Representation & Demand */}
      <div className="card-elevated p-5">
        <SectionHeader icon={Scale} title="Representation & Demand" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-3 w-3" /> Representation Status
            </label>
            <select
              value={data.representation_status}
              onChange={e => onChange({ representation_status: e.target.value as DemandOverviewInputs["representation_status"] })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="unknown">Unknown</option>
              <option value="represented">Represented</option>
              <option value="unrepresented">Unrepresented</option>
            </select>
            <p className="text-[9px] text-muted-foreground italic">Tracked as metadata only — not used as an automatic value adjustment</p>
          </div>
          <Field label="Attorney Name" value={data.claimant_attorney_name} onChange={v => onChange({ claimant_attorney_name: v })} icon={Briefcase} />
          <Field label="Attorney Firm" value={data.claimant_attorney_firm} onChange={v => onChange({ claimant_attorney_firm: v })} icon={Building2} />
          <Field label="Demand Received Date" value={data.demand_received_date ?? ""} onChange={v => onChange({ demand_received_date: v || null })} icon={Calendar} type="date" />
          <CurrencyField label="Demand Amount" value={data.demand_amount} onChange={v => onChange({ demand_amount: v })} />
          <CurrencyField label="Policy Limits" value={data.policy_limits} onChange={v => onChange({ policy_limits: v })} />
        </div>
      </div>

      {/* Liability & Notes */}
      <div className="card-elevated p-5">
        <SectionHeader icon={Shield} title="Liability & Claim Notes" />
        <div className="grid grid-cols-1 gap-4 mt-4">
          <TextArea label="Liability Determination" value={data.liability_determination} onChange={v => onChange({ liability_determination: v })} rows={2} />
          <TextArea label="Claim Notes" value={data.claim_notes} onChange={v => onChange({ claim_notes: v })} rows={3} />
        </div>
      </div>
    </div>
  );
};

// ─── Sub-components ─────────────────────────────────────

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-border">
      <Icon className="h-4 w-4 text-primary" />
      <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
    </div>
  );
}

function Field({
  label, value, onChange, icon: Icon, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; icon?: React.ElementType; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
        placeholder={`Enter ${label.toLowerCase()}`}
      />
    </div>
  );
}

function CurrencyField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <DollarSign className="h-3 w-3" /> {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">$</span>
        <input
          type="number"
          value={value ?? ""}
          onChange={e => onChange(e.target.value ? parseFloat(e.target.value) : null)}
          className="w-full rounded-md border border-border bg-background pl-7 pr-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
          placeholder="0.00"
        />
      </div>
    </div>
  );
}

function TextArea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring transition-colors resize-none"
        placeholder={`Enter ${label.toLowerCase()}`}
      />
    </div>
  );
}

export default DemandOverviewSection;
