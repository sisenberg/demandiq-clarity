import { useState } from "react";
import { useSourceDrawer } from "./SourceDrawer";
import { MOCK_SOURCE_PAGES, type SourcePage } from "./SourceDrawer";
import WorkspaceCard from "./WorkspaceCard";
import { BookOpen, FileText, Search, Filter } from "lucide-react";

const DOC_TYPE_LABEL: Record<string, string> = {
  police_report: "Police Report",
  medical_record: "Medical Record",
  imaging_report: "Imaging Report",
  expert_report: "Expert Report",
  legal_filing: "Legal Filing",
  correspondence: "Correspondence",
};

const RELEVANCE_STYLE: Record<string, string> = {
  direct: "bg-primary/10 text-primary border-primary/20",
  corroborating: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))] border-[hsl(var(--status-approved)/0.2)]",
  contradicting: "bg-[hsl(var(--status-failed-bg))] text-[hsl(var(--status-failed-foreground))] border-[hsl(var(--status-failed)/0.2)]",
  contextual: "bg-accent text-muted-foreground border-border",
};

const SourcePagesPanel = () => {
  const { openSource } = useSourceDrawer();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const docTypes = [...new Set(MOCK_SOURCE_PAGES.map((p) => p.documentType))];

  const filtered = MOCK_SOURCE_PAGES.filter((p) => {
    if (filterType !== "all" && p.documentType !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.docName.toLowerCase().includes(q) ||
        p.extractedText.toLowerCase().includes(q) ||
        p.highlights.some((h) => h.text.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Group by document
  const grouped = filtered.reduce<Record<string, SourcePage[]>>((acc, page) => {
    const key = page.documentId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(page);
    return acc;
  }, {});

  return (
    <WorkspaceCard
      icon={BookOpen}
      title="Source Pages"
      count={MOCK_SOURCE_PAGES.length}
      actions={
        <div className="flex items-center gap-2">
          {/* Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-[11px] font-medium px-2 py-1.5 rounded-lg border border-border bg-card text-foreground outline-none focus:ring-2 focus:ring-ring/40"
          >
            <option value="all">All Types</option>
            {docTypes.map((t) => (
              <option key={t} value={t}>{DOC_TYPE_LABEL[t] ?? t}</option>
            ))}
          </select>
        </div>
      }
    >
      {/* Search */}
      <div className="px-5 py-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search source text, documents…"
            className="w-full pl-9 pr-3 py-2 text-xs border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Results */}
      <div className="divide-y divide-border">
        {Object.entries(grouped).map(([docId, pages]) => (
          <div key={docId}>
            {/* Document header */}
            <div className="px-5 py-2.5 bg-muted/30 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">{pages[0].docName}</span>
              <span className="text-[10px] text-muted-foreground">
                {pages.length} page{pages.length !== 1 ? "s" : ""}
              </span>
              <code className="ml-auto text-[10px] bg-accent px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                {DOC_TYPE_LABEL[pages[0].documentType] ?? pages[0].documentType}
              </code>
            </div>

            {/* Page cards */}
            {pages.map((page) => (
              <button
                key={page.id}
                onClick={() =>
                  openSource({
                    docName: page.docName,
                    page: page.pageLabel,
                    excerpt: page.highlights[0]?.text,
                    relevance: page.highlights[0]?.relevance as any,
                  })
                }
                className="w-full text-left px-5 py-3.5 hover:bg-accent/30 transition-colors flex gap-3"
              >
                {/* Page number */}
                <div className="shrink-0 w-12 h-16 rounded-lg border border-border bg-background flex flex-col items-center justify-center">
                  <span className="text-[9px] font-medium text-muted-foreground uppercase">Page</span>
                  <span className="text-lg font-bold text-foreground">{page.pageNumber}</span>
                </div>

                {/* Content preview */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground leading-relaxed line-clamp-2 font-mono mb-2">
                    {page.extractedText.substring(0, 150)}…
                  </p>

                  {/* Highlights */}
                  {page.highlights.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {page.highlights.map((h, i) => (
                        <span
                          key={i}
                          className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${RELEVANCE_STYLE[h.relevance]}`}
                        >
                          {h.relevance}
                        </span>
                      ))}
                      <span className="text-[10px] text-muted-foreground">
                        {page.highlights.length} highlight{page.highlights.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-xs text-muted-foreground">No source pages match your search.</p>
          </div>
        )}
      </div>
    </WorkspaceCard>
  );
};

export default SourcePagesPanel;
