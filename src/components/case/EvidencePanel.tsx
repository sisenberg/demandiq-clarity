import type { TimelineEvent } from "@/types";
import { mockDocuments } from "@/data/mock";

interface EvidencePanelProps {
  event: TimelineEvent | null;
}

const EvidencePanel = ({ event }: EvidencePanelProps) => {
  if (!event) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-border shrink-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Evidence
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-sm text-muted-foreground text-center">
            Select a chronology event to view its source evidence.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Evidence
        </h2>
        <p className="text-sm font-medium text-foreground mt-1 leading-snug">
          {event.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{event.eventDate}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {event.evidenceRefs.map((ref, idx) => {
          const doc = mockDocuments.find((d) => d.id === ref.documentId);
          return (
            <div
              key={`${ref.documentId}-${ref.pageNumber}-${idx}`}
              className="border border-border rounded-md overflow-hidden"
            >
              {/* Source header */}
              <div className="px-3 py-2 bg-muted/50 border-b border-border">
                <p className="text-xs font-medium text-foreground">
                  {doc?.fileName ?? ref.documentId}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Page {ref.pageNumber}
                </p>
              </div>

              {/* Excerpt */}
              {ref.excerpt && (
                <div className="px-3 py-2.5">
                  <p className="text-xs leading-relaxed text-foreground font-mono">
                    {ref.excerpt}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {event.evidenceRefs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No evidence references linked to this event.
          </p>
        )}
      </div>

      {/* Metadata footer */}
      <div className="px-4 py-2 border-t border-border shrink-0 text-[10px] text-muted-foreground space-y-0.5">
        <p>Source: {event.source === "ai_extracted" ? "AI Extracted" : "Manual"}</p>
        <p>Version: {event.version}</p>
        {event.reviewedAt && <p>Reviewed: {event.reviewedAt}</p>}
      </div>
    </div>
  );
};

export default EvidencePanel;
