import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useCase } from "@/hooks/useCases";
import { useCaseDocuments, type DocumentRow } from "@/hooks/useDocuments";
import { useCaseJobs } from "@/hooks/useJobs";
import { useTriggerProcessing } from "@/hooks/useJobs";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { CasePackageProvider, useCasePackage } from "@/hooks/useCasePackage";
import { isEntitlementActive } from "@/hooks/useModuleEntitlements";
import { useModuleCompletion, COMPLETION_STATUS_LABEL, COMPLETION_STATUS_BADGE } from "@/hooks/useModuleCompletion";
import { ModuleId, ModuleCompletionStatus } from "@/types";
import DocumentUpload from "@/components/case/DocumentUpload";
import JobsPanel from "@/components/case/JobsPanel";
import DocumentTypeTag from "@/components/case/DocumentTypeTag";
import CaseNavRail, { type CaseSection } from "@/components/case/CaseNavRail";
import CaseHeader from "@/components/case/CaseHeader";
import CaseRightRail from "@/components/case/CaseRightRail";
import WorkspaceCard from "@/components/case/WorkspaceCard";
import OverviewCards from "@/components/case/OverviewCards";
import BodyMap from "@/components/case/BodyMap";
import ChronologyPanel from "@/components/case/ChronologyPanel";
import HorizontalTimeline from "@/components/case/HorizontalTimeline";
import CaseNotesPanel from "@/components/case/CaseNotesPanel";
import AnalysisCard from "@/components/case/AnalysisCard";
import type { AnalysisSection } from "@/components/case/AnalysisCard";
import SourcePagesPanel from "@/components/case/SourcePagesPanel";
import { SourceDrawerProvider, SourceDrawer } from "@/components/case/SourceDrawer";
import ModuleCompletionStatusPanel from "@/components/case/ModuleCompletionStatusPanel";
import CompleteDemandDialog from "@/components/case/CompleteDemandDialog";
import EmptyState from "@/components/ui/EmptyState";
import { PageLoading, WorkspaceSkeleton } from "@/components/ui/LoadingSkeleton";
import ComingSoonBadge from "@/components/ui/ComingSoonBadge";
import {
  ArrowLeft,
  FileText,
  Play,
  Upload,
  Clock,
  GitBranch,
  ClipboardCheck,
  PanelRightClose,
  PanelRightOpen,
  CheckCircle2,
  Inbox,
} from "lucide-react";

// ─── Status lookups ─────────────────────────────────
const DOC_STATUS_BADGE: Record<string, string> = {
  uploaded: "status-badge-draft",
  queued: "status-badge-draft",
  ocr_in_progress: "status-badge-processing",
  classified: "status-badge-processing",
  extracted: "status-badge-approved",
  needs_attention: "status-badge-attention",
  complete: "status-badge-approved",
  failed: "status-badge-failed",
};

