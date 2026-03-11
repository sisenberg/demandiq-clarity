import type { CaseRow } from "@/hooks/useCases";
import type { DocumentRow } from "@/hooks/useDocuments";
import { EvidenceStatement, type CitationSource } from "./EvidenceCitation";
import WorkspaceCard from "./WorkspaceCard";
import {
  Briefcase,
  AlertTriangle,
  Stethoscope,
  Scale,
  DollarSign,
  FileText,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";

// ─── Mock structured data ──────────────────────────────
const CASE_SUMMARY_CITATIONS: CitationSource[] = [
  { docName: "Police Report #PR-2024-8812", page: "pg. 3", relevance: "direct" },
  { docName: "ER Records — Mercy General", page: "pg. 1", relevance: "direct" },
];

const INJURY_SUMMARY = [
  {
    region: "Cervical Spine",
    diagnosis: "C5-C6 disc herniation with foraminal narrowing",
    icdCode: "M50.12",
    severity: "severe" as const,
    treating: "Dr. Sarah Chen (Ortho), Dr. Patel (Pain Mgmt)",
    citations: [
      { docName: "MRI Report — Regional Radiology", page: "pg. 7", relevance: "direct" as const },
    ],
  },
  {
    region: "Right Shoulder",
    diagnosis: "Rotator cuff strain with contusion",
    icdCode: "S46.011A",
    severity: "moderate" as const,
    treating: "Dr. Chen (Ortho)",
    citations: [
      { docName: "ER Records — Mercy General", page: "pg. 1", relevance: "direct" as const },
    ],
  },
  {
    region: "Lumbar Spine",
    diagnosis: "L4-L5 strain with possible pre-existing degenerative changes",
    icdCode: "M54.5",
    severity: "moderate" as const,
    treating: "Dr. Chen (Ortho)",
    citations: [
      { docName: "Dr. Chen Ortho Eval", page: "pg. 3", relevance: "direct" as const },
    ],
  },
  {
    region: "Right Knee",
    diagnosis: "Medial meniscus tear",
    icdCode: "S83.211A",
    severity: "moderate" as const,
    treating: "Dr. Chen (Ortho)",
    citations: [
      { docName: "MRI Report — Regional Radiology", page: "pg. 12", relevance: "direct" as const },
    ],
  },
];

const TREATMENT_SUMMARY = {
  totalVisits: 42,
  providers: 5,
  ptSessions: 24,
  injections: 2,
  totalBilled: 87450,
  totalPaid: 62200,
};

const FLAGS = [
  {
    type: "warning" as const,
    title: "Pre-existing Condition — Lumbar Region",
    description: "Dr. Chen notes 'possible pre-existing degenerative changes' at L4-L5. Defense may argue contribution.",
    citations: [{ docName: "Dr. Chen Ortho Eval", page: "pg. 3", relevance: "contradicting" as const }],
  },
  {
    type: "alert" as const,
    title: "3-Month Treatment Gap (Jan–Mar 2025)",
    description: "No treatment records between Jan 15 and Apr 2, 2025. May weaken ongoing injury argument.",
    citations: [],
  },
  {
    type: "warning" as const,
    title: "IME Disputes Surgical Necessity",
    description: "Defense IME by Dr. Roberts concludes herniation is related but surgery is premature.",
    citations: [{ docName: "IME Report — Dr. Roberts", page: "pg. 8", relevance: "contradicting" as const }],
  },
  {
    type: "info" as const,
    title: "Liability Favorable",
    description: "Police report confirms defendant ran red light. Dash cam footage request pending.",
    citations: [{ docName: "Police Report #PR-2024-8812", page: "pg. 3", relevance: "direct" as const }],
  },
];

const SEVERITY_BADGE: Record<string, string> = {
  minor: "status-badge-review",
  moderate: "status-badge-attention",
  severe: "status-badge-failed",
};

const FLAG_DOT: Record<string, string> = {
  alert: "bg-destructive",
  warning: "bg-[hsl(var(--status-review))]",
  info: "bg-primary",
};

interface OverviewCardsProps {
  caseData: CaseRow;
  documents: DocumentRow[];
}

const OverviewCards = ({ caseData, documents }: OverviewCardsProps) => {
  const completeDocs = documents.filter(
    (d) => d.document_status === "complete" || d.document_status === "extracted"
  ).length;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Case Summary ─────────────────────── */}
      <WorkspaceCard icon={Briefcase} title="Case Summary">
        <div className="px-5 py-4">
          <p className="text-sm text-foreground leading-relaxed">
            <EvidenceStatement
              text={`On ${caseData.date_of_loss || "date pending"}, ${caseData.claimant} was involved in a rear-end motor vehicle collision caused by ${caseData.insured} who failed to stop at a red traffic signal.`}
              citations={CASE_SUMMARY_CITATIONS}
            />
          </p>
          <p className="text-sm text-foreground leading-relaxed mt-2">
            <EvidenceStatement
              text="Claimant sustained multiple injuries including cervical disc herniation (C5-C6), right shoulder contusion, lumbar strain, and right knee meniscus tear. Emergency treatment was rendered at Mercy General Hospital on the date of loss."
              citations={[
                { docName: "ER Records — Mercy General", page: "pg. 1", relevance: "direct" },
              ]}
            />
          </p>

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border">
            <QuickStat label="Documents" value={`${documents.length}`} icon={FileText} />
            <QuickStat label="Processed" value={`${completeDocs}/${documents.length}`} icon={TrendingUp} />
            <QuickStat label="Total Billed" value={`$${(TREATMENT_SUMMARY.totalBilled).toLocaleString()}`} icon={DollarSign} />
            <QuickStat label="Providers" value={`${TREATMENT_SUMMARY.providers}`} icon={Stethoscope} />
          </div>
        </div>
      </WorkspaceCard>

      {/* ── Injury & Treatment Summary ────────── */}
      <WorkspaceCard
        icon={Stethoscope}
        title="Injury & Treatment Summary"
        count={INJURY_SUMMARY.length}
        tabs={[
          { key: "injuries", label: "Injuries" },
          { key: "treatment", label: "Treatment" },
        ]}
      >
        {(tab: string) =>
          tab === "injuries" ? (
            <div className="divide-y divide-border">
              {INJURY_SUMMARY.map((inj, idx) => (
                <div key={idx} className="px-5 py-3.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={SEVERITY_BADGE[inj.severity]}>{inj.severity}</span>
                    <span className="text-sm font-medium text-foreground">{inj.region}</span>
                    <code className="text-[10px] bg-accent px-1.5 py-0.5 rounded text-muted-foreground font-mono ml-auto">
                      {inj.icdCode}
                    </code>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">
                    <EvidenceStatement text={inj.diagnosis} citations={inj.citations} />
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Treating: {inj.treating}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <TreatmentStat label="Total Visits" value={TREATMENT_SUMMARY.totalVisits.toString()} />
                <TreatmentStat label="PT Sessions" value={TREATMENT_SUMMARY.ptSessions.toString()} />
                <TreatmentStat label="Injections" value={TREATMENT_SUMMARY.injections.toString()} />
                <TreatmentStat label="Providers" value={TREATMENT_SUMMARY.providers.toString()} />
                <TreatmentStat label="Total Billed" value={`$${TREATMENT_SUMMARY.totalBilled.toLocaleString()}`} />
                <TreatmentStat label="Total Paid" value={`$${TREATMENT_SUMMARY.totalPaid.toLocaleString()}`} />
              </div>
              <div className="mt-4 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Treatment included emergency care, orthopedic evaluation, cervical and knee MRIs, 24 physical therapy sessions, and 2 epidural steroid injections. Physical therapy was prescribed at 3x/week for 8 weeks with progressive functional restoration protocol.
                </p>
              </div>
            </div>
          )
        }
      </WorkspaceCard>

      {/* ── Issue Flags ──────────────────────── */}
      <WorkspaceCard icon={ShieldAlert} title="Issue Flags" count={FLAGS.length}>
        <div className="divide-y divide-border">
          {FLAGS.map((flag, idx) => (
            <div key={idx} className="px-5 py-3.5">
              <div className="flex items-start gap-2.5">
                <span className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${FLAG_DOT[flag.type]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{flag.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                    <EvidenceStatement text={flag.description} citations={flag.citations} />
                  </p>
                </div>
              </div>
            </div>
          ))}
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
