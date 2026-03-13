/**
 * EvaluateIQ — Representation Context Card
 *
 * Displays representation status, attorney info, retention risk,
 * and explicit representation notes in the evaluation workspace.
 */

import type { RepresentationAwareValuation } from '@/types/representation-valuation';
import {
  UserCheck,
  UserX,
  HelpCircle,
  TrendingUp,
  AlertTriangle,
  Shield,
  Briefcase,
  Info,
} from 'lucide-react';

interface Props {
  valuation: RepresentationAwareValuation;
}

const EvalRepresentationCard = ({ valuation }: Props) => {
  const { representation_context: ctx, representation_notes: notes } = valuation;

  const statusIcon = ctx.representation_status_current === 'represented'
    ? UserCheck
    : ctx.representation_status_current === 'unrepresented'
      ? UserX
      : HelpCircle;

  const statusLabel = ctx.representation_status_current === 'represented'
    ? 'Represented'
    : ctx.representation_status_current === 'unrepresented'
      ? 'Unrepresented'
      : 'Unknown';

  const statusColor = ctx.representation_status_current === 'represented'
    ? 'text-[hsl(var(--status-approved))]'
    : ctx.representation_status_current === 'unrepresented'
      ? 'text-[hsl(var(--status-attention))]'
      : 'text-muted-foreground';

  const statusBg = ctx.representation_status_current === 'represented'
    ? 'bg-[hsl(var(--status-approved))]/10'
    : ctx.representation_status_current === 'unrepresented'
      ? 'bg-[hsl(var(--status-attention))]/10'
      : 'bg-accent';

  const StatusIcon = statusIcon;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Representation Context</h3>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md ${statusBg} ${statusColor}`}>
          <StatusIcon className="h-3 w-3" />
          {statusLabel}
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* Status Details Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <DetailCell label="Current Status" value={statusLabel} />
          <DetailCell label="At Evaluation" value={statusLabel} />
          <DetailCell label="History Events" value={String(ctx.representation_history_count)} />
          {ctx.current_attorney_name && (
            <DetailCell label="Attorney" value={ctx.current_attorney_name} />
          )}
          {ctx.current_firm_name && (
            <DetailCell label="Firm" value={ctx.current_firm_name} />
          )}
          {ctx.representation_status_current === 'unrepresented' && (
            <div className="space-y-1">
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Retention Risk</span>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3 w-3 text-muted-foreground" />
                <span className={`text-[13px] font-bold ${
                  ctx.attorney_retention_risk > 60 ? 'text-destructive'
                  : ctx.attorney_retention_risk > 35 ? 'text-[hsl(var(--status-attention))]'
                  : 'text-[hsl(var(--status-approved))]'
                }`}>{ctx.attorney_retention_risk}%</span>
              </div>
              {/* Mini progress bar */}
              <div className="h-1 rounded-full bg-accent overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    ctx.attorney_retention_risk > 60 ? 'bg-destructive'
                    : ctx.attorney_retention_risk > 35 ? 'bg-[hsl(var(--status-attention))]'
                    : 'bg-[hsl(var(--status-approved))]'
                  }`}
                  style={{ width: `${ctx.attorney_retention_risk}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Flags */}
        <div className="flex flex-wrap gap-2">
          {ctx.representation_transition_flag && (
            <FlagPill icon={AlertTriangle} label="Representation Transition" variant="attention" />
          )}
          {ctx.attorney_retained_during_claim_flag && (
            <FlagPill icon={UserCheck} label="Attorney Retained During Claim" variant="info" />
          )}
          {ctx.attorney_retained_after_initial_offer_flag && (
            <FlagPill icon={AlertTriangle} label="Retained After Initial Offer" variant="attention" />
          )}
        </div>

        {/* Representation Independence Note */}
        <div className="rounded-lg border border-border bg-accent/30 p-4">
          <div className="flex items-start gap-2.5">
            <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-2 min-w-0">
              <p className="text-[11px] font-semibold text-foreground">Fact-Based Value Independence</p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {notes.fact_value_independence_statement}
              </p>
              <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
                {notes.resolution_context_explanation}
              </p>
            </div>
          </div>
        </div>

        {/* Compliance Notes */}
        <div className="space-y-1.5">
          {notes.compliance_notes.map((note, i) => (
            <div key={i} className="flex items-start gap-2 text-[9px] text-muted-foreground">
              <Info className="h-3 w-3 shrink-0 mt-0.5" />
              <span>{note}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      <p className="text-[12px] font-medium text-foreground">{value}</p>
    </div>
  );
}

function FlagPill({ icon: Icon, label, variant }: { icon: React.ElementType; label: string; variant: 'attention' | 'info' }) {
  const color = variant === 'attention'
    ? 'bg-[hsl(var(--status-attention))]/10 border-[hsl(var(--status-attention))]/20 text-[hsl(var(--status-attention))]'
    : 'bg-accent border-border text-muted-foreground';
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded-md border ${color}`}>
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

export default EvalRepresentationCard;
