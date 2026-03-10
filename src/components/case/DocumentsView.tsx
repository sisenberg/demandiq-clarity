import type { CaseDocument } from "@/types";
import { DocumentStatus } from "@/types";

interface DocumentsViewProps {
  documents: CaseDocument[];
}

const statusConfig: Record<DocumentStatus, { label: string; className: string }> = {
  [DocumentStatus.Pending]: {
    label: "Pending",
    className: "bg-muted text-muted-foreground",
  },
  [DocumentStatus.Processing]: {
    label: "Processing",
    className: "bg-primary/10 text-primary",
  },
  [DocumentStatus.Extracted]: {
    label: "Extracted",
    className: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]",
  },
  [DocumentStatus.Failed]: {
    label: "Failed",
    className: "bg-destructive/10 text-destructive",
  },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DocumentsView = ({ documents }: DocumentsViewProps) => {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-lg font-semibold text-foreground">Documents</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {documents.length} documents
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-6 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                File
              </th>
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Pages
              </th>
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Size
              </th>
              <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => {
              const config = statusConfig[doc.status];
              return (
                <tr
                  key={doc.id}
                  className="border-b border-border hover:bg-accent/50 transition-colors"
                >
                  <td className="px-6 py-3">
                    <p className="font-medium text-foreground">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">{doc.fileType}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {doc.pageCount ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatBytes(doc.fileSizeBytes)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${config.className}`}
                    >
                      {config.label}
                    </span>
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

export default DocumentsView;
