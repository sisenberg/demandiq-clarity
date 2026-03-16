/**
 * Intake Field Provenance Panel
 *
 * Allows tracing any published field back to its OCR source document and page.
 * Supports filtering by section, version, and reviewer action.
 */

import { useState, useMemo } from "react";
import {
  FileText, Eye, User, Clock, ChevronDown, ChevronRight,
  Shield, Search, Filter, CheckCircle2, Pencil, Zap, AlertTriangle,
} from "lucide-react";
import {
  useIntakeFieldProvenance,
  REVIEWER_ACTION_LABEL,
  PUBLISH_EVENT_LABEL,
  type IntakeFieldProvenanceRow,
} from "@/hooks/useIntakeFieldProvenance";

interface Props {
  caseId: string;
  version?: number;
}

const SECTION_LABELS: Record<string, string> = {
  demand: "Demand Fields",
  specials: "Medical Specials",
  treatment: "Treatment Timeline",
  injury: "Injury Facts",
};

const ACTION_ICON: Record<string, React.ElementType> = {
  auto_accepted: Zap,
  human_verified: CheckCircle2,
  human_corrected: Pencil,
  unverified: AlertTriangle,
};

const ACTION_COLOR: Record<string, string> = {
  auto_accepted: "text-muted-foreground",
  human_verified: "text-[hsl(var(--status-approved))]",
  human_corrected: "text-primary",
  unverified: "text-[hsl(var(--status-attention))]",
};

