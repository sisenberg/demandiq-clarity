import { BookOpen, Clock } from "lucide-react";
import { CitationBadge, type CitationSource } from "./EvidenceCitation";
import { useCasePackage } from "@/hooks/useCasePackage";
import type { TimelineEvent, EvidenceReference } from "@/types";

function refsToCS(refs: EvidenceReference[]): CitationSource[] {
  return refs.map((r) => ({
    docName: r.doc_name,
    page: r.page_label,
    excerpt: r.quoted_text,
    relevance: r.relevance as any,
  }));
}

const CATEGORY_COLORS: Record<string, string> = {
  Accident: "bg-destructive",
  "First Treatment": "bg-[hsl(var(--status-attention))]",
  Treatment: "bg-[hsl(var(--status-processing))]",
  Imaging: "bg-[hsl(var(--status-review))]",
  Injection: "bg-[hsl(var(--status-approved))]",
  IME: "bg-muted-foreground",
  Demand: "bg-primary",
  Surgery: "bg-destructive",
  Legal: "bg-primary",
  Administrative: "bg-muted-foreground",
};

const ChronologyPanel = () => {
  const { pkg } = useCasePackage();
  const events = pkg.timeline_events;

  return (
    <div className="card-elevated overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Case Chronology</h2>
        <span className="text-[10px] font-medium bg-accent text-muted-foreground px-2 py-0.5 rounded-full">
          {events.length} milestones
        </span>
      </div>

      <div className="px-5 py-4">
        <div className="relative">
          <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />

          <div className="flex flex-col gap-0">
            {events.map((evt) => {
              const dotColor = CATEGORY_COLORS[evt.category] ?? "bg-primary";
              const citations = refsToCS(evt.evidence_refs);
              return (
                <div key={evt.id} className="flex gap-4 py-3 relative group">
                  <div className="relative z-10 mt-1.5 shrink-0">
                    <div className={`h-[11px] w-[11px] rounded-full ${dotColor} ring-2 ring-card`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-semibold text-foreground tabular-nums">{evt.event_date}</span>
                      <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-accent text-muted-foreground">
                        {evt.category}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-foreground mb-1">{evt.label}</p>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {evt.description}
                      {citations.map((c, ci) => (
                        <CitationBadge key={ci} source={c} />
                      ))}
                    </p>

                    {citations.some((c) => c.excerpt) && (
                      <div className="mt-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity max-h-0 group-hover:max-h-96 overflow-hidden">
                        {citations
                          .filter((c) => c.excerpt)
                          .map((c, ci) => (
                            <div key={ci} className="flex items-start gap-2 pl-3 border-l-2 border-primary/20">
                              <span className="text-[10px] font-semibold text-primary shrink-0 mt-0.5">{c.page}</span>
                              <span className="text-[11px] text-foreground font-mono leading-relaxed">"{c.excerpt}"</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChronologyPanel;
