import { BookOpen, ExternalLink } from "lucide-react";
import { useSourceDrawer } from "./SourceDrawer";

export interface CitationSource {
  docName: string;
  page: string;
  excerpt?: string;
  relevance?: "direct" | "corroborating" | "contradicting" | "contextual";
  /** Database document ID for deep-link resolution */
  documentId?: string;
  /** Evidence anchor ID */
  anchorId?: string;
  /** Parse version the citation refers to */
  parseVersion?: number;
  /** Chunk ID for chunk-level resolution */
  chunkId?: string;
}

const RELEVANCE_STYLE: Record<string, string> = {
  direct: "bg-primary/10 text-primary border-primary/20",
  corroborating: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))] border-[hsl(var(--status-approved)/0.2)]",
  contradicting: "bg-[hsl(var(--status-failed-bg))] text-[hsl(var(--status-failed-foreground))] border-[hsl(var(--status-failed)/0.2)]",
  contextual: "bg-accent text-muted-foreground border-border",
};

/**
 * Inline citation badge — clickable, opens source drawer
 */
export const CitationBadge = ({ source }: { source: CitationSource }) => {
  const { openSource } = useSourceDrawer();

  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        openSource(source);
      }}
      className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-[2px] rounded-md border bg-primary/4 text-primary border-primary/12 cursor-pointer hover:bg-primary/10 hover:border-primary/20 active:bg-primary/15 transition-all duration-100 ml-1"
      title={`${source.docName} — ${source.page}${source.excerpt ? `\n"${source.excerpt}"` : ""}`}
    >
      <BookOpen className="h-2 w-2" />
      {source.page}
    </span>
  );
};

/**
 * Full citation block — source reference with optional excerpt
 */
export const CitationBlock = ({ source }: { source: CitationSource }) => {
  const { openSource } = useSourceDrawer();
  const relStyle = RELEVANCE_STYLE[source.relevance ?? "direct"];

  return (
    <div
      className="rounded-lg border border-border bg-background p-3 cursor-pointer hover:border-primary/20 hover:shadow-sm transition-all duration-150 group"
      onClick={() => openSource(source)}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${relStyle}`}>
          {source.relevance ?? "direct"}
        </span>
        <span className="text-[10px] font-semibold bg-primary/8 text-primary px-1.5 py-0.5 rounded-md">
          {source.page}
        </span>
        <span className="text-[11px] font-medium text-foreground truncate flex-1">{source.docName}</span>
        <ExternalLink className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary transition-colors" />
      </div>
      {source.excerpt && (
        <blockquote className="text-[11px] text-foreground/80 leading-relaxed pl-3 border-l-2 border-primary/20 mt-2 evidence-text">
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
