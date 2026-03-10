import { useParams, Link } from "react-router-dom";
import {
  mockCases,
  mockDocuments,
  mockChronologyEvents,
  mockEvidenceLinks,
  mockIssueFlags,
  mockReviewItems,
  mockExtractions,
  mockJobs,
  mockCasePackages,
  mockUsers,
} from "@/data/mock/index";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import {
  CaseStatus,
  DocumentStatus,
  ReviewState,
  EventType,
  Severity,
  FlagStatus,
  ReviewStatus,
  ReviewItemType,
  JobStatus,
  JobType,
  PackageStatus,
  ExtractionStatus,
  RelevanceType,
} from "@/types";
import {
  ArrowLeft,
  FileText,
  Clock,
  AlertTriangle,
  ClipboardCheck,
  Cog,
  Package,
  Link2,
  Upload,
  Play,
  CheckCircle,
  XCircle,
  Send,
  UserPlus,
  Download,
} from "lucide-react";

const caseStatusLabel: Record<CaseStatus, string> = {
  [CaseStatus.Intake]: "Intake",
  [CaseStatus.Extraction]: "Extracting",
  [CaseStatus.Review]: "In Review",
  [CaseStatus.Approved]: "Approved",
  [CaseStatus.Exported]: "Exported",
  [CaseStatus.Archived]: "Archived",
};

const caseStatusColor: Record<CaseStatus, string> = {
  [CaseStatus.Intake]: "bg-muted text-muted-foreground",
  [CaseStatus.Extraction]: "bg-primary/10 text-primary",
  [CaseStatus.Review]: "status-badge-review",
  [CaseStatus.Approved]: "status-badge-approved",
  [CaseStatus.Exported]: "bg-muted text-muted-foreground",
  [CaseStatus.Archived]: "bg-muted text-muted-foreground",
};

const docStatusConfig: Record<DocumentStatus, { label: string; className: string }> = {
  [DocumentStatus.Pending]: { label: "Pending", className: "bg-muted text-muted-foreground" },
  [DocumentStatus.Processing]: { label: "Processing", className: "bg-primary/10 text-primary" },
  [DocumentStatus.Extracted]: { label: "Extracted", className: "status-badge-approved" },
  [DocumentStatus.Failed]: { label: "Failed", className: "bg-destructive/10 text-destructive" },
};

const reviewStateConfig: Record<ReviewState, { label: string; className: string }> = {
  [ReviewState.Pending]: { label: "Pending", className: "status-badge-review" },
  [ReviewState.Approved]: { label: "Approved", className: "status-badge-approved" },
  [ReviewState.Rejected]: { label: "Rejected", className: "bg-destructive/10 text-destructive text-xs font-medium px-2 py-0.5 rounded" },
  [ReviewState.Edited]: { label: "Edited", className: "status-badge-draft" },
};

const severityConfig: Record<Severity, { label: string; className: string }> = {
  [Severity.Critical]: { label: "Critical", className: "bg-destructive/10 text-destructive" },
  [Severity.High]: { label: "High", className: "bg-destructive/10 text-destructive" },
  [Severity.Medium]: { label: "Medium", className: "status-badge-review" },
  [Severity.Low]: { label: "Low", className: "bg-muted text-muted-foreground" },
};

