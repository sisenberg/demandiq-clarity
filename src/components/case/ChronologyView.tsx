import React from "react";
import { TimelineEvent, EventStatus } from "@/types";

interface ChronologyViewProps {
  events: TimelineEvent[];
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
  onApproveEvent: (eventId: string) => void;
  onRejectEvent: (eventId: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const statusLabel: Record<EventStatus, string> = {
  [EventStatus.Draft]: "Draft",
  [EventStatus.NeedsReview]: "Needs Review",
  [EventStatus.Approved]: "Approved",
  [EventStatus.Rejected]: "Rejected",
};

const statusClass: Record<EventStatus, string> = {
  [EventStatus.Draft]: "status-badge-draft",
  [EventStatus.NeedsReview]: "status-badge-review",
  [EventStatus.Approved]: "status-badge-approved",
  [EventStatus.Rejected]:
    "text-xs font-medium px-2 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/30",
};

const ChronologyView: React.FC<ChronologyViewProps> = ({
  events,
  selectedEventId,
  onSelectEvent,
  onApproveEvent,
  onRejectEvent,
  currentPage,
  totalPages,
  onPageChange,
}) => {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Chronology</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {events.length} events · Select an event to view source evidence
          </p>
        </div>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto">
        {events.map((event) => (
          <div
            key={event.id}
            onClick={() => onSelectEvent(event.id)}
            className={`px-6 py-4 border-b border-border cursor-pointer transition-colors ${
              selectedEventId === event.id
                ? "bg-primary/[0.04] border-l-2 border-l-primary"
                : "hover:bg-accent/50"
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground min-w-[80px]">
                  {event.date}
                </span>
                <span className={statusClass[event.status]}>
                  {statusLabel[event.status]}
                </span>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                v{event.version}
              </span>
            </div>

            <h3 className="text-sm font-medium text-foreground mb-1">
              {event.title}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {event.description}
            </p>

            {/* Source indicator */}
            {event.sourceDocumentId && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground font-mono">
                  Source: p.{event.sourcePageNumber}
                </span>
                <span className="text-[10px] text-muted-foreground">·</span>
                <span className="text-[10px] text-muted-foreground capitalize">
                  {event.source}
                </span>
              </div>
            )}

            {/* Review actions for items needing review */}
            {event.status === EventStatus.NeedsReview && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onApproveEvent(event.id);
                  }}
                  className="text-xs font-medium px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRejectEvent(event.id);
                  }}
                  className="text-xs font-medium px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="px-6 py-3 border-t border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Page {currentPage} of {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="text-xs px-2.5 py-1 rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="text-xs px-2.5 py-1 rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChronologyView;
