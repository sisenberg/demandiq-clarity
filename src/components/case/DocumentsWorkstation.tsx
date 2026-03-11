import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useCaseDocuments, type DocumentRow } from "@/hooks/useDocuments";
import { useCasePackage } from "@/hooks/useCasePackage";
import { useSourceDrawer, MOCK_SOURCE_PAGES } from "./SourceDrawer";
import DocumentTypeTag from "./DocumentTypeTag";
import {
  Search,
  X,
  FileText,
  Calendar,
  SortAsc,
  SortDesc,
  Filter,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Stethoscope,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Eye,
} from "lucide-react";

import {
  DOCUMENT_STATUS_BADGE,
  PIPELINE_STAGE_LABEL,
  DOCUMENT_TYPE_LABEL,
  getDocumentStatusBadge,
  getPipelineStageLabel,
  isDocumentReady,
} from "@/lib/statuses";

const STATUS_BADGE = DOCUMENT_STATUS_BADGE;
const PIPELINE_LABELS = PIPELINE_STAGE_LABEL;
const DOC_TYPE_LABEL = DOCUMENT_TYPE_LABEL;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type SortMode = "chronological" | "original" | "type" | "status";

interface DocumentsWorkstationProps {
  documents: DocumentRow[];
  loading: boolean;
  caseId: string;
}

