import React from "react";
import { CaseDocument, DocumentStatus } from "@/types";

interface DocumentsViewProps {
  documents: CaseDocument[];
}

const statusLabel: Record<DocumentStatus, string> = {
  [DocumentStatus.Uploading]: "Uploading",
  [DocumentStatus.Processing]: "Processing",
  [DocumentStatus.Extracted]: "Extracted",
  [DocumentStatus.ReviewNeeded]: "Review Needed",
  [DocumentStatus.Verified]: "Verified",
  [DocumentStatus.Error]: "Error",
};

const statusClass: Record<DocumentStatus, string> = {
  [DocumentStatus.Uploading]: "status-badge-draft",
  [DocumentStatus.Processing]: "status-badge-draft",
  [DocumentStatus.Extracted]: "status-badge-draft",
  [DocumentStatus.ReviewNeeded]: "status-badge-review",
  [DocumentStatus.Verified]: "status-badge-approved",
  [DocumentStatus.Error]:
    "text-xs font-medium px-2 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/30",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DocumentsView: React.FC<DocumentsViewProps> = ({ documents }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Documents</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {documents.length} source documents
          </p>
        </div>
        <button className="text-xs font-medium px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          Upload Document
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-6 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                File Name
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Pages
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Size
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Uploaded
              </th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr
                key={doc.id}
                className="border-b border-border hover:bg-accent/50 cursor-pointer transition-colors"
              >
                <td className="px-6 py-3">
                  <span className="text-sm font-medium text-foreground">
                    {doc.fileName}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={statusClass[doc.status]}>
                    {statusLabel[doc.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-mono text-muted-foreground">
                    {doc.pageCount ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-mono text-muted-foreground">
                    {formatFileSize(doc.fileSize)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-mono text-muted-foreground">
                    {new Date(doc.uploadedAt).toLocaleDateString()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DocumentsView;
