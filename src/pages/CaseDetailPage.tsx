import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useCase } from "@/hooks/useCases";
import { useCaseDocuments, type DocumentRow } from "@/hooks/useDocuments";
import { useCaseJobs } from "@/hooks/useJobs";
import { useTriggerProcessing } from "@/hooks/useJobs";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { CasePackageProvider } from "@/hooks/useCasePackage";
import DocumentUpload from "@/components/case/DocumentUpload";
import JobsPanel from "@/components/case/JobsPanel";
import ProcessingPipeline from "@/components/case/ProcessingPipeline";
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
import {
  ArrowLeft,
  FileText,
  Cog,
  Play,
  Upload,
  Clock,
  StickyNote,
  BookOpen,
  GitBranch,
  AlertTriangle,
  Briefcase,
  TrendingUp,
  CheckCircle,
  ExternalLink,
  ClipboardCheck,
} from "lucide-react";

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

// ─── Mock data for timeline / notes ──────────────────
const MOCK_TIMELINE = [
  { date: "2024-11-15", event: "Motor vehicle accident on I-95 northbound", type: "Incident", source: "Police Report #PR-2024-8812" },
  { date: "2024-11-15", event: "Emergency room visit at Mercy General Hospital", type: "Medical", source: "ER Records — Mercy General" },
  { date: "2024-11-18", event: "Follow-up visit with Dr. Sarah Chen, orthopedic evaluation", type: "Medical", source: "Medical Record — Dr. Chen" },
  { date: "2024-12-02", event: "MRI of cervical spine completed — disc herniation C5-C6", type: "Diagnostic", source: "Imaging Report — Regional Radiology" },
  { date: "2024-12-10", event: "Physical therapy initiated — 3x/week for 8 weeks", type: "Treatment", source: "PT Records — Advanced Rehab" },
  { date: "2025-01-05", event: "Insurance demand letter sent to carrier", type: "Legal", source: "Correspondence — Demand Letter v1" },
  { date: "2025-02-15", event: "Independent medical examination by Dr. Roberts", type: "Medical", source: "IME Report — Dr. Roberts" },
  { date: "2025-03-01", event: "Settlement negotiation round 1 — $45,000 offered", type: "Negotiation", source: "Carrier Correspondence" },
];

const MOCK_NOTES = [
  { author: "Sarah Mitchell", time: "2 hours ago", text: "Reviewed the MRI report — C5-C6 herniation is well-documented. Need to cross-reference with PT progress notes for causation argument." },
  { author: "David Park", time: "Yesterday", text: "Police report confirms defendant ran red light. Liability should be straightforward. Requesting dash cam footage." },
  { author: "Sarah Mitchell", time: "3 days ago", text: "Initial document review complete. 12 medical records, 2 billing statements, 1 police report uploaded. Flagged potential pre-existing condition in lumbar region." },
];

