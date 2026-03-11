import { useState } from "react";
import { useAuditLog } from "@/hooks/useAuditLog";
import {
  useDocumentTypeSuggestions,
  useDocumentMetadataExtractions,
  useClassifyDocument,
  useAcceptTypeSuggestion,
  useCorrectMetadata,
  useAcceptMetadata,
  METADATA_FIELD_LABEL,
  type TypeSuggestionRow,
  type MetadataExtractionRow,
} from "@/hooks/useDocumentClassification";
import { DOCUMENT_TYPE_LABEL } from "@/lib/statuses";
import {
  Sparkles,
  Check,
  Pencil,
  X,
  Loader2,
  FileSearch,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Quote,
} from "lucide-react";

interface DocumentMetadataPanelProps {
  documentId: string;
  currentDocumentType: string;
  intakeStatus: string;
}

const DocumentMetadataPanel = ({
  documentId,
  currentDocumentType,
  intakeStatus,
}: DocumentMetadataPanelProps) => {
  const { data: typeSuggestions = [], isLoading: loadingTypes } =
    useDocumentTypeSuggestions(documentId);
  const { data: metadataExtractions = [], isLoading: loadingMeta } =
    useDocumentMetadataExtractions(documentId);
  const classifyDoc = useClassifyDocument();
  const acceptType = useAcceptTypeSuggestion();
  const correctMeta = useCorrectMetadata();
  const acceptMeta = useAcceptMetadata();

  const [showAllTypes, setShowAllTypes] = useState(false);
  const [editingMeta, setEditingMeta] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showSource, setShowSource] = useState<string | null>(null);

  const canClassify =
    intakeStatus === "text_extracted" ||
    intakeStatus === "queued_for_parsing" ||
    intakeStatus === "parsing" ||
    intakeStatus === "parsed";

  const hasResults = typeSuggestions.length > 0 || metadataExtractions.length > 0;

  // Group metadata by field_type
  const metaByField = metadataExtractions.reduce<Record<string, MetadataExtractionRow[]>>(
    (acc, m) => {
      if (!acc[m.field_type]) acc[m.field_type] = [];
      acc[m.field_type].push(m);
      return acc;
    },
    {}
  );

  const handleStartEdit = (extraction: MetadataExtractionRow) => {
    setEditingMeta(extraction.id);
    setEditValue(extraction.user_corrected_value ?? extraction.extracted_value);
  };

  const handleSaveEdit = (extractionId: string) => {
    correctMeta.mutate({ extractionId, correctedValue: editValue });
    setEditingMeta(null);
  };

  return (
    <div className="space-y-3">
      {/* Header with classify button */}
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          AI Classification
        </h4>
        {canClassify && (
          <button
            onClick={() => classifyDoc.mutate(documentId)}
            disabled={classifyDoc.isPending}
            className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {classifyDoc.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {hasResults ? "Re-classify" : "Classify"}
          </button>
        )}
      </div>

      {/* Loading state */}
      {(loadingTypes || loadingMeta) && (
        <div className="flex items-center gap-2 py-3">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Loading classification data…</span>
        </div>
      )}

      {/* No results yet */}
      {!loadingTypes && !loadingMeta && !hasResults && (
        <div className="text-center py-4">
          <FileSearch className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-[10px] text-muted-foreground">
            {canClassify
              ? "Click Classify to detect document type and extract metadata."
              : "Text extraction must complete before classification."}
          </p>
        </div>
      )}

      {/* Type suggestions */}
      {typeSuggestions.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-3 py-2 border-b border-border/50 bg-accent/30">
            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">
              Document Type
            </span>
          </div>

          <div className="divide-y divide-border/30">
            {(showAllTypes ? typeSuggestions : typeSuggestions.slice(0, 2)).map(
              (suggestion) => {
                const isCurrentType = currentDocumentType === suggestion.suggested_type;
                const typeLabel =
                  DOCUMENT_TYPE_LABEL[suggestion.suggested_type as keyof typeof DOCUMENT_TYPE_LABEL] ??
                  suggestion.suggested_type;

                return (
                  <div
                    key={suggestion.id}
                    className={`px-3 py-2 flex items-center gap-2 ${
                      isCurrentType ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-foreground">
                          {typeLabel}
                        </span>
                        <ConfidenceBadge confidence={suggestion.confidence} />
                        {isCurrentType && (
                          <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-1">
                        {suggestion.reasoning}
                      </p>
                    </div>
                    {!isCurrentType && (
                      <button
                        onClick={() =>
                          acceptType.mutate({
                            suggestionId: suggestion.id,
                            documentId,
                            suggestedType: suggestion.suggested_type,
                          })
                        }
                        disabled={acceptType.isPending}
                        className="flex items-center gap-1 text-[9px] font-medium px-2 py-1 rounded border border-border text-foreground hover:bg-accent transition-colors shrink-0"
                      >
                        <Check className="h-2.5 w-2.5" /> Accept
                      </button>
                    )}
                  </div>
                );
              }
            )}
          </div>

          {typeSuggestions.length > 2 && (
            <button
              onClick={() => setShowAllTypes(!showAllTypes)}
              className="w-full px-3 py-1.5 text-[9px] font-medium text-primary hover:bg-accent/30 transition-colors flex items-center justify-center gap-1"
            >
              {showAllTypes ? (
                <>
                  <ChevronDown className="h-2.5 w-2.5" /> Show fewer
                </>
              ) : (
                <>
                  <ChevronRight className="h-2.5 w-2.5" /> +{typeSuggestions.length - 2} more
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Metadata extractions */}
      {Object.keys(metaByField).length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-3 py-2 border-b border-border/50 bg-accent/30">
            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">
              Extracted Metadata
            </span>
          </div>

          <div className="divide-y divide-border/30">
            {Object.entries(metaByField).map(([fieldType, extractions]) => {
              const label = METADATA_FIELD_LABEL[fieldType] ?? fieldType;
              const hasConflicts = extractions.length > 1;

              return (
                <div key={fieldType} className="px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">
                      {label}
                    </span>
                    {hasConflicts && (
                      <span className="text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention-foreground))]">
                        {extractions.length} candidates
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {extractions.map((extraction) => (
                      <div key={extraction.id} className="group">
                        <div className="flex items-center gap-1.5">
                          {editingMeta === extraction.id ? (
                            <div className="flex-1 flex items-center gap-1">
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="flex-1 text-[11px] px-2 py-1 rounded border border-primary/30 bg-background text-foreground outline-none focus:ring-1 focus:ring-primary/30"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveEdit(extraction.id)}
                                className="p-1 rounded text-primary hover:bg-primary/10"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => setEditingMeta(null)}
                                className="p-1 rounded text-muted-foreground hover:bg-accent"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="text-[11px] font-medium text-foreground flex-1">
                                {extraction.user_corrected_value ?? extraction.extracted_value}
                                {extraction.user_corrected_value && (
                                  <span className="text-[8px] text-muted-foreground ml-1">
                                    (corrected)
                                  </span>
                                )}
                              </span>
                              <ConfidenceBadge confidence={extraction.confidence} />
                              <button
                                onClick={() => handleStartEdit(extraction)}
                                className="p-0.5 rounded text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Edit"
                              >
                                <Pencil className="h-2.5 w-2.5" />
                              </button>
                              {!extraction.is_accepted && (
                                <button
                                  onClick={() => acceptMeta.mutate(extraction.id)}
                                  className="p-0.5 rounded text-muted-foreground/40 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Accept"
                                >
                                  <Check className="h-2.5 w-2.5" />
                                </button>
                              )}
                              <button
                                onClick={() =>
                                  setShowSource(
                                    showSource === extraction.id ? null : extraction.id
                                  )
                                }
                                className="p-0.5 rounded text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                title="View source"
                              >
                                <Quote className="h-2.5 w-2.5" />
                              </button>
                            </>
                          )}
                        </div>

                        {/* Source snippet */}
                        {showSource === extraction.id && extraction.source_snippet && (
                          <div className="mt-1.5 ml-2 px-2 py-1.5 rounded bg-accent/50 border-l-2 border-primary/30">
                            <p className="text-[9px] text-muted-foreground font-mono leading-relaxed">
                              "{extraction.source_snippet}"
                            </p>
                            {extraction.source_page && (
                              <span className="text-[8px] text-muted-foreground/60 mt-0.5 block">
                                Page {extraction.source_page}
                              </span>
                            )}
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
    </div>
  );
};

// ── Confidence badge ──────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence == null) return null;

  const pct = Math.round(confidence * 100);
  let className = "bg-accent text-muted-foreground";

  if (confidence >= 0.9) {
    className = "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]";
  } else if (confidence >= 0.7) {
    className = "bg-[hsl(var(--status-processing-bg))] text-[hsl(var(--status-processing-foreground))]";
  } else if (confidence >= 0.5) {
    className = "bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention-foreground))]";
  } else {
    className = "bg-destructive/10 text-destructive";
  }

  return (
    <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${className}`}>
      {pct}%
    </span>
  );
}

export { ConfidenceBadge };
export default DocumentMetadataPanel;
