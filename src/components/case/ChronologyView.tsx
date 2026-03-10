import type { TimelineEvent } from "@/types";
import { EventStatus } from "@/types";

interface ChronologyViewProps {
  events: TimelineEvent[];
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
  onApproveEvent: (eventId: string) => void;
  onRejectEvent: (eventId: string) => void;
}

const statusConfig: Record<
  EventStatus,
  { label: string; className: string }
> = {
  [EventStatus.Draft]: {
    label: "Draft",
    className: "status-badge-draft",
  },
  [EventStatus.PendingReview]: {
    label: "Pending Review",
    className: "status-badge-review",
  },
  [EventStatus.Approved]: {
    label: "Approved",
    className: "status-badge-approved",
  },
  [EventStatus.Rejected]: {
    label: "Rejected",
    className: "bg-destructive/10 text-destructive text-xs font-medium px-2 py-0.5 rounded",
  },
  [EventStatus.Edited]: {
    label: "Edited",
    className: "status-badge-review",
  },
};

const ChronologyView = ({
  events,
  selectedEventId,
  onSelectEvent,
  onApproveEvent,
  onRejectEvent,
}: ChronologyViewProps) => {
  const sorted = [...events].sort(
    (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-lg font-semibold text-foreground">Chronology</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {events.length} events · {events.filter((e) => e.status === EventStatus.Approved).length} approved
        </p>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

          <div className="flex flex-col gap-1">
            {sorted.map((event) => {
              const isSelected = event.id === selectedEventId;
              const config = statusConfig[event.status];
              const isReviewable =
                event.status === EventStatus.PendingReview ||
                event.status === EventStatus.Draft;

              return (
                <button
                  key={event.id}
                  onClick={() => onSelectEvent(event.id)}
                  className={`relative pl-7 pr-4 py-3 text-left rounded transition-colors ${
                    isSelected
                      ? "bg-accent"
                      : "hover:bg-accent/50"
                  }`}
                >
                  {/* Dot */}
                  <div
                    className={`absolute left-1 top-[18px] w-3 h-3 rounded-full border-2 ${
                      event.status === EventStatus.Approved
                        ? "border-[hsl(var(--status-approved))] bg-[hsl(var(--status-approved))]"
                        : event.status === EventStatus.PendingReview
                        ? "border-[hsl(var(--status-review))] bg-background"
                        : event.status === EventStatus.Rejected
                        ? "border-destructive bg-background"
                        : "border-border bg-background"
                    }`}
                  />

                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">
                        {event.eventDate}
                        {event.source === "ai_extracted" && (
                          <span className="ml-2 text-[10px] opacity-60">AI</span>
                        )}
                      </p>
                      <p className="text-sm font-medium text-foreground mt-0.5 leading-snug">
                        {event.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {event.description}
                      </p>
                    </div>
                    <span className={config.className}>{config.label}</span>
                  </div>

                  {/* Review actions */}
                  {isReviewable && isSelected && (
                    <div className="flex gap-2 mt-2 ml-0">
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onApproveEvent(event.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            onApproveEvent(event.id);
                          }
                        }}
                        className="text-xs font-medium px-3 py-1 rounded bg-[hsl(var(--status-approved))] text-white cursor-pointer hover:opacity-90 transition-opacity"
                      >
                        Approve
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRejectEvent(event.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            onRejectEvent(event.id);
                          }
                        }}
                        className="text-xs font-medium px-3 py-1 rounded bg-destructive/10 text-destructive cursor-pointer hover:bg-destructive/20 transition-colors"
                      >
                        Reject
                      </span>
                    </div>
                  )}

                  {/* Evidence count */}
                  {event.evidenceRefs.length > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      {event.evidenceRefs.length} evidence ref{event.evidenceRefs.length !== 1 && "s"}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChronologyView;
