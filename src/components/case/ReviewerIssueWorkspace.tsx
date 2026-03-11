/**
 * ReviewerIQ — Issue Workspace
 * Queue of review issues grouped by provider and type.
 * Supports reviewer disposition actions with rationale notes.
 */

import { useState, useMemo } from "react";
import {
  AlertTriangle, CheckCircle2, XCircle, HelpCircle, ArrowUpRight,
  ChevronDown, ChevronRight, Filter, Search, X, FileText,
  DollarSign, Stethoscope, Shield, Clock, Zap, Activity, BookOpen,
} from "lucide-react";
import type {
  ReviewIssue, ReviewIssueType, ReviewIssueSeverity, ReviewIssueDisposition,
  ClinicalIssueCategory,
} from "@/types/reviewer-issues";
import {
  ISSUE_TYPE_LABEL, ISSUE_SEVERITY_LABEL, DISPOSITION_LABEL,
  ISSUE_CATEGORY_MAP, CLINICAL_CATEGORY_LABEL,
} from "@/types/reviewer-issues";

// ─── Severity styling ───────────────────────────────────

const SEVERITY_STYLE: Record<ReviewIssueSeverity, { color: string; bg: string }> = {
  critical: { color: "text-[hsl(var(--status-failed))]", bg: "bg-[hsl(var(--status-failed-bg))]" },
  high: { color: "text-[hsl(var(--status-attention))]", bg: "bg-[hsl(var(--status-attention-bg))]" },
  medium: { color: "text-[hsl(var(--status-review))]", bg: "bg-[hsl(var(--status-review-bg))]" },
  low: { color: "text-muted-foreground", bg: "bg-accent/50" },
  info: { color: "text-primary", bg: "bg-primary/5" },
};

const DISPOSITION_STYLE: Record<ReviewIssueDisposition, string> = {
  pending: "bg-[hsl(var(--status-draft-bg))] text-[hsl(var(--status-draft-foreground))]",
  accepted: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]",
  reduced: "bg-[hsl(var(--status-review-bg))] text-[hsl(var(--status-review-foreground))]",
  denied: "bg-[hsl(var(--status-failed-bg))] text-[hsl(var(--status-failed-foreground))]",
  uncertain: "bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention-foreground))]",
  escalated: "bg-[hsl(var(--status-processing-bg))] text-[hsl(var(--status-processing-foreground))]",
  dismissed: "bg-accent text-muted-foreground",
};

// ─── Props ──────────────────────────────────────────────

interface ReviewerIssueWorkspaceProps {
  issues: ReviewIssue[];
  onDisposition: (issueId: string, disposition: ReviewIssueDisposition, rationale: string) => void;
}

