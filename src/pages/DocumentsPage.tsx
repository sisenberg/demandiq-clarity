import { Link } from "react-router-dom";
import { useAllDocuments, type DocumentRow } from "@/hooks/useDocuments";
import { useCases } from "@/hooks/useCases";
import { FileText } from "lucide-react";
import DocumentTypeTag from "@/components/case/DocumentTypeTag";

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

const DocumentsPage = () => {
  const { data: documents = [], isLoading } = useAllDocuments();
  const { data: cases = [] } = useCases();

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Documents</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isLoading ? "Loading…" : `${documents.length} documents across all cases`}
        </p>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {documents.length === 0 && !isLoading ? (
          <div className="px-4 py-12 text-center">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No documents yet. Upload documents from a case.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">File</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Case</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Size</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Pipeline</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {documents.map((doc) => {
                const parentCase = cases.find((c) => c.id === doc.case_id);
                return (
                  <tr key={doc.id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/documents/${doc.id}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-foreground">{doc.file_name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {parentCase ? (
                        <Link to={`/cases/${parentCase.id}`} className="text-xs text-primary hover:underline">
                          {parentCase.case_number}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">{doc.case_id}</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><DocumentTypeTag type={doc.document_type} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{formatBytes(doc.file_size_bytes)}</td>
                    <td className="px-4 py-3">
                      <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-foreground">
                        {doc.pipeline_stage.replace(/_/g, " ")}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <span className={DOC_STATUS_BADGE[doc.document_status] ?? "status-badge-draft"}>
                        {DOC_STATUS_LABEL[doc.document_status] ?? doc.document_status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default DocumentsPage;