const relevanceLabel: Record<RelevanceType, string> = {
  [RelevanceType.Direct]: "Direct",
  [RelevanceType.Corroborating]: "Corroborating",
  [RelevanceType.Contradicting]: "Contradicting",
  [RelevanceType.Contextual]: "Contextual",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CaseDetailPage = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const { role } = useAuth();
  const caseData = mockCases.find((c) => c.id === caseId);

  if (!caseData) {
    return (
      <div className="p-6">
        <Link to="/cases" className="text-sm text-primary hover:underline flex items-center gap-1 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Cases
        </Link>
        <p className="text-sm text-muted-foreground">Case not found.</p>
      </div>
    );
  }

  const documents = mockDocuments.filter((d) => d.case_id === caseId);
  const events = mockChronologyEvents.filter((e) => e.case_id === caseId);
  const evidenceLinks = mockEvidenceLinks.filter((e) => e.case_id === caseId);
  const issueFlags = mockIssueFlags.filter((i) => i.case_id === caseId);
  const reviewItems = mockReviewItems.filter((r) => r.case_id === caseId);
  const extractions = mockExtractions.filter((e) => e.case_id === caseId);
  const jobs = mockJobs.filter((j) => j.case_id === caseId);
  const packages = mockCasePackages.filter((p) => p.case_id === caseId);
  const assignee = mockUsers.find((u) => u.id === caseData.assigned_to);

  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
  );

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <Link to="/cases" className="text-sm text-primary hover:underline flex items-center gap-1 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Cases
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{caseData.title}</h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{caseData.case_number}</span>
            <span>·</span>
            <span>DOL: {caseData.date_of_loss}</span>
            <span>·</span>
            <span>{caseData.claimant} v. {caseData.defendant}</span>
            {assignee && (
              <>
                <span>·</span>
                <span>Assigned: {assignee.display_name}</span>
              </>
            )}
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${caseStatusColor[caseData.case_status]}`}>
          {caseStatusLabel[caseData.case_status]}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
        <StatCard icon={FileText} label="Documents" value={documents.length} />
        <StatCard icon={Clock} label="Events" value={events.length} />
        <StatCard icon={Link2} label="Evidence Links" value={evidenceLinks.length} />
        <StatCard icon={AlertTriangle} label="Issues" value={issueFlags.length} />
        <StatCard icon={ClipboardCheck} label="Reviews" value={reviewItems.length} />
        <StatCard icon={Cog} label="Jobs" value={jobs.length} />
      </div>

      {/* Documents */}
      <Section title="Documents" count={documents.length}>
        {documents.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">File</th>
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Pages</th>
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Size</th>
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {documents.map((doc) => {
                const cfg = docStatusConfig[doc.document_status];
                return (
                  <tr key={doc.id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-foreground">{doc.file_name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{doc.page_count ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatBytes(doc.file_size_bytes)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${cfg.className}`}>{cfg.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      {/* Chronology */}
      <Section title="Chronology" count={events.length}>
        <div className="relative pl-4">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
          <div className="flex flex-col gap-1">
            {sortedEvents.map((event) => {
              const rs = reviewStateConfig[event.review_state];
              const evLinks = evidenceLinks.filter(
                (el) => el.linked_entity_type === "chronology_event" && el.linked_entity_id === event.id
              );
              return (
                <div key={event.id} className="relative pl-6 py-2">
                  <div className={`absolute left-0 top-[14px] w-3 h-3 rounded-full border-2 ${
                    event.review_state === ReviewState.Approved
                      ? "border-[hsl(var(--status-approved))] bg-[hsl(var(--status-approved))]"
                      : event.review_state === ReviewState.Rejected
                      ? "border-destructive bg-background"
                      : "border-[hsl(var(--status-review))] bg-background"
                  }`} />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">
                        {event.event_date}
                        <span className="ml-2 text-[10px] opacity-60">{event.event_type}</span>
                        {event.source_type === "ai_extracted" && <span className="ml-2 text-[10px] opacity-60">AI</span>}
                      </p>
                      <p className="text-sm text-foreground mt-0.5 leading-snug">{event.summary}</p>
                      {evLinks.length > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {evLinks.length} evidence link{evLinks.length !== 1 && "s"}
                        </p>
                      )}
                    </div>
                    <span className={rs.className}>{rs.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Evidence Links */}
      <Section title="Evidence Links" count={evidenceLinks.length}>
        <div className="flex flex-col gap-2">
          {evidenceLinks.map((el) => {
            const doc = documents.find((d) => d.id === el.source_document_id);
            return (
              <div key={el.id} className="border border-border rounded-md overflow-hidden">
                <div className="px-3 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-foreground">{doc?.file_name ?? el.source_document_id}</p>
                    <p className="text-[10px] text-muted-foreground">Page {el.source_page} · {el.locator_text}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-foreground">{relevanceLabel[el.relevance_type]}</code>
                    <span className="text-[10px] text-muted-foreground">→ {el.linked_entity_type}:{el.linked_entity_id}</span>
                  </div>
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-xs leading-relaxed text-foreground font-mono">{el.quoted_text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Issue Flags */}
      <Section title="Issue Flags" count={issueFlags.length}>
        <div className="flex flex-col gap-2">
          {issueFlags.map((flag) => {
            const sev = severityConfig[flag.severity];
            const flagEvLinks = evidenceLinks.filter(
              (el) => el.linked_entity_type === "issue_flag" && el.linked_entity_id === flag.id
            );
            return (
              <div key={flag.id} className="border border-border rounded-md px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-foreground">{flag.flag_type}</code>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${sev.className}`}>{sev.label}</span>
                    </div>
                    <p className="text-sm text-foreground">{flag.description}</p>
                    {flagEvLinks.length > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-1">{flagEvLinks.length} evidence link{flagEvLinks.length !== 1 && "s"}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 text-[10px] text-muted-foreground">
                    <span>{flag.status}</span>
                    <span className={reviewStateConfig[flag.review_state].className}>{reviewStateConfig[flag.review_state].label}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Review Items */}
      <Section title="Review Items" count={reviewItems.length}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Linked Record</th>
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Assigned To</th>
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {reviewItems.map((ri) => {
              const user = mockUsers.find((u) => u.id === ri.assigned_to);
              const rsClass: Record<ReviewStatus, string> = {
                [ReviewStatus.Pending]: "status-badge-review",
                [ReviewStatus.InProgress]: "bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded",
                [ReviewStatus.Approved]: "status-badge-approved",
                [ReviewStatus.Rejected]: "bg-destructive/10 text-destructive text-xs font-medium px-2 py-0.5 rounded",
                [ReviewStatus.Deferred]: "status-badge-draft",
              };
              return (
                <tr key={ri.id} className="hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-2.5">
                    <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-foreground">{ri.item_type}</code>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{ri.linked_record_type}:{ri.linked_record_id}</td>
                  <td className="px-4 py-2.5 text-foreground">{user?.display_name ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={rsClass[ri.review_status]}>{ri.review_status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{ri.resolution_notes ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      {/* Extractions */}
      <Section title="Extractions" count={extractions.length}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Document</th>
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Events</th>
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Issues</th>
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {extractions.map((ext) => {
              const doc = documents.find((d) => d.id === ext.document_id);
              const extStatusClass: Record<ExtractionStatus, string> = {
                [ExtractionStatus.Queued]: "bg-muted text-muted-foreground",
                [ExtractionStatus.Running]: "bg-primary/10 text-primary",
                [ExtractionStatus.Completed]: "status-badge-approved",
                [ExtractionStatus.Failed]: "bg-destructive/10 text-destructive",
              };
              return (
                <tr key={ext.id} className="hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-2.5 text-foreground">{doc?.file_name ?? ext.document_id}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${extStatusClass[ext.extraction_status]}`}>
                      {ext.extraction_status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{ext.events_extracted}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{ext.issues_flagged}</td>
                  <td className="px-4 py-2.5 text-xs text-destructive">{ext.error_message ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      {/* Jobs */}
      <Section title="Jobs" count={jobs.length}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Started</th>
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Completed</th>
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {jobs.map((job) => {
              const jobStatusClass: Record<JobStatus, string> = {
                [JobStatus.Queued]: "bg-muted text-muted-foreground",
                [JobStatus.Running]: "bg-primary/10 text-primary",
                [JobStatus.Completed]: "status-badge-approved",
                [JobStatus.Failed]: "bg-destructive/10 text-destructive",
              };
              return (
                <tr key={job.id} className="hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-2.5">
                    <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-foreground">{job.job_type}</code>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${jobStatusClass[job.job_status]}`}>
                      {job.job_status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{job.started_at ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{job.completed_at ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-destructive">{job.error_message ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      {/* Case Packages */}
      <Section title="Case Packages" count={packages.length}>
        {packages.length === 0 ? (
          <p className="text-sm text-muted-foreground px-4 py-3">No packages generated yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {packages.map((pkg) => (
              <div key={pkg.id} className="border border-border rounded-md px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Version {pkg.package_version}</p>
                  <p className="text-xs text-muted-foreground">Schema {pkg.schema_version} · Created {pkg.created_at}</p>
                </div>
                <span className="status-badge-approved">{pkg.package_status}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
};

// --- Helper components ---

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="border border-border rounded-lg px-3 py-3 bg-card">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-semibold text-card-foreground">{value}</p>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        {title}
        <span className="text-xs font-normal text-muted-foreground">({count})</span>
      </h2>
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {children}
      </div>
    </div>
  );
}

export default CaseDetailPage;
