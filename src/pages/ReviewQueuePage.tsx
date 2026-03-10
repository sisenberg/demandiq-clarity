import { mockReviewItems, mockChronologyEvents, mockIssueFlags, mockUsers } from "@/data/mock/index";
import { ReviewStatus, ReviewItemType } from "@/types";
import { REVIEW_STATUS_LABEL, REVIEW_STATUS_BADGE } from "@/lib/workflow";
import { ClipboardCheck } from "lucide-react";

function getLinkedSummary(item: typeof mockReviewItems[number]): string {
  if (item.item_type === ReviewItemType.ChronologyEvent) {
    const evt = mockChronologyEvents.find((e) => e.id === item.linked_record_id);
    return evt?.summary?.slice(0, 80) ?? item.linked_record_id;
  }
  if (item.item_type === ReviewItemType.IssueFlag) {
    const flag = mockIssueFlags.find((f) => f.id === item.linked_record_id);
    return flag?.description?.slice(0, 80) ?? item.linked_record_id;
  }
  return item.linked_record_id;
}

const ReviewQueuePage = () => {
  const pending = mockReviewItems.filter(
    (r) =>
      r.review_status === ReviewStatus.Pending ||
      r.review_status === ReviewStatus.InReview ||
      r.review_status === ReviewStatus.ChangesRequested
  );

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Review Queue</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{pending.length} items awaiting review</p>
      </div>

      {pending.length === 0 ? (
        <div className="border border-border rounded-lg bg-card px-6 py-12 text-center">
          <ClipboardCheck className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No items pending review.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {pending.map((item) => {
            const assignee = mockUsers.find((u) => u.id === item.assigned_to);
            return (
              <div key={item.id} className="border border-border rounded-lg bg-card px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-foreground">{item.item_type}</code>
                      <span className="text-[10px] text-muted-foreground">{item.linked_record_type}:{item.linked_record_id}</span>
                    </div>
                    <p className="text-sm text-foreground line-clamp-2">{getLinkedSummary(item)}</p>
                    {assignee && (
                      <p className="text-xs text-muted-foreground mt-1">Assigned to {assignee.display_name}</p>
                    )}
                  </div>
                  <span className={REVIEW_STATUS_BADGE[item.review_status]}>
                    {REVIEW_STATUS_LABEL[item.review_status]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReviewQueuePage;
