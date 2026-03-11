import { BookOpen, ExternalLink } from "lucide-react";

export interface CitationSource {
  docName: string;
  page: string;
  excerpt?: string;
  relevance?: "direct" | "corroborating" | "contradicting" | "contextual";
}

const RELEVANCE_STYLE: Record<string, string> = {
  direct: "bg-primary/10 text-primary border-primary/20",
  corroborating: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))] border-[hsl(var(--status-approved)/0.2)]",
  contradicting: "bg-[hsl(var(--status-failed-bg))] text-[hsl(var(--status-failed-foreground))] border-[hsl(var(--status-failed)/0.2)]",
  contextual: "bg-accent text-muted-foreground border-border",
};

/**
 * Inline citation badge — renders like [Source: doc, pg. X]
 */
export const CitationBadge = ({ source }: { source: CitationSource }) => {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border bg-primary/5 text-primary border-primary/15 cursor-pointer hover:bg-primary/10 transition-colors ml-1"
      title={`${source.docName} — ${source.page}${source.excerpt ? `\n"${source.excerpt}"` : ""}`}
    >
      <BookOpen className="h-2.5 w-2.5" />
      {source.page}
    </span>
  );
};

/**
 * Full citation block — source reference with optional excerpt
 */
export const CitationBlock = ({ source }: { source: CitationSource }) => {
  const relStyle = RELEVANCE_STYLE[source.relevance ?? "direct"];

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${relStyle}`}>
          {source.relevance ?? "direct"}
        </span>
        <span className="text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
          {source.page}
        </span>
        <span className="text-xs font-medium text-foreground truncate flex-1">{source.docName}</span>
        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 cursor-pointer hover:text-primary transition-colors" />
      </div>
      {source.excerpt && (
        <blockquote className="text-xs text-foreground leading-relaxed pl-3 border-l-2 border-primary/30 mt-2 font-mono">
          "{source.excerpt}"
        </blockquote>
      )}
    </div>
  );
};

/**
 * Renders text with inline citation badges after it
 */
export const EvidenceStatement = ({
  text,
  citations,
  className = "",
}: {
  text: string;
  citations: CitationSource[];
  className?: string;
}) => {
  return (
    <span className={className}>
      {text}
      {citations.map((c, i) => (
        <CitationBadge key={i} source={c} />
      ))}
    </span>
  );
};
