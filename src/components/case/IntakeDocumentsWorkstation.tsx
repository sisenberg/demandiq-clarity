import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { type DocumentRow, useDeleteDocument } from "@/hooks/useDocuments";
import { useRetryIntakeJob, useCaseIntakeJobs } from "@/hooks/useIntakeJobs";
import { useInvokeExtraction, useTriggerCaseExtraction } from "@/hooks/useExtraction";
import { useCaseDuplicateFlags } from "@/hooks/useDuplicateFlags";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { supabase } from "@/integrations/supabase/client";
import DocumentReviewWorkspace from "./DocumentReviewWorkspace";
import {
  getIntakeBadge,
  INTAKE_STATUS_LABEL,
  INTAKE_PROCESSING_STATUSES,
  isIntakeProcessing,
  isIntakeComplete,
  getPipelineStageLabel,
} from "@/lib/statuses";
import IntakeUploadZone from "./IntakeUploadZone";
import IntakeSummaryPanel from "./IntakeSummaryPanel";
import DocumentTypeTag from "./DocumentTypeTag";
import DocumentMetadataPanel from "./DocumentMetadataPanel";
import {
  Search,
  X,
  FileText,
  Filter,
  ChevronRight,
  ExternalLink,
  Trash2,
  RotateCcw,
  Eye,
  Download,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Copy,
  Inbox,
  Upload,
  Zap,
  Pencil,
} from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type SortMode = "chronological" | "type" | "status";

interface IntakeDocumentsWorkstationProps {
  documents: DocumentRow[];
  loading: boolean;
  caseId: string;
}

