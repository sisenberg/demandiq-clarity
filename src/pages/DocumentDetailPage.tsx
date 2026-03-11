import { useParams, Link } from "react-router-dom";
import { useDocument } from "@/hooks/useDocuments";
import { useDocumentJobs } from "@/hooks/useJobs";
import { useDocumentIntakeJobs } from "@/hooks/useIntakeJobs";
import { useDocumentPages } from "@/hooks/useDocumentPages";
import { useDocumentExtractedFacts } from "@/hooks/useExtractedFacts";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { useTriggerProcessing } from "@/hooks/useJobs";
import { useCreateIntakeJob, useRetryIntakeJob } from "@/hooks/useIntakeJobs";
import ProcessingPipeline from "@/components/case/ProcessingPipeline";
import JobsPanel from "@/components/case/JobsPanel";
import DocumentTypeTag from "@/components/case/DocumentTypeTag";
import { INTAKE_STATUS_LABEL, INTAKE_JOB_TYPE_LABEL, FACT_TYPE_LABEL } from "@/types/intake";
import type { IntakeJobRow, ExtractedFactRow, DocumentPageRow } from "@/types/intake";
import { ArrowLeft, FileText, Play, RotateCcw, Layers, Brain, AlertTriangle, CheckCircle } from "lucide-react";

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

