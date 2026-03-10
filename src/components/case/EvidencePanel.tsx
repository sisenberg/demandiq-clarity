import React from "react";
import { TimelineEvent } from "@/types";

interface EvidencePanelProps {
  event: TimelineEvent | null;
}

const EvidencePanel: React.FC<EvidencePanelProps> = ({ event }) => {
  if (!event) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-border">
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
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Evidence
        </h2>
      </div>

      {/* Event reference */}
      <div className="px-4 py-3 border-b border-border bg-accent/50">
        <div className="text-xs text-muted-foreground mb-1 font-mono">
          {event.date} · v{event.version}
        </div>
        <h3 className="text-sm font-medium text-foreground">
          {event.title}
        </h3>
      </div>

      {/* Source document info */}
      {event.sourceDocumentId ? (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Source Document</span>
              <span>·</span>
              <span className="font-mono">Page {event.sourcePageNumber}</span>
            </div>
          </div>

          {/* Source text snippet */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Extracted Text
              </span>
            </div>
            <div className="p-4 rounded border border-primary/20 bg-primary/[0.02]">
              <p className="evidence-text text-xs leading-relaxed text-foreground">
                {event.sourceTextSnippet}
              </p>
            </div>

            {/* Metadata */}
            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Extraction method</span>
                <span className="font-mono text-foreground capitalize">{event.source}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Created</span>
                <span className="font-mono text-foreground">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </div>
              {event.reviewedBy && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Reviewed</span>
                  <span className="font-mono text-foreground">
                    {new Date(event.reviewedAt!).toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Version</span>
                <span className="font-mono text-foreground">{event.version}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-xs text-muted-foreground text-center">
            No source document linked to this event.
          </p>
        </div>
      )}
    </div>
  );
};

export default EvidencePanel;
