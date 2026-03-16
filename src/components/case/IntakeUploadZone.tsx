import { useState, useRef, useCallback, useEffect } from "react";
import { useUploadDocuments, type UploadFileProgress } from "@/hooks/useDocuments";
import { Upload, X, FileText, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface IntakeUploadZoneProps {
  caseId: string;
  onUploadComplete?: () => void;
}

const IntakeUploadZone = ({ caseId, onUploadComplete }: IntakeUploadZoneProps) => {
  const uploadMutation = useUploadDocuments();
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [fileProgress, setFileProgress] = useState<UploadFileProgress[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    if (!isUploading) {
      setStagedFiles((prev) => [...prev, ...arr]);
    }
  }, [isUploading]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const removeStaged = (idx: number) =>
    setStagedFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleUpload = async () => {
    if (stagedFiles.length === 0 || isUploading) return;
    setIsUploading(true);

    const initialProgress: UploadFileProgress[] = stagedFiles.map((file) => ({
      file,
      status: "pending",
      progress: 0,
    }));
    setFileProgress(initialProgress);

    await uploadMutation.mutateAsync({
      caseId,
      files: stagedFiles,
      documentType: "other", // Auto-detect later
      onFileProgress: (idx, update) => {
        setFileProgress((prev) =>
          prev.map((p, i) => (i === idx ? { ...p, ...update } : p))
        );
      },
    });

    // Wait a beat then reset
    setTimeout(() => {
      setStagedFiles([]);
      setFileProgress([]);
      setIsUploading(false);
      onUploadComplete?.();
    }, 1500);
  };

  const completedCount = fileProgress.filter((f) => f.status === "done").length;
  const errorCount = fileProgress.filter((f) => f.status === "error").length;

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isUploading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          dragOver
            ? "border-primary bg-primary/5 shadow-[0_0_0_4px_hsl(var(--primary)/0.08)]"
            : "border-border hover:border-muted-foreground hover:bg-accent/30"
        } ${isUploading ? "pointer-events-none opacity-60" : ""}`}
      >
        <div className="h-10 w-10 rounded-xl bg-accent mx-auto flex items-center justify-center mb-3">
          <Upload className={`h-5 w-5 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <p className="text-sm font-medium text-foreground">
          Drop files here or click to browse
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, DOCX, JPG, JPEG, PNG, WEBP — up to 20MB each
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {/* Staged file list OR upload progress */}
      {(stagedFiles.length > 0 || fileProgress.length > 0) && (
        <div className="card-elevated overflow-hidden">
          {/* Upload header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">
                {isUploading
                  ? `Uploading ${completedCount}/${fileProgress.length}`
                  : `${stagedFiles.length} file${stagedFiles.length !== 1 ? "s" : ""} ready`}
              </span>
              {errorCount > 0 && (
                <span className="text-[10px] font-medium text-destructive flex items-center gap-0.5">
                  <AlertTriangle className="h-3 w-3" /> {errorCount} failed
                </span>
              )}
            </div>
            {!isUploading && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStagedFiles([])}
                  className="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear All
                </button>
                <button
                  onClick={handleUpload}
                  className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload All
                </button>
              </div>
            )}
          </div>

          {/* File rows */}
          <div className="divide-y divide-border/50 max-h-60 overflow-y-auto">
            {(isUploading ? fileProgress : stagedFiles.map((f) => ({ file: f, status: "pending" as const, progress: 0 }))).map(
              (item, idx) => (
                <div key={idx} className="px-4 py-2.5 flex items-center gap-3">
                  {/* Icon / status */}
                  <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
                    {item.status === "done" ? (
                      <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-approved))]" />
                    ) : item.status === "error" ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : item.status === "uploading" || item.status === "creating_record" ? (
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{item.file.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{formatBytes(item.file.size)}</span>
                      {item.status === "uploading" && (
                        <span className="text-[10px] text-primary font-medium">Uploading…</span>
                      )}
                      {item.status === "creating_record" && (
                        <span className="text-[10px] text-primary font-medium">Creating record…</span>
                      )}
                      {item.status === "done" && (
                        <span className="text-[10px] text-[hsl(var(--status-approved-foreground))] font-medium">Done</span>
                      )}
                      {item.status === "error" && (
                        <span className="text-[10px] text-destructive font-medium truncate max-w-[200px]">
                          {(item as UploadFileProgress).error || "Failed"}
                        </span>
                      )}
                    </div>
                    {/* Progress bar */}
                    {isUploading && item.status !== "pending" && (
                      <div className="mt-1.5 h-1 w-full bg-accent rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            item.status === "error" ? "bg-destructive" :
                            item.status === "done" ? "bg-[hsl(var(--status-approved))]" : "bg-primary"
                          }`}
                          style={{ width: `${(item as UploadFileProgress).progress ?? 0}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Remove button (only when not uploading) */}
                  {!isUploading && (
                    <button
                      onClick={() => removeStaged(idx)}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default IntakeUploadZone;
