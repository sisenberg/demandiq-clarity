import { mockDocuments, mockCases } from "@/data/mock/index";
import { DocumentStatus } from "@/types";
import { FileText } from "lucide-react";

const statusConfig: Record<DocumentStatus, { label: string; className: string }> = {
  [DocumentStatus.Pending]: { label: "Pending", className: "bg-muted text-muted-foreground" },
  [DocumentStatus.Processing]: { label: "Processing", className: "bg-primary/10 text-primary" },
  [DocumentStatus.Extracted]: { label: "Extracted", className: "status-badge-approved" },
  [DocumentStatus.Failed]: { label: "Failed", className: "bg-destructive/10 text-destructive" },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DocumentsPage = () => {
  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Documents</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{mockDocuments.length} documents across all cases</p>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">File</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Case</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Pages</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Size</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {mockDocuments.map((doc) => {
              const config = statusConfig[doc.document_status];
              const parentCase = mockCases.find((c) => c.id === doc.case_id);
              return (
                <tr key={doc.id} className="hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground">{doc.file_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{parentCase?.case_number ?? doc.case_id}</td>
                  <td className="px-4 py-3 text-muted-foreground">{doc.page_count ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatBytes(doc.file_size_bytes)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${config.className}`}>{config.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DocumentsPage;
