import type { EvaluateIntakeSnapshot, CompletenessWarning, FieldCompleteness } from "@/types/evaluate-intake";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Clock,
  Shield,
  Activity,
  DollarSign,
  Users,
  Stethoscope,
  FileText,
  Scale,
  Syringe,
  ScanSearch,
  Bone,
  Brain,
} from "lucide-react";

interface Props {
  snapshot: EvaluateIntakeSnapshot;
}

// ─── Completeness badge ─────────────────────────────────

function CompletenessIcon({ status }: { status: FieldCompleteness }) {
  switch (status) {
    case "complete":
      return <CheckCircle2 className="h-3 w-3 text-[hsl(var(--status-approved))]" />;
    case "partial":
      return <AlertTriangle className="h-3 w-3 text-[hsl(var(--status-attention))]" />;
    case "missing":
      return <XCircle className="h-3 w-3 text-[hsl(var(--status-failed))]" />;
  }
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))] border-[hsl(var(--status-approved))]/20"
      : score >= 50
        ? "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))] border-[hsl(var(--status-attention))]/20"
        : "bg-[hsl(var(--status-failed))]/10 text-[hsl(var(--status-failed))] border-[hsl(var(--status-failed))]/20";

  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${color}`}>
      {score}%
    </span>
  );
}

// ─── Stat row ───────────────────────────────────────────

function StatRow({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-[11px] text-muted-foreground flex-1">{label}</span>
      <span className="text-[12px] font-medium text-foreground">{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground">({sub})</span>}
    </div>
  );
}

// ─── Clinical flag pill ─────────────────────────────────

function FlagPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
        active
          ? "bg-[hsl(var(--status-attention))]/10 border-[hsl(var(--status-attention))]/20 text-[hsl(var(--status-attention))]"
          : "bg-accent border-border text-muted-foreground"
      }`}
    >
      {active ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
      {label}
    </span>
  );
}

// ─── Main Component ─────────────────────────────────────

