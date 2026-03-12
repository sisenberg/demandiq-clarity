/**
 * NegotiateIQ — Right Panel: Live timeline, notes, drafts, attorney intelligence
 */

import { useMemo } from "react";
import type { NegotiationEventRow, NegotiationNoteRow } from "@/types/negotiate-persistence";
import { useNegotiationEvents, useNegotiationNotes, useNegotiateSession } from "@/hooks/useNegotiateSession";
import AttorneyIntelligenceCard from "@/components/negotiate/AttorneyIntelligenceCard";
import {
  History,
  StickyNote,
  FileEdit,
  DollarSign,
  ArrowDownUp,
  Shield,
  MessageSquare,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

const EVENT_ICONS: Record<string, React.ElementType> = {
  offer_made: DollarSign,
  counteroffer_received: ArrowDownUp,
  hold: Shield,
  bracket_proposed: DollarSign,
  support_requested: AlertTriangle,
  authority_adjusted: Shield,
  draft_generated: FileEdit,
  note_added: StickyNote,
  session_completed: CheckCircle2,
  status_changed: Clock,
  strategy_override: ArrowDownUp,
};

interface NegotiateRightPanelProps {
  caseId?: string;
  attorneyName?: string;
  firmName?: string;
}

const NegotiateRightPanel = ({ caseId }: NegotiateRightPanelProps) => {
  const { data: session } = useNegotiateSession(caseId);
  const { data: events = [] } = useNegotiationEvents(session?.id);
  const { data: notes = [] } = useNegotiationNotes(session?.id);

  const recentEvents = useMemo(() => [...events].reverse().slice(0, 30), [events]);

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pl-1">
      {/* Negotiation Timeline */}
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <History className="h-3 w-3 text-muted-foreground" />
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Timeline
          </h3>
          {events.length > 0 && (
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
              {events.length}
            </span>
          )}
        </div>

        {recentEvents.length > 0 ? (
          <div className="space-y-1">
            {recentEvents.map((evt) => (
              <TimelineEvent key={evt.id} event={evt} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-4">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              No events yet. Events will appear as offers, counteroffers, and status changes are recorded.
            </p>
          </div>
        )}
      </div>

      {/* Adjuster Notes */}
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <StickyNote className="h-3 w-3 text-muted-foreground" />
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Notes
          </h3>
          {notes.length > 0 && (
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
              {notes.length}
            </span>
          )}
        </div>

        {notes.length > 0 ? (
          <div className="space-y-2">
            {notes.slice(0, 10).map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-4">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Private negotiation notes will appear here as they are added during rounds.
            </p>
          </div>
        )}
      </div>

      {/* Drafts placeholder */}
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <FileEdit className="h-3 w-3 text-muted-foreground" />
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Drafts</h3>
        </div>
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-4">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Settlement letters and correspondence drafts.
          </p>
          <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent text-muted-foreground mt-2 inline-block">
            Coming Soon
          </span>
        </div>
      </div>
    </div>
  );
};

function TimelineEvent({ event }: { event: NegotiationEventRow }) {
  const Icon = EVENT_ICONS[event.event_type] ?? MessageSquare;
  const isOffer = event.event_type === "offer_made" || event.event_type === "counteroffer_received";

  return (
    <div className="flex gap-2 py-1.5 px-2 rounded-lg hover:bg-accent/30 transition-colors">
      <div className={`mt-0.5 shrink-0 h-5 w-5 rounded-md flex items-center justify-center ${
        isOffer ? "bg-primary/10" : "bg-accent"
      }`}>
        <Icon className={`h-2.5 w-2.5 ${isOffer ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-foreground leading-snug line-clamp-2">{event.summary}</p>
        <p className="text-[8px] text-muted-foreground mt-0.5">
          {new Date(event.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

function NoteCard({ note }: { note: NegotiationNoteRow }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[10px] text-foreground leading-relaxed line-clamp-3">{note.content}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[8px] text-muted-foreground">
          {new Date(note.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
        <span className="text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-accent text-muted-foreground">
          {note.note_type}
        </span>
      </div>
    </div>
  );
}

export default NegotiateRightPanel;
