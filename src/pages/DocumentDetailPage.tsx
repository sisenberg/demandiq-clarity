import { useParams, Link } from "react-router-dom";
import { useDocument, type DocumentRow } from "@/hooks/useDocuments";
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
    return <div className="p-6"><p className="text-sm text-muted-foreground">Loading…</p></div>;
  }

  if (!doc) {
    return (
      <div className="p-6">
        <Link to="/documents" className="text-sm text-primary hover:underline flex items-center gap-1 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Documents
        </Link>
        <p className="text-sm text-muted-foreground">Document not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      {/* Back link */}
      <Link to={`/cases/${doc.case_id}`} className="text-sm text-primary hover:underline flex items-center gap-1 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Case
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">{doc.file_name}</h1>
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

      {/* Action bar */}
      {hasPermission(role, "trigger_processing") && doc.document_status === "uploaded" && (
        <div className="mb-6">
          <button
            onClick={() => triggerProcessing.mutate({ caseId: doc.case_id, documentId: doc.id })}
            disabled={triggerProcessing.isPending}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" /> Trigger Processing
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Metadata + Pipeline */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Metadata */}
          <div className="border border-border rounded-lg bg-card">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Metadata</h2>
            </div>
            <div className="px-4 py-3 flex flex-col gap-2">
              <MetaRow label="File Type" value={doc.file_type} />
              <MetaRow label="File Size" value={formatBytes(doc.file_size_bytes)} />
              <MetaRow label="Pages" value={doc.page_count?.toString() ?? "—"} />
              <MetaRow label="Document Type" value={doc.document_type} />
              <MetaRow label="Status" value={DOC_STATUS_LABEL[doc.document_status] ?? doc.document_status} />
              <MetaRow label="Pipeline Stage" value={doc.pipeline_stage.replace(/_/g, " ")} />
              <MetaRow label="Uploaded" value={new Date(doc.created_at).toLocaleString()} />
              {doc.extracted_at && <MetaRow label="Extracted" value={new Date(doc.extracted_at).toLocaleString()} />}
            </div>
          </div>

          {/* Processing Pipeline */}
          <div className="border border-border rounded-lg bg-card">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Processing Pipeline</h2>
            </div>
            <div className="px-4 py-3">
              <ProcessingPipeline currentStage={doc.pipeline_stage} documentStatus={doc.document_status} />
            </div>
          </div>
        </div>

        {/* Right: Content + Jobs */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Extracted Text Preview */}
          <div className="border border-border rounded-lg bg-card">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Extracted Text</h2>
            </div>
            <div className="px-4 py-4">
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

          {/* Page/Chunk Preview (placeholder) */}
          <div className="border border-border rounded-lg bg-card">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Page Preview</h2>
            </div>
            <div className="px-4 py-6 text-center">
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
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider shrink-0">{label}</span>
      <span className="text-xs text-foreground text-right">{value}</span>
    </div>
  );
}

export default DocumentDetailPage;
