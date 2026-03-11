import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useCase } from "@/hooks/useCases";
import { useCaseDocuments, type DocumentRow } from "@/hooks/useDocuments";
import { useCaseJobs } from "@/hooks/useJobs";
import { useTriggerProcessing } from "@/hooks/useJobs";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { CasePackageProvider } from "@/hooks/useCasePackage";
import { isEntitlementActive } from "@/hooks/useModuleEntitlements";
import { useModuleCompletion } from "@/hooks/useModuleCompletion";
import { ModuleId, ModuleCompletionStatus } from "@/types";
import CaseOverview from "@/components/case/CaseOverview";
import CoverPageTab from "@/components/case/CoverPageTab";
import ChecklistTab from "@/components/case/ChecklistTab";
import ChronologySummaryTab from "@/components/case/ChronologySummaryTab";
import ClaimantBackgroundTab from "@/components/case/ClaimantBackgroundTab";
import ClaimAssessmentTab from "@/components/case/ClaimAssessmentTab";
import ProvidersTab from "@/components/case/ProvidersTab";
import BillingView from "@/components/case/BillingView";
import CaseChatView from "@/components/case/CaseChatView";
import DocumentsWorkstation from "@/components/case/DocumentsWorkstation";
import IntakeDocumentsWorkstation from "@/components/case/IntakeDocumentsWorkstation";
import SourcePagesWorkstation from "@/components/case/SourcePagesWorkstation";
import DocumentUpload from "@/components/case/DocumentUpload";
import JobsPanel from "@/components/case/JobsPanel";
import DocumentTypeTag from "@/components/case/DocumentTypeTag";
import CaseNavRail, { type CaseSection } from "@/components/case/CaseNavRail";
import CaseHeader from "@/components/case/CaseHeader";
import CaseRightUtilityRail from "@/components/case/CaseRightUtilityRail";
import CaseWorkspaceTabs, { type WorkspaceTab } from "@/components/case/CaseWorkspaceTabs";
import CaseWorkspaceToolbar from "@/components/case/CaseWorkspaceToolbar";
import WorkspaceCard from "@/components/case/WorkspaceCard";
import OverviewCards from "@/components/case/OverviewCards";
import BodyMap from "@/components/case/BodyMap";
import ChronologyPanel from "@/components/case/ChronologyPanel";
import HorizontalTimeline from "@/components/case/HorizontalTimeline";
import CaseNotesPanel from "@/components/case/CaseNotesPanel";
import AnalysisCard from "@/components/case/AnalysisCard";
import type { AnalysisSection } from "@/components/case/AnalysisCard";
import { SourceDrawerProvider, SourceDrawer } from "@/components/case/SourceDrawer";
import ModuleCompletionStatusPanel from "@/components/case/ModuleCompletionStatusPanel";
import CompleteDemandDialog from "@/components/case/CompleteDemandDialog";
import EmptyState from "@/components/ui/EmptyState";
import { PageLoading } from "@/components/ui/LoadingSkeleton";
import ComingSoonBadge from "@/components/ui/ComingSoonBadge";
import {
  ArrowLeft,
  FileText,
  Upload,
  ClipboardCheck,
  CheckCircle2,
  Inbox,
} from "lucide-react";