const DocumentsWorkstation = ({ documents, loading, caseId }: DocumentsWorkstationProps) => {
  const { openSource } = useSourceDrawer();
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("chronological");
  const [filterType, setFilterType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Filter
  const filtered = useMemo(() => {
    let items = documents;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((d) => d.file_name.toLowerCase().includes(q) || d.document_type.toLowerCase().includes(q));
    }
    if (filterType) items = items.filter((d) => d.document_type === filterType);
    if (filterStatus) items = items.filter((d) => d.document_status === filterStatus);
    return items;
  }, [documents, search, filterType, filterStatus]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortMode) {
      case "chronological": return arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case "original": return arr; // original upload order
      case "type": return arr.sort((a, b) => a.document_type.localeCompare(b.document_type));
      case "status": return arr.sort((a, b) => a.document_status.localeCompare(b.document_status));
    }
  }, [filtered, sortMode]);

  // Unique types / statuses for filters
  const types = [...new Set(documents.map((d) => d.document_type))];
  const statuses = [...new Set(documents.map((d) => d.document_status))];

  // Detail panel doc
  const selectedDoc = selectedDocId ? documents.find((d) => d.id === selectedDocId) : null;
  const selectedPages = selectedDoc
    ? MOCK_SOURCE_PAGES.filter((sp) => sp.docName.toLowerCase().includes(selectedDoc.file_name.toLowerCase().split("_")[0].toLowerCase().substring(0, 8)))
    : [];

  // Stats
  const totalPages = documents.reduce((s, d) => s + (d.page_count ?? 0), 0);
  const completeDocs = documents.filter((d) => isDocumentReady(d.document_status)).length;

  return (
    <div className="flex h-[calc(100vh-180px)] -m-5 border-t border-border">
      {/* LEFT: Document list */}
      <div className={`flex flex-col min-w-0 border-r border-border ${selectedDoc ? "w-[55%]" : "flex-1"}`}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-[12px] font-semibold text-foreground flex-1">
              Documents <span className="text-muted-foreground font-normal">({documents.length})</span>
            </h3>
            <span className="text-[10px] text-muted-foreground">{totalPages} pages · {completeDocs} processed</span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Sort */}
            <div className="flex gap-px bg-accent rounded-lg p-0.5">
              {([
                { key: "chronological" as SortMode, label: "Date" },
                { key: "original" as SortMode, label: "Upload Order" },
                { key: "type" as SortMode, label: "Type" },
              ]).map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSortMode(s.key)}
                  className={`px-2 py-1 text-[10px] font-medium rounded-md transition-all ${
                    sortMode === s.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex-1" />

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-lg border transition-all ${
                showFilters || filterType || filterStatus ? "bg-primary/10 text-primary border-primary/20" : "bg-accent/40 text-muted-foreground border-border"
              }`}
            >
              <Filter className="h-3 w-3" /> Filters
            </button>

            <div className="relative w-44">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search documents…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-7 pr-7 py-1.5 text-[11px] bg-accent/40 border border-border rounded-lg text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-primary/30"
              />
              {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="h-3 w-3 text-muted-foreground" /></button>}
            </div>
          </div>

          {/* Filter row */}
          {showFilters && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="text-[10px] bg-accent border border-border rounded px-2 py-1 text-foreground outline-none">
                <option value="">All Types</option>
                {types.map((t) => <option key={t} value={t}>{DOC_TYPE_LABEL[t] ?? t}</option>)}
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-[10px] bg-accent border border-border rounded px-2 py-1 text-foreground outline-none">
                <option value="">All Statuses</option>
                {statuses.map((s) => <option key={s} value={s}>{STATUS_BADGE[s]?.label ?? s}</option>)}
              </select>
              {(filterType || filterStatus) && (
                <button onClick={() => { setFilterType(""); setFilterStatus(""); }} className="text-[10px] text-primary font-medium">Clear</button>
              )}
            </div>
          )}
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1,2,3,4,5].map((i) => <div key={i} className="animate-pulse h-16 bg-accent rounded-lg" />)}
            </div>
          ) : sorted.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-[11px] text-muted-foreground">No documents match your filters.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {sorted.map((doc) => {
                const status = getDocumentStatusBadge(doc.document_status);
                const isSelected = selectedDocId === doc.id;
                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDocId(isSelected ? null : doc.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-accent/20 transition-colors flex items-start gap-3 ${
                      isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""
                    }`}
                  >
                    {/* Doc icon */}
                    <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
                      <FileText className="h-4.5 w-4.5 text-muted-foreground" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-foreground truncate">{doc.file_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <DocumentTypeTag type={doc.document_type} />
                        <span className="text-[10px] text-muted-foreground">{formatBytes(doc.file_size_bytes)}</span>
                        {doc.page_count && <span className="text-[10px] text-muted-foreground">{doc.page_count} pg</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${status.className}`}>
                          {status.label}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {formatDate(doc.created_at)}
                        </span>
                        <code className="text-[9px] bg-accent text-muted-foreground px-1 py-0.5 rounded font-mono">
                          {PIPELINE_LABELS[doc.pipeline_stage] ?? doc.pipeline_stage}
                        </code>
                      </div>
                    </div>

                    <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-1 transition-transform ${isSelected ? "rotate-90 text-primary" : ""}`} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Document detail panel */}
      {selectedDoc && (
        <div className="flex-1 flex flex-col min-w-0 bg-background">
          {/* Detail header */}
          <div className="px-4 py-3 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-foreground truncate">{selectedDoc.file_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <DocumentTypeTag type={selectedDoc.document_type} />
                  <span className="text-[10px] text-muted-foreground">{formatBytes(selectedDoc.file_size_bytes)}</span>
                  {selectedDoc.page_count && <span className="text-[10px] text-muted-foreground">{selectedDoc.page_count} pages</span>}
                </div>
              </div>
              <Link
                to={`/documents/${selectedDoc.id}`}
                className="flex items-center gap-1 text-[10px] text-primary font-medium hover:text-primary/80"
              >
                Full Detail <ExternalLink className="h-3 w-3" />
              </Link>
              <button onClick={() => setSelectedDocId(null)} className="p-1 rounded text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Detail content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Metadata grid */}
            <div className="grid grid-cols-2 gap-3">
              <MetaItem label="Status" value={getDocumentStatusBadge(selectedDoc.document_status).label} />
              <MetaItem label="Pipeline Stage" value={getPipelineStageLabel(selectedDoc.pipeline_stage)} />
              <MetaItem label="Uploaded" value={formatDate(selectedDoc.created_at)} />
              <MetaItem label="Extracted" value={selectedDoc.extracted_at ? formatDate(selectedDoc.extracted_at) : "Pending"} />
            </div>

            {/* Linked source pages */}
            {selectedPages.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Source Pages ({selectedPages.length})</h4>
                <div className="space-y-2">
                  {selectedPages.map((sp) => (
                    <button
                      key={sp.id}
                      onClick={() => openSource({ docName: sp.docName, page: sp.pageLabel, excerpt: sp.highlights[0]?.text, relevance: sp.highlights[0]?.relevance as any })}
                      className="w-full text-left rounded-lg border border-border p-3 hover:border-primary/30 transition-colors group"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">Page {sp.pageNumber}</span>
                        {sp.highlights.length > 0 && (
                          <span className="text-[9px] text-muted-foreground">{sp.highlights.length} highlights</span>
                        )}
                        <Eye className="h-3 w-3 text-muted-foreground/40 ml-auto group-hover:text-primary transition-colors" />
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3 font-mono">
                        {sp.extractedText.substring(0, 200)}…
                      </p>
                      {sp.highlights.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {sp.highlights.map((h, i) => {
                            const relStyle: Record<string, string> = {
                              direct: "bg-primary/10 text-primary border-primary/20",
                              corroborating: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))] border-[hsl(var(--status-approved)/0.2)]",
                              contradicting: "bg-destructive/10 text-destructive border-destructive/20",
                              contextual: "bg-accent text-muted-foreground border-border",
                            };
                            return (
                              <span key={i} className={`text-[8px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded border ${relStyle[h.relevance] ?? ""}`}>
                                {h.relevance}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedPages.length === 0 && (
              <div className="text-center py-6">
                <BookOpen className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-[11px] text-muted-foreground">No extracted source pages available for this document.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest block mb-0.5">{label}</span>
      <span className="text-[12px] font-medium text-foreground">{value}</span>
    </div>
  );
}

export default DocumentsWorkstation;
