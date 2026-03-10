import { useState, useRef, useCallback } from "react";
import { useUploadDocuments } from "@/hooks/useDocuments";
import { Upload, X, FileText } from "lucide-react";

const DOCUMENT_TYPES = [
  { value: "medical_record", label: "Medical Record" },
  { value: "police_report", label: "Police Report" },
  { value: "legal_filing", label: "Legal Filing" },
  { value: "correspondence", label: "Correspondence" },
  { value: "billing_record", label: "Billing Record" },
  { value: "imaging_report", label: "Imaging Report" },
  { value: "insurance_document", label: "Insurance Document" },
  { value: "employment_record", label: "Employment Record" },
  { value: "expert_report", label: "Expert Report" },
  { value: "photograph", label: "Photograph" },
  { value: "other", label: "Other" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentUploadProps {
  caseId: string;
  open: boolean;
  onClose: () => void;
}

const DocumentUpload = ({ caseId, open, onClose }: DocumentUploadProps) => {
  const uploadMutation = useUploadDocuments();
  const [files, setFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState("other");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    setFiles((prev) => [...prev, ...Array.from(newFiles)]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleUpload = async () => {
    if (files.length === 0) return;
    await uploadMutation.mutateAsync({ caseId, files, documentType });
    setFiles([]);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/20" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-lg shadow-lg w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Upload Documents</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
            }`}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-foreground font-medium">
              Drop files here or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, JPG, PNG — up to 20MB each</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.tiff"
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </div>

          {/* Document type selector */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Document Type</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {DOCUMENT_TYPES.map((dt) => (
                <option key={dt.value} value={dt.value}>{dt.label}</option>
              ))}
            </select>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="border border-border rounded-md divide-y divide-border max-h-48 overflow-y-auto">
              {files.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-foreground truncate">{file.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{formatBytes(file.size)}</span>
                  </div>
                  <button onClick={() => removeFile(idx)} className="text-muted-foreground hover:text-destructive shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button onClick={onClose} className="px-4 py-2 text-xs font-medium rounded-md border border-border bg-card text-foreground hover:bg-accent transition-colors">
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={files.length === 0 || uploadMutation.isPending}
              className="px-4 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {uploadMutation.isPending ? "Uploading…" : `Upload ${files.length} file${files.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentUpload;