const IntakeDocumentsWorkstation = ({ documents, loading, caseId }: IntakeDocumentsWorkstationProps) => {
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("chronological");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [reviewDocId, setReviewDocId] = useState<string | null>(null);

  const deleteDoc = useDeleteDocument();
  const triggerExtraction = useTriggerCaseExtraction();
  const invokeExtraction = useInvokeExtraction();
  const retryIntakeJob = useRetryIntakeJob();
  const { data: intakeJobs = [] } = useCaseIntakeJobs(caseId);
  const { data: duplicateFlags = [] } = useCaseDuplicateFlags(caseId);

  const queuedExtractionCount = intakeJobs.filter(
    (j) => j.job_type === "text_extraction" && j.status === "queued"
  ).length;
  const runningJobCount = intakeJobs.filter(
    (j) => j.status === "running"
  ).length;

  // Build a set of doc IDs that have duplicate flags
  const duplicateDocIds = useMemo(() => {
    const ids = new Set<string>();
    duplicateFlags.filter((f) => f.flag_status === "flagged").forEach((f) => {
      ids.add(f.document_id);
      ids.add(f.duplicate_of_document_id);
    });
    return ids;
  }, [duplicateFlags]);

  // Filter
  const filtered = useMemo(() => {
    let items = documents;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((d) => d.file_name.toLowerCase().includes(q) || d.document_type.toLowerCase().includes(q));
    }
    if (filterType) items = items.filter((d) => d.document_type === filterType);
    if (filterStatus) items = items.filter((d) => d.intake_status === filterStatus);
    return items;
  }, [documents, search, filterType, filterStatus]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortMode) {
      case "chronological": return arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case "type": return arr.sort((a, b) => a.document_type.localeCompare(b.document_type));
      case "status": return arr.sort((a, b) => a.intake_status.localeCompare(b.intake_status));
    }
  }, [filtered, sortMode]);

  const types = [...new Set(documents.map((d) => d.document_type))];
  const selectedDoc = selectedDocId ? documents.find((d) => d.id === selectedDocId) : null;

  // COMPLIANCE: View-original uses a short-lived signed URL (120s).
  // PRIMARY EVIDENCE ZONE — raw uploaded document (L4 restricted_phi).
  // Storage RLS enforces tenant-scoped access.
  const handleViewOriginal = async (doc: DocumentRow) => {
    if (!doc.storage_path) return;
    const { data } = await supabase.storage.from("case-documents").createSignedUrl(doc.storage_path, 120);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
      // Audit: track document access / signed URL for compliance evidence
      auditLog.mutate({
        actionType: "signed_url_generated",
        entityType: "case_document",
        entityId: doc.id,
        caseId,
        afterValue: { ttl: 120, purpose: "view_original" },
      });
    }
  };

  // If reviewing a document, show the review workspace full-width
  if (reviewDocId) {
    return (
      <div className="card-elevated overflow-hidden" style={{ height: "calc(100vh - 180px)" }}>
        <DocumentReviewWorkspace
          documentId={reviewDocId}
          caseId={caseId}
          onBack={() => setReviewDocId(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Intake Summary */}
      <IntakeSummaryPanel documents={documents} loading={loading} />

      {/* Actions bar */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
          Document Intake
          {runningJobCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-primary normal-case tracking-normal">
              <Loader2 className="h-3 w-3 animate-spin" /> {runningJobCount} processing
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {queuedExtractionCount > 0 && (
            <button
              onClick={() => triggerExtraction.mutate(caseId)}
              disabled={triggerExtraction.isPending}
              className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              <Zap className="h-3.5 w-3.5" />
              {triggerExtraction.isPending ? "Starting…" : `Extract ${queuedExtractionCount} Doc${queuedExtractionCount !== 1 ? "s" : ""}`}
            </button>
          )}
          <button
            onClick={() => setShowUploadZone(!showUploadZone)}
            className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Upload className="h-3.5 w-3.5" />
            {showUploadZone ? "Hide Upload" : "Upload Documents"}
          </button>
        </div>
      </div>

      {/* Upload zone */}
      {showUploadZone && (
        <IntakeUploadZone caseId={caseId} onUploadComplete={() => setShowUploadZone(false)} />
      )}

      {/* Document list */}
      <div className="card-elevated overflow-hidden flex flex-col" style={{ minHeight: "400px" }}>
        {/* Controls header */}
        <div className="px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-semibold text-foreground flex-1">
              Documents <span className="text-muted-foreground font-normal">({documents.length})</span>
            </span>

            {/* Sort pills */}
            <div className="flex gap-px bg-accent rounded-lg p-0.5">
              {([
                { key: "chronological" as SortMode, label: "Recent" },
                { key: "type" as SortMode, label: "Type" },
                { key: "status" as SortMode, label: "Status" },
              ]).map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSortMode(s.key)}
                  className={`px-2 py-1 text-[10px] font-medium rounded-md transition-all ${
                    sortMode === s.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-lg border transition-all ${
                showFilters || filterType || filterStatus ? "bg-primary/10 text-primary border-primary/20" : "bg-accent/40 text-muted-foreground border-border"
              }`}
            >
              <Filter className="h-3 w-3" /> Filters
            </button>

            <div className="relative w-44">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-7 pr-7 py-1.5 text-[11px] bg-accent/40 border border-border rounded-lg text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-primary/30"
              />
              {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="h-3 w-3 text-muted-foreground" /></button>}
            </div>
          </div>

          {showFilters && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="text-[10px] bg-accent border border-border rounded px-2 py-1 text-foreground outline-none">
                <option value="">All Types</option>
                {types.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-[10px] bg-accent border border-border rounded px-2 py-1 text-foreground outline-none">
                <option value="">All Intake Statuses</option>
                {Object.entries(INTAKE_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              {(filterType || filterStatus) && (
                <button onClick={() => { setFilterType(""); setFilterStatus(""); }} className="text-[10px] text-primary font-medium">Clear</button>
              )}
            </div>
          )}
        </div>

        {/* List body */}
        <div className="flex flex-1 min-h-0">
          {/* Left: document rows */}
          <div className={`flex flex-col min-w-0 overflow-y-auto ${selectedDoc ? "w-[55%] border-r border-border" : "flex-1"}`}>
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => <div key={i} className="animate-pulse h-16 bg-accent rounded-lg" />)}
              </div>
            ) : sorted.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="h-14 w-14 rounded-2xl bg-accent flex items-center justify-center mb-4">
                  <Inbox className="h-7 w-7 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  {documents.length === 0 ? "No documents yet" : "No matches"}
                </p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {documents.length === 0
                    ? "Upload medical records, police reports, and other case documents to start building your demand."
                    : "Try adjusting your search or filter criteria."}
                </p>
                {documents.length === 0 && (
                  <button
                    onClick={() => setShowUploadZone(true)}
                    className="mt-4 flex items-center gap-1.5 text-xs font-medium px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    <Upload className="h-3.5 w-3.5" /> Upload Documents
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {sorted.map((doc) => {
                  const intakeBadge = getIntakeBadge(doc.intake_status);
                  const isSelected = selectedDocId === doc.id;
                  const isDuplicate = duplicateDocIds.has(doc.id);
                  const isFailed = doc.intake_status === "failed";
                  const isProcessing = isIntakeProcessing(doc.intake_status);

                  return (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedDocId(isSelected ? null : doc.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-accent/20 transition-colors flex items-start gap-3 ${
                        isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""
                      } ${isFailed ? "bg-[hsl(var(--status-failed-bg))]/30" : ""}`}
                    >
                      <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center shrink-0 relative">
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 text-primary animate-spin" />
                        ) : isFailed ? (
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                        ) : isIntakeComplete(doc.intake_status) ? (
                          <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-approved))]" />
                        ) : (
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        )}
                        {isDuplicate && (
                          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[hsl(var(--status-attention))] flex items-center justify-center">
                            <Copy className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[12px] font-semibold text-foreground truncate">{doc.file_name}</p>
                          {isDuplicate && (
                            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention-foreground))] shrink-0">
                              Duplicate?
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <DocumentTypeTag type={doc.document_type} />
                          <span className="text-[10px] text-muted-foreground">{formatBytes(doc.file_size_bytes)}</span>
                          {doc.page_count && <span className="text-[10px] text-muted-foreground">{doc.page_count} pg</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${intakeBadge.className}`}>
                            {intakeBadge.label}
                          </span>
                          <span className="text-[9px] text-muted-foreground">{formatDate(doc.created_at)}</span>
                        </div>
                      </div>

                      <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-1 transition-transform ${isSelected ? "rotate-90 text-primary" : ""}`} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: detail panel */}
          {selectedDoc && (
            <div className="flex-1 flex flex-col min-w-0 bg-background">
              <div className="px-4 py-3 border-b border-border bg-card shrink-0">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-foreground truncate">{selectedDoc.file_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <DocumentTypeTag type={selectedDoc.document_type} />
                      <span className="text-[10px] text-muted-foreground">{formatBytes(selectedDoc.file_size_bytes)}</span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedDocId(null)} className="p-1 rounded text-muted-foreground hover:text-foreground shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Metadata */}
                <div className="grid grid-cols-2 gap-3">
                  <MetaItem label="Intake Status" value={getIntakeBadge(selectedDoc.intake_status).label} />
                  <MetaItem label="Pipeline" value={getPipelineStageLabel(selectedDoc.pipeline_stage)} />
                  <MetaItem label="Uploaded" value={formatDate(selectedDoc.created_at)} />
                  <MetaItem label="Pages" value={selectedDoc.page_count?.toString() ?? "—"} />
                </div>

                {/* AI Classification & Metadata Panel */}
                <DocumentMetadataPanel
                  documentId={selectedDoc.id}
                  currentDocumentType={selectedDoc.document_type}
                  intakeStatus={selectedDoc.intake_status}
                />

                {/* Duplicate warning */}
                {duplicateDocIds.has(selectedDoc.id) && (
                  <div className="rounded-lg border border-[hsl(var(--status-attention))]/30 bg-[hsl(var(--status-attention-bg))] px-4 py-3 flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-attention))] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-foreground">Suspected Duplicate</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        This document may be a duplicate of another file in this case. Review the content to confirm.
                      </p>
                    </div>
                  </div>
                )}

                {/* Failed error state with retry */}
                {selectedDoc.intake_status === "failed" && (() => {
                  const failedJob = intakeJobs.find(
                    (j) => j.document_id === selectedDoc.id && j.status === "failed"
                  );
                  return (
                    <div className="rounded-lg border border-destructive/30 bg-[hsl(var(--status-failed-bg))] px-4 py-3">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs font-medium text-foreground">Processing Failed</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {failedJob?.error_message || "Text extraction failed. You can retry or upload a new version."}
                          </p>
                        </div>
                      </div>
                      {failedJob && (
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            onClick={() => {
                              retryIntakeJob.mutate(failedJob.id, {
                                onSuccess: () => {
                                  // Re-invoke extraction after retry
                                  setTimeout(() => invokeExtraction.mutate(failedJob.id), 500);
                                },
                              });
                            }}
                            disabled={retryIntakeJob.isPending}
                            className="flex items-center gap-1 text-[10px] font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                          >
                            <RotateCcw className="h-3 w-3" /> Retry Extraction
                          </button>
                          <span className="text-[9px] text-muted-foreground">
                            {failedJob.retry_count}/{failedJob.max_retries} retries used
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Hash */}
                {selectedDoc.file_hash && (
                  <div className="rounded-lg border border-border bg-card p-2.5">
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest block mb-0.5">SHA-256</span>
                    <code className="text-[10px] text-muted-foreground font-mono break-all">{selectedDoc.file_hash}</code>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setReviewDocId(selectedDoc.id)}
                    className="flex items-center gap-1.5 text-[10px] font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    <Pencil className="h-3 w-3" /> Review & Correct
                  </button>
                  <button
                    onClick={() => handleViewOriginal(selectedDoc)}
                    disabled={!selectedDoc.storage_path}
                    className="flex items-center gap-1.5 text-[10px] font-medium px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    <Eye className="h-3 w-3" /> View Original
                  </button>
                  <Link
                    to={`/documents/${selectedDoc.id}`}
                    className="flex items-center gap-1.5 text-[10px] font-medium px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-accent transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" /> Full Detail
                  </Link>
                  {confirmDelete === selectedDoc.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          deleteDoc.mutate({ docId: selectedDoc.id, storagePath: selectedDoc.storage_path });
                          setSelectedDocId(null);
                          setConfirmDelete(null);
                        }}
                        className="flex items-center gap-1 text-[10px] font-medium px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                      >
                        Confirm Delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-[10px] font-medium text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(selectedDoc.id)}
                      className="flex items-center gap-1.5 text-[10px] font-medium px-3 py-1.5 rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/5 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest block mb-0.5">{label}</span>
      <span className="text-[12px] font-medium text-foreground capitalize">{value}</span>
    </div>
  );
}

export default IntakeDocumentsWorkstation;
