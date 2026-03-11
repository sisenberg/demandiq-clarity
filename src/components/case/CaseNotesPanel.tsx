import { useState, useRef, useCallback } from "react";
import {
  Pencil,
  Download,
  MoreHorizontal,
  Plus,
  ChevronRight,
  Check,
  X,
  FileText,
  FileDown,
  Copy,
  CheckCircle,
  Clock,
  Eye,
  Send,
  RotateCcw,
} from "lucide-react";
import { EvidenceStatement, CitationBadge, type CitationSource } from "./EvidenceCitation";
import { useCasePackage } from "@/hooks/useCasePackage";
import type { EvidenceReference, ClaimAssessmentSection, ClaimAssessmentBlock } from "@/types";
import { ReviewStatus } from "@/types";

// ─── Helpers ────────────────────────────────────────
function refsToCS(refs: EvidenceReference[]): CitationSource[] {
  return refs.map((r) => ({
    docName: r.doc_name,
    page: r.page_label,
    excerpt: r.quoted_text,
    relevance: r.relevance as any,
  }));
}

// ─── Review state UI mapping ────────────────────────
const REVIEW_STATUS_META: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  [ReviewStatus.Draft]: { label: "Draft", className: "bg-accent text-muted-foreground border-border", icon: FileText },
  [ReviewStatus.InReview]: { label: "In Review", className: "bg-[hsl(var(--status-review-bg))] text-[hsl(var(--status-review-foreground))] border-[hsl(var(--status-review)/0.2)]", icon: Eye },
  [ReviewStatus.Approved]: { label: "Approved", className: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))] border-[hsl(var(--status-approved)/0.2)]", icon: CheckCircle },
  [ReviewStatus.Published]: { label: "Published", className: "bg-primary/10 text-primary border-primary/20", icon: Send },
};

// ─── Sub-tab definitions ────────────────────────────
interface SubTab { key: string; label: string; }

const TABS: SubTab[] = [
  { key: "claim", label: "Claim Assessment" },
  { key: "chrono", label: "Chronological Summary" },
  { key: "codes", label: "Medical Codes" },
  { key: "billing", label: "Billing" },
  { key: "providers", label: "Providers" },
  { key: "demand", label: "Demand Package" },
];

