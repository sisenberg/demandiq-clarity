import { useCasePackage } from "@/hooks/useCasePackage";
import { isDocumentReady } from "@/lib/statuses";
import { EvidenceStatement, type CitationSource } from "./EvidenceCitation";
import WorkspaceCard from "./WorkspaceCard";
import {
  Briefcase,
  Stethoscope,
  DollarSign,
  FileText,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import type { CasePackage, EvidenceReference, Injury, IssueFlag } from "@/types";
import { getBillingSummary, getTreatmentStats } from "@/data/mock/casePackage";

// ─── Helpers ────────────────────────────────────────
function refsToCS(refs: EvidenceReference[]): CitationSource[] {
  return refs.map((r) => ({
    docName: r.doc_name,
    page: r.page_label,
    excerpt: r.quoted_text,
    relevance: r.relevance as any,
  }));
}

const SEVERITY_BADGE: Record<string, string> = {
  minor: "status-badge-review",
  moderate: "status-badge-attention",
  severe: "status-badge-failed",
  catastrophic: "status-badge-failed",
  fatal: "status-badge-failed",
};

const FLAG_DOT: Record<string, string> = {
  pre_existing_condition: "bg-[hsl(var(--status-review))]",
  treatment_gap: "bg-destructive",
  incomplete_compliance: "bg-[hsl(var(--status-review))]",
  documentation_missing: "bg-[hsl(var(--status-attention))]",
  causation_risk: "bg-destructive",
  inconsistency: "bg-[hsl(var(--status-attention))]",
};

interface OverviewCardsProps {
  caseData: { date_of_loss: string | null; claimant: string; insured: string };
  documents: { document_status: string }[];
}

const OverviewCards = ({ caseData, documents }: OverviewCardsProps) => {
  const { pkg } = useCasePackage();
  const billing = getBillingSummary(pkg);
  const stats = getTreatmentStats(pkg);

  const completeDocs = documents.filter(
    (d) => d.document_status === "complete" || d.document_status === "extracted"
  ).length;

  // Get first two evidence refs for the case summary
  const summaryRefs = pkg.evidence_refs.filter((r) => r.linked_entity_type === "timeline_event").slice(0, 2);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Case Summary ─────────────────────── */}
      <WorkspaceCard icon={Briefcase} title="Case Summary">
        <div className="px-5 py-4">
          <p className="text-sm text-foreground leading-relaxed">
            <EvidenceStatement
              text={`On ${caseData.date_of_loss || "date pending"}, ${caseData.claimant} was involved in a rear-end motor vehicle collision caused by ${caseData.insured} who failed to stop at a red traffic signal.`}
              citations={refsToCS(summaryRefs)}
            />
          </p>
          <p className="text-sm text-foreground leading-relaxed mt-2">
            <EvidenceStatement
              text={`Claimant sustained ${pkg.injuries.length} injuries including ${pkg.injuries.map((i) => `${i.body_part.toLowerCase()} (${i.diagnosis_code})`).join(", ")}. Emergency treatment was rendered at ${pkg.providers.find((p) => p.specialty === "Emergency Medicine")?.facility_name ?? "the hospital"} on the date of loss.`}
              citations={refsToCS(pkg.injuries[0]?.evidence_refs.slice(0, 1) ?? [])}
            />
          </p>

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border">
            <QuickStat label="Documents" value={`${documents.length}`} icon={FileText} />
            <QuickStat label="Processed" value={`${completeDocs}/${documents.length}`} icon={TrendingUp} />
            <QuickStat label="Total Billed" value={`$${billing.totalBilled.toLocaleString()}`} icon={DollarSign} />
            <QuickStat label="Providers" value={`${pkg.providers.length}`} icon={Stethoscope} />
          </div>
        </div>
      </WorkspaceCard>

      {/* ── Injury & Treatment Summary ────────── */}
      <WorkspaceCard
        icon={Stethoscope}
        title="Injury & Treatment Summary"
        count={pkg.injuries.length}
        tabs={[
          { key: "injuries", label: "Injuries" },
          { key: "treatment", label: "Treatment" },
        ]}
      >
        {(tab: string) =>
          tab === "injuries" ? (
            <div className="divide-y divide-border">
              {pkg.injuries.map((inj) => (
                <div key={inj.id} className="px-5 py-3.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={SEVERITY_BADGE[inj.severity]}>{inj.severity}</span>
                    <span className="text-sm font-medium text-foreground">{inj.body_part}</span>
                    <code className="text-[10px] bg-accent px-1.5 py-0.5 rounded text-muted-foreground font-mono ml-auto">
                      {inj.diagnosis_code}
                    </code>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">
                    <EvidenceStatement text={inj.diagnosis_description} citations={refsToCS(inj.evidence_refs)} />
                  </p>
                  {inj.is_pre_existing && (
                    <span className="text-[10px] font-medium text-[hsl(var(--status-attention-foreground))] bg-[hsl(var(--status-attention-bg))] px-1.5 py-0.5 rounded mt-1 inline-block">
                      Possible Pre-Existing
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <TreatmentStat label="Total Visits" value={stats.totalVisits.toString()} />
                <TreatmentStat label="PT Sessions" value={stats.ptSessions.toString()} />
                <TreatmentStat label="Injections" value={stats.injections.toString()} />
                <TreatmentStat label="Providers" value={stats.providers.toString()} />
                <TreatmentStat label="Total Billed" value={`$${billing.totalBilled.toLocaleString()}`} />
                <TreatmentStat label="Total Paid" value={`$${billing.totalPaid.toLocaleString()}`} />
              </div>
              <div className="mt-4 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Treatment included {pkg.treatments.map((t) => t.treatment_type.replace(/_/g, " ")).filter((v, i, a) => a.indexOf(v) === i).join(", ")}.
                  {pkg.demand_summary.medical_specials > 0 && ` Total medical specials: $${pkg.demand_summary.medical_specials.toLocaleString()}.`}
                </p>
              </div>
            </div>
          )
        }
      </WorkspaceCard>

      {/* ── Issue Flags ──────────────────────── */}
      <WorkspaceCard icon={ShieldAlert} title="Issue Flags" count={pkg.issue_flags.length}>
        <div className="divide-y divide-border">
          {pkg.issue_flags.map((flag) => {
            const flagRefs = pkg.evidence_refs.filter((r) => r.linked_entity_id === flag.id);
            return (
              <div key={flag.id} className="px-5 py-3.5">
                <div className="flex items-start gap-2.5">
                  <span className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${FLAG_DOT[flag.flag_type] ?? "bg-primary"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{flag.flag_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                      <EvidenceStatement text={flag.description} citations={refsToCS(flagRefs)} />
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </WorkspaceCard>
    </div>
  );
};

function QuickStat({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="rounded-lg bg-background border border-border px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function TreatmentStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background border border-border px-3 py-2.5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold text-foreground mt-0.5">{value}</p>
    </div>
  );
}

export default OverviewCards;
