/**
 * EvaluateIQ — Left Panel
 * Case summary, package status, and claim profile summary.
 */

import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import { EvaluateModuleState, EVALUATE_STATE_LABEL, EVALUATE_STATE_BADGE_CLASS } from "@/types/evaluateiq";
import type { ClaimProfileResult } from "@/lib/claimProfileClassifier";
import { PROFILE_META } from "@/lib/claimProfileClassifier";
import {
  User,
  Calendar,
  MapPin,
  Shield,
  Package,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Bone,
  Activity,
  DollarSign,
  FileText,
  Stethoscope,
} from "lucide-react";

interface Props {
  snapshot: EvaluateIntakeSnapshot | null;
  moduleState: EvaluateModuleState;
  caseNumber: string;
  claimVsInsured: string;
  inputSource: string | null;
  sourceVersion: number | null;
  isStale: boolean;
}

const fmt = (n: number) => `$${n.toLocaleString()}`;

const EvalLeftPanel = ({
  snapshot,
  moduleState,
  caseNumber,
  claimVsInsured,
  inputSource,
  sourceVersion,
  isStale,
}: Props) => {
  return (
    <div className="w-[280px] shrink-0 border-r border-border bg-card overflow-y-auto h-full">
      <div className="p-4 space-y-4">
        {/* ── Case Identity ──────────────────────── */}
        <section>
          <p className="section-label text-muted-foreground mb-2">Case</p>
          <h2 className="text-[13px] font-semibold text-foreground leading-snug">{claimVsInsured}</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{caseNumber}</p>
        </section>

        {/* ── Module Status ──────────────────────── */}
        <section className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Package className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Module Status</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${EVALUATE_STATE_BADGE_CLASS[moduleState]}`}>
              {EVALUATE_STATE_LABEL[moduleState]}
            </span>
          </div>
          {inputSource && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Stethoscope className="h-3 w-3" />
              Source: {inputSource === "revieweriq" ? "ReviewerIQ" : "DemandIQ"} v{sourceVersion}
            </div>
          )}
          {isStale && (
            <div className="flex items-center gap-1.5 text-[10px] text-[hsl(var(--status-attention))]">
              <AlertTriangle className="h-3 w-3" />
              Upstream data has changed
            </div>
          )}
        </section>

        {/* ── Claimant Profile ───────────────────── */}
        {snapshot && (
          <section className="rounded-lg border border-border p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Claimant</span>
            </div>
            <ProfileRow icon={User} label="Name" value={snapshot.claimant.claimant_name.value || "—"} />
            <ProfileRow icon={Calendar} label="DOL" value={snapshot.accident.date_of_loss.value ? new Date(snapshot.accident.date_of_loss.value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"} />
            <ProfileRow icon={MapPin} label="Jurisdiction" value={snapshot.venue_jurisdiction.jurisdiction_state.value || "—"} />
          </section>
        )}

        {/* ── Quick Stats ────────────────────────── */}
        {snapshot && (
          <section className="rounded-lg border border-border p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Summary</span>
            </div>
            <StatRow icon={Bone} label="Injuries" value={String(snapshot.injuries.length)} />
            <StatRow icon={Activity} label="Treatments" value={String(snapshot.treatment_timeline.length)} />
            <StatRow icon={DollarSign} label="Total Billed" value={fmt(snapshot.medical_billing.reduce((s, b) => s + b.billed_amount, 0))} />
            <StatRow icon={Shield} label="Policy Limit" value={snapshot.policy_coverage.length > 0 ? fmt(snapshot.policy_coverage.reduce((max, p) => Math.max(max, p.coverage_limit ?? 0), 0)) : "—"} />
            <StatRow
              icon={CheckCircle2}
              label="Completeness"
              value={`${snapshot.overall_completeness_score}%`}
              accent={snapshot.overall_completeness_score >= 80}
            />
          </section>
        )}

        {/* ── Clinical Flags ─────────────────────── */}
        {snapshot && (
          <section className="rounded-lg border border-border p-3 space-y-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Clinical Indicators</span>
            <div className="flex flex-wrap gap-1.5">
              {snapshot.clinical_flags.has_surgery && <FlagPill label="Surgery" active />}
              {snapshot.clinical_flags.has_injections && <FlagPill label="Injections" active />}
              {snapshot.clinical_flags.has_advanced_imaging && <FlagPill label="Imaging" active />}
              {snapshot.clinical_flags.has_permanency_indicators && <FlagPill label="Permanency" active />}
              {snapshot.clinical_flags.has_impairment_rating && <FlagPill label="Impairment" active />}
              {snapshot.clinical_flags.has_scarring_disfigurement && <FlagPill label="Scarring" active />}
              {!snapshot.clinical_flags.has_surgery && !snapshot.clinical_flags.has_injections && !snapshot.clinical_flags.has_advanced_imaging && !snapshot.clinical_flags.has_permanency_indicators && (
                <span className="text-[10px] text-muted-foreground italic">No clinical indicators flagged</span>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

function ProfileRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="text-[10px] text-muted-foreground w-16 shrink-0">{label}</span>
      <span className="text-[11px] font-medium text-foreground truncate">{value}</span>
    </div>
  );
}

function StatRow({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <span className={`text-[11px] font-semibold ${accent ? "text-primary" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

function FlagPill({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full border ${
      active
        ? "bg-[hsl(var(--status-attention))]/10 border-[hsl(var(--status-attention))]/20 text-[hsl(var(--status-attention))]"
        : "bg-accent border-border text-muted-foreground"
    }`}>
      {label}
    </span>
  );
}

export default EvalLeftPanel;