// ─── ReviewerIQ Preview ─────────────────────────────
const MEDICAL_REVIEW_SECTIONS: AnalysisSection[] = [
  {
    title: "Treatment Reasonableness",
    items: [
      { label: "ER Visit — Mercy General", value: "Reasonable", detail: "Appropriate given mechanism; cervical strain, shoulder contusion, radiating pain warranted imaging.", severity: "info" },
      { label: "PT Frequency (3x/week)", value: "Reasonable", detail: "Consistent with cervical disc herniation treatment guidelines.", severity: "info" },
      { label: "ESI #2 at 8 weeks post-#1", value: "Flagged", detail: "Second injection at 8-week interval within guidelines but may be questioned.", severity: "warning" },
      { label: "PT Non-Completion (24/36)", value: "Issue", detail: "Only 67% of prescribed sessions completed. Defense will argue non-compliance.", severity: "alert" },
    ],
  },
  {
    title: "Body-Part Grouping",
    items: [
      { label: "Cervical Spine (C5-C6)", value: "Primary", detail: "Herniation confirmed by MRI. Driving majority of treatment and damages.", severity: "alert" },
      { label: "Right Shoulder", value: "Resolved", detail: "Contusion and strain resolved after 6 weeks PT.", severity: "info" },
      { label: "Lumbar Spine (L4-L5)", value: "Disputed", detail: "Pre-existing degenerative changes noted. Causation may be challenged.", severity: "warning" },
      { label: "Right Knee", value: "Secondary", detail: "Meniscus tear confirmed. Conservative treatment ongoing.", severity: "warning" },
    ],
  },
  {
    title: "Provider Highlights",
    items: [
      { label: "Dr. Sarah Chen — Orthopedics", detail: "Primary treating physician. 6 visits. Consistent documentation.", severity: "info" },
      { label: "Dr. Raj Patel — Pain Management", detail: "ESI provider. 3 visits. Follow-up documentation could be stronger.", severity: "info" },
      { label: "Dr. William Roberts — IME", detail: "Defense examiner. Disputes surgical necessity. Key rebuttal target.", severity: "alert" },
    ],
  },
  {
    title: "Billing Review Items",
    items: [
      { label: "MRI Cervical (72141)", value: "$3,200", detail: "Billed at $3,200 vs. Medicare rate ~$380. Expect significant reduction.", severity: "warning" },
      { label: "ESI (64483) x2", value: "$12,400", detail: "Two injections at $6,200 each. Within range but on high end.", severity: "warning" },
      { label: "PT Sessions (97110)", value: "$9,600", detail: "24 sessions at $400/session. Reasonable per-session rate.", severity: "info" },
      { label: "Total Reduction Risk", value: "~29%", detail: "Expected reduction from billed ($87,450) to adjusted (~$62,200).", severity: "alert" },
    ],
  },
];

