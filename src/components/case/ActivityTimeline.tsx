import type { CaseActivityEvent } from "@/lib/workflow";
import { CASE_STATUS_LABEL, CASE_STATUS_BADGE } from "@/lib/workflow";
import { CaseStatus } from "@/types";
import { Clock } from "lucide-react";

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const ActivityTimeline = ({ events }: { events: CaseActivityEvent[] }) => {
  const sorted = [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="border border-border rounded-lg bg-card px-4 py-8 text-center">
        <Clock className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Activity Timeline
          <span className="text-xs font-normal text-muted-foreground">({sorted.length})</span>
        </h3>
      </div>
      <div className="relative">
        <div className="absolute left-[23px] top-0 bottom-0 w-px bg-border" />
        <div className="divide-y divide-border">
          {sorted.map((event) => {
            const toStatus = event.to_status as CaseStatus | undefined;
            return (
              <div key={event.id} className="relative pl-12 pr-4 py-3">
                {/* Dot */}
                <div className={`absolute left-[18px] top-[18px] w-2.5 h-2.5 rounded-full border-2 ${
                  event.to_status
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40 bg-background"
                }`} />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-xs font-medium text-foreground">{event.action}</p>
                      {toStatus && CASE_STATUS_LABEL[toStatus] && (
                        <span className={CASE_STATUS_BADGE[toStatus]}>
                          {CASE_STATUS_LABEL[toStatus]}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{event.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {event.actor_name} · {formatTimestamp(event.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ActivityTimeline;
