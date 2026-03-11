import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useDocument } from "@/hooks/useDocuments";
import { useDocumentPages } from "@/hooks/useDocumentPages";
import { useDocumentExtractedFacts } from "@/hooks/useExtractedFacts";
import {
  useDocumentTypeSuggestions,
  useDocumentMetadataExtractions,
  useAcceptTypeSuggestion,
  useCorrectMetadata,
  useAcceptMetadata,
  useClassifyDocument,
  METADATA_FIELD_LABEL,
  type MetadataExtractionRow,
} from "@/hooks/useDocumentClassification";
import {
  useCaseChronologyCandidates,
  useUpdateCandidateStatus,
  useEditCandidate,
  CHRONO_CATEGORY_LABEL,
  type ChronologyCandidateRow,
} from "@/hooks/useChronologyCandidates";
import { useAuditLog } from "@/hooks/useAuditLog";
import { ConfidenceBadge } from "@/components/case/DocumentMetadataPanel";
import { DOCUMENT_TYPE_LABEL, INTAKE_STATUS_LABEL } from "@/lib/statuses";
import type { DocumentPageRow } from "@/types/intake";
import type { ExtractedFactRow } from "@/types/intake";
import { FACT_TYPE_LABEL } from "@/types/intake";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Eye,
  Pencil,
  Check,
  X,
  AlertTriangle,
  Quote,
  Sparkles,
  Loader2,
  Clock,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DocumentReviewWorkspaceProps {
  documentId: string;
  caseId: string;
  onBack?: () => void;
}