const IntakeProvenancePanel = ({ caseId, version }: Props) => {
  const { data: records, isLoading } = useIntakeFieldProvenance(caseId, version);
  const [filterSection, setFilterSection] = useState<string>("all");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!records) return [];
    return records.filter((r) => {
      if (filterSection !== "all" && r.section !== filterSection) return false;
      if (filterAction !== "all" && r.reviewer_action !== filterAction) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.field_name.toLowerCase().includes(q) ||
          r.final_value.toLowerCase().includes(q) ||
          r.extracted_value.toLowerCase().includes(q) ||
          (r.source_snippet ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, filterSection, filterAction, search]);

  const stats = useMemo(() => {
    if (!records) return { total: 0, corrected: 0, verified: 0, auto: 0 };
    return {
      total: records.length,
      corrected: records.filter((r) => r.reviewer_action === "human_corrected").length,
      verified: records.filter((r) => r.reviewer_action === "human_verified").length,
      auto: records.filter((r) => r.reviewer_action === "auto_accepted").length,
    };
  }, [records]);

  if (isLoading) {
    return (
      <div className="card-elevated p-5 flex items-center justify-center">
        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="card-elevated overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h3 className="text-[13px] font-semibold text-foreground">Field Provenance Audit Trail</h3>
          </div>
          <span className="text-[9px] font-mono text-muted-foreground tabular-nums">
            {stats.total} fields traced
          </span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-3">
          <StatChip icon={Zap} label="Auto" count={stats.auto} color="text-muted-foreground" />
          <StatChip icon={CheckCircle2} label="Verified" count={stats.verified} color="text-[hsl(var(--status-approved))]" />
          <StatChip icon={Pencil} label="Corrected" count={stats.corrected} color="text-primary" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search fields, values, snippets…"
              className="w-full pl-7 pr-3 py-1.5 text-[10px] rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <select
            value={filterSection}
            onChange={(e) => setFilterSection(e.target.value)}
            className="text-[10px] px-2 py-1.5 rounded-md border border-border bg-background text-foreground"
          >
            <option value="all">All Sections</option>
            {Object.entries(SECTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="text-[10px] px-2 py-1.5 rounded-md border border-border bg-background text-foreground"
          >
            <option value="all">All Actions</option>
            {Object.entries(REVIEWER_ACTION_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Records list */}
      <div className="max-h-[500px] overflow-y-auto divide-y divide-border">
        {filtered.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <Filter className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-[11px] text-muted-foreground">No provenance records match your filters.</p>
          </div>
        ) : (
          filtered.map((rec) => (
            <ProvenanceRow
              key={rec.id}
              record={rec}
              expanded={expandedId === rec.id}
              onToggle={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ─── Sub-components ─────────────────────────────────────

function ProvenanceRow({ record, expanded, onToggle }: {
  record: IntakeFieldProvenanceRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const ActionIcon = ACTION_ICON[record.reviewer_action] ?? Zap;
  const actionColor = ACTION_COLOR[record.reviewer_action] ?? "text-muted-foreground";
  const hasCorrected = record.corrected_value != null && record.corrected_value !== record.extracted_value;

  return (
    <div className="group">
      <button
        onClick={onToggle}
        className="w-full px-5 py-3 text-left hover:bg-accent/30 transition-colors flex items-start gap-3"
      >
        <div className="shrink-0 pt-0.5">
          {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
              {SECTION_LABELS[record.section] ?? record.section}
            </span>
            <span className="text-[8px] text-muted-foreground">·</span>
            <span className="text-[10px] font-medium text-foreground">{record.field_name}</span>
            {hasCorrected && (
              <span className="text-[7px] font-bold uppercase tracking-wider px-1.5 py-0 rounded bg-primary/10 text-primary">
                Corrected
              </span>
            )}
          </div>
          <p className={`text-[11px] truncate ${hasCorrected ? "text-primary font-medium" : "text-foreground"}`}>
            {record.final_value || <span className="text-muted-foreground italic">Empty</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ActionIcon className={`h-3 w-3 ${actionColor}`} />
          <span className={`text-[8px] font-semibold ${actionColor}`}>
            {REVIEWER_ACTION_LABEL[record.reviewer_action] ?? record.reviewer_action}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pl-11 pb-4 space-y-2 bg-accent/10">
          {/* Source traceability */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            <DetailItem label="Extracted Value" value={record.extracted_value} />
            <DetailItem label="Final Value" value={record.final_value} highlight={hasCorrected} />
            {hasCorrected && <DetailItem label="Corrected Value" value={record.corrected_value ?? ""} highlight />}
            <DetailItem label="Package Version" value={`v${record.intake_package_version}`} />
            <DetailItem label="Publish Event" value={PUBLISH_EVENT_LABEL[record.publish_event] ?? record.publish_event} />
          </div>

          {/* Source document link */}
          {record.source_document_id && (
            <div className="flex items-center gap-2 mt-2 p-2 rounded-md border border-border bg-card">
              <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-mono text-muted-foreground truncate">
                  Doc: {record.source_document_id.slice(0, 12)}…
                </p>
                {record.source_page != null && (
                  <p className="text-[9px] text-muted-foreground">Page {record.source_page}</p>
                )}
              </div>
              {record.source_snippet && (
                <div className="text-[9px] text-muted-foreground max-w-[200px] truncate italic">
                  "{record.source_snippet.slice(0, 80)}"
                </div>
              )}
            </div>
          )}

          {/* Reviewer info */}
          {record.reviewer_user_id && (
            <div className="flex items-center gap-3 text-[8px] text-muted-foreground">
              <div className="flex items-center gap-1"><User className="h-2.5 w-2.5" /> {record.reviewer_user_id.slice(0, 8)}</div>
              {record.reviewer_timestamp && (
                <div className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {new Date(record.reviewer_timestamp).toLocaleString()}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <span className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      <p className={`text-[10px] mt-0.5 ${highlight ? "text-primary font-medium" : "text-foreground"}`}>
        {value || <span className="text-muted-foreground italic">—</span>}
      </p>
    </div>
  );
}

function StatChip({ icon: Icon, label, count, color }: { icon: React.ElementType; label: string; count: number; color: string }) {
  return (
    <div className={`flex items-center gap-1 ${color}`}>
      <Icon className="h-3 w-3" />
      <span className="text-[10px] font-semibold">{count} {label}</span>
    </div>
  );
}

export default IntakeProvenancePanel;
