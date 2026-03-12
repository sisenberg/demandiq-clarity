/**
 * NegotiateIQ — Right Panel: Notes, drafts, and timeline
 */

import {
  FileEdit,
  History,
  StickyNote,
  MessageSquare,
} from "lucide-react";

const NegotiateRightPanel = () => {
  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pl-1">
      {/* Negotiation Timeline */}
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <History className="h-3 w-3 text-muted-foreground" />
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Negotiation Timeline</h3>
        </div>
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-4">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            All offers, counteroffers, and position changes will be tracked chronologically here. Each entry records the amount, rationale, and timestamp.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
              Coming Soon
            </span>
          </div>
        </div>
      </div>

      {/* Adjuster Notes */}
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <StickyNote className="h-3 w-3 text-muted-foreground" />
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Adjuster Notes</h3>
        </div>
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-4">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Private negotiation notes, strategy adjustments, and call summaries. Notes persist across rounds and are included in the completion package.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
              Coming Soon
            </span>
          </div>
        </div>
      </div>

      {/* Drafts */}
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <FileEdit className="h-3 w-3 text-muted-foreground" />
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Drafts</h3>
        </div>
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-4">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Settlement letters, counteroffer drafts, and correspondence templates. Drafts reference the evaluation range and package provenance automatically.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
              Coming Soon
            </span>
          </div>
        </div>
      </div>

      {/* Communication Log */}
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <MessageSquare className="h-3 w-3 text-muted-foreground" />
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Communication Log</h3>
        </div>
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-4">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Track calls, emails, and meetings with claimant counsel. Log key positions discussed and commitments made.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
              Coming Soon
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NegotiateRightPanel;
