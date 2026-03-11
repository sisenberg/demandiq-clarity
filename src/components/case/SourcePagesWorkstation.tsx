import { useState, useMemo, useCallback } from "react";
import { useSourceDrawer, MOCK_SOURCE_PAGES, type SourcePage } from "./SourceDrawer";
import {
  Search,
  X,
  BookOpen,
  FileText,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Printer,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  List,
  Grid,
  ArrowUpDown,
  Eye,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────
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
  contradicting: "bg-destructive/10 text-destructive border-destructive/20",
  contextual: "bg-accent text-muted-foreground border-border",
};

type SortMode = "document" | "chronological";

const SourcePagesWorkstation = () => {
  const { openSource } = useSourceDrawer();
  const pages = MOCK_SOURCE_PAGES;

  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("document");
  const [filterType, setFilterType] = useState<string>("");
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  // Filter
  const filtered = useMemo(() => {
    let items = pages;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (p) => p.docName.toLowerCase().includes(q) || p.extractedText.toLowerCase().includes(q) || p.highlights.some((h) => h.text.toLowerCase().includes(q))
      );
    }
    if (filterType) items = items.filter((p) => p.documentType === filterType);
    return items;
  }, [pages, search, filterType]);

  // Sort / group
  const grouped = useMemo(() => {
    if (sortMode === "chronological") {
      // Flat sorted by page number across all docs
      return null;
    }
    const map = new Map<string, SourcePage[]>();
    filtered.forEach((p) => {
      if (!map.has(p.documentId)) map.set(p.documentId, []);
      map.get(p.documentId)!.push(p);
    });
    return map;
  }, [filtered, sortMode]);

  const chronologicalPages = useMemo(() => {
    if (sortMode !== "chronological") return [];
    return [...filtered].sort((a, b) => a.pageNumber - b.pageNumber);
  }, [filtered, sortMode]);

  const selectedPage = selectedPageId ? pages.find((p) => p.id === selectedPageId) : null;

  // Navigation
  const allPages = sortMode === "chronological" ? chronologicalPages : filtered;
  const currentIndex = selectedPage ? allPages.findIndex((p) => p.id === selectedPage.id) : -1;

  const navigate = (dir: -1 | 1) => {
    const nextIdx = currentIndex + dir;
    if (nextIdx >= 0 && nextIdx < allPages.length) setSelectedPageId(allPages[nextIdx].id);
  };

  const docTypes = [...new Set(pages.map((p) => p.documentType))];

  const handlePrint = useCallback(() => {
    if (!selectedPage) return;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(`<html><head><title>${selectedPage.docName} - Page ${selectedPage.pageNumber}</title><style>body{font-family:monospace;white-space:pre-wrap;padding:40px;font-size:12px;line-height:1.6;}</style></head><body>${selectedPage.extractedText}</body></html>`);
      w.document.close();
      w.print();
    }
  }, [selectedPage]);

  const handleDownload = useCallback(() => {
    if (!selectedPage) return;
    const blob = new Blob([selectedPage.extractedText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedPage.docName.replace(/\s+/g, "_")}_page${selectedPage.pageNumber}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedPage]);

  return (
    <div className="flex h-[calc(100vh-180px)] -m-5 border-t border-border">
      {/* LEFT: Page list / TOC */}
      <div className={`flex flex-col border-r border-border bg-card ${selectedPage ? "w-[280px] shrink-0" : "flex-1 max-w-2xl mx-auto"}`}>
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-border shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            <h3 className="text-[12px] font-semibold text-foreground flex-1">Source Pages</h3>
            <span className="text-[10px] text-muted-foreground">{filtered.length} pages</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex gap-px bg-accent rounded p-0.5">
              <button onClick={() => setSortMode("document")} className={`px-2 py-0.5 text-[9px] font-medium rounded transition-all ${sortMode === "document" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                By Document
              </button>
              <button onClick={() => setSortMode("chronological")} className={`px-2 py-0.5 text-[9px] font-medium rounded transition-all ${sortMode === "chronological" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                Chronological
              </button>
            </div>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="text-[9px] bg-accent border border-border rounded px-1.5 py-1 text-foreground outline-none ml-auto">
              <option value="">All Types</option>
              {docTypes.map((t) => <option key={t} value={t}>{DOC_TYPE_LABEL[t] ?? t}</option>)}
            </select>
          </div>

          <div className="relative mt-1.5">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search pages…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-7 pr-7 py-1.5 text-[10px] bg-accent/40 border border-border rounded-lg text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-primary/30"
            />
            {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="h-2.5 w-2.5 text-muted-foreground" /></button>}
          </div>
        </div>

        {/* Page list */}
        <div className="flex-1 overflow-y-auto">
          {sortMode === "document" && grouped && Array.from(grouped.entries()).map(([docId, docPages]) => (
            <div key={docId}>
              <div className="px-3 py-2 bg-accent/40 border-b border-border/50 flex items-center gap-1.5 sticky top-0 z-10">
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-semibold text-foreground truncate flex-1">{docPages[0].docName}</span>
                <code className="text-[8px] bg-accent px-1 py-0.5 rounded text-muted-foreground">{docPages.length}</code>
              </div>
              {docPages.map((page) => (
                <PageListItem
                  key={page.id}
                  page={page}
                  isSelected={selectedPageId === page.id}
                  compact={!!selectedPage}
                  onClick={() => setSelectedPageId(page.id)}
                />
              ))}
            </div>
          ))}

          {sortMode === "chronological" && chronologicalPages.map((page) => (
            <PageListItem
              key={page.id}
              page={page}
              isSelected={selectedPageId === page.id}
              compact={!!selectedPage}
              showDocName
              onClick={() => setSelectedPageId(page.id)}
            />
          ))}

          {filtered.length === 0 && (
            <div className="p-6 text-center">
              <p className="text-[11px] text-muted-foreground">No pages match your search.</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Page viewer */}
      {selectedPage && (
        <div className="flex-1 flex flex-col min-w-0 bg-background">
          {/* Viewer toolbar */}
          <div className="px-4 py-2 border-b border-border bg-card shrink-0 flex items-center gap-2">
            <button onClick={() => navigate(-1)} disabled={currentIndex <= 0} className="p-1 rounded text-muted-foreground hover:text-foreground disabled:text-muted-foreground/20">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-[11px] font-medium text-foreground tabular-nums">
              {currentIndex + 1} / {allPages.length}
            </span>
            <button onClick={() => navigate(1)} disabled={currentIndex >= allPages.length - 1} className="p-1 rounded text-muted-foreground hover:text-foreground disabled:text-muted-foreground/20">
              <ChevronRight className="h-4 w-4" />
            </button>

            <div className="h-4 w-px bg-border mx-1" />

            <span className="text-[11px] text-foreground font-medium truncate flex-1">{selectedPage.docName} — Page {selectedPage.pageNumber}</span>

            <div className="flex items-center gap-1">
              <button onClick={() => setZoom((z) => Math.max(50, z - 25))} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"><ZoomOut className="h-3.5 w-3.5" /></button>
              <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-center">{zoom}%</span>
              <button onClick={() => setZoom((z) => Math.min(200, z + 25))} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"><ZoomIn className="h-3.5 w-3.5" /></button>

              <div className="h-4 w-px bg-border mx-1" />

              <button onClick={() => setRotation((r) => (r + 90) % 360)} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent" title="Rotate"><RotateCw className="h-3.5 w-3.5" /></button>
              <button onClick={handlePrint} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent" title="Print"><Printer className="h-3.5 w-3.5" /></button>
              <button onClick={handleDownload} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent" title="Download"><Download className="h-3.5 w-3.5" /></button>
            </div>

            <button onClick={() => { setSelectedPageId(null); setZoom(100); setRotation(0); }} className="p-1 rounded text-muted-foreground hover:text-foreground ml-1">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Page content */}
          <div className="flex-1 overflow-auto p-6">
            {/* Highlights panel */}
            {selectedPage.highlights.length > 0 && (
              <div className="mb-4 space-y-1.5">
                {selectedPage.highlights.map((h, i) => (
                  <div key={i} className={`rounded-lg border p-2.5 ${
                    h.relevance === "direct" ? "border-primary/20 bg-primary/5" :
                    h.relevance === "contradicting" ? "border-destructive/20 bg-destructive/5" :
                    h.relevance === "corroborating" ? "border-[hsl(var(--status-approved)/0.2)] bg-[hsl(var(--status-approved-bg))]" :
                    "border-border bg-accent"
                  }`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-[8px] font-bold uppercase tracking-widest px-1 py-0.5 rounded border ${RELEVANCE_STYLE[h.relevance]}`}>{h.relevance}</span>
                      <span className="text-[9px] text-muted-foreground">Evidence Highlight</span>
                    </div>
                    <p className="text-[11px] text-foreground leading-relaxed font-mono">"{h.text}"</p>
                  </div>
                ))}
              </div>
            )}

            {/* Document text */}
            <div
              className="rounded-lg border border-border bg-card p-6 shadow-sm mx-auto"
              style={{
                maxWidth: `${Math.round(600 * (zoom / 100))}px`,
                transform: `rotate(${rotation}deg)`,
                transformOrigin: "top center",
              }}
            >
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">{DOC_TYPE_LABEL[selectedPage.documentType] ?? selectedPage.documentType}</span>
                <span className="text-[10px] text-muted-foreground">·</span>
                <span className="text-[10px] font-medium text-foreground">Page {selectedPage.pageNumber}</span>
              </div>
              <pre
                className="text-foreground leading-relaxed font-mono whitespace-pre-wrap"
                style={{ fontSize: `${Math.round(12 * (zoom / 100))}px` }}
              >
                {selectedPage.extractedText}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Page list item ──────────────────────────────────
function PageListItem({
  page,
  isSelected,
  compact,
  showDocName,
  onClick,
}: {
  page: SourcePage;
  isSelected: boolean;
  compact: boolean;
  showDocName?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 hover:bg-accent/30 transition-colors flex items-start gap-2 border-b border-border/20 ${
        isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""
      }`}
    >
      <div className="shrink-0 w-8 h-10 rounded border border-border bg-background flex flex-col items-center justify-center">
        <span className="text-[7px] font-medium text-muted-foreground">PG</span>
        <span className="text-[12px] font-bold text-foreground leading-none">{page.pageNumber}</span>
      </div>
      <div className="flex-1 min-w-0">
        {showDocName && <p className="text-[9px] font-semibold text-muted-foreground truncate mb-0.5">{page.docName}</p>}
        <p className="text-[10px] text-foreground line-clamp-2 leading-relaxed font-mono">
          {page.extractedText.substring(0, compact ? 80 : 150)}…
        </p>
        {page.highlights.length > 0 && (
          <div className="flex gap-1 mt-1">
            {page.highlights.map((h, i) => (
              <span key={i} className={`text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 rounded border ${RELEVANCE_STYLE[h.relevance]}`}>
                {h.relevance}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

export default SourcePagesWorkstation;