const MOCK_SOURCES = [
  { page: "pg. 3", doc: "Police Report #PR-2024-8812", excerpt: "Vehicle 1 failed to stop at red signal, striking Vehicle 2 in the intersection at approximately 35 mph." },
  { page: "pg. 1", doc: "ER Records — Mercy General", excerpt: "Patient presents with acute cervical strain, right shoulder contusion, and complaints of radiating pain to right upper extremity." },
  { page: "pg. 7", doc: "MRI Report — Regional Radiology", excerpt: "Impression: Central disc herniation at C5-C6 with moderate foraminal narrowing. Recommend neurosurgical consultation." },
  { page: "pg. 2", doc: "PT Records — Advanced Rehab", excerpt: "Initial evaluation: cervical ROM significantly limited. Pain rated 7/10. Treatment plan: manual therapy, therapeutic exercise, modalities 3x/week." },
];

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
  const { role } = useAuth();
  const { data: caseData, isLoading: caseLoading } = useCase(caseId);
  const { data: documents = [], isLoading: docsLoading } = useCaseDocuments(caseId);
  const { data: jobs = [], isLoading: jobsLoading } = useCaseJobs(caseId);
  const triggerProcessing = useTriggerProcessing();
  const [showUpload, setShowUpload] = useState(false);
  const [activeSection, setActiveSection] = useState<CaseSection>("overview");
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  if (caseLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Loading case…</p>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="p-8">
        <Link to="/cases" className="text-sm text-primary hover:underline flex items-center gap-1 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Cases
        </Link>
        <p className="text-sm text-muted-foreground">Case not found.</p>
      </div>
    );
  }

  const pendingDocs = documents.filter((d) => d.document_status === "uploaded").length;
  const completeDocs = documents.filter((d) => d.document_status === "complete" || d.document_status === "extracted").length;

  return (
    <SourceDrawerProvider>
    <div className="flex flex-col h-full">
      {/* Top case header */}
      <CaseHeader caseData={caseData} />

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
          <div className="p-6 max-w-5xl flex flex-col gap-5">
            {/* ── OVERVIEW ────────────────────────── */}
            {activeSection === "overview" && (
              <>
                {/* Horizontal chronology bar */}
                <HorizontalTimeline />

                {/* DemandIQ Overview — Case Summary, Injuries, Flags */}
                <OverviewCards caseData={caseData} documents={documents} />

                {/* Body Map */}
                <BodyMap />

                {/* Chronology */}
                <ChronologyPanel />

                {/* Documents preview */}
                <WorkspaceCard
                  icon={FileText}
                  title="Documents"
                  count={documents.length}
                  actions={
                    <div className="flex gap-2">
                      {hasPermission(role, "upload_document") && (
                        <button
                          onClick={() => setShowUpload(true)}
                          className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-accent transition-colors"
                        >
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
                  {documents.length === 0 ? (
                    <div className="px-5 py-10 text-center">
                      <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
                    </div>
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

                {/* Jobs */}
                <JobsPanel jobs={jobs} loading={jobsLoading} />
              </>
            )}

            {/* ── TIMELINE ────────────────────────── */}
            {activeSection === "timeline" && (
              <WorkspaceCard
                icon={Clock}
                title="Case Chronology"
                count={MOCK_TIMELINE.length}
                tabs={[
                  { key: "all", label: "All Events" },
                  { key: "medical", label: "Medical" },
                  { key: "legal", label: "Legal" },
                ]}
              >
                {(tab: string) => {
                  const events = tab === "all"
                    ? MOCK_TIMELINE
                    : MOCK_TIMELINE.filter((e) =>
                        tab === "medical"
                          ? ["Medical", "Diagnostic", "Treatment"].includes(e.type)
                          : ["Legal", "Negotiation", "Incident"].includes(e.type)
                      );
                  return (
                    <div className="px-5 py-4">
                      <div className="relative">
                        <div className="absolute left-[7px] top-3 bottom-3 w-px bg-border" />
                        <div className="flex flex-col gap-0">
                          {events.map((ev, idx) => (
                            <div key={idx} className="flex gap-4 py-3 relative">
                              <div className="relative z-10 mt-1">
                                <div className="h-[15px] w-[15px] rounded-full border-2 border-primary bg-card" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2 mb-0.5">
                                  <span className="text-xs font-semibold text-foreground">{ev.date}</span>
                                  <span className="text-[10px] font-medium bg-accent text-muted-foreground px-2 py-0.5 rounded-full">
                                    {ev.type}
                                  </span>
                                </div>
                                <p className="text-sm text-foreground leading-relaxed">{ev.event}</p>
                                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                                  <BookOpen className="h-3 w-3" /> {ev.source}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }}
              </WorkspaceCard>
            )}

            {/* ── NOTES (DemandIQ Workspace) ───── */}
            {activeSection === "notes" && (
              <>
                <CaseNotesPanel />

                <AnalysisCard
                  icon={ClipboardCheck}
                  title="Medical Review Snapshot"
                  subtitle="ReviewerIQ Preview"
                  sections={MEDICAL_REVIEW_SECTIONS}
                />
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
                  {documents.length === 0 ? (
                    <div className="px-5 py-12 text-center">
                      <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left bg-muted/30">
                          <th className="px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">File</th>
                          <th className="px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                          <th className="px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Size</th>
                          <th className="px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Pipeline</th>
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
                            <td className="px-5 py-3 text-muted-foreground">{formatBytes(doc.file_size_bytes)}</td>
                            <td className="px-5 py-3">
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
            {activeSection === "sources" && (
              <SourcePagesPanel />
            )}

            {/* ── WORKFLOWS ────────────────────────── */}
            {activeSection === "workflows" && (
              <WorkspaceCard icon={GitBranch} title="Workflows">
                <div className="px-5 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { title: "Document Intake", desc: "Upload, OCR, classify and extract", status: "active", progress: documents.length > 0 ? Math.round((completeDocs / Math.max(documents.length, 1)) * 100) : 0 },
                      { title: "Chronology Build", desc: "Generate timeline from medical records", status: documents.length > 0 ? "ready" : "pending", progress: 0 },
                      { title: "Issue Flagging", desc: "Identify gaps, pre-existing conditions", status: "pending", progress: 0 },
                      { title: "Demand Package", desc: "Generate demand letter and exhibits", status: "pending", progress: 0 },
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
                        {/* Progress bar */}
                        <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${wf.progress}%` }}
                          />
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

        {/* Right rail — sticky on desktop, below content on mobile */}
        <div className="hidden lg:flex lg:sticky lg:top-0 lg:h-full">
          <CaseRightRail caseData={caseData} documents={documents} />
        </div>
      </div>

      <DocumentUpload caseId={caseData.id} open={showUpload} onClose={() => setShowUpload(false)} />
      <SourceDrawer />
    </div>
    </SourceDrawerProvider>
  );
};

function StatCard({
  icon: Icon,
  label,
  value,
  color = "text-muted-foreground",
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="card-elevated px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-semibold text-card-foreground">{value}</p>
    </div>
  );
}

export default CaseDetailPage;
