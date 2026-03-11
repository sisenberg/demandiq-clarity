import { useParams, Link } from "react-router-dom";
import { useDocument } from "@/hooks/useDocuments";
import { useDocumentJobs } from "@/hooks/useJobs";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { useTriggerProcessing } from "@/hooks/useJobs";
import ProcessingPipeline from "@/components/case/ProcessingPipeline";
import JobsPanel from "@/components/case/JobsPanel";
import DocumentTypeTag from "@/components/case/DocumentTypeTag";
import { ArrowLeft, FileText, Play } from "lucide-react";

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

const DocumentDetailPage = () => {
  const { docId } = useParams<{ docId: string }>();
  const { role } = useAuth();
  const { data: doc, isLoading } = useDocument(docId);
  const { data: jobs = [], isLoading: jobsLoading } = useDocumentJobs(docId);
  const triggerProcessing = useTriggerProcessing();

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

  return (
    <div className="p-8 max-w-6xl">
      <Link to={`/cases/${doc.case_id}`} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 mb-5 font-medium transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Case
      </Link>

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
          <span className={DOC_STATUS_BADGE[doc.document_status] ?? "status-badge-draft"}>
            {DOC_STATUS_LABEL[doc.document_status] ?? doc.document_status}
          </span>
        </div>

        {hasPermission(role, "trigger_processing") && doc.document_status === "uploaded" && (
          <div className="mt-4 pt-4 border-t border-border">
            <button
              onClick={() => triggerProcessing.mutate({ caseId: doc.case_id, documentId: doc.id })}
              disabled={triggerProcessing.isPending}
              className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
            >
              <Play className="h-3.5 w-3.5" /> Trigger Processing
            </button>
          </div>
        )}
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
                  No extracted text available. Trigger processing to extract text from this document.
                </p>
              )}
            </div>
          </div>

          {/* Page Preview */}
          <div className="card-elevated overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border bg-muted/30">
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Page Preview</h2>
            </div>
            <div className="px-5 py-8 text-center">
              <p className="text-xs text-muted-foreground">
                Page-level previews will appear here once processing is complete.
              </p>
            </div>
          </div>

          {/* Jobs */}
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

export default DocumentDetailPage;