const EvaluateIntakeSummaryPanel = ({ snapshot }: Props) => {
  const totalBilled = snapshot.medical_billing.reduce((sum, b) => sum + b.billed_amount, 0);
  const totalPaid = snapshot.medical_billing.reduce((sum, b) => sum + (b.paid_amount ?? 0), 0);
  const totalReviewed = snapshot.medical_billing.reduce((sum, b) => sum + (b.reviewer_recommended_amount ?? 0), 0);
  const hasReviewerAmounts = snapshot.medical_billing.some((b) => b.reviewer_recommended_amount !== null);

  const criticalWarnings = snapshot.completeness_warnings.filter((w) => w.status === "missing");
  const partialWarnings = snapshot.completeness_warnings.filter((w) => w.status === "partial");

  return (
    <div className="space-y-4">
      {/* ── Source & Snapshot Metadata ────────────── */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-semibold text-foreground">Intake Snapshot</h3>
          <ScoreBadge score={snapshot.overall_completeness_score} />
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Source Module</span>
            <span className="font-medium text-foreground">
              {snapshot.source_module === "revieweriq" ? "ReviewerIQ" : "DemandIQ"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Package Version</span>
            <span className="font-medium text-foreground">v{snapshot.source_package_version}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Snapshot Created</span>
            <span className="font-medium text-foreground">
              {new Date(snapshot.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Snapshot ID</span>
            <span className="font-mono text-muted-foreground text-[9px]">{snapshot.snapshot_id.slice(-12)}</span>
          </div>
        </div>
      </div>

      {/* ── Key Metrics ──────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-[12px] font-semibold text-foreground mb-2">Key Inputs</h3>
        <div className="divide-y divide-border">
          <StatRow icon={Bone} label="Injuries" value={snapshot.injuries.length} sub={`${snapshot.injuries.filter((i) => i.is_pre_existing).length} pre-existing`} />
          <StatRow icon={Activity} label="Treatments" value={snapshot.treatment_timeline.length} />
          <StatRow icon={Users} label="Providers" value={snapshot.providers.length} />
          <StatRow icon={DollarSign} label="Total Billed" value={`$${totalBilled.toLocaleString()}`} />
          <StatRow icon={DollarSign} label="Total Paid" value={`$${totalPaid.toLocaleString()}`} />
          {hasReviewerAmounts && (
            <StatRow icon={Stethoscope} label="Reviewer Recommended" value={`$${totalReviewed.toLocaleString()}`} />
          )}
          <StatRow icon={Scale} label="Liability Facts" value={snapshot.liability_facts.length} />
          <StatRow icon={Shield} label="Policy Limits" value={
            snapshot.policy_coverage.length > 0
              ? `$${(snapshot.policy_coverage[0].coverage_limit ?? 0).toLocaleString()}`
              : "—"
          } />
          <StatRow icon={DollarSign} label="Lost Wages" value={
            snapshot.wage_loss.total_lost_wages.value > 0
              ? `$${snapshot.wage_loss.total_lost_wages.value.toLocaleString()}`
              : "—"
          } />
          <StatRow icon={Brain} label="Future Medical" value={
            snapshot.future_treatment.future_medical_estimate.value > 0
              ? `$${snapshot.future_treatment.future_medical_estimate.value.toLocaleString()}`
              : "—"
          } />
        </div>
      </div>

      {/* ── Clinical Flags ───────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-[12px] font-semibold text-foreground mb-2.5">Clinical Flags</h3>
        <div className="flex flex-wrap gap-1.5">
          <FlagPill active={snapshot.clinical_flags.has_surgery} label="Surgery" />
          <FlagPill active={snapshot.clinical_flags.has_injections} label="Injections" />
          <FlagPill active={snapshot.clinical_flags.has_advanced_imaging} label="Advanced Imaging" />
          <FlagPill active={snapshot.clinical_flags.has_permanency_indicators} label="Permanency" />
          <FlagPill active={snapshot.clinical_flags.has_impairment_rating} label="Impairment Rating" />
          <FlagPill active={snapshot.clinical_flags.has_scarring_disfigurement} label="Scarring" />
        </div>
      </div>

      {/* ── Completeness Warnings ────────────────── */}
      {snapshot.completeness_warnings.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--status-attention))]" />
            <h3 className="text-[12px] font-semibold text-foreground">
              Completeness Warnings
              <span className="text-[10px] font-normal text-muted-foreground ml-1.5">
                {criticalWarnings.length} missing · {partialWarnings.length} partial
              </span>
            </h3>
          </div>
          <div className="space-y-1.5">
            {snapshot.completeness_warnings.map((w) => (
              <div key={w.field} className="flex items-start gap-2 py-1">
                <CompletenessIcon status={w.status} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-foreground">{w.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-snug">{w.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Upstream Concerns ────────────────────── */}
      {snapshot.upstream_concerns.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Info className="h-3.5 w-3.5 text-[hsl(var(--status-review))]" />
            <h3 className="text-[12px] font-semibold text-foreground">
              Upstream Issues & Concerns
              <span className="text-[10px] font-normal text-muted-foreground ml-1.5">
                {snapshot.upstream_concerns.length} items
              </span>
            </h3>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {snapshot.upstream_concerns.map((c) => (
              <div key={c.id} className="flex items-start gap-2 py-1">
                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-px rounded shrink-0 mt-0.5 ${
                  c.severity === "critical"
                    ? "bg-[hsl(var(--status-failed))]/10 text-[hsl(var(--status-failed))]"
                    : c.severity === "warning"
                      ? "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]"
                      : "bg-accent text-muted-foreground"
                }`}>
                  {c.category}
                </span>
                <p className="text-[10px] text-foreground leading-snug flex-1">{c.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Future Treatment Indicators ──────────── */}
      {snapshot.future_treatment.indicators.value.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-[12px] font-semibold text-foreground mb-2">Future Treatment Indicators</h3>
          <ul className="space-y-1">
            {snapshot.future_treatment.indicators.value.map((ind, i) => (
              <li key={i} className="flex items-center gap-2 text-[11px] text-foreground">
                <Syringe className="h-3 w-3 text-muted-foreground shrink-0" />
                {ind}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default EvaluateIntakeSummaryPanel;
