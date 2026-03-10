import { mockEvents } from "@/data/mock/index";
import { EventStatus } from "@/types";
import { ClipboardCheck } from "lucide-react";

const statusConfig: Record<EventStatus, { label: string; className: string }> = {
  [EventStatus.Draft]: { label: "Draft", className: "status-badge-draft" },
  [EventStatus.PendingReview]: { label: "Pending Review", className: "status-badge-review" },
  [EventStatus.Approved]: { label: "Approved", className: "status-badge-approved" },
  [EventStatus.Rejected]: { label: "Rejected", className: "bg-destructive/10 text-destructive text-xs font-medium px-2 py-0.5 rounded" },
  [EventStatus.Edited]: { label: "Edited", className: "status-badge-review" },
};

const ReviewQueuePage = () => {
  const reviewable = mockEvents.filter(
    (e) => e.status === EventStatus.PendingReview || e.status === EventStatus.Draft
  );

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Review Queue</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {reviewable.length} items awaiting review
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {reviewable.length === 0 && (
          <div className="border border-border rounded-lg bg-card px-6 py-12 text-center">
            <ClipboardCheck className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No items pending review.</p>
          </div>
        )}

        {reviewable.map((event) => {
          const config = statusConfig[event.status];
          return (
            <div
              key={event.id}
              className="border border-border rounded-lg bg-card px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{event.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{event.eventDate}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {event.description}
                  </p>
                </div>
                <span className={config.className}>{config.label}</span>
              </div>
              <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                <span>{event.evidenceRefs.length} evidence ref{event.evidenceRefs.length !== 1 ? "s" : ""}</span>
                <span>v{event.version}</span>
                <span>{event.source === "ai_extracted" ? "AI Extracted" : "Manual"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReviewQueuePage;