// ─── Component ──────────────────────────────────────
const CaseNotesPanel = () => {
  const { demandIQ } = useCasePackage();
  const [activeTab, setActiveTab] = useState("claim");
  const [isEditing, setIsEditing] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>(demandIQ.review_status);
  const [lastEditedBy] = useState(demandIQ.last_edited_by);
  const [lastEditedAt, setLastEditedAt] = useState(demandIQ.last_edited_at);

  const exportRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  const handleExport = useCallback((format: "pdf" | "docx") => {
    console.log(`[Export] Generating ${format.toUpperCase()} export for tab: ${activeTab}`);
    setShowExportMenu(false);
  }, [activeTab]);

  const handleStatusChange = useCallback((status: ReviewStatus) => {
    setReviewStatus(status);
    setLastEditedAt(new Date().toISOString());
    setShowMoreMenu(false);
  }, []);

  const toggleEdit = useCallback(() => {
    if (isEditing) {
      setLastEditedAt(new Date().toISOString());
    }
    setIsEditing((prev) => !prev);
  }, [isEditing]);

  const statusMeta = REVIEW_STATUS_META[reviewStatus];
  const StatusIcon = statusMeta.icon;

  // Get tab content from DemandIQ output
  const TAB_CONTENT: Record<string, { title: string; items: string[] }> = {
    chrono: { title: "Chronological Summary", items: demandIQ.chronological_summary },
    codes: { title: "Medical Codes", items: demandIQ.medical_codes },
    billing: { title: "Billing Summary", items: demandIQ.billing_summary },
    providers: { title: "Provider Summary", items: demandIQ.provider_summary },
    demand: { title: "Demand Package", items: demandIQ.demand_package },
  };

  return (
    <div className="card-elevated overflow-hidden">
      {/* ── Header ────────────────────────── */}
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-3 bg-card">
        <h2 className="text-sm font-semibold text-foreground">Case Notes</h2>

        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusMeta.className}`}>
          <StatusIcon className="h-3 w-3" />
          {statusMeta.label}
        </span>

        <div className="flex-1" />

        <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {lastEditedBy} · {formatRelativeTime(lastEditedAt)}
        </span>

        <div className="flex items-center gap-1.5">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <button onClick={toggleEdit} className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                <Check className="h-3.5 w-3.5" /><span className="hidden sm:inline">Save</span>
              </button>
              <button onClick={() => setIsEditing(false)} className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <ActionButton icon={Pencil} label="Edit" onClick={toggleEdit} />
          )}

          <div className="relative" ref={exportRef}>
            <ActionButton icon={Download} label="Export" onClick={() => { setShowExportMenu(!showExportMenu); setShowMoreMenu(false); }} />
            {showExportMenu && (
              <DropdownMenu onClose={() => setShowExportMenu(false)}>
                <DropdownItem icon={FileText} label="Export as PDF" onClick={() => handleExport("pdf")} />
                <DropdownItem icon={FileDown} label="Export as DOCX" onClick={() => handleExport("docx")} />
              </DropdownMenu>
            )}
          </div>

          <div className="relative" ref={moreRef}>
            <ActionButton icon={MoreHorizontal} onClick={() => { setShowMoreMenu(!showMoreMenu); setShowExportMenu(false); }} />
            {showMoreMenu && (
              <DropdownMenu onClose={() => setShowMoreMenu(false)}>
                <DropdownItem icon={Copy} label="Duplicate Section" onClick={() => setShowMoreMenu(false)} />
                <div className="h-px bg-border my-1" />
                <p className="px-3 py-1 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Review Status</p>
                <DropdownItem icon={FileText} label="Mark as Draft" active={reviewStatus === ReviewStatus.Draft} onClick={() => handleStatusChange(ReviewStatus.Draft)} />
                <DropdownItem icon={Eye} label="Send to Review" active={reviewStatus === ReviewStatus.InReview} onClick={() => handleStatusChange(ReviewStatus.InReview)} />
                <DropdownItem icon={CheckCircle} label="Approve" active={reviewStatus === ReviewStatus.Approved} onClick={() => handleStatusChange(ReviewStatus.Approved)} />
                <DropdownItem icon={Send} label="Publish" active={reviewStatus === ReviewStatus.Published} onClick={() => handleStatusChange(ReviewStatus.Published)} />
                <div className="h-px bg-border my-1" />
                <DropdownItem icon={RotateCcw} label="View Edit History" onClick={() => setShowMoreMenu(false)} />
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="px-5 py-2 bg-primary/5 border-b border-primary/10 flex items-center gap-2">
          <Pencil className="h-3 w-3 text-primary" />
          <span className="text-[11px] font-medium text-primary">Editing mode — click section text to edit. Citations are preserved.</span>
        </div>
      )}

      {/* ── Sub-tabs ──────────────────────── */}
      <div className="border-b border-border bg-card">
        <div className="flex items-center px-5 overflow-x-auto">
          {TABS.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`relative px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors ${activeTab === tab.key ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              {tab.label}
              {activeTab === tab.key && <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-primary rounded-full" />}
            </button>
          ))}
          <button className="ml-1 p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Content ───────────────────────── */}
      <div className="bg-card">
        {activeTab === "claim" ? (
          <ClaimAssessmentContent sections={demandIQ.claim_assessment} isEditing={isEditing} />
        ) : (
          <PlaceholderTabContent data={TAB_CONTENT[activeTab]} isEditing={isEditing} />
        )}
      </div>
    </div>
  );
};

