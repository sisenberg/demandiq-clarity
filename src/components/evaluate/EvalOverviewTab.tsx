import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import {
  Bone,
  Activity,
  DollarSign,
  Shield,
  Scale,
  Users,
  Stethoscope,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Brain,
} from "lucide-react";

interface Props {
  snapshot: EvaluateIntakeSnapshot;
}

const fmt = (n: number) => `$${n.toLocaleString()}`;

const EvalOverviewTab = ({ snapshot }: Props) => {
  const totalBilled = snapshot.medical_billing.reduce((s, b) => s + b.billed_amount, 0);
  const totalPaid = snapshot.medical_billing.reduce((s, b) => s + (b.paid_amount ?? 0), 0);
  const totalReviewed = snapshot.medical_billing.reduce((s, b) => s + (b.reviewer_recommended_amount ?? 0), 0);
  const hasReviewed = snapshot.medical_billing.some((b) => b.reviewer_recommended_amount !== null);

  const supportingFacts = snapshot.liability_facts.filter((f) => f.supports_liability);
  const adverseFacts = snapshot.liability_facts.filter((f) => !f.supports_liability);

  const policyLimit = snapshot.policy_coverage.length > 0
    ? snapshot.policy_coverage.reduce((max, p) => Math.max(max, p.coverage_limit ?? 0), 0)
    : null;

  // Derive range expanders / reducers from snapshot data
  const expanders = deriveExpanders(snapshot);
  const reducers = deriveReducers(snapshot);

  return (
    <div className="space-y-5">
      {/* ── Top metrics ─────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={DollarSign} label="Total Billed" value={fmt(totalBilled)} />
        <MetricCard icon={DollarSign} label="Total Paid" value={fmt(totalPaid)} accent />
        {hasReviewed && <MetricCard icon={Stethoscope} label="Reviewed Medical" value={fmt(totalReviewed)} />}
        <MetricCard icon={Shield} label="Policy Limits" value={policyLimit != null ? fmt(policyLimit) : "—"} />
        <MetricCard icon={Bone} label="Injuries" value={String(snapshot.injuries.length)} sub={`${snapshot.injuries.filter((i) => i.is_pre_existing).length} pre-existing`} />
        <MetricCard icon={Activity} label="Treatments" value={String(snapshot.treatment_timeline.length)} />
        <MetricCard icon={Users} label="Providers" value={String(snapshot.providers.length)} />
        <MetricCard icon={DollarSign} label="Wage Loss" value={snapshot.wage_loss.total_lost_wages.value > 0 ? fmt(snapshot.wage_loss.total_lost_wages.value) : "—"} />
      </div>

      {/* ── Injury Summary ──────────────────────── */}
      <div className="card-elevated p-5">
        <SectionTitle icon={Bone} title="Injury Summary" count={snapshot.injuries.length} />
        <div className="mt-3 space-y-2">
          {snapshot.injuries.map((inj) => (
            <div key={inj.id} className="flex items-start gap-3 py-1.5">
              <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${severityDot(inj.severity)}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-medium text-foreground">{inj.diagnosis_description}</span>
                  {inj.is_pre_existing && (
                    <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]">
                      Pre-existing
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {inj.body_part} · {inj.diagnosis_code} · {inj.severity}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Treatment Summary ─────────────────── */}
        <div className="card-elevated p-5">
          <SectionTitle icon={Activity} title="Treatment Summary" count={snapshot.treatment_timeline.length} />
          <div className="mt-3 space-y-1">
            {groupByType(snapshot.treatment_timeline).map(([type, items]) => (
              <div key={type} className="flex items-center justify-between py-1.5">
                <span className="text-[11px] font-medium text-foreground">{type}</span>
                <span className="text-[11px] text-muted-foreground">{items.length} {items.length === 1 ? "visit" : "visits"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Medical Totals ────────────────────── */}
        <div className="card-elevated p-5">
          <SectionTitle icon={DollarSign} title="Medical Totals" />
          <div className="mt-3 space-y-2">
            <TotalRow label="Total Billed" value={fmt(totalBilled)} />
            <TotalRow label="Total Paid" value={fmt(totalPaid)} />
            {hasReviewed && <TotalRow label="Reviewer Recommended" value={fmt(totalReviewed)} highlight />}
            {snapshot.future_treatment.future_medical_estimate.value > 0 && (
              <TotalRow label="Future Medical (est.)" value={fmt(snapshot.future_treatment.future_medical_estimate.value)} />
            )}
            {snapshot.wage_loss.total_lost_wages.value > 0 && (
              <TotalRow label="Lost Wages" value={fmt(snapshot.wage_loss.total_lost_wages.value)} />
            )}
          </div>
        </div>
      </div>

      {/* ── Liability Posture ───────────────────── */}
      <div className="card-elevated p-5">
        <SectionTitle icon={Scale} title="Liability Posture" count={snapshot.liability_facts.length} />
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="section-label mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-[hsl(var(--status-approved))]" />
              Supporting Facts ({supportingFacts.length})
            </p>
            <div className="space-y-1.5">
              {supportingFacts.map((f) => (
                <FactRow key={f.id} text={f.fact_text} confidence={f.confidence} />
              ))}
            </div>
          </div>
          <div>
            <p className="section-label mb-2 flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-[hsl(var(--status-failed))]" />
              Adverse / Defense Facts ({adverseFacts.length})
            </p>
            <div className="space-y-1.5">
              {adverseFacts.length > 0 ? adverseFacts.map((f) => (
                <FactRow key={f.id} text={f.fact_text} confidence={f.confidence} />
              )) : (
                <p className="text-[11px] text-muted-foreground italic">No adverse facts identified</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Range Expanders & Reducers ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-elevated p-5">
          <SectionTitle icon={TrendingUp} title="Range Expanders" count={expanders.length} />
          <div className="mt-3 space-y-2">
            {expanders.map((e, i) => (
              <DriverPill key={i} label={e.label} explanation={e.explanation} type="expander" />
            ))}
            {expanders.length === 0 && <p className="text-[11px] text-muted-foreground italic">None identified from current inputs</p>}
          </div>
        </div>
        <div className="card-elevated p-5">
          <SectionTitle icon={TrendingDown} title="Range Reducers" count={reducers.length} />
          <div className="mt-3 space-y-2">
            {reducers.map((r, i) => (
              <DriverPill key={i} label={r.label} explanation={r.explanation} type="reducer" />
            ))}
            {reducers.length === 0 && <p className="text-[11px] text-muted-foreground italic">None identified from current inputs</p>}
          </div>
        </div>
      </div>

      {/* ── Clinical Flags ──────────────────────── */}
      <div className="card-elevated p-5">
        <SectionTitle icon={Brain} title="Clinical Indicators" />
        <div className="mt-3 flex flex-wrap gap-2">
          <FlagChip active={snapshot.clinical_flags.has_surgery} label="Surgery" />
          <FlagChip active={snapshot.clinical_flags.has_injections} label="Injections" />
          <FlagChip active={snapshot.clinical_flags.has_advanced_imaging} label="Advanced Imaging" />
          <FlagChip active={snapshot.clinical_flags.has_permanency_indicators} label="Permanency" />
          <FlagChip active={snapshot.clinical_flags.has_impairment_rating} label="Impairment Rating" />
          <FlagChip active={snapshot.clinical_flags.has_scarring_disfigurement} label="Scarring / Disfigurement" />
        </div>
      </div>

      {/* ── Upstream Concerns ───────────────────── */}
      {snapshot.upstream_concerns.length > 0 && (
        <div className="card-elevated p-5">
          <SectionTitle icon={AlertTriangle} title="Upstream Concerns" count={snapshot.upstream_concerns.length} />
          <div className="mt-3 space-y-2">
            {snapshot.upstream_concerns.map((c) => (
              <div key={c.id} className="flex items-start gap-2.5 py-1">
                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${
                  c.severity === "critical"
                    ? "bg-[hsl(var(--status-failed))]/10 text-[hsl(var(--status-failed))]"
                    : c.severity === "warning"
                      ? "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]"
                      : "bg-accent text-muted-foreground"
                }`}>
                  {c.category}
                </span>
                <p className="text-[11px] text-foreground leading-snug flex-1">{c.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Sub-components ─────────────────────────────────────

function SectionTitle({ icon: Icon, title, count }: { icon: React.ElementType; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
      <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
      {count !== undefined && (
        <span className="text-[9px] font-semibold bg-accent/60 text-muted-foreground px-1.5 py-0.5 rounded-md min-w-[18px] text-center">
          {count}
        </span>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub, accent }: { icon: React.ElementType; label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="card-elevated p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-[18px] font-bold tracking-tight ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function TotalRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={`text-[12px] font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

function FactRow({ text, confidence }: { text: string; confidence: number | null }) {
  return (
    <div className="flex items-start gap-2 py-1">
      {confidence !== null && (
        <span className={`confidence-dot mt-1.5 ${confidence >= 0.8 ? "confidence-high" : confidence >= 0.5 ? "confidence-medium" : "confidence-low"}`} />
      )}
      <p className="text-[11px] text-foreground leading-snug">{text}</p>
    </div>
  );
}

function DriverPill({ label, explanation, type }: { label: string; explanation: string; type: "expander" | "reducer" }) {
  const color = type === "expander"
    ? "border-[hsl(var(--status-attention))]/20 bg-[hsl(var(--status-attention))]/5"
    : "border-[hsl(var(--status-approved))]/20 bg-[hsl(var(--status-approved))]/5";
  return (
    <div className={`rounded-lg border p-3 ${color}`}>
      <p className="text-[11px] font-semibold text-foreground">{label}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{explanation}</p>
    </div>
  );
}

function FlagChip({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
      active
        ? "bg-[hsl(var(--status-attention))]/10 border-[hsl(var(--status-attention))]/20 text-[hsl(var(--status-attention))]"
        : "bg-accent border-border text-muted-foreground"
    }`}>
      {active ? <CheckCircle2 className="h-2.5 w-2.5" /> : <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />}
      {label}
    </span>
  );
}

function severityDot(severity: string) {
  switch (severity.toLowerCase()) {
    case "severe": return "bg-[hsl(var(--status-failed))]";
    case "moderate": return "bg-[hsl(var(--status-attention))]";
    case "mild": return "bg-[hsl(var(--status-approved))]";
    default: return "bg-muted-foreground/40";
  }
}

function groupByType(treatments: EvaluateIntakeSnapshot["treatment_timeline"]) {
  const map = new Map<string, typeof treatments>();
  for (const t of treatments) {
    const arr = map.get(t.treatment_type) ?? [];
    arr.push(t);
    map.set(t.treatment_type, arr);
  }
  return Array.from(map.entries());
}

// ─── Derived Expanders / Reducers ───────────────────────

interface DriverItem { label: string; explanation: string }

function deriveExpanders(s: EvaluateIntakeSnapshot): DriverItem[] {
  const items: DriverItem[] = [];
  if (s.clinical_flags.has_surgery) items.push({ label: "Surgical Intervention", explanation: "Surgical procedures increase general damages exposure and future care costs." });
  if (s.clinical_flags.has_permanency_indicators) items.push({ label: "Permanency Indicators", explanation: "Documented permanency findings support higher non-economic damages." });
  if (s.injuries.filter(i => !i.is_pre_existing).length >= 3) items.push({ label: "Multiple Injuries", explanation: `${s.injuries.filter(i => !i.is_pre_existing).length} new injuries documented, increasing cumulative damages.` });
  if (s.future_treatment.future_medical_estimate.value > 0) items.push({ label: "Future Medical Needs", explanation: `Estimated ${fmt(s.future_treatment.future_medical_estimate.value)} in projected future treatment costs.` });
  if (s.clinical_flags.has_scarring_disfigurement) items.push({ label: "Scarring / Disfigurement", explanation: "Documented scarring or disfigurement supports pain and suffering claims." });
  return items;
}

function deriveReducers(s: EvaluateIntakeSnapshot): DriverItem[] {
  const items: DriverItem[] = [];
  if (s.injuries.some(i => i.is_pre_existing)) items.push({ label: "Pre-existing Conditions", explanation: `${s.injuries.filter(i => i.is_pre_existing).length} pre-existing condition(s) may reduce causation attribution.` });
  if (s.upstream_concerns.some(c => c.category === "gap")) items.push({ label: "Treatment Gaps", explanation: "Gaps in treatment timeline may undermine damages continuity argument." });
  if (s.upstream_concerns.some(c => c.category === "credibility")) items.push({ label: "Credibility Concerns", explanation: "Upstream analysis flagged potential credibility or inconsistency issues." });
  if (s.comparative_negligence.claimant_negligence_percentage.value !== null) items.push({ label: "Comparative Negligence", explanation: "Potential claimant contribution to loss may reduce recovery." });
  if (s.upstream_concerns.some(c => c.category === "documentation")) items.push({ label: "Documentation Gaps", explanation: "Missing or incomplete documentation weakens evidentiary support." });
  return items;
}

export default EvalOverviewTab;
