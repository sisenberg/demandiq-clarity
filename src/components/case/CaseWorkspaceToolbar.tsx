import { useState, useRef, useEffect } from "react";
import {
  Search,
  Download,
  RefreshCw,
  MoreHorizontal,
  FileDown,
  FileText,
  Printer,
  Copy,
  Trash2,
  Archive,
} from "lucide-react";

interface CaseWorkspaceToolbarProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const CaseWorkspaceToolbar = ({ onRefresh, isRefreshing }: CaseWorkspaceToolbarProps) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="flex items-center gap-1.5">
      {/* Find Evidence */}
      {searchOpen ? (
        <div className="search-input w-64">
          <Search className="h-3 w-3 shrink-0" />
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onBlur={() => { if (!searchQuery) setSearchOpen(false); }}
            placeholder="Find evidence for statement…"
          />
        </div>
      ) : (
        <button
          onClick={() => setSearchOpen(true)}
          className="btn-ghost text-[11px]"
        >
          <Search className="h-3 w-3" />
          Find Evidence
        </button>
      )}

      <div className="w-px h-4 bg-border mx-1" />

      {/* Export dropdown */}
      <div className="relative" ref={exportRef}>
        <button
          onClick={() => setExportOpen(!exportOpen)}
          className="btn-ghost text-[11px]"
        >
          <Download className="h-3 w-3" />
          Export
        </button>
        {exportOpen && (
          <div className="absolute top-full right-0 mt-1 w-48 bg-popover border border-border rounded-lg shadow-lg z-30 py-1">
            {[
              { icon: FileDown, label: "Export as PDF" },
              { icon: FileText, label: "Export as DOCX" },
              { icon: FileDown, label: "Export with Exhibits" },
              { icon: Printer, label: "Print Preview" },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => setExportOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
              >
                <item.icon className="h-3 w-3" />
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Refresh */}
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="btn-ghost text-[11px]"
        title="Re-run analysis"
      >
        <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
      </button>

      {/* More menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="btn-ghost"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
        {menuOpen && (
          <div className="absolute top-full right-0 mt-1 w-44 bg-popover border border-border rounded-lg shadow-lg z-30 py-1">
            {[
              { icon: Copy, label: "Duplicate Case" },
              { icon: Archive, label: "Archive Case" },
              { icon: Trash2, label: "Delete Case", danger: true },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => setMenuOpen(false)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] transition-colors ${
                  item.danger
                    ? "text-destructive hover:bg-destructive/5"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
              >
                <item.icon className="h-3 w-3" />
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CaseWorkspaceToolbar;