// ─── Claim Assessment ───────────────────────────────
const ClaimAssessmentContent = ({ sections, isEditing }: { sections: ClaimAssessmentSection[]; isEditing: boolean }) => {
  const [expanded, setExpanded] = useState<Record<number, boolean>>(
    Object.fromEntries(sections.map((_, i) => [i, true]))
  );
  const [editedTexts, setEditedTexts] = useState<Record<string, string>>({});

  const toggle = (idx: number) => setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }));
  const getKey = (si: number, bi: number) => `${si}-${bi}`;
  const handleTextChange = (si: number, bi: number, value: string) => {
    setEditedTexts((prev) => ({ ...prev, [getKey(si, bi)]: value }));
  };

  return (
    <div className="divide-y divide-border">
      {sections.map((section, idx) => (
        <div key={idx}>
          <button onClick={() => toggle(idx)} className="w-full flex items-center gap-2 px-5 py-3 text-left hover:bg-accent/30 transition-colors">
            <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded[idx] ? "rotate-90" : ""}`} />
            <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
          </button>

          {expanded[idx] && (
            <div className="px-5 pb-4 pl-10 flex flex-col gap-2.5">
              {section.content.map((block, bi) => {
                const key = getKey(idx, bi);
                const currentText = editedTexts[key] ?? block.text;
                const citations = refsToCS(block.evidence_refs);

                return isEditing ? (
                  <div key={bi} className="group">
                    <textarea
                      value={currentText}
                      onChange={(e) => handleTextChange(idx, bi, e.target.value)}
                      className="w-full text-sm text-foreground leading-relaxed bg-background border border-input rounded-lg px-3 py-2 resize-y min-h-[60px] outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-colors font-sans"
                      rows={Math.max(2, Math.ceil(currentText.length / 100))}
                    />
                    {citations.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5 pl-1">
                        {citations.map((c, ci) => <CitationBadge key={ci} source={c} />)}
                      </div>
                    )}
                  </div>
                ) : (
                  <p key={bi} className="text-sm text-foreground leading-relaxed">
                    <EvidenceStatement text={currentText} citations={citations} />
                  </p>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ─── Placeholder tab ────────────────────────────────
const PlaceholderTabContent = ({ data, isEditing }: { data?: { title: string; items: string[] }; isEditing: boolean }) => {
  const [editedItems, setEditedItems] = useState<Record<number, string>>({});

  if (!data) return <div className="px-5 py-8 text-center text-xs text-muted-foreground">Tab content coming soon.</div>;

  return (
    <div className="px-5 py-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">{data.title}</h3>
      <div className="flex flex-col gap-2">
        {data.items.map((item, i) => {
          const currentText = editedItems[i] ?? item;
          return (
            <div key={i} className="flex items-start gap-2.5 py-1.5">
              <span className="text-[10px] font-mono text-muted-foreground mt-0.5 shrink-0 w-4 text-right">{i + 1}.</span>
              {isEditing ? (
                <input type="text" value={currentText} onChange={(e) => setEditedItems((prev) => ({ ...prev, [i]: e.target.value }))} className="flex-1 text-sm text-foreground leading-relaxed bg-background border border-input rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-colors" />
              ) : (
                <p className="text-sm text-foreground leading-relaxed">{currentText}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Dropdown Menu ──────────────────────────────────
function DropdownMenu({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 min-w-[180px] rounded-xl border border-border bg-card shadow-lg z-50 py-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
        {children}
      </div>
    </>
  );
}

function DropdownItem({ icon: Icon, label, onClick, active }: { icon: React.ElementType; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium transition-colors ${active ? "text-primary bg-primary/5" : "text-foreground hover:bg-accent"}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" /><span>{label}</span>
      {active && <Check className="h-3 w-3 ml-auto text-primary" />}
    </button>
  );
}

function ActionButton({ icon: Icon, label, onClick }: { icon: React.ElementType; label?: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title={label}>
      <Icon className="h-3.5 w-3.5" />
      {label && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default CaseNotesPanel;