export default function ReviewerIssueWorkspace({ issues, onDisposition }: ReviewerIssueWorkspaceProps) {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<ReviewIssueSeverity | null>(null);
  const [typeFilter, setTypeFilter] = useState<ReviewIssueType | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<ClinicalIssueCategory | null>(null);
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [groupMode, setGroupMode] = useState<"provider" | "category">("provider");

  const filtered = useMemo(() => {
    return issues.filter(i => {
      if (showPendingOnly && i.disposition !== "pending") return false;
      if (severityFilter && i.severity !== severityFilter) return false;
      if (typeFilter && i.issue_type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!`${i.title} ${i.description} ${i.affected_provider || ""}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [issues, search, severityFilter, typeFilter, showPendingOnly]);

  // Group by provider
  const grouped = useMemo(() => {
    const map = new Map<string, ReviewIssue[]>();
    for (const i of filtered) {
      const key = i.affected_provider || "General";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  const pendingCount = issues.filter(i => i.disposition === "pending").length;
  const totalQuestioned = filtered.reduce((s, i) => s + i.questioned_amount, 0);

  const severityCounts = useMemo(() => {
    const counts: Record<ReviewIssueSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const i of issues) counts[i.severity]++;
    return counts;
  }, [issues]);

  const toggleIssue = (id: string) => {
    setExpandedIssues(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <SummaryCard icon={Shield} label="Total Issues" value={issues.length} />
        <SummaryCard icon={AlertTriangle} label="Pending" value={pendingCount} alert={pendingCount > 0} />
        <SummaryCard icon={DollarSign} label="Questioned" value={`$${totalQuestioned.toLocaleString()}`} />
        {severityCounts.critical > 0 && <SummaryCard icon={XCircle} label="Critical" value={severityCounts.critical} alert />}
        {severityCounts.high > 0 && <SummaryCard icon={AlertTriangle} label="High" value={severityCounts.high} alert />}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text" placeholder="Search issues…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-[11px] rounded-lg border border-border bg-card focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="h-3 w-3 text-muted-foreground" /></button>}
        </div>

        <button
          onClick={() => setShowPendingOnly(!showPendingOnly)}
          className={`text-[10px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
            showPendingOnly ? "border-primary/30 bg-primary/5 text-primary" : "border-border bg-card text-muted-foreground"
          }`}
        >
          Pending only ({pendingCount})
        </button>

        {/* Severity chips */}
        {(["critical", "high", "medium", "low"] as ReviewIssueSeverity[]).map(sev => {
          if (severityCounts[sev] === 0) return null;
          const style = SEVERITY_STYLE[sev];
          const isActive = severityFilter === sev;
          return (
            <button
              key={sev}
              onClick={() => setSeverityFilter(isActive ? null : sev)}
              className={`text-[10px] font-medium px-2 py-1 rounded-lg border transition-colors ${
                isActive ? `${style.bg} ${style.color} border-current/20` : "border-border bg-card text-muted-foreground"
              }`}
            >
              {ISSUE_SEVERITY_LABEL[sev]} ({severityCounts[sev]})
            </button>
          );
        })}

        <div className="ml-auto text-[10px] text-muted-foreground">{filtered.length} issues</div>
      </div>

      {/* Grouped issue list */}
      <div className="flex flex-col gap-2">
        {grouped.map(([provider, provIssues]) => (
          <ProviderIssueGroup
            key={provider}
            provider={provider}
            issues={provIssues}
            expandedIssues={expandedIssues}
            onToggle={toggleIssue}
            onDisposition={onDisposition}
          />
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-[12px]">
            No issues match the current filters.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────

function SummaryCard({ icon: Icon, label, value, alert }: { icon: React.ElementType; label: string; value: string | number; alert?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 flex items-center gap-2">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${alert ? "text-[hsl(var(--status-review))]" : "text-muted-foreground"}`} />
      <div className="min-w-0">
        <p className="text-[9px] text-muted-foreground font-medium">{label}</p>
        <p className="text-[13px] font-semibold text-foreground leading-tight">{value}</p>
      </div>
    </div>
  );
}

function ProviderIssueGroup({
  provider, issues, expandedIssues, onToggle, onDisposition,
}: {
  provider: string;
  issues: ReviewIssue[];
  expandedIssues: Set<string>;
  onToggle: (id: string) => void;
  onDisposition: (id: string, d: ReviewIssueDisposition, r: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const totalQuestioned = issues.reduce((s, i) => s + i.questioned_amount, 0);
  const pendingCount = issues.filter(i => i.disposition === "pending").length;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/40 transition-colors text-left"
      >
        <Stethoscope className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-[12px] font-semibold text-foreground flex-1 truncate">{provider}</span>
        <span className="text-[10px] text-muted-foreground">{issues.length} issues</span>
        {totalQuestioned > 0 && <span className="text-[10px] text-muted-foreground">${totalQuestioned.toLocaleString()}</span>}
        {pendingCount > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[hsl(var(--status-review-bg))] text-[hsl(var(--status-review-foreground))] font-medium">
            {pendingCount} pending
          </span>
        )}
        {collapsed ? <ChevronRight className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="border-t border-border divide-y divide-border/40">
          {issues.map(issue => (
            <IssueRow
              key={issue.id}
              issue={issue}
              expanded={expandedIssues.has(issue.id)}
              onToggle={() => onToggle(issue.id)}
              onDisposition={onDisposition}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function IssueRow({
  issue, expanded, onToggle, onDisposition,
}: {
  issue: ReviewIssue;
  expanded: boolean;
  onToggle: () => void;
  onDisposition: (id: string, d: ReviewIssueDisposition, r: string) => void;
}) {
  const [rationale, setRationale] = useState(issue.disposition_rationale);
  const sevStyle = SEVERITY_STYLE[issue.severity];

  return (
    <div className={`${expanded ? "bg-accent/20" : ""}`}>
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/30 transition-colors text-left">
        <div className={`h-2 w-2 rounded-full shrink-0 ${sevStyle.bg} border ${sevStyle.color.replace("text-", "border-")}/30`} />
        <span className="text-[11px] font-medium text-foreground flex-1 truncate">{issue.title}</span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium ${DISPOSITION_STYLE[issue.disposition]}`}>
          {DISPOSITION_LABEL[issue.disposition]}
        </span>
        {issue.questioned_amount > 0 && (
          <span className="text-[10px] text-muted-foreground">${issue.questioned_amount.toLocaleString()}</span>
        )}
        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-[10px] text-muted-foreground">{issue.description}</p>

          {/* Machine explanation */}
          <div className="rounded-md bg-accent/40 px-2.5 py-1.5">
            <p className="text-[9px] font-medium text-muted-foreground mb-0.5">Rule Explanation</p>
            <p className="text-[10px] text-foreground/80">{issue.machine_explanation}</p>
          </div>

          {/* Date range / affected info */}
          <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
            {issue.affected_date_start && <span>From: {issue.affected_date_start}</span>}
            {issue.affected_date_end && <span>To: {issue.affected_date_end}</span>}
            {issue.affected_treatment_ids.length > 0 && <span>{issue.affected_treatment_ids.length} treatment(s)</span>}
            {issue.affected_bill_line_ids.length > 0 && <span>{issue.affected_bill_line_ids.length} bill line(s)</span>}
          </div>

          {/* Evidence */}
          {issue.evidence.length > 0 && (
            <div className="space-y-1">
              <p className="text-[9px] font-medium text-muted-foreground">Evidence</p>
              {issue.evidence.map((ev, i) => (
                <div key={i} className="rounded bg-card border border-border px-2 py-1 text-[9px]">
                  <span className="evidence-text text-foreground/80">"{ev.quoted_text}"</span>
                  {ev.source_page && <span className="text-muted-foreground ml-1">— pg. {ev.source_page}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Rationale */}
          <div>
            <label className="text-[9px] font-medium text-muted-foreground">Reviewer Rationale</label>
            <textarea
              value={rationale}
              onChange={e => setRationale(e.target.value)}
              placeholder="Enter rationale for disposition…"
              className="w-full mt-1 px-2 py-1.5 text-[10px] rounded-lg border border-border bg-card focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              rows={2}
            />
          </div>

          {/* Disposition actions */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(["accepted", "reduced", "denied", "uncertain", "escalated", "dismissed"] as ReviewIssueDisposition[]).map(d => (
              <button
                key={d}
                onClick={() => onDisposition(issue.id, d, rationale)}
                className={`text-[9px] font-medium px-2 py-1 rounded-md border transition-colors ${
                  issue.disposition === d
                    ? `${DISPOSITION_STYLE[d]} border-current/20`
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {DISPOSITION_LABEL[d]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
