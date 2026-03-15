/**
 * EvaluateIQ — Evaluation Context Section
 */

import type { EvaluationContextInputs } from "@/types/valuation-input";
import {
  AlertTriangle,
  Clock,
  Link2,
  FileSearch,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
} from "lucide-react";

interface Props {
  data: EvaluationContextInputs;
  onChange: (patch: Partial<EvaluationContextInputs>) => void;
}

const EvaluationContextSection = ({ data, onChange }: Props) => {
  return (
    <div className="space-y-4">
      {/* Pre-existing & Gaps */}
      <div className="card-elevated p-5">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Risk Factors</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 mt-4">
          <ContextField
            icon={Link2}
            label="Pre-Existing Conditions"
            value={data.pre_existing_conditions}
            onChange={v => onChange({ pre_existing_conditions: v })}
            placeholder="Document any pre-existing conditions relevant to causation analysis…"
          />
          <ContextField
            icon={Clock}
            label="Gaps in Treatment"
            value={data.gaps_in_treatment}
            onChange={v => onChange({ gaps_in_treatment: v })}
            placeholder="Describe any treatment gaps that may affect valuation…"
          />
        </div>
      </div>

      {/* Causation & Documentation */}
      <div className="card-elevated p-5">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <FileSearch className="h-4 w-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Causation & Documentation</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 mt-4">
          <ContextField
            icon={AlertTriangle}
            label="Causation Concerns"
            value={data.causation_concerns}
            onChange={v => onChange({ causation_concerns: v })}
            placeholder="Any concerns about injury causation or attribution…"
          />
          <ContextField
            icon={FileSearch}
            label="Documentation Concerns"
            value={data.documentation_concerns}
            onChange={v => onChange({ documentation_concerns: v })}
            placeholder="Missing records, incomplete documentation, unsupported claims…"
          />
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="card-elevated p-5">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <ThumbsUp className="h-4 w-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Claim Assessment</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-[hsl(var(--status-approved))] uppercase tracking-wider flex items-center gap-1.5">
              <ThumbsUp className="h-3 w-3" /> Strengths
            </label>
            <textarea
              value={data.strengths}
              onChange={e => onChange({ strengths: e.target.value })}
              rows={4}
              className="w-full rounded-md border border-[hsl(var(--status-approved))]/20 bg-[hsl(var(--status-approved))]/5 px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--status-approved))]/40 transition-colors resize-none"
              placeholder="Strong liability position, clear causation, well-documented injuries…"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-destructive uppercase tracking-wider flex items-center gap-1.5">
              <ThumbsDown className="h-3 w-3" /> Weaknesses
            </label>
            <textarea
              value={data.weaknesses}
              onChange={e => onChange({ weaknesses: e.target.value })}
              rows={4}
              className="w-full rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-destructive/40 transition-colors resize-none"
              placeholder="Pre-existing conditions, treatment gaps, comparative negligence…"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="card-elevated p-5">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">General Notes</h3>
        </div>
        <div className="mt-4">
          <textarea
            value={data.notes}
            onChange={e => onChange({ notes: e.target.value })}
            rows={4}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring transition-colors resize-none"
            placeholder="Additional evaluation notes, considerations, or observations…"
          />
        </div>
      </div>
    </div>
  );
};

function ContextField({
  icon: Icon, label, value, onChange, placeholder,
}: {
  icon: React.ElementType; label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Icon className="h-3 w-3" /> {label}
      </label>
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

export default EvaluationContextSection;