const DOC_STATUS_LABEL: Record<string, string> = {
  uploaded: "Uploaded",
  queued: "Queued",
  ocr_in_progress: "OCR In Progress",
  classified: "Classified",
  extracted: "Extracted",
  needs_attention: "Needs Attention",
  complete: "Complete",
  failed: "Failed",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── ReviewerIQ Preview (Coming Soon) ───────────────
const MEDICAL_REVIEW_SECTIONS: AnalysisSection[] = [
  {
    title: "Treatment Reasonableness",
    items: [
      { label: "ER Visit — Mercy General", value: "Reasonable", detail: "Appropriate given mechanism; cervical strain, shoulder contusion, radiating pain warranted imaging.", severity: "info" },
      { label: "PT Frequency (3x/week)", value: "Reasonable", detail: "Consistent with cervical disc herniation treatment guidelines. Duration appropriate.", severity: "info" },
      { label: "ESI #2 at 8 weeks post-#1", value: "Flagged", detail: "Second injection at 8-week interval is within guidelines but may be questioned given only partial relief from first.", severity: "warning" },
      { label: "PT Non-Completion (24/36)", value: "Issue", detail: "Only 67% of prescribed sessions completed. Defense will argue non-compliance weakens damages.", severity: "alert" },
    ],
  },
  {
    title: "Body-Part Grouping",
    items: [
      { label: "Cervical Spine (C5-C6)", value: "Primary", detail: "Herniation confirmed by MRI. Driving majority of treatment and damages.", severity: "alert" },
      { label: "Right Shoulder", value: "Resolved", detail: "Contusion and strain resolved after 6 weeks PT. No ongoing treatment.", severity: "info" },
      { label: "Lumbar Spine (L4-L5)", value: "Disputed", detail: "Pre-existing degenerative changes noted. Causation may be challenged.", severity: "warning" },
      { label: "Right Knee", value: "Secondary", detail: "Meniscus tear confirmed. Conservative treatment ongoing.", severity: "warning" },
    ],
  },
  {
    title: "Provider Highlights",
    items: [
      { label: "Dr. Sarah Chen — Orthopedics", detail: "Primary treating physician. 6 visits. Consistent documentation, causation opinions well-supported.", severity: "info" },
      { label: "Dr. Raj Patel — Pain Management", detail: "ESI provider. 3 visits. Procedure notes adequate. Follow-up documentation could be stronger.", severity: "info" },
      { label: "Dr. William Roberts — IME", detail: "Defense examiner. Concurs on herniation causation but disputes surgical necessity. Key rebuttal target.", severity: "alert" },
    ],
  },
  {
    title: "Billing Review Items",
    items: [
      { label: "MRI Cervical (72141)", value: "$3,200", detail: "Billed at $3,200 vs. Medicare rate ~$380. Expect significant reduction in adjusted value.", severity: "warning" },
      { label: "ESI (64483) x2", value: "$12,400", detail: "Two injections at $6,200 each. Within range but on high end for market.", severity: "warning" },
      { label: "PT Sessions (97110)", value: "$9,600", detail: "24 sessions at $400/session. Reasonable per-session rate.", severity: "info" },
      { label: "Total Reduction Risk", value: "~29%", detail: "Expected reduction from billed ($87,450) to adjusted value (~$62,200) based on usual and customary analysis.", severity: "alert" },
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
  const [showRightRail, setShowRightRail] = useState(true);
  const hasReviewerIQ = isEntitlementActive(entitlements, ModuleId.ReviewerIQ);
  const { data: demandCompletion } = useModuleCompletion(caseId, "demandiq");

  if (caseLoading) {
    return <PageLoading message="Loading case…" />;
  }

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

  const pendingDocs = documents.filter((d) => d.document_status === "uploaded").length;
  const completeDocs = documents.filter((d) => d.document_status === "complete" || d.document_status === "extracted").length;

  return (
    <CasePackageProvider caseId={caseData.id}>
    <SourceDrawerProvider>
    <div className="flex flex-col h-full">
      {/* Top case header */}
      <CaseHeader caseData={caseData}>
        {/* Completion action in header */}
        {hasPermission(role, "complete_module") && (caseData.case_status === "complete" || caseData.case_status === "exported") && (
          <button
            onClick={() => setShowCompletionDialog(true)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg transition-colors shadow-sm ${
              demandCompletion?.status === ModuleCompletionStatus.Completed
                ? "border border-[hsl(var(--status-approved))]/30 bg-[hsl(var(--status-approved))]/10 text-foreground hover:bg-[hsl(var(--status-approved))]/20"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {demandCompletion?.status === ModuleCompletionStatus.Completed
              ? `Demand Completed · v${demandCompletion.version}`
              : "Complete Demand"}
          </button>
        )}
      </CaseHeader>

      {/* Workspace body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left nav rail */}
        <div className="hidden md:flex">
          <CaseNavRail active={activeSection} onChange={setActiveSection} />
        </div>

        {/* Mobile section tabs */}
        <div className="md:hidden flex overflow-x-auto border-b border-border bg-card px-2 gap-1 shrink-0">
          {(["overview", "documents", "timeline", "notes", "chat"] as CaseSection[]).map((s) => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
                activeSection === s
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Center workspace */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 max-w-5xl flex flex-col gap-4">
            {/* ── OVERVIEW ────────────────────────── */}
            {activeSection === "overview" && (
              <>
                <HorizontalTimeline />
                <OverviewCards caseData={caseData} documents={documents} />
                <BodyMap />
                <ChronologyPanel />

                {/* Documents preview */}
                <WorkspaceCard
                  icon={FileText}
                  title="Documents"
                  count={documents.length}
                  actions={
                    <div className="flex gap-2">
                      {hasPermission(role, "upload_document") && (
                         <button onClick={() => setShowUpload(true)} className="btn-secondary text-[11px]">
                          <Upload className="h-3 w-3" /> Upload
                        </button>
                      )}
                      {hasPermission(role, "trigger_processing") && pendingDocs > 0 && (
                        <button
                          onClick={() => triggerProcessing.mutate({ caseId: caseData.id })}
                          disabled={triggerProcessing.isPending}
                          className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          <Play className="h-3 w-3" /> Process
                        </button>
                      )}
                    </div>
                  }
                >
                  {docsLoading ? (
                    <div className="p-5 space-y-2">
                      {[1,2,3].map(i => <div key={i} className="animate-pulse h-10 bg-accent rounded-lg" />)}
                    </div>
                  ) : documents.length === 0 ? (
                    <EmptyState icon={FileText} title="No documents" description="Upload documents to begin analysis." />
                  ) : (
                    <div className="divide-y divide-border">
                      {documents.slice(0, 5).map((doc) => (
                        <div key={doc.id} className="px-5 py-3 flex items-center gap-3 hover:bg-accent/30 transition-colors">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <Link
                              to={`/documents/${doc.id}`}
                              className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                            >
                              {doc.file_name}
                            </Link>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {formatBytes(doc.file_size_bytes)} · {doc.pipeline_stage.replace(/_/g, " ")}
                            </p>
                          </div>
                          <DocumentTypeTag type={doc.document_type} />
                          <span className={DOC_STATUS_BADGE[doc.document_status] ?? "status-badge-draft"}>
                            {DOC_STATUS_LABEL[doc.document_status] ?? doc.document_status}
                          </span>
                        </div>
                      ))}
                      {documents.length > 5 && (
                        <div className="px-5 py-2.5 text-center">
                          <button
                            onClick={() => setActiveSection("documents")}
                            className="text-xs text-primary font-medium hover:underline"
                          >
                            View all {documents.length} documents →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </WorkspaceCard>

                <JobsPanel jobs={jobs} loading={jobsLoading} />
              </>
            )}

            {/* ── TIMELINE ────────────────────────── */}
            {activeSection === "timeline" && <ChronologyPanel />}

            {/* ── NOTES (DemandIQ Workspace) ───── */}
            {activeSection === "notes" && (
              <>
                <ModuleCompletionStatusPanel
                  caseId={caseData.id}
                  moduleId="demandiq"
                  onCompleteClick={hasPermission(role, "complete_module") ? () => setShowCompletionDialog(true) : undefined}
                />
                <CaseNotesPanel />

                {/* ReviewerIQ — show full card if entitled, teaser if not */}
                {hasReviewerIQ ? (
                  <AnalysisCard
                    icon={ClipboardCheck}
                    title="Medical Review Snapshot"
                    subtitle="ReviewerIQ"
                    sections={MEDICAL_REVIEW_SECTIONS}
                  />
                ) : (
                  <div className="relative">
                    <div className="absolute top-3 right-3 z-10">
                      <ComingSoonBadge label="ReviewerIQ · Add-on" />
                    </div>
                    <div className="opacity-50 pointer-events-none">
                      <AnalysisCard
                        icon={ClipboardCheck}
                        title="Medical Review Snapshot"
                        subtitle="ReviewerIQ Preview"
                        sections={MEDICAL_REVIEW_SECTIONS.slice(0, 1)}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── DOCUMENTS (dedicated) ────────── */}
            {activeSection === "documents" && (
              <>
                <div className="flex flex-wrap gap-2">
                  {hasPermission(role, "upload_document") && (
                    <button
                      onClick={() => setShowUpload(true)}
                      className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-accent transition-colors"
                    >
                      <Upload className="h-3.5 w-3.5" /> Upload Documents
                    </button>
                  )}
                  {hasPermission(role, "trigger_processing") && pendingDocs > 0 && (
                    <button
                      onClick={() => triggerProcessing.mutate({ caseId: caseData.id })}
                      disabled={triggerProcessing.isPending}
                      className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
                    >
                      <Play className="h-3.5 w-3.5" /> Trigger Processing
                    </button>
                  )}
                </div>
                <WorkspaceCard icon={FileText} title="All Documents" count={documents.length}>
                  {docsLoading ? (
                    <div className="p-5 space-y-2">
                      {[1,2,3,4,5].map(i => <div key={i} className="animate-pulse h-10 bg-accent rounded-lg" />)}
                    </div>
                  ) : documents.length === 0 ? (
                    <EmptyState icon={FileText} title="No documents uploaded" description="Upload documents to begin case processing." />
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left bg-muted/30">
                          <th className="px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">File</th>
                          <th className="px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                          <th className="px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Size</th>
                          <th className="px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Pipeline</th>
                          <th className="px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {documents.map((doc) => (
                          <tr key={doc.id} className="hover:bg-accent/30 transition-colors">
                            <td className="px-5 py-3">
                              <Link to={`/documents/${doc.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                                {doc.file_name}
                              </Link>
                            </td>
                            <td className="px-5 py-3"><DocumentTypeTag type={doc.document_type} /></td>
                            <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">{formatBytes(doc.file_size_bytes)}</td>
                            <td className="px-5 py-3 hidden md:table-cell">
                              <code className="text-[10px] bg-accent px-2 py-0.5 rounded-full text-muted-foreground font-medium">
                                {doc.pipeline_stage.replace(/_/g, " ")}
                              </code>
                            </td>
                            <td className="px-5 py-3">
                              <span className={DOC_STATUS_BADGE[doc.document_status] ?? "status-badge-draft"}>
                                {DOC_STATUS_LABEL[doc.document_status] ?? doc.document_status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </WorkspaceCard>
                <JobsPanel jobs={jobs} loading={jobsLoading} />
              </>
            )}

            {/* ── SOURCES ────────────────────────── */}
            {activeSection === "sources" && <SourcePagesPanel />}

            {/* ── WORKFLOWS ────────────────────────── */}
            {activeSection === "workflows" && (
              <WorkspaceCard icon={GitBranch} title="Workflows">
                <div className="px-5 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { title: "Document Intake", desc: "Upload, OCR, classify and extract", status: "active", progress: documents.length > 0 ? Math.round((completeDocs / Math.max(documents.length, 1)) * 100) : 0 },
                      { title: "Chronology Build", desc: "Generate timeline from medical records", status: documents.length > 0 ? "ready" : "pending", progress: 0 },
                      { title: "Issue Flagging", desc: "Identify gaps, pre-existing conditions", status: "pending", progress: 0 },
                      { title: "Demand Completion", desc: "Finalize demand letter and supporting exhibits", status: "pending", progress: 0 },
                    ].map((wf) => (
                      <div key={wf.title} className="rounded-xl border border-border p-4 bg-background">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-foreground">{wf.title}</h4>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            wf.status === "active" ? "status-badge-processing" :
                            wf.status === "ready" ? "status-badge-approved" :
                            "status-badge-draft"
                          }`}>
                            {wf.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">{wf.desc}</p>
                        <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${wf.progress}%` }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">{wf.progress}% complete</p>
                      </div>
                    ))}
                  </div>
                </div>
              </WorkspaceCard>
            )}

            {/* ── CHAT (mobile fallback) ────────── */}
            {activeSection === "chat" && (
              <div className="lg:hidden">
                <CaseRightRail caseData={caseData} documents={documents} />
              </div>
            )}
          </div>
        </div>

        {/* Right rail — collapsible on desktop, hidden on mobile */}
        <div className="hidden lg:flex lg:relative">
          {/* Collapse toggle */}
          <button
            onClick={() => setShowRightRail(!showRightRail)}
            className="absolute -left-3 top-4 z-20 h-6 w-6 rounded-full border border-border bg-card shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title={showRightRail ? "Collapse panel" : "Expand panel"}
          >
            {showRightRail ? <PanelRightClose className="h-3 w-3" /> : <PanelRightOpen className="h-3 w-3" />}
          </button>
          {showRightRail && (
            <div className="lg:sticky lg:top-0 lg:h-full">
              <CaseRightRail caseData={caseData} documents={documents} />
            </div>
          )}
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