const CaseDetailPage = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const { role, entitlements } = useAuth();
  const { data: caseData, isLoading: caseLoading } = useCase(caseId);
  const { data: documents = [], isLoading: docsLoading } = useCaseDocuments(caseId);
  const { data: jobs = [], isLoading: jobsLoading } = useCaseJobs(caseId);
  const triggerProcessing = useTriggerProcessing();
  const [showUpload, setShowUpload] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [activeSection, setActiveSection] = useState<CaseSection>("overview");
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("assessment");
  const [showRightRail, setShowRightRail] = useState(true);
  const [showUtilityRail, setShowUtilityRail] = useState(true);
  const hasReviewerIQ = isEntitlementActive(entitlements, ModuleId.ReviewerIQ);
  const { data: demandCompletion } = useModuleCompletion(caseId, "demandiq");

  const pendingDocs = documents.filter((d) => d.document_status === "uploaded").length;
  const completeDocs = documents.filter((d) => d.document_status === "complete" || d.document_status === "extracted").length;

  if (caseLoading) return <PageLoading message="Loading case…" />;

  if (!caseData) {
    return (
      <div className="p-8">
        <Link to="/cases" className="text-sm text-primary hover:underline flex items-center gap-1 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Cases
        </Link>
        <EmptyState icon={Inbox} title="Case not found" description="This case may have been removed or you don't have access." />
      </div>
    );
  }

  // Claimant summary for left rail
  const claimantSummary = {
    claimantName: caseData.claimant || "Unknown Claimant",
    doi: caseData.date_of_loss ? new Date(caseData.date_of_loss).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—",
    claimNumber: caseData.claim_number || "—",
    pageCount: documents.reduce((sum, d) => sum + (d.page_count ?? 0), 0),
  };

  return (
    <CasePackageProvider caseId={caseData.id}>
    <SourceDrawerProvider>
    <div className="flex flex-col h-full">
      {/* Top case header */}
      <CaseHeader caseData={caseData}>
        {hasPermission(role, "complete_module") && (caseData.case_status === "complete" || caseData.case_status === "exported") && (
          <button
            onClick={() => setShowCompletionDialog(true)}
            className={`flex items-center gap-1.5 text-[11px] font-semibold px-3.5 py-2 rounded-lg transition-all duration-150 ${
              demandCompletion?.status === ModuleCompletionStatus.Completed
                ? "border border-[hsl(var(--status-approved))]/25 bg-[hsl(var(--status-approved))]/8 text-foreground hover:bg-[hsl(var(--status-approved))]/15"
                : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {demandCompletion?.status === ModuleCompletionStatus.Completed
              ? `Demand Completed · v${demandCompletion.version}`
              : "Complete Demand"}
          </button>
        )}
      </CaseHeader>

      {/* Workspace body — 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Case nav rail with claimant summary */}
        <div className="hidden md:flex">
          <CaseNavRail active={activeSection} onChange={setActiveSection} claimant={claimantSummary} />
        </div>

        {/* Mobile section tabs */}
        <div className="md:hidden flex overflow-x-auto border-b border-border bg-card px-2 gap-1 shrink-0">
          {(["overview", "notes", "billing", "documents", "chat"] as CaseSection[]).map((s) => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`px-3 py-2.5 text-[11px] font-medium whitespace-nowrap transition-colors ${
                activeSection === s ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* CENTER: Main workspace */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Sticky workspace toolbar — tabs + actions */}
          {(activeSection === "overview" || activeSection === "notes") && (
            <div className="sticky-toolbar justify-between shrink-0">
              <CaseWorkspaceTabs active={activeTab} onChange={setActiveTab} />
              <CaseWorkspaceToolbar />
            </div>
          )}

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            <div className={`p-5 flex flex-col gap-4 ${activeSection === "overview" ? "max-w-[1400px]" : "max-w-5xl"}`}>
              {/* ── OVERVIEW ────────────────────────── */}
              {activeSection === "overview" && (
                <CaseOverview caseData={caseData} documents={documents} />
              )}

              {/* ── DemandIQ WORKSPACE (tab-driven) ──── */}
              {activeSection === "notes" && (
                <>
                  {activeTab === "cover" && (
                    <CoverPageTab caseData={caseData} documents={documents} />
                  )}

                  {activeTab === "checklist" && (
                    <ChecklistTab />
                  )}

                  {activeTab === "assessment" && (
                    <ClaimAssessmentTab />
                  )}

                  {activeTab === "chronology" && (
                    <ChronologySummaryTab />
                  )}

                  {activeTab === "background" && (
                    <ClaimantBackgroundTab />
                  )}

                  {activeTab === "providers" && (
                    <ProvidersTab />
                  )}
                </>
              )}

              {/* ── BILLING ────────────────────────── */}
              {activeSection === "billing" && (
                <BillingView />
              )}

              {/* ── DOCUMENTS ─────────────────────── */}
              {activeSection === "documents" && (
                <DocumentsWorkstation documents={documents} loading={docsLoading} caseId={caseData.id} />
              )}

              {/* ── SOURCE PAGES ──────────────────── */}
              {activeSection === "sources" && <SourcePagesWorkstation />}

              {/* ── CHAT ──────────────────────────── */}
              {activeSection === "chat" && (
                <CaseChatView />
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Utility rail (Table of Contents / Refine / Evidence) */}
        <div className="hidden lg:flex">
          <CaseRightUtilityRail
            collapsed={!showUtilityRail}
            onToggle={() => setShowUtilityRail(!showUtilityRail)}
          />
        </div>
      </div>

      <DocumentUpload caseId={caseData.id} open={showUpload} onClose={() => setShowUpload(false)} />
      <CompleteDemandDialog
        caseId={caseData.id}
        caseStatus={caseData.case_status}
        documents={documents}
        open={showCompletionDialog}
        onClose={() => setShowCompletionDialog(false)}
      />
      <SourceDrawer />
    </div>
    </SourceDrawerProvider>
    </CasePackageProvider>
  );
};

export default CaseDetailPage;
