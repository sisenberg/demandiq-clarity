import { useState } from "react";
import { useCasePackage } from "@/hooks/useCasePackage";
import { useIntakeEvaluationPackage } from "@/hooks/useIntakeEvaluationPackage";
import { useIntakeValidation } from "@/hooks/useIntakeValidation";
import { useIntakeWorkflow } from "@/hooks/useIntakeWorkflow";
import { useSourceDrawer } from "./SourceDrawer";
import { CitationBadge, EvidenceStatement, type CitationSource } from "./EvidenceCitation";
import { getBillingSummary, getTreatmentStats } from "@/data/mock/casePackage";
import CaseEmptyUploadCTA from "./CaseEmptyUploadCTA";
import type { CaseRow } from "@/hooks/useCases";
import type { DocumentRow } from "@/hooks/useDocuments";
import { isDocumentReady } from "@/lib/statuses";
import type { EvidenceReference, TimelineEvent } from "@/types";
import { maskClaimNumber } from "@/lib/phi-utils";
import {
  User,
  FileText,
  DollarSign,
  Clock,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Shield,
  Stethoscope,
  AlertTriangle,
  Activity,
  Search,
  Download,
  ClipboardCheck,
  ArrowRight,
  Heart,
  Brain,
  Bone,
  Eye,
  Zap,
  Scale,
  CircleDot,
  CheckCircle2,
  XCircle,
  Info,
  Settings,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────
function refsToCS(refs: EvidenceReference[]): CitationSource[] {
  return refs.map((r) => ({
    docName: r.doc_name,
    page: r.page_label,
    excerpt: r.quoted_text,
    relevance: r.relevance as any,
  }));
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const CATEGORY_ICON: Record<string, React.ElementType> = {
  Accident: Zap,
  "First Treatment": Stethoscope,
  Treatment: Stethoscope,
  Imaging: Eye,
  Injection: CircleDot,
  IME: ClipboardCheck,
  Demand: FileText,
  Surgery: Activity,
  Legal: Scale,
  Administrative: Settings,
};

const CATEGORY_DOT: Record<string, string> = {
  Accident: "bg-destructive",
  "First Treatment": "bg-[hsl(var(--status-attention))]",
  Treatment: "bg-primary",
  Imaging: "bg-[hsl(var(--status-review))]",
  Injection: "bg-[hsl(var(--status-approved))]",
  IME: "bg-muted-foreground",
  Demand: "bg-primary",
  Surgery: "bg-destructive",
  Legal: "bg-primary",
  Administrative: "bg-muted-foreground",
};

// ─── Body region mapping ─────────────────────────────
function mapInjuryToBodySystem(bodyPart: string, bodyRegion?: string): string {
  const bp = ((bodyPart || "") + " " + (bodyRegion || "")).toLowerCase();
  if (bp.includes("cervic") || bp.includes("neck")) return "Cervical";
  if (bp.includes("thorac") || bp.includes("upper back") || bp.includes("mid back")) return "Thoracic";
  if (bp.includes("lumbar") || bp.includes("lower back") || bp.includes("sacr")) return "Lumbar";
  if (bp.includes("shoulder") || bp.includes("elbow") || bp.includes("wrist") || bp.includes("hand") || bp.includes("arm")) return "Upper Extremity";
  if (bp.includes("hip") || bp.includes("knee") || bp.includes("ankle") || bp.includes("foot") || bp.includes("leg")) return "Lower Extremity";
  if (bp.includes("neuro") || bp.includes("brain") || bp.includes("head") || bp.includes("concuss") || bp.includes("radiculop")) return "Neurologic";
  if (bp.includes("function") || bp.includes("sleep") || bp.includes("mood") || bp.includes("anxiety") || bp.includes("ptsd")) return "Functional / Psychological";
  return "Other";
}

const BODY_SYSTEM_ICON: Record<string, React.ElementType> = {
  Cervical: Bone,
  Thoracic: Bone,
  Lumbar: Bone,
  "Upper Extremity": Activity,
  "Lower Extremity": Activity,
  Neurologic: Brain,
  "Functional / Psychological": Heart,
  Other: CircleDot,
};

const SEVERITY_BADGE: Record<string, string> = {
  minor: "status-badge-review",
  moderate: "status-badge-attention",
  severe: "status-badge-failed",
  catastrophic: "status-badge-failed",
  fatal: "status-badge-failed",
};

// ─── Main Component ──────────────────────────────────
interface CaseOverviewProps {
  caseData: CaseRow;
  documents: DocumentRow[];
  onNavigate?: (section: string) => void;
}

const CaseOverview = ({ caseData, documents, onNavigate }: CaseOverviewProps) => {
  const { pkg, hasData } = useCasePackage();
  const { data: intakePkg } = useIntakeEvaluationPackage(caseData.id);
  const { validation } = useIntakeValidation(caseData.id);
  const workflow = useIntakeWorkflow(caseData.id, documents);
  const [pipelineOpen, setPipelineOpen] = useState(false);

  const billing = hasData ? getBillingSummary(pkg) : { totalBilled: 0, totalAdjusted: 0, totalPaid: 0 };
  const stats = hasData ? getTreatmentStats(pkg) : { providers: 0, totalVisits: 0, ptSessions: 0, injections: 0 };

  const completeDocs = documents.filter((d) => isDocumentReady(d.document_status)).length;

  // Resolve data from either mock pkg or real intakePkg
  const specials = intakePkg?.specials_summary as any;
  const totalBilled = hasData ? billing.totalBilled : (specials?.total_billed ?? 0);
  const billCount = specials?.bill_count ?? 0;
  const providerCount = hasData ? stats.providers : (specials?.provider_count ?? intakePkg?.provider_list?.length ?? 0);
  const injuryCount = hasData ? pkg.injuries.length : (intakePkg?.injury_summary?.length ?? 0);
  const treatmentSummary = intakePkg?.treatment_summary as any;
  const treatmentCount = hasData ? stats.totalVisits : (treatmentSummary?.treatment_count ?? 0);
  const representedStatus = intakePkg?.represented_status ?? "";
  const attorneyName = intakePkg?.attorney_name ?? "";
  const lawFirm = intakePkg?.law_firm ?? "";
  const demandAmount = hasData ? pkg.demand_summary?.demand_amount : intakePkg?.demand_amount;
  const claimantName = intakePkg?.claimant_name ?? caseData.claimant;

  // Determine primary status
  const primaryStatus = determinePrimaryStatus(workflow.state, validation, intakePkg?.package_status);

  // Compute next action
  const nextAction = computeNextAction(workflow.state, validation, documents, completeDocs, intakePkg?.package_status);

  // Injury data: use mock or real
  const injuries: any[] = hasData
    ? pkg.injuries
    : (intakePkg?.injury_summary ?? []).map((inj: any, i: number) => ({
        id: inj.id ?? `inj-${i}`,
        body_part: inj.body_part ?? inj.label ?? "Unknown",
        body_region: inj.body_region ?? "",
        diagnosis_code: inj.diagnosis_code ?? inj.icd10 ?? "",
        diagnosis_description: inj.diagnosis_description ?? inj.description ?? "",
        severity: inj.severity ?? "moderate",
        is_pre_existing: inj.is_pre_existing ?? false,
        evidence_refs: inj.evidence_refs ?? [],
        first_date: inj.first_date ?? null,
        last_date: inj.last_date ?? null,
        provider: inj.provider ?? null,
      }));

  // Timeline events
  const timelineEvents: TimelineEvent[] = hasData ? pkg.timeline_events : [];

  // Issue flags
  const issueFlags = hasData ? pkg.issue_flags : [];

  // Group injuries by body system
  const findingsBySystem = groupFindingsBySystem(injuries);

  // No documents → empty state
  if (documents.length === 0) {
    return <CaseEmptyUploadCTA caseId={caseData.id} />;
  }

  return (
    <div className="flex gap-5">
      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">

        {/* ═══ 1. CLAIM HEADER ═══ */}
        <ClaimHeader
          claimantName={claimantName}
          claimNumber={caseData.claim_number}
          doi={caseData.date_of_loss}
          jurisdiction={caseData.jurisdiction_state}
          attorneyName={attorneyName}
          lawFirm={lawFirm}
          primaryStatus={primaryStatus}
          onNavigate={onNavigate}
        />

        {/* ═══ 2. TOP ROW — 3 Cards ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* A. Claim Summary */}
          <ClaimSummaryCard
            caseData={caseData}
            claimantName={claimantName}
            injuries={injuries}
            totalBilled={totalBilled}
            providerCount={providerCount}
            treatmentCount={treatmentCount}
            representedStatus={representedStatus}
            hasData={hasData}
            pkg={pkg}
          />

          {/* B. Case Snapshot */}
          <CaseSnapshotCard
            demandAmount={demandAmount}
            totalBilled={totalBilled}
            providerCount={providerCount}
            documentCount={documents.length}
            injuryCount={injuryCount}
            treatmentCount={treatmentCount}
            representedStatus={representedStatus}
            attorneyName={attorneyName}
            completeDocs={completeDocs}
          />

          {/* C. Next Required Action */}
          <NextActionCard action={nextAction} onNavigate={onNavigate} />
        </div>

        {/* ═══ 3. FINDINGS BY BODY SYSTEM ═══ */}
        <FindingsByBodySystem findings={findingsBySystem} hasData={hasData} />

        {/* ═══ 4. LOWER ROW ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Billing Summary */}
          <BillingSummaryCard
            totalBilled={totalBilled}
            totalAdjusted={hasData ? billing.totalAdjusted : 0}
            totalPaid={hasData ? billing.totalPaid : 0}
            billCount={billCount}
            providerCount={providerCount}
          />

          {/* Documents */}
          <DocumentsCard documents={documents} completeDocs={completeDocs} />

          {/* Review Flags */}
          <ReviewFlagsCard
            validation={validation}
            issueFlags={issueFlags}
            hasData={hasData}
            pkg={hasData ? pkg : null}
          />
        </div>

        {/* ═══ 5. PROCESSING DETAILS (collapsed) ═══ */}
        <div className="card-elevated overflow-hidden">
          <button
            onClick={() => setPipelineOpen(!pipelineOpen)}
            className="w-full px-4 py-3 flex items-center gap-2 hover:bg-accent/30 transition-colors"
          >
            <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Processing Details</span>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {pipelineOpen ? "Hide" : "Show"} pipeline status
            </span>
            {pipelineOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
          {pipelineOpen && (
            <div className="border-t border-border p-4">
              <PipelineDetails
                workflow={workflow}
                documents={documents}
                completeDocs={completeDocs}
                intakePkg={intakePkg}
              />
            </div>
          )}
        </div>
      </div>

      {/* ═══ RIGHT STICKY CHRONOLOGY RAIL ═══ */}
      <div className="hidden xl:flex w-72 shrink-0">
        <ChronologyRail
          events={timelineEvents}
          hasData={hasData}
          caseData={caseData}
          intakePkg={intakePkg}
        />
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════
// 1. CLAIM HEADER
// ═════════════════════════════════════════════════════
function ClaimHeader({
  claimantName,
  claimNumber,
  doi,
  jurisdiction,
  attorneyName,
  lawFirm,
  primaryStatus,
  onNavigate,
}: {
  claimantName: string;
  claimNumber: string;
  doi: string | null;
  jurisdiction: string;
  attorneyName: string;
  lawFirm: string;
  primaryStatus: { label: string; className: string };
  onNavigate?: (section: string) => void;
}) {
  return (
    <div className="card-elevated px-5 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h2 className="text-[15px] font-semibold text-foreground truncate">{claimantName || "Claimant"}</h2>
              <span className={primaryStatus.className}>{primaryStatus.label}</span>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {claimNumber && <MetaChip label={`Claim: ${maskClaimNumber(claimNumber)}`} />}
              {doi && <MetaChip label={`DOI: ${formatDate(doi)}`} />}
              {jurisdiction && <MetaChip label={jurisdiction} />}
              {attorneyName && <MetaChip label={`Atty: ${attorneyName}${lawFirm ? ` · ${lawFirm}` : ""}`} />}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <HeaderButton icon={Search} label="Find Evidence" onClick={() => onNavigate?.("documents")} />
          <HeaderButton icon={Download} label="Export" onClick={() => {}} />
          <HeaderButton icon={ClipboardCheck} label="Intake Review" primary onClick={() => onNavigate?.("intake-review")} />
        </div>
      </div>
    </div>
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
  );
}

function HeaderButton({ icon: Icon, label, primary, onClick }: { icon: React.ElementType; label: string; primary?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
        primary
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "bg-accent text-foreground hover:bg-accent/80"
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

// ═════════════════════════════════════════════════════
// 2A. CLAIM SUMMARY
// ═════════════════════════════════════════════════════
function ClaimSummaryCard({
  caseData,
  claimantName,
  injuries,
  totalBilled,
  providerCount,
  treatmentCount,
  representedStatus,
  hasData,
  pkg,
}: {
  caseData: CaseRow;
  claimantName: string;
  injuries: any[];
  totalBilled: number;
  providerCount: number;
  treatmentCount: number;
  representedStatus: string;
  hasData: boolean;
  pkg: any;
}) {
  const bullets = generateClaimBullets(caseData, claimantName, injuries, totalBilled, providerCount, treatmentCount, representedStatus);
  const summaryRefs = hasData ? pkg.evidence_refs?.filter((r: EvidenceReference) => r.linked_entity_type === "timeline_event").slice(0, 2) : [];

  return (
    <div className="card-elevated overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <BookOpen className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold text-foreground">Claim Summary</h3>
      </div>
      <div className="px-4 py-3 flex-1">
        <ul className="space-y-1.5">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <span className="text-[11px] text-foreground leading-relaxed">
                {hasData && summaryRefs.length > 0 && i === 0 ? (
                  <EvidenceStatement text={b} citations={refsToCS(summaryRefs)} />
                ) : (
                  b
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function generateClaimBullets(
  caseData: CaseRow,
  claimantName: string,
  injuries: any[],
  totalBilled: number,
  providerCount: number,
  treatmentCount: number,
  representedStatus: string,
): string[] {
  const bullets: string[] = [];

  // Mechanism
  bullets.push(
    `${claimantName} involved in motor vehicle collision on ${formatDate(caseData.date_of_loss)}.`
  );

  // Key injuries
  if (injuries.length > 0) {
    const topInjuries = injuries.slice(0, 3).map((i) => i.body_part?.toLowerCase()).filter(Boolean);
    bullets.push(
      `${injuries.length} documented injuries including ${topInjuries.join(", ") || "multiple regions"}.`
    );
  }

  // Treatment pattern
  if (treatmentCount > 0) {
    bullets.push(
      `${treatmentCount} treatment events across ${providerCount} provider${providerCount !== 1 ? "s" : ""}.`
    );
  }

  // Diagnostics
  const diagCodes = injuries.filter((i) => i.diagnosis_code).slice(0, 3).map((i) => i.diagnosis_code);
  if (diagCodes.length > 0) {
    bullets.push(`Key diagnoses: ${diagCodes.join(", ")}.`);
  }

  // Financials
  if (totalBilled > 0) {
    bullets.push(`Total medical specials: $${totalBilled.toLocaleString()}.`);
  }

  // Representation
  if (representedStatus) {
    bullets.push(
      representedStatus === "represented"
        ? "Claimant is represented by counsel."
        : `Claimant status: ${representedStatus}.`
    );
  }

  // Complications
  const preExisting = injuries.filter((i) => i.is_pre_existing);
  if (preExisting.length > 0) {
    bullets.push(`${preExisting.length} possible pre-existing condition${preExisting.length > 1 ? "s" : ""} flagged.`);
  }

  return bullets.slice(0, 8);
}

// ═════════════════════════════════════════════════════
// 2B. CASE SNAPSHOT
// ═════════════════════════════════════════════════════
function CaseSnapshotCard({
  demandAmount,
  totalBilled,
  providerCount,
  documentCount,
  injuryCount,
  treatmentCount,
  representedStatus,
  attorneyName,
  completeDocs,
}: {
  demandAmount: number | null | undefined;
  totalBilled: number;
  providerCount: number;
  documentCount: number;
  injuryCount: number;
  treatmentCount: number;
  representedStatus: string;
  attorneyName: string;
  completeDocs: number;
}) {
  const rows = [
    { label: "Demand Amount", value: demandAmount ? `$${demandAmount.toLocaleString()}` : "Policy Limits" },
    { label: "Total Billed", value: totalBilled > 0 ? `$${totalBilled.toLocaleString()}` : "—" },
    { label: "Providers", value: `${providerCount}` },
    { label: "Documents", value: `${completeDocs} / ${documentCount} processed` },
    { label: "Injury Regions", value: `${injuryCount}` },
    { label: "Treatment Events", value: `${treatmentCount}` },
    { label: "Representation", value: representedStatus === "represented" ? `Represented${attorneyName ? ` (${attorneyName})` : ""}` : representedStatus || "Unknown" },
  ];

  return (
    <div className="card-elevated overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Shield className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold text-foreground">Case Snapshot</h3>
      </div>
      <div className="px-4 py-3 flex-1">
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{r.label}</span>
              <span className="text-[12px] font-semibold text-foreground text-right">{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════
// 2C. NEXT REQUIRED ACTION
// ═════════════════════════════════════════════════════
interface NextActionInfo {
  state: string;
  description: string;
  blockers: string[];
  ctaLabel: string;
  ctaTarget: string;
  severity: "info" | "warning" | "success" | "error";
}

function computeNextAction(
  workflowState: string,
  validation: any,
  documents: DocumentRow[],
  completeDocs: number,
  packageStatus?: string | null,
): NextActionInfo {
  const processing = documents.filter((d) => d.document_status === "queued" || d.document_status === "ocr_in_progress");
  const failed = documents.filter((d) => d.document_status === "failed");

  if (processing.length > 0) {
    return {
      state: "Processing Documents",
      description: `${processing.length} document${processing.length > 1 ? "s" : ""} still being processed. Results will appear automatically.`,
      blockers: [],
      ctaLabel: "View Documents",
      ctaTarget: "documents",
      severity: "info",
    };
  }

  if (failed.length > 0) {
    return {
      state: "Resolve Failed Documents",
      description: `${failed.length} document${failed.length > 1 ? "s" : ""} failed processing and may be missing from the record.`,
      blockers: failed.slice(0, 3).map((d) => d.file_name),
      ctaLabel: "View Documents",
      ctaTarget: "documents",
      severity: "error",
    };
  }

  if (validation.blockers.length > 0) {
    return {
      state: "Needs Intake Review",
      description: "Required fields are missing or unverified. Complete intake review to proceed.",
      blockers: validation.blockers.slice(0, 3).map((b: any) => b.message ?? b),
      ctaLabel: "Open Intake Review",
      ctaTarget: "intake-review",
      severity: "warning",
    };
  }

  if (packageStatus === "ready_for_review") {
    return {
      state: "Finalize Intake Review",
      description: "Extracted data is assembled and ready for human verification.",
      blockers: validation.warnings.slice(0, 3).map((w: any) => w.message ?? w),
      ctaLabel: "Open Intake Review",
      ctaTarget: "intake-review",
      severity: "warning",
    };
  }

  if (packageStatus === "published_to_evaluateiq") {
    return {
      state: "Ready for EvaluateIQ",
      description: "Intake package published. Claim is ready for valuation.",
      blockers: [],
      ctaLabel: "Open EvaluateIQ",
      ctaTarget: "evaluate",
      severity: "success",
    };
  }

  return {
    state: "Review Pending",
    description: "Upload documents and complete intake to proceed.",
    blockers: [],
    ctaLabel: "Upload Documents",
    ctaTarget: "documents",
    severity: "info",
  };
}

function NextActionCard({ action, onNavigate }: { action: NextActionInfo; onNavigate?: (section: string) => void }) {
  const severityStyles: Record<string, { bg: string; border: string; icon: React.ElementType; iconColor: string }> = {
    info: { bg: "bg-primary/5", border: "border-primary/20", icon: Info, iconColor: "text-primary" },
    warning: { bg: "bg-[hsl(var(--status-attention))]/5", border: "border-[hsl(var(--status-attention))]/20", icon: AlertTriangle, iconColor: "text-[hsl(var(--status-attention))]" },
    success: { bg: "bg-[hsl(var(--status-approved))]/5", border: "border-[hsl(var(--status-approved))]/20", icon: CheckCircle2, iconColor: "text-[hsl(var(--status-approved))]" },
    error: { bg: "bg-destructive/5", border: "border-destructive/20", icon: XCircle, iconColor: "text-destructive" },
  };
  const s = severityStyles[action.severity];
  const IconComp = s.icon;

  return (
    <div className={`card-elevated overflow-hidden flex flex-col border ${s.border}`}>
      <div className={`px-4 py-3 border-b ${s.border} flex items-center gap-2 ${s.bg}`}>
        <IconComp className={`h-3.5 w-3.5 ${s.iconColor}`} />
        <h3 className="text-xs font-semibold text-foreground">Next Action</h3>
      </div>
      <div className="px-4 py-3 flex flex-col flex-1 justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{action.state}</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">{action.description}</p>

          {action.blockers.length > 0 && (
            <div className="mt-2.5 flex flex-col gap-1">
              {action.blockers.map((b, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <XCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                  <span className="text-[10px] text-foreground">{b}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => onNavigate?.(action.ctaTarget)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/90 transition-colors"
        >
          {action.ctaLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════
// 3A. FINDINGS BY BODY SYSTEM
// ═════════════════════════════════════════════════════
interface BodySystemGroup {
  system: string;
  findings: any[];
}

function groupFindingsBySystem(injuries: any[]): BodySystemGroup[] {
  const groups: Record<string, any[]> = {};
  injuries.forEach((inj) => {
    const system = mapInjuryToBodySystem(inj.body_part, inj.body_region);
    if (!groups[system]) groups[system] = [];
    groups[system].push(inj);
  });

  const order = ["Cervical", "Thoracic", "Lumbar", "Upper Extremity", "Lower Extremity", "Neurologic", "Functional / Psychological", "Other"];
  return order
    .filter((s) => groups[s])
    .map((s) => ({ system: s, findings: groups[s] }));
}

function FindingsByBodySystem({ findings, hasData }: { findings: BodySystemGroup[]; hasData: boolean }) {
  const { openSource } = useSourceDrawer();
  const [expandedSystem, setExpandedSystem] = useState<string | null>(findings[0]?.system ?? null);

  if (findings.length === 0) {
    return (
      <div className="card-elevated px-4 py-8 text-center">
        <Activity className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">No injury findings extracted yet.</p>
      </div>
    );
  }

  return (
    <div className="card-elevated overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Activity className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold text-foreground">Findings by Body System</h3>
        <span className="text-[10px] font-medium bg-accent text-muted-foreground px-2 py-0.5 rounded-full ml-auto">
          {findings.reduce((n, g) => n + g.findings.length, 0)} total
        </span>
      </div>

      <div className="divide-y divide-border">
        {findings.map((group) => {
          const isExpanded = expandedSystem === group.system;
          const SystemIcon = BODY_SYSTEM_ICON[group.system] ?? CircleDot;
          return (
            <div key={group.system}>
              <button
                onClick={() => setExpandedSystem(isExpanded ? null : group.system)}
                className="w-full px-4 py-2.5 flex items-center gap-2.5 hover:bg-accent/30 transition-colors"
              >
                <SystemIcon className="h-3.5 w-3.5 text-primary" />
                <span className="text-[12px] font-semibold text-foreground flex-1 text-left">{group.system}</span>
                <span className="text-[10px] font-medium text-muted-foreground bg-accent px-1.5 py-0.5 rounded-full">{group.findings.length}</span>
                {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              </button>

              {isExpanded && (
                <div className="border-t border-border/50">
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_100px_80px_80px_70px_60px_40px] gap-2 px-4 py-1.5 bg-accent/30 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <span>Finding</span>
                    <span>Diagnosis</span>
                    <span>First Date</span>
                    <span>Last Date</span>
                    <span>Severity</span>
                    <span>Evidence</span>
                    <span></span>
                  </div>
                  {group.findings.map((f: any) => (
                    <div
                      key={f.id}
                      className="grid grid-cols-[1fr_100px_80px_80px_70px_60px_40px] gap-2 px-4 py-2 hover:bg-accent/20 transition-colors items-center cursor-pointer"
                      onClick={() => {
                        if (f.evidence_refs?.length > 0) {
                          const ref = f.evidence_refs[0];
                          openSource({ docName: ref.doc_name, page: ref.page_label, excerpt: ref.quoted_text, relevance: ref.relevance });
                        }
                      }}
                    >
                      <span className="text-[11px] font-medium text-foreground truncate">{f.body_part}</span>
                      <code className="text-[10px] font-mono text-muted-foreground">{f.diagnosis_code || "—"}</code>
                      <span className="text-[10px] text-muted-foreground">{f.first_date ? formatShortDate(f.first_date) : "—"}</span>
                      <span className="text-[10px] text-muted-foreground">{f.last_date ? formatShortDate(f.last_date) : "—"}</span>
                      <span className={`${SEVERITY_BADGE[f.severity] ?? "status-badge-review"} text-[9px]`}>{f.severity}</span>
                      <span className="text-[10px] text-muted-foreground">{f.evidence_refs?.length ?? 0}</span>
                      <div>
                        {f.is_pre_existing && (
                          <AlertTriangle className="h-3 w-3 text-[hsl(var(--status-attention))]" title="Possible pre-existing" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════
// 3B. CHRONOLOGY RAIL (Right sticky)
// ═════════════════════════════════════════════════════
function ChronologyRail({
  events,
  hasData,
  caseData,
  intakePkg,
}: {
  events: TimelineEvent[];
  hasData: boolean;
  caseData: CaseRow;
  intakePkg: any;
}) {
  const { openSource } = useSourceDrawer();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // If no timeline events, show a placeholder
  if (!hasData || events.length === 0) {
    return (
      <div className="card-elevated flex flex-col sticky top-5 max-h-[calc(100vh-140px)] w-full">
        <div className="px-3.5 py-3 border-b border-border flex items-center gap-2 shrink-0">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold text-foreground">Chronology</h3>
        </div>
        <div className="flex-1 p-4 flex flex-col items-center justify-center text-center">
          <Clock className="h-6 w-6 text-muted-foreground mb-2" />
          <p className="text-[11px] text-muted-foreground">Chronology events will appear here once documents are fully processed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-elevated flex flex-col h-fit sticky top-5 max-h-[calc(100vh-140px)] w-full">
      <div className="px-3.5 py-3 border-b border-border flex items-center gap-2 shrink-0">
        <Clock className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold text-foreground">Chronology</h3>
        <span className="text-[10px] font-medium bg-accent text-muted-foreground px-2 py-0.5 rounded-full ml-auto">
          {events.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="relative">
          <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />
          {events.map((evt) => {
            const isExpanded = expandedIds.has(evt.id);
            const dot = CATEGORY_DOT[evt.category] ?? "bg-muted-foreground";
            const EvtIcon = CATEGORY_ICON[evt.category] ?? CircleDot;

            return (
              <div key={evt.id} className="relative pl-5 pb-3">
                <div className={`absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-card ${dot} transition-all`} />

                <button
                  onClick={() => toggleExpand(evt.id)}
                  className="w-full text-left rounded-md px-2 py-1.5 transition-all hover:bg-accent/50"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-foreground tabular-nums">{formatShortDate(evt.event_date)}</span>
                    <EvtIcon className="h-2.5 w-2.5 text-muted-foreground" />
                    {isExpanded ? <ChevronDown className="h-2.5 w-2.5 text-muted-foreground ml-auto" /> : <ChevronRight className="h-2.5 w-2.5 text-muted-foreground ml-auto" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium mt-0.5 truncate">{evt.label}</p>
                </button>

                {isExpanded && (
                  <div className="px-2 pt-1.5 pb-1">
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{evt.description}</p>
                    {evt.evidence_refs.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {evt.evidence_refs.map((r: EvidenceReference, i: number) => (
                          <button
                            key={i}
                            onClick={(e) => {
                              e.stopPropagation();
                              openSource({ docName: r.doc_name, page: r.page_label, excerpt: r.quoted_text, relevance: r.relevance as any });
                            }}
                            className="text-[9px] font-medium text-primary bg-primary/5 hover:bg-primary/10 px-1.5 py-0.5 rounded transition-colors"
                          >
                            {r.page_label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════
// 4A. BILLING SUMMARY
// ═════════════════════════════════════════════════════
function BillingSummaryCard({
  totalBilled,
  totalAdjusted,
  totalPaid,
  billCount,
  providerCount,
}: {
  totalBilled: number;
  totalAdjusted: number;
  totalPaid: number;
  billCount: number;
  providerCount: number;
}) {
  return (
    <div className="card-elevated overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <DollarSign className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold text-foreground">Billing Summary</h3>
      </div>
      <div className="p-4">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total Billed</span>
            <span className="text-sm font-bold text-foreground">{totalBilled > 0 ? `$${totalBilled.toLocaleString()}` : "—"}</span>
          </div>
          {totalAdjusted > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Adjusted</span>
              <span className="text-[12px] font-semibold text-foreground">${totalAdjusted.toLocaleString()}</span>
            </div>
          )}
          {totalPaid > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Paid</span>
              <span className="text-[12px] font-semibold text-foreground">${totalPaid.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-border mt-1">
            <span className="text-[10px] text-muted-foreground">{billCount > 0 ? `${billCount} line items` : "—"}</span>
            <span className="text-[10px] text-muted-foreground">{providerCount} provider{providerCount !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════
// 4B. DOCUMENTS
// ═════════════════════════════════════════════════════
function DocumentsCard({ documents, completeDocs }: { documents: DocumentRow[]; completeDocs: number }) {
  const failed = documents.filter((d) => d.document_status === "failed").length;
  const processing = documents.filter((d) => d.document_status === "queued" || d.document_status === "ocr_in_progress").length;

  return (
    <div className="card-elevated overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <FileText className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold text-foreground">Documents</h3>
        <span className="text-[10px] font-medium bg-accent text-muted-foreground px-2 py-0.5 rounded-full ml-auto">{documents.length}</span>
      </div>
      <div className="p-4">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Processed</span>
            <span className="text-[12px] font-semibold text-foreground">{completeDocs} / {documents.length}</span>
          </div>
          {processing > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold text-[hsl(var(--status-processing))] uppercase tracking-wider">Processing</span>
              <span className="text-[12px] font-semibold text-foreground">{processing}</span>
            </div>
          )}
          {failed > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-semibold text-destructive uppercase tracking-wider">Failed</span>
              <span className="text-[12px] font-semibold text-destructive">{failed}</span>
            </div>
          )}
          {/* Document type breakdown */}
          <div className="pt-2 border-t border-border mt-1 flex flex-wrap gap-1.5">
            {Object.entries(
              documents.reduce<Record<string, number>>((acc, d) => {
                const t = d.document_type?.replace(/_/g, " ") || "unknown";
                acc[t] = (acc[t] ?? 0) + 1;
                return acc;
              }, {})
            ).map(([type, count]) => (
              <span key={type} className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-accent text-muted-foreground capitalize">
                {type} ({count})
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════
// 4C. REVIEW FLAGS / MISSING ITEMS
// ═════════════════════════════════════════════════════
function ReviewFlagsCard({
  validation,
  issueFlags,
  hasData,
  pkg,
}: {
  validation: any;
  issueFlags: any[];
  hasData: boolean;
  pkg: any;
}) {
  const allFlags: { label: string; severity: "blocker" | "warning" | "flag" }[] = [];

  // From validation engine
  (validation.blockers ?? []).forEach((b: any) => {
    allFlags.push({ label: typeof b === "string" ? b : b.message, severity: "blocker" });
  });
  (validation.warnings ?? []).forEach((w: any) => {
    allFlags.push({ label: typeof w === "string" ? w : w.message, severity: "warning" });
  });

  // From mock issue flags
  if (hasData) {
    issueFlags.forEach((f: any) => {
      allFlags.push({
        label: `${f.flag_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}: ${f.description}`,
        severity: "flag",
      });
    });
  }

  const severityIcon: Record<string, { icon: React.ElementType; color: string }> = {
    blocker: { icon: XCircle, color: "text-destructive" },
    warning: { icon: AlertTriangle, color: "text-[hsl(var(--status-attention))]" },
    flag: { icon: Info, color: "text-primary" },
  };

  return (
    <div className="card-elevated overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
        <h3 className="text-xs font-semibold text-foreground">Review Flags</h3>
        {allFlags.length > 0 && (
          <span className="text-[10px] font-semibold bg-destructive/10 text-destructive px-2 py-0.5 rounded-full ml-auto">
            {allFlags.length}
          </span>
        )}
      </div>
      <div className="max-h-[240px] overflow-y-auto">
        {allFlags.length === 0 ? (
          <div className="p-4 text-center">
            <CheckCircle2 className="h-5 w-5 text-[hsl(var(--status-approved))] mx-auto mb-1.5" />
            <p className="text-[11px] text-muted-foreground">No review flags identified.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {allFlags.map((f, i) => {
              const { icon: FlagIcon, color } = severityIcon[f.severity];
              return (
                <div key={i} className="px-4 py-2.5 flex items-start gap-2">
                  <FlagIcon className={`h-3 w-3 ${color} shrink-0 mt-0.5`} />
                  <span className="text-[11px] text-foreground leading-relaxed">{f.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════
// 5. PROCESSING DETAILS (collapsed accordion)
// ═════════════════════════════════════════════════════
function PipelineDetails({
  workflow,
  documents,
  completeDocs,
  intakePkg,
}: {
  workflow: any;
  documents: DocumentRow[];
  completeDocs: number;
  intakePkg: any;
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* Pipeline steps */}
      <div>
        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Pipeline Steps</span>
        <div className="mt-2 flex flex-col gap-1.5">
          {workflow.simplifiedSteps.map((step: any) => (
            <div key={step.label} className="flex items-center gap-2.5">
              {step.status === "complete" && <CheckCircle2 className="h-3 w-3 text-[hsl(var(--status-approved))]" />}
              {step.status === "active" && <Clock className="h-3 w-3 text-primary animate-pulse" />}
              {step.status === "blocked" && <XCircle className="h-3 w-3 text-destructive" />}
              {step.status === "pending" && <CircleDot className="h-3 w-3 text-muted-foreground" />}
              <span className="text-[11px] text-foreground">{step.label}</span>
              <span className={`text-[9px] font-medium ml-auto ${
                step.status === "complete" ? "text-[hsl(var(--status-approved))]" :
                step.status === "active" ? "text-primary" :
                step.status === "blocked" ? "text-destructive" : "text-muted-foreground"
              }`}>
                {step.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* OCR summary */}
      <div className="pt-3 border-t border-border">
        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">OCR & Extraction</span>
        <div className="mt-2 grid grid-cols-3 gap-3">
          <div>
            <p className="text-[10px] text-muted-foreground">Documents</p>
            <p className="text-[12px] font-semibold text-foreground">{completeDocs}/{documents.length}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Package Status</p>
            <p className="text-[12px] font-semibold text-foreground">{intakePkg?.package_status?.replace(/_/g, " ") ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Version</p>
            <p className="text-[12px] font-semibold text-foreground">v{intakePkg?.version ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* Assembled metadata */}
      {intakePkg?.assembled_at && (
        <div className="pt-3 border-t border-border">
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Assembly</span>
          <div className="mt-1.5 flex gap-4">
            <div>
              <p className="text-[10px] text-muted-foreground">Assembled</p>
              <p className="text-[11px] text-foreground">{new Date(intakePkg.assembled_at).toLocaleString()}</p>
            </div>
            {intakePkg.published_at && (
              <div>
                <p className="text-[10px] text-muted-foreground">Published</p>
                <p className="text-[11px] text-foreground">{new Date(intakePkg.published_at).toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════
// STATUS HELPERS
// ═════════════════════════════════════════════════════
function determinePrimaryStatus(
  workflowState: string,
  validation: any,
  packageStatus?: string | null,
): { label: string; className: string } {
  if (packageStatus === "published_to_evaluateiq") {
    return { label: "Ready for Valuation", className: "status-badge-approved" };
  }
  if (packageStatus === "ready_for_review") {
    return { label: "Intake Review", className: "status-badge-processing" };
  }
  if (validation.blockers?.length > 0) {
    return { label: "Action Required", className: "status-badge-attention" };
  }
  if (workflowState === "processing") {
    return { label: "Processing", className: "status-badge-processing" };
  }
  if (workflowState === "extracting") {
    return { label: "Extracting", className: "status-badge-processing" };
  }
  return { label: "In Progress", className: "status-badge-draft" };
}

export default CaseOverview;