const INTAKE_JOB_STATUS_STYLE: Record<string, string> = {
  queued: "status-badge-draft",
  running: "status-badge-processing",
  completed: "status-badge-approved",
  failed: "status-badge-failed",
  cancelled: "status-badge-draft",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DocumentDetailPage = () => {
  const { docId } = useParams<{ docId: string }>();
  const { role } = useAuth();
  const { data: doc, isLoading } = useDocument(docId);
  const { data: jobs = [], isLoading: jobsLoading } = useDocumentJobs(docId);
  const { data: intakeJobs = [], isLoading: intakeJobsLoading } = useDocumentIntakeJobs(docId);
  const { data: pages = [] } = useDocumentPages(docId);
  const { data: facts = [] } = useDocumentExtractedFacts(docId);
  const triggerProcessing = useTriggerProcessing();
  const createIntakeJob = useCreateIntakeJob();
  const retryIntakeJob = useRetryIntakeJob();

  if (isLoading) {
    return <div className="p-8"><p className="text-sm text-muted-foreground">Loading…</p></div>;
  }

  if (!doc) {
    return (
      <div className="p-8">
        <Link to="/documents" className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 mb-4 font-medium">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Documents
        </Link>
        <p className="text-sm text-muted-foreground">Document not found.</p>
      </div>
    );
  }

  const intakeStatus = (doc as any).intake_status || "uploaded";

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-5">
        <Link to={`/cases/${doc.case_id}`} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-medium transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Case
        </Link>
        <span className="text-border">|</span>
        <Link to={`/cases/${doc.case_id}`} state={{ openReview: doc.id }} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-medium transition-colors">
          <FileText className="h-3.5 w-3.5" /> Open in Review Workspace
        </Link>
      </div>

      {/* Header Card */}
      <div className="card-elevated px-6 py-5 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground tracking-tight">{doc.file_name}</h1>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <DocumentTypeTag type={doc.document_type} />
                <span>{formatBytes(doc.file_size_bytes)}</span>
                {doc.page_count && <span>{doc.page_count} pages</span>}
                <span>Uploaded {new Date(doc.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mr-1">Intake</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              intakeStatus === "parsed" ? "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]" :
              intakeStatus === "failed" ? "bg-destructive/10 text-destructive" :
              intakeStatus === "needs_review" ? "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]" :
              "bg-accent text-muted-foreground"
            }`}>
              {INTAKE_STATUS_LABEL[intakeStatus as keyof typeof INTAKE_STATUS_LABEL] ?? intakeStatus}
            </span>
            <span className={DOC_STATUS_BADGE[doc.document_status] ?? "status-badge-draft"}>
              {DOC_STATUS_LABEL[doc.document_status] ?? doc.document_status}
            </span>
          </div>
        </div>

        {/* Intake pipeline actions */}
        <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
          {intakeStatus === "uploaded" && (
            <button
              onClick={() => createIntakeJob.mutate({ caseId: doc.case_id, documentId: doc.id, jobType: "text_extraction" })}
              disabled={createIntakeJob.isPending}
              className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
            >
              <Play className="h-3.5 w-3.5" /> Start Text Extraction
            </button>
          )}
          {(intakeStatus === "text_extracted" || intakeStatus === "parsed") && (
            <button
              onClick={() => createIntakeJob.mutate({ caseId: doc.case_id, documentId: doc.id, jobType: "fact_extraction" })}
              disabled={createIntakeJob.isPending}
              className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
            >
              <Brain className="h-3.5 w-3.5" /> Extract Facts
            </button>
          )}
          {intakeStatus === "uploaded" && (
            <button
              onClick={() => createIntakeJob.mutate({ caseId: doc.case_id, documentId: doc.id, jobType: "duplicate_detection" })}
              disabled={createIntakeJob.isPending}
              className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-accent transition-colors disabled:opacity-50"
            >
              <Layers className="h-3.5 w-3.5" /> Check Duplicates
            </button>
          )}
          {hasPermission(role, "trigger_processing") && doc.document_status === "uploaded" && (
            <button
              onClick={() => triggerProcessing.mutate({ caseId: doc.case_id, documentId: doc.id })}
              disabled={triggerProcessing.isPending}
              className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-accent transition-colors disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" /> Legacy Processing
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Metadata */}
          <div className="card-elevated overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border bg-muted/30">
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Metadata</h2>
            </div>
            <div className="px-5 py-4 flex flex-col gap-2.5">
              <MetaRow label="File Type" value={doc.file_type} />
              <MetaRow label="File Size" value={formatBytes(doc.file_size_bytes)} />
              <MetaRow label="Pages" value={doc.page_count?.toString() ?? "—"} />
              <MetaRow label="Document Type" value={doc.document_type.replace(/_/g, " ")} />
              <MetaRow label="Status" value={DOC_STATUS_LABEL[doc.document_status] ?? doc.document_status} />
              <MetaRow label="Intake Status" value={INTAKE_STATUS_LABEL[intakeStatus as keyof typeof INTAKE_STATUS_LABEL] ?? intakeStatus} />
              <MetaRow label="Pipeline Stage" value={doc.pipeline_stage.replace(/_/g, " ")} />
              <MetaRow label="Uploaded" value={new Date(doc.created_at).toLocaleString()} />
              {doc.extracted_at && <MetaRow label="Extracted" value={new Date(doc.extracted_at).toLocaleString()} />}
            </div>
          </div>

          {/* Pipeline */}
          <div className="card-elevated overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border bg-muted/30">
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Processing Pipeline</h2>
            </div>
            <div className="px-5 py-4">
              <ProcessingPipeline currentStage={doc.pipeline_stage} documentStatus={doc.document_status} />
            </div>
          </div>

          {/* Document Pages */}
          {pages.length > 0 && (
            <div className="card-elevated overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border bg-muted/30">
                <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Extracted Pages ({pages.length})
                </h2>
              </div>
              <div className="px-5 py-4 flex flex-col gap-2 max-h-64 overflow-y-auto">
                {pages.map((page) => (
                  <div key={page.id} className="flex items-baseline justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider shrink-0">
                      Page {page.page_number}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                      {page.extracted_text ? `${page.extracted_text.slice(0, 60)}…` : "No text"}
                    </span>
                    {page.confidence_score != null && (
                      <span className="text-[10px] text-muted-foreground shrink-0">{Math.round(page.confidence_score * 100)}%</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Extracted Text */}
          <div className="card-elevated overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border bg-muted/30">
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Extracted Text</h2>
            </div>
            <div className="px-5 py-5">
              {doc.extracted_text ? (
                <pre className="text-xs text-foreground font-mono whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                  {doc.extracted_text}
                </pre>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No extracted text available. Start text extraction to process this document.
                </p>
              )}
            </div>
          </div>

          {/* Extracted Facts */}
          <div className="card-elevated overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border bg-muted/30">
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Extracted Facts ({facts.length})
              </h2>
            </div>
            <div className="px-5 py-4">
              {facts.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No facts extracted yet. Run fact extraction after text has been extracted.
                </p>
              ) : (
                <div className="flex flex-col gap-2.5 max-h-96 overflow-y-auto">
                  {facts.map((fact) => (
                    <FactCard key={fact.id} fact={fact} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Intake Jobs */}
          <div className="card-elevated overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border bg-muted/30">
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Intake Jobs ({intakeJobs.length})
              </h2>
            </div>
            <div className="px-5 py-4">
              {intakeJobsLoading ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : intakeJobs.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No intake jobs yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                        <th className="text-left py-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                        <th className="text-left py-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Retries</th>
                        <th className="text-left py-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Error</th>
                        <th className="text-right py-2 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {intakeJobs.map((job) => (
                        <tr key={job.id} className="border-b border-border/50 last:border-0">
                          <td className="py-2.5 px-2 font-medium text-foreground">
                            {INTAKE_JOB_TYPE_LABEL[job.job_type] ?? job.job_type}
                          </td>
                          <td className="py-2.5 px-2">
                            <span className={INTAKE_JOB_STATUS_STYLE[job.status] ?? "status-badge-draft"}>
                              {job.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-muted-foreground">{job.retry_count}/{job.max_retries}</td>
                          <td className="py-2.5 px-2 text-destructive truncate max-w-[200px]">{job.error_message || "—"}</td>
                          <td className="py-2.5 px-2 text-right">
                            {job.status === "failed" && (
                              <button
                                onClick={() => retryIntakeJob.mutate(job.id)}
                                className="text-[10px] font-medium text-primary hover:text-primary/80 flex items-center gap-1"
                              >
                                <RotateCcw className="h-3 w-3" /> Retry
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Legacy Jobs */}
          <JobsPanel jobs={jobs} loading={jobsLoading} />
        </div>
      </div>
    </div>
  );
};

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider shrink-0">{label}</span>
      <span className="text-xs text-foreground text-right capitalize">{value}</span>
    </div>
  );
}

function FactCard({ fact }: { fact: ExtractedFactRow }) {
  return (
    <div className="border border-border rounded-lg px-4 py-3">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {FACT_TYPE_LABEL[fact.fact_type] ?? fact.fact_type}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {fact.needs_review && (
            <span className="flex items-center gap-0.5 text-[10px] font-medium text-[hsl(var(--status-attention))]">
              <AlertTriangle className="h-3 w-3" /> Review
            </span>
          )}
          {fact.confidence_score != null && (
            <span className="text-[10px] text-muted-foreground">{Math.round(fact.confidence_score * 100)}%</span>
          )}
        </div>
      </div>
      <p className="text-xs text-foreground leading-relaxed">{fact.fact_text}</p>
      {fact.source_snippet && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground italic truncate">
            p.{fact.page_number ?? "?"} — "{fact.source_snippet}"
          </p>
        </div>
      )}
    </div>
  );
}

export default DocumentDetailPage;
