import { useState } from "react";
import { useCasePackage } from "@/hooks/useCasePackage";
import { CitationBadge, type CitationSource } from "./EvidenceCitation";
import { getBillingSummary, getTreatmentStats } from "@/data/mock/casePackage";
import type { CaseRow } from "@/hooks/useCases";
import type { DocumentRow } from "@/hooks/useDocuments";
import type { EvidenceReference } from "@/types";
import { Pencil, Check, X } from "lucide-react";

function refsToCS(refs: EvidenceReference[]): CitationSource[] {
  return refs.map((r) => ({
    docName: r.doc_name, page: r.page_label, excerpt: r.quoted_text, relevance: r.relevance as any,
  }));
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// ─── Editable Field ──────────────────────────────────
function EditableField({ value, onChange, multiline, className = "" }: {
  value: string; onChange: (v: string) => void; multiline?: boolean; className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <div className="flex items-start gap-1">
        {multiline ? (
          <textarea
            className="flex-1 text-[12px] leading-relaxed text-foreground bg-accent/50 border border-primary/20 rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary/30 resize-none min-h-[60px]"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
        ) : (
          <input
            className="flex-1 text-[12px] text-foreground bg-accent/50 border border-primary/20 rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-primary/30"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
        )}
        <button onClick={() => { onChange(draft); setEditing(false); }} className="p-1 rounded text-primary hover:bg-primary/10 transition-colors">
          <Check className="h-3 w-3" />
        </button>
        <button onClick={() => { setDraft(value); setEditing(false); }} className="p-1 rounded text-muted-foreground hover:bg-accent transition-colors">
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <span className={`group relative ${className}`}>
      <span>{value}</span>
      <button
        onClick={() => setEditing(true)}
        className="inline-flex ml-1 p-0.5 rounded text-muted-foreground/0 group-hover:text-muted-foreground hover:bg-accent transition-all"
        title="Edit"
      >
        <Pencil className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

// ─── Main Component ──────────────────────────────────
interface CoverPageTabProps {
  caseData: CaseRow;
  documents: DocumentRow[];
}

const CoverPageTab = ({ caseData, documents }: CoverPageTabProps) => {
  const { pkg } = useCasePackage();
  const billing = getBillingSummary(pkg);
  const stats = getTreatmentStats(pkg);
  const claimant = pkg.parties.find((p) => p.party_role === "claimant");
  const defendant = pkg.parties.find((p) => p.party_role === "insured");
  const accidentRefs = pkg.evidence_refs.filter((r) => r.linked_entity_id === "te-001");

  // Editable state
  const [accidentDesc, setAccidentDesc] = useState(
    `On ${formatDate(caseData.date_of_loss)}, claimant Elena Martinez was traveling westbound on Interstate 95 near the Oak Street exit in Sacramento, California when the defendant's vehicle, a commercial freight truck operated by James Howell of Pacific Freight Lines, failed to stop at a red traffic signal and struck the claimant's vehicle from behind at approximately 35 miles per hour.`
  );
  const [functionalImpact, setFunctionalImpact] = useState(
    `Claimant reports significant limitations in daily activities including inability to perform job duties as a warehouse logistics coordinator (light duty only per Dr. Chen), difficulty with overhead reaching and prolonged sitting, disrupted sleep (waking 2-3x nightly due to cervical pain), and inability to participate in recreational activities.`
  );
  const [workImpact, setWorkImpact] = useState(
    `Claimant has been unable to return to full duty as a warehouse logistics coordinator. Currently on light duty restrictions per Dr. Chen. Lost wages from date of injury through return to light duty (approximately 6 weeks). Ongoing earning capacity impact due to inability to perform physical job requirements.`
  );
  const [currentStatus, setCurrentStatus] = useState(
    `Claimant continues treatment with Dr. Chen (orthopedics) and Dr. Patel (pain management). Physical therapy course completed (24 of 36 sessions). Second ESI performed 03/10/2025 with follow-up pending. Surgical consultation under consideration for C5-C6 disc herniation if conservative measures fail.`
  );

  return (
    <div className="max-w-3xl mx-auto">
      {/* Document header */}
      <div className="text-center mb-8 pb-6 border-b border-border">
        <p className="section-label mb-2">DemandIQ — Cover Page</p>
        <h1 className="text-lg font-bold text-foreground tracking-tight">
          {caseData.claimant} v. {caseData.defendant}
        </h1>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Claim #{caseData.claim_number} · {caseData.jurisdiction_state} · Prepared {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {/* ── Section: Claimant Demographics ── */}
      <CoverSection title="Claimant Demographics">
        <div className="grid grid-cols-2 gap-x-8 gap-y-2">
          <CoverField label="Full Name" value={claimant?.full_name ?? caseData.claimant} />
          <CoverField label="Date of Birth" value="June 22, 1990 (Age 34)" />
          <CoverField label="Address" value={claimant?.address ?? "—"} />
          <CoverField label="Phone" value={claimant?.contact_phone ?? "—"} />
          <CoverField label="Email" value={claimant?.contact_email ?? "—"} />
          <CoverField label="Occupation" value="Warehouse Logistics Coordinator" />
        </div>
      </CoverSection>

      {/* ── Section: Date & Mechanism of Loss ── */}
      <CoverSection title="Date & Mechanism of Loss" citations={refsToCS(accidentRefs).slice(0, 2)}>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-3">
          <CoverField label="Date of Loss" value={formatDate(caseData.date_of_loss)} />
          <CoverField label="Accident Type" value="Rear-End Motor Vehicle Collision" />
          <CoverField label="Location" value="I-95 at Oak Street Exit, Sacramento, CA" />
          <CoverField label="Claim Number" value={caseData.claim_number} mono />
        </div>
        <div className="mt-3">
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Accident Description</span>
          <div className="text-[12px] text-foreground leading-relaxed mt-1">
            <EditableField value={accidentDesc} onChange={setAccidentDesc} multiline />
          </div>
        </div>
      </CoverSection>

      {/* ── Section: Injury Summary ── */}
      <CoverSection title="Injury Summary">
        <div className="flex flex-col gap-2">
          {pkg.injuries.map((inj) => (
            <div key={inj.id} className="flex items-start gap-3 py-1.5">
              <SeverityDot severity={inj.severity} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-medium text-foreground">{inj.body_part}</span>
                  <code className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{inj.diagnosis_code}</code>
                  {inj.is_pre_existing && (
                    <span className="status-badge-attention text-[8px]">Pre-Existing</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{inj.diagnosis_description}</p>
              </div>
              {inj.evidence_refs.length > 0 && (
                <div className="shrink-0 flex gap-0.5">
                  {refsToCS(inj.evidence_refs).slice(0, 1).map((c, i) => (
                    <CitationBadge key={i} source={c} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CoverSection>

      {/* ── Section: Treatment Summary ── */}
      <CoverSection title="Treatment Summary">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <SummaryMetric label="Total Visits" value={stats.totalVisits.toString()} />
          <SummaryMetric label="PT Sessions" value={`${stats.ptSessions}/36`} warn={stats.ptSessions < 36} />
          <SummaryMetric label="Injections" value={stats.injections.toString()} />
          <SummaryMetric label="Providers" value={stats.providers.toString()} />
          <SummaryMetric label="Total Billed" value={`$${billing.totalBilled.toLocaleString()}`} />
          <SummaryMetric label="Adjusted" value={`$${billing.totalAdjusted.toLocaleString()}`} />
        </div>

        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Major Procedures</span>
        <div className="flex flex-col gap-1.5 mt-2">
          {pkg.treatments.filter(t => t.treatment_type !== "physical_therapy" || t.id === "tx-005").slice(0, 6).map((tx) => (
            <div key={tx.id} className="flex items-center gap-2 text-[11px]">
              <span className="h-1 w-1 rounded-full bg-primary shrink-0" />
              <span className="text-foreground font-medium">{tx.description.split(".")[0]}</span>
              <span className="text-muted-foreground ml-auto tabular-nums">{tx.treatment_date}</span>
              {tx.evidence_refs.length > 0 && (
                <CitationBadge source={refsToCS(tx.evidence_refs)[0]} />
              )}
            </div>
          ))}
        </div>
      </CoverSection>

      {/* ── Section: Functional Impact ── */}
      <CoverSection title="Functional Impact">
        <div className="text-[12px] text-foreground leading-relaxed">
          <EditableField value={functionalImpact} onChange={setFunctionalImpact} multiline />
        </div>
      </CoverSection>

      {/* ── Section: Work Impact ── */}
      <CoverSection title="Work Impact">
        <div className="text-[12px] text-foreground leading-relaxed">
          <EditableField value={workImpact} onChange={setWorkImpact} multiline />
        </div>
      </CoverSection>

      {/* ── Section: Current Status ── */}
      <CoverSection title="Current Status">
        <div className="text-[12px] text-foreground leading-relaxed">
          <EditableField value={currentStatus} onChange={setCurrentStatus} multiline />
        </div>
      </CoverSection>

      {/* ── Section: Demand Summary ── */}
      <CoverSection title="Demand Summary">
        <div className="grid grid-cols-2 gap-x-8 gap-y-2">
          <CoverField label="Demand Amount" value={`$${pkg.demand_summary.demand_amount.toLocaleString()}`} />
          <CoverField label="Date Transmitted" value={pkg.demand_summary.demand_date} />
          <CoverField label="Medical Specials (Billed)" value={`$${billing.totalBilled.toLocaleString()}`} />
          <CoverField label="Medical Specials (Adjusted)" value={`$${billing.totalAdjusted.toLocaleString()}`} />
          <CoverField label="General Damages" value={`$${pkg.demand_summary.general_damages.toLocaleString()}`} />
          <CoverField label="Response Deadline" value={pkg.demand_summary.response_deadline} />
        </div>
      </CoverSection>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-border text-center">
        <p className="text-[10px] text-muted-foreground">
          Prepared by CasualtyIQ · DemandIQ Module · Confidential Work Product
        </p>
      </div>
    </div>
  );
};

// ─── Sub-components ──────────────────────────────────

function CoverSection({ title, children, citations }: {
  title: string; children: React.ReactNode; citations?: CitationSource[];
}) {
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3 pb-1.5 border-b border-border/60">
        <h2 className="text-[13px] font-semibold text-foreground tracking-tight">{title}</h2>
        {citations && citations.length > 0 && (
          <div className="flex gap-0.5 ml-auto">
            {citations.map((c, i) => <CitationBadge key={i} source={c} />)}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

function CoverField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="py-0.5">
      <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
      <p className={`text-[12px] text-foreground mt-0.5 ${mono ? "font-mono text-[11px]" : ""}`}>{value}</p>
    </div>
  );
}

function SummaryMetric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-accent/40 border border-border px-3 py-2">
      <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
      <p className={`text-[13px] font-semibold mt-0.5 ${warn ? "text-[hsl(var(--status-attention-foreground))]" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const color = severity === "severe" || severity === "catastrophic" || severity === "fatal"
    ? "bg-destructive"
    : severity === "moderate"
    ? "bg-[hsl(var(--status-attention))]"
    : "bg-[hsl(var(--status-review))]";
  return <span className={`h-2 w-2 rounded-full mt-1 shrink-0 ${color}`} />;
}

export default CoverPageTab;