const DocumentReviewWorkspace = ({ documentId, caseId, onBack }: DocumentReviewWorkspaceProps) => {
  const { data: doc, isLoading: docLoading } = useDocument(documentId);
  const { data: pages = [], isLoading: pagesLoading } = useDocumentPages(documentId);
  const { data: facts = [] } = useDocumentExtractedFacts(documentId);
  const { data: typeSuggestions = [] } = useDocumentTypeSuggestions(documentId);
  const { data: metaExtractions = [] } = useDocumentMetadataExtractions(documentId);
  const { data: chronoCandidates = [] } = useCaseChronologyCandidates(caseId);
  const classifyDoc = useClassifyDocument();
  const acceptType = useAcceptTypeSuggestion();
  const correctMeta = useCorrectMetadata();
  const acceptMeta = useAcceptMetadata();
  const updateChronoStatus = useUpdateCandidateStatus();
  const editChronoCandidate = useEditCandidate();
  const auditLog = useAuditLog();

  const [activePage, setActivePage] = useState(1);
  const [rightTab, setRightTab] = useState<"text" | "metadata" | "facts" | "chronology">("text");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const textPanelRef = useRef<HTMLDivElement>(null);
  const pdfRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter chronology to this document's events
  const docChronoCandidates = useMemo(
    () => chronoCandidates.filter((c) => c.source_document_id === documentId && c.status !== "merged"),
    [chronoCandidates, documentId]
  );

  // Sign PDF URL with auto-refresh before expiration (sign for 600s, refresh at 480s)
  const signPdfUrl = useCallback(async (storagePath: string) => {
    const { data } = await supabase.storage.from("case-documents").createSignedUrl(storagePath, 600);
    if (data?.signedUrl) setPdfUrl(data.signedUrl);
    // Schedule refresh 2 minutes before expiry
    if (pdfRefreshTimer.current) clearTimeout(pdfRefreshTimer.current);
    pdfRefreshTimer.current = setTimeout(() => signPdfUrl(storagePath), 480_000);
  }, []);

  useEffect(() => {
    if (!doc?.storage_path) return;
    signPdfUrl(doc.storage_path);
    return () => { if (pdfRefreshTimer.current) clearTimeout(pdfRefreshTimer.current); };
  }, [doc?.storage_path, signPdfUrl]);

  // Escape key to close workspace (only when not editing)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      onBack?.();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onBack]);

  const currentPage = pages.find((p) => p.page_number === activePage);
  const totalPages = pages.length || doc?.page_count || 0;

  // Jump to page from extracted item
  const jumpToPage = (pageNum: number) => {
    setActivePage(pageNum);
    setRightTab("text");
  };

  if (docLoading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Loading document…</span>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <AlertTriangle className="h-6 w-6 opacity-40" />
        <p className="text-xs">Document not found</p>
        {onBack && (
          <button onClick={onBack} className="text-xs text-primary hover:underline mt-1">← Back to list</button>
        )}
      </div>
    );
  }

  const intakeStatus = (doc as any).intake_status || "uploaded";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="panel-header justify-between shrink-0">
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}
          <FileText className="h-3.5 w-3.5 text-primary" />
          <h2 className="panel-header-title truncate max-w-[300px]">{doc.file_name}</h2>
          <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
            {DOCUMENT_TYPE_LABEL[doc.document_type as keyof typeof DOCUMENT_TYPE_LABEL] ?? doc.document_type}
          </span>
          <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${
            intakeStatus === "parsed" || intakeStatus === "text_extracted"
              ? "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]"
              : intakeStatus === "failed" ? "bg-destructive/10 text-destructive"
              : "bg-accent text-muted-foreground"
          }`}>
            {INTAKE_STATUS_LABEL[intakeStatus as keyof typeof INTAKE_STATUS_LABEL] ?? intakeStatus}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Page nav */}
          <div className="flex items-center gap-1 bg-accent/60 rounded-lg px-1.5 py-0.5">
            <button
              onClick={() => setActivePage(Math.max(1, activePage - 1))}
              disabled={activePage <= 1}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <span className="text-[10px] font-medium text-foreground tabular-nums min-w-[60px] text-center">
              Page {activePage} / {totalPages}
            </span>
            <button
              onClick={() => setActivePage(Math.min(totalPages, activePage + 1))}
              disabled={activePage >= totalPages}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn-ghost">
              <Eye className="h-3 w-3" /> PDF
            </a>
          )}
        </div>
      </div>

      {/* Split pane — responsive: stack on narrow, side-by-side on wide */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
        {/* Left: Document viewer */}
        <div className="w-full lg:w-1/2 flex flex-col border-b lg:border-b-0 lg:border-r border-border bg-muted/20 min-h-[40vh] lg:min-h-0">
          {/* Page thumbnails strip */}
          <div className="flex gap-1 px-3 py-2 border-b border-border overflow-x-auto shrink-0">
            {pages.slice(0, 50).map((page) => (
              <button
                key={page.id}
                onClick={() => setActivePage(page.page_number)}
                className={`shrink-0 px-2 py-1 rounded text-[9px] font-medium transition-colors ${
                  activePage === page.page_number
                    ? "bg-primary text-primary-foreground"
                    : "bg-accent text-muted-foreground hover:text-foreground hover:bg-accent/80"
                }`}
              >
                {page.page_number}
              </button>
            ))}
          </div>

          {/* Page content */}
          <div className="flex-1 overflow-y-auto p-4">
            {pdfUrl ? (
              <iframe
                src={`${pdfUrl}#page=${activePage}`}
                className="w-full h-full rounded-lg border border-border bg-card"
                title={`Document page ${activePage}`}
              />
            ) : currentPage?.extracted_text ? (
              <div className="bg-card rounded-lg border border-border p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">
                    Page {currentPage.page_number} — OCR Text
                  </span>
                  {currentPage.confidence_score != null && (
                    <ConfidenceBadge confidence={currentPage.confidence_score} />
                  )}
                </div>
                <pre className="text-xs text-foreground font-mono whitespace-pre-wrap leading-relaxed">
                  {currentPage.extracted_text}
                </pre>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileText className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-[11px]">No preview available for this page</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Review panels */}
        <div className="w-1/2 flex flex-col min-w-0">
          {/* Tab bar */}
          <div className="pill-toggle-group mx-3 mt-2.5 mb-1">
            {([
              { key: "text" as const, label: "Text", count: pages.length },
              { key: "metadata" as const, label: "Metadata", count: metaExtractions.length },
              { key: "facts" as const, label: "Facts", count: facts.length },
              { key: "chronology" as const, label: "Chronology", count: docChronoCandidates.length },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setRightTab(tab.key)}
                className={rightTab === tab.key ? "pill-toggle-active" : "pill-toggle-inactive"}
              >
                {tab.label}
                {tab.count > 0 && <span className="ml-1 text-[8px] opacity-60">{tab.count}</span>}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto px-3 py-2" ref={textPanelRef}>
            {rightTab === "text" && (
              <TextPanel pages={pages} activePage={activePage} onJumpToPage={jumpToPage} />
            )}
            {rightTab === "metadata" && (
              <MetadataPanel
                documentId={documentId}
                caseId={caseId}
                doc={doc}
                typeSuggestions={typeSuggestions}
                metaExtractions={metaExtractions}
                intakeStatus={intakeStatus}
                classifyDoc={classifyDoc}
                acceptType={acceptType}
                correctMeta={correctMeta}
                acceptMeta={acceptMeta}
                auditLog={auditLog}
                onJumpToPage={jumpToPage}
              />
            )}
            {rightTab === "facts" && (
              <FactsPanel facts={facts} onJumpToPage={jumpToPage} caseId={caseId} auditLog={auditLog} />
            )}
            {rightTab === "chronology" && (
              <ChronologyPanel
                candidates={docChronoCandidates}
                caseId={caseId}
                updateStatus={updateChronoStatus}
                editCandidate={editChronoCandidate}
                auditLog={auditLog}
                onJumpToPage={jumpToPage}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Text Panel ──────────────────────────────────────────

function TextPanel({ pages, activePage, onJumpToPage }: {
  pages: DocumentPageRow[];
  activePage: number;
  onJumpToPage: (p: number) => void;
}) {
  return (
    <div className="space-y-3">
      {pages.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic py-4 text-center">No extracted text available</p>
      ) : (
        pages.map((page) => (
          <div
            key={page.id}
            id={`page-text-${page.page_number}`}
            className={`rounded-lg border p-3 transition-colors ${
              page.page_number === activePage
                ? "border-primary/30 bg-primary/5"
                : "border-border bg-card"
            }`}
          >
            <button
              onClick={() => onJumpToPage(page.page_number)}
              className="flex items-center gap-2 mb-2 w-full text-left"
            >
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">
                Page {page.page_number}
              </span>
              {page.confidence_score != null && (
                <ConfidenceBadge confidence={page.confidence_score} />
              )}
              {page.page_number === activePage && (
                <span className="text-[7px] font-bold text-primary uppercase ml-auto">Viewing</span>
              )}
            </button>
            <pre className="text-[10px] text-foreground font-mono whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
              {page.extracted_text || "No text"}
            </pre>
          </div>
        ))
      )}
    </div>
  );
}

// ── Metadata Panel ──────────────────────────────────────

function MetadataPanel({ documentId, caseId, doc, typeSuggestions, metaExtractions, intakeStatus, classifyDoc, acceptType, correctMeta, acceptMeta, auditLog, onJumpToPage }: {
  documentId: string;
  caseId: string;
  doc: any;
  typeSuggestions: any[];
  metaExtractions: MetadataExtractionRow[];
  intakeStatus: string;
  classifyDoc: any;
  acceptType: any;
  correctMeta: any;
  acceptMeta: any;
  auditLog: any;
  onJumpToPage: (p: number) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const canClassify = ["text_extracted", "queued_for_parsing", "parsing", "parsed"].includes(intakeStatus);
  const metaByField = metaExtractions.reduce<Record<string, MetadataExtractionRow[]>>((acc, m) => {
    if (!acc[m.field_type]) acc[m.field_type] = [];
    acc[m.field_type].push(m);
    return acc;
  }, {});

  const handleAcceptType = (suggestion: any) => {
    auditLog.mutate({
      actionType: "document_type_changed",
      entityType: "case_documents",
      entityId: documentId,
      caseId,
      beforeValue: { document_type: doc.document_type },
      afterValue: { document_type: suggestion.suggested_type },
    });
    acceptType.mutate({ suggestionId: suggestion.id, documentId, suggestedType: suggestion.suggested_type });
  };

  const handleCorrectMeta = (extraction: MetadataExtractionRow) => {
    auditLog.mutate({
      actionType: "metadata_corrected",
      entityType: "document_metadata_extractions",
      entityId: extraction.id,
      caseId,
      beforeValue: { value: extraction.user_corrected_value ?? extraction.extracted_value },
      afterValue: { value: editValue },
    });
    correctMeta.mutate({ extractionId: extraction.id, correctedValue: editValue });
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      {/* Classify action */}
      {canClassify && (
        <div className="flex justify-end">
          <button
            onClick={() => classifyDoc.mutate(documentId)}
            disabled={classifyDoc.isPending}
            className="btn-primary text-[10px]"
          >
            {classifyDoc.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {typeSuggestions.length > 0 ? "Re-classify" : "Classify"}
          </button>
        </div>
      )}

      {/* Type suggestions */}
      {typeSuggestions.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-3 py-2 border-b border-border/50 bg-accent/30">
            <span className="section-label">Document Type</span>
          </div>
          <div className="divide-y divide-border/30">
            {typeSuggestions.map((s: any) => {
              const isActive = doc.document_type === s.suggested_type;
              return (
                <div key={s.id} className={`px-3 py-2 flex items-center gap-2 ${isActive ? "bg-primary/5" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-foreground">
                        {DOCUMENT_TYPE_LABEL[s.suggested_type as keyof typeof DOCUMENT_TYPE_LABEL] ?? s.suggested_type}
                      </span>
                      <ConfidenceBadge confidence={s.confidence} />
                      {isActive && (
                        <span className="text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-1">{s.reasoning}</p>
                  </div>
                  {!isActive && (
                    <button onClick={() => handleAcceptType(s)} className="btn-ghost text-[9px]">
                      <Check className="h-2.5 w-2.5" /> Accept
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Metadata fields */}
      {Object.keys(metaByField).length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-3 py-2 border-b border-border/50 bg-accent/30">
            <span className="section-label">Extracted Metadata</span>
          </div>
          <div className="divide-y divide-border/30">
            {Object.entries(metaByField).map(([fieldType, extractions]) => {
              const hasConflicts = extractions.length > 1;
              return (
                <div key={fieldType} className="px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="section-label">{METADATA_FIELD_LABEL[fieldType] ?? fieldType}</span>
                    {hasConflicts && (
                      <span className="text-[7px] font-bold uppercase px-1 py-0.5 rounded bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention-foreground))]">
                        {extractions.length} candidates
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {extractions.map((ext) => (
                      <div key={ext.id} className="group">
                        <div className="flex items-center gap-1.5">
                          {editingId === ext.id ? (
                            <div className="flex-1 flex items-center gap-1">
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="flex-1 text-[11px] px-2 py-1 rounded border border-primary/30 bg-background text-foreground outline-none focus:ring-1 focus:ring-primary/30"
                                autoFocus
                                onKeyDown={(e) => { if (e.key === "Enter") handleCorrectMeta(ext); if (e.key === "Escape") setEditingId(null); }}
                              />
                              <button onClick={() => handleCorrectMeta(ext)} className="p-1 rounded text-primary hover:bg-primary/10">
                                <Check className="h-3 w-3" />
                              </button>
                              <button onClick={() => setEditingId(null)} className="p-1 rounded text-muted-foreground hover:bg-accent">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="text-[11px] font-medium text-foreground flex-1 truncate">
                                {ext.user_corrected_value ?? ext.extracted_value}
                                {ext.user_corrected_value && (
                                  <span className="text-[8px] text-muted-foreground ml-1">(corrected)</span>
                                )}
                              </span>
                              <ConfidenceBadge confidence={ext.confidence} />
                              {/* Jump to source page */}
                              {ext.source_page && (
                                <button
                                  onClick={() => onJumpToPage(ext.source_page!)}
                                  className="p-0.5 rounded text-muted-foreground/40 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                  title={`Jump to page ${ext.source_page}`}
                                >
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </button>
                              )}
                              <button
                                onClick={() => { setEditingId(ext.id); setEditValue(ext.user_corrected_value ?? ext.extracted_value); }}
                                className="p-0.5 rounded text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Edit"
                              >
                                <Pencil className="h-2.5 w-2.5" />
                              </button>
                              {!ext.is_accepted && (
                                <button
                                  onClick={() => acceptMeta.mutate(ext.id)}
                                  className="p-0.5 rounded text-muted-foreground/40 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Accept"
                                >
                                  <Check className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                        {/* Source snippet on hover */}
                        {ext.source_snippet && (
                          <div className="mt-1 ml-2 text-[9px] text-muted-foreground font-mono truncate opacity-0 group-hover:opacity-100 transition-opacity">
                            <Quote className="h-2 w-2 inline mr-1" />
                            "{ext.source_snippet.substring(0, 120)}"
                            {ext.source_page && <span className="ml-1 text-[8px]">— p.{ext.source_page}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {Object.keys(metaByField).length === 0 && typeSuggestions.length === 0 && (
        <div className="text-center py-6">
          <Sparkles className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-[10px] text-muted-foreground">
            {canClassify ? "Run classification to extract metadata" : "Text extraction must complete first"}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Facts Panel ──────────────────────────────────────────

function FactsPanel({ facts, onJumpToPage, caseId, auditLog }: {
  facts: ExtractedFactRow[];
  onJumpToPage: (p: number) => void;
  caseId: string;
  auditLog: any;
}) {
  if (facts.length === 0) {
    return (
      <div className="text-center py-6">
        <AlertTriangle className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-[10px] text-muted-foreground">No extracted facts. Run fact extraction after OCR completes.</p>
      </div>
    );
  }

  const lowConfidence = facts.filter((f) => f.confidence_score != null && f.confidence_score < 0.6);
  const needsReview = facts.filter((f) => f.needs_review);

  return (
    <div className="space-y-3">
      {/* Summary */}
      {(lowConfidence.length > 0 || needsReview.length > 0) && (
        <div className="flex gap-2">
          {lowConfidence.length > 0 && (
            <span className="text-[9px] font-medium px-2 py-1 rounded bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention-foreground))]">
              {lowConfidence.length} low confidence
            </span>
          )}
          {needsReview.length > 0 && (
            <span className="text-[9px] font-medium px-2 py-1 rounded bg-[hsl(var(--status-review-bg))] text-[hsl(var(--status-review-foreground))]">
              {needsReview.length} needs review
            </span>
          )}
        </div>
      )}

      {facts.map((fact) => (
        <div
          key={fact.id}
          className={`rounded-lg border p-3 group ${
            fact.confidence_score != null && fact.confidence_score < 0.5
              ? "border-destructive/20 bg-destructive/5"
              : fact.needs_review
              ? "border-[hsl(var(--status-attention))]/20 bg-[hsl(var(--status-attention-bg))]"
              : "border-border bg-card"
          }`}
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">
              {FACT_TYPE_LABEL[fact.fact_type] ?? fact.fact_type}
            </span>
            <div className="flex items-center gap-1.5">
              {fact.needs_review && (
                <span className="flex items-center gap-0.5 text-[9px] font-medium text-[hsl(var(--status-attention))]">
                  <AlertTriangle className="h-2.5 w-2.5" /> Review
                </span>
              )}
              <ConfidenceBadge confidence={fact.confidence_score} />
            </div>
          </div>
          <p className="text-[11px] text-foreground leading-relaxed">{fact.fact_text}</p>
          {fact.source_snippet && (
            <button
              onClick={() => fact.page_number && onJumpToPage(fact.page_number)}
              className="mt-2 flex items-start gap-1.5 text-[9px] text-muted-foreground hover:text-primary transition-colors cursor-pointer w-full text-left"
            >
              <Quote className="h-2.5 w-2.5 shrink-0 mt-0.5" />
              <span className="font-mono truncate">"{fact.source_snippet}"</span>
              {fact.page_number && <span className="shrink-0 font-semibold">p.{fact.page_number}</span>}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Chronology Panel ──────────────────────────────────────

function ChronologyPanel({ candidates, caseId, updateStatus, editCandidate, auditLog, onJumpToPage }: {
  candidates: ChronologyCandidateRow[];
  caseId: string;
  updateStatus: any;
  editCandidate: any;
  auditLog: any;
  onJumpToPage: (p: number) => void;
}) {
  if (candidates.length === 0) {
    return (
      <div className="text-center py-6">
        <Clock className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-[10px] text-muted-foreground">No chronology events linked to this document</p>
      </div>
    );
  }

  const handleStatusChange = (candidate: ChronologyCandidateRow, newStatus: "accepted" | "suppressed" | "draft") => {
    auditLog.mutate({
      actionType: "chronology_status_changed",
      entityType: "chronology_event_candidates",
      entityId: candidate.id,
      caseId,
      beforeValue: { status: candidate.status },
      afterValue: { status: newStatus },
    });
    updateStatus.mutate({ candidateId: candidate.id, status: newStatus, caseId });
  };

  return (
    <div className="space-y-2">
      {candidates.map((c) => (
        <div key={c.id} className={`rounded-lg border p-3 group ${
          c.status === "accepted"
            ? "border-[hsl(var(--status-approved))]/20 bg-[hsl(var(--status-approved-bg))]"
            : c.status === "suppressed"
            ? "border-border bg-accent/30 opacity-60"
            : "border-border bg-card"
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-semibold text-foreground tabular-nums">{c.event_date || "No date"}</span>
            <span className="text-[8px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-accent text-muted-foreground">
              {CHRONO_CATEGORY_LABEL[c.category] ?? c.category}
            </span>
            <ConfidenceBadge confidence={c.confidence} />
            {c.status !== "draft" && (
              <span className={`text-[7px] font-bold uppercase px-1 py-0.5 rounded ${
                c.status === "accepted"
                  ? "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]"
                  : "bg-accent text-muted-foreground"
              }`}>
                {c.status}
              </span>
            )}
          </div>
          <p className="text-[11px] font-medium text-foreground">{c.user_corrected_label ?? c.label}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{c.user_corrected_description ?? c.description}</p>

          {/* Actions */}
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {c.source_page && (
              <button onClick={() => onJumpToPage(c.source_page!)} className="btn-ghost text-[9px]">
                <ExternalLink className="h-2.5 w-2.5" /> p.{c.source_page}
              </button>
            )}
            {c.status === "draft" && (
              <button onClick={() => handleStatusChange(c, "accepted")} className="btn-ghost text-[9px] hover:text-[hsl(var(--status-approved))]">
                <Check className="h-2.5 w-2.5" /> Accept
              </button>
            )}
            {c.status === "accepted" && (
              <button onClick={() => handleStatusChange(c, "draft")} className="btn-ghost text-[9px]">
                <X className="h-2.5 w-2.5" /> Revert
              </button>
            )}
            <button
              onClick={() => handleStatusChange(c, c.status === "suppressed" ? "draft" : "suppressed")}
              className="btn-ghost text-[9px]"
            >
              <EyeOff className="h-2.5 w-2.5" /> {c.status === "suppressed" ? "Restore" : "Suppress"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default DocumentReviewWorkspace;
