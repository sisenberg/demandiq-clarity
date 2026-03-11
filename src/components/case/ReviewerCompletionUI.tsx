/**
 * ReviewerIQ — Complete Reviewer Workflow UI
 * Completion rail, modal, package view, and version history.
 */

import { useState, useMemo, useCallback } from "react";
import {
  CheckCircle2, XCircle, AlertTriangle, ArrowUpRight,
  Shield, Package, FileText, Clock, User, BarChart3,
  ChevronDown, ChevronRight, Download, RotateCcw,
} from "lucide-react";
import type { CompletionReadiness, ReviewPackageV1, PackageVersionEntry, ReviewerModuleState } from "@/lib/reviewerWorkflow";
import { MODULE_STATE_LABEL } from "@/lib/reviewerWorkflow";
import { SUPPORT_LEVEL_LABEL, SPECIALTY_LABEL } from "@/types/specialty-review";
import type { SupportLevel, SpecialtyType } from "@/types/specialty-review";

// ─── Styling ───────────────────────────────────────────

const GATE_STYLE = {
  passed: { icon: CheckCircle2, color: "text-[hsl(var(--status-approved))]", bg: "bg-[hsl(var(--status-approved-bg))]" },
  failed: { icon: XCircle, color: "text-[hsl(var(--status-failed))]", bg: "bg-[hsl(var(--status-failed-bg))]" },
  pending: { icon: Clock, color: "text-muted-foreground", bg: "bg-muted" },
  waived_with_reason: { icon: AlertTriangle, color: "text-[hsl(var(--status-attention))]", bg: "bg-[hsl(var(--status-attention-bg))]" },
};

const STATE_STYLE: Record<ReviewerModuleState, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_review: "bg-[hsl(var(--status-processing-bg))] text-[hsl(var(--status-processing-foreground))]",
  needs_attention: "bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention-foreground))]",
  ready_to_complete: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]",
  completed: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]",
  reopened: "bg-[hsl(var(--status-review-bg))] text-[hsl(var(--status-review-foreground))]",
};

// ─── Completion Rail ───────────────────────────────────

interface CompletionRailProps {
  readiness: CompletionReadiness;
  latestPackage: ReviewPackageV1 | null;
  onComplete: () => void;
  onReopen?: () => void;
}

export function CompletionRail({ readiness, latestPackage, onComplete, onReopen }: CompletionRailProps) {
  const isCompleted = readiness.module_state === "completed";

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5 flex items-center gap-3 flex-wrap">
      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${STATE_STYLE[readiness.module_state]}`}>
        {MODULE_STATE_LABEL[readiness.module_state]}
      </span>

      <div className="flex items-center gap-3 text-[9px] text-muted-foreground flex-1">
        {readiness.summary.critical_unresolved > 0 && (
          <span className="text-[hsl(var(--status-failed))] font-medium">
            {readiness.summary.critical_unresolved} critical
          </span>
        )}
        {readiness.summary.escalations_pending > 0 && (
          <span className="text-[hsl(var(--status-attention))] font-medium">
            {readiness.summary.escalations_pending} escalations
          </span>
        )}
        <span>{readiness.summary.bills_pending} bills pending</span>
        <span>{readiness.gates.filter(g => g.status === "passed").length}/{readiness.gates.length} gates passed</span>
      </div>

      {latestPackage && (
        <span className="text-[9px] text-muted-foreground">
          v{latestPackage.package_metadata.package_version}
        </span>
      )}

      {isCompleted && onReopen ? (
        <button
          onClick={onReopen}
          className="flex items-center gap-1 text-[10px] font-medium px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-accent transition-colors"
        >
          <RotateCcw className="h-3 w-3" /> Reopen Review
        </button>
      ) : (
        <button
          onClick={onComplete}
          disabled={!readiness.can_complete}
          className="flex items-center gap-1 text-[10px] font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Package className="h-3 w-3" /> Complete Reviewer
        </button>
      )}
    </div>
  );
}

// ─── Complete Reviewer Modal ───────────────────────────

interface CompleteReviewerModalProps {
  readiness: CompletionReadiness;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CompleteReviewerModal({ readiness, onConfirm, onCancel }: CompleteReviewerModalProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>("gates");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-xl max-h-[80vh] overflow-y-auto">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Complete Reviewer</h2>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <XCircle className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className={`rounded-lg px-3 py-2 text-center ${readiness.can_complete ? "bg-[hsl(var(--status-approved-bg))]" : "bg-[hsl(var(--status-failed-bg))]"}`}>
            <p className={`text-[11px] font-semibold ${readiness.can_complete ? "text-[hsl(var(--status-approved-foreground))]" : "text-[hsl(var(--status-failed-foreground))]"}`}>
              {readiness.can_complete ? "Ready to Complete" : `${readiness.blockers.length} Blocker(s) Remaining`}
            </p>
          </div>

          <Section
            title="Readiness Checklist"
            expanded={expandedSection === "gates"}
            onToggle={() => setExpandedSection(expandedSection === "gates" ? null : "gates")}
          >
            <div className="space-y-1.5">
              {readiness.gates.map(gate => {
                const st = GATE_STYLE[gate.status];
                const GateIcon = st.icon;
                return (
                  <div key={gate.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 bg-accent/30">
                    <GateIcon className={`h-3.5 w-3.5 shrink-0 ${st.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium text-foreground">{gate.label}</p>
                      <p className="text-[9px] text-muted-foreground">{gate.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {readiness.blockers.length > 0 && (
            <Section
              title={`Blockers (${readiness.blockers.length})`}
              expanded={expandedSection === "blockers"}
              onToggle={() => setExpandedSection(expandedSection === "blockers" ? null : "blockers")}
            >
              <div className="space-y-1">
                {readiness.blockers.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md px-2 py-1.5 bg-[hsl(var(--status-failed-bg))]/30">
                    <XCircle className="h-3 w-3 text-[hsl(var(--status-failed))] shrink-0" />
                    <span className="text-[9px] text-foreground">{b}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section
            title="Support Level Summary"
            expanded={expandedSection === "support"}
            onToggle={() => setExpandedSection(expandedSection === "support" ? null : "support")}
          >
            <div className="grid grid-cols-2 gap-1.5 text-[9px]">
              {(Object.entries(readiness.summary.support_counts) as [SupportLevel, number][]).map(([lvl, count]) => (
                <div key={lvl} className="flex items-center justify-between px-2 py-1 rounded bg-accent/30">
                  <span className="text-foreground">{SUPPORT_LEVEL_LABEL[lvl]}</span>
                  <span className="font-semibold text-foreground">{count}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Specialty Breakdown"
            expanded={expandedSection === "specialty"}
            onToggle={() => setExpandedSection(expandedSection === "specialty" ? null : "specialty")}
          >
            <div className="grid grid-cols-2 gap-1.5 text-[9px]">
              {(Object.entries(readiness.summary.specialty_counts) as [SpecialtyType, number][])
                .filter(([, c]) => c > 0)
                .map(([spec, count]) => (
                  <div key={spec} className="flex items-center justify-between px-2 py-1 rounded bg-accent/30">
                    <span className="text-foreground">{SPECIALTY_LABEL[spec]}</span>
                    <span className="font-semibold text-foreground">{count}</span>
                  </div>
                ))}
            </div>
          </Section>
        </div>

        <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="text-[10px] font-medium px-4 py-1.5 rounded-md border border-border text-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!readiness.can_complete}
            className="text-[10px] font-medium px-4 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Confirm Completion
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Package Version History ───────────────────────────

interface PackageVersionHistoryProps {
  versions: PackageVersionEntry[];
  currentPackage: ReviewPackageV1 | null;
}

export function PackageVersionHistory({ versions, currentPackage }: PackageVersionHistoryProps) {
  if (versions.length === 0 && !currentPackage) {
    return (
      <div className="text-center py-6 text-[11px] text-muted-foreground">
        No completed packages yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {currentPackage && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-semibold text-foreground">
                v{currentPackage.package_metadata.package_version}
              </span>
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">CURRENT</span>
            </div>
            <button className="text-[9px] font-medium px-2 py-1 rounded bg-accent text-foreground hover:bg-accent/80">
              <Download className="h-3 w-3 inline mr-1" />JSON
            </button>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[9px] text-muted-foreground">
            <span><User className="h-3 w-3 inline" /> {currentPackage.package_metadata.generated_by}</span>
            <span><Clock className="h-3 w-3 inline" /> {new Date(currentPackage.package_metadata.generated_at).toLocaleString()}</span>
            <span>{currentPackage.reviewer_summary.total_episodes_reviewed} episodes</span>
            <span>{currentPackage.reviewer_summary.total_line_items_reviewed} line items</span>
          </div>
        </div>
      )}

      {versions.filter(v => !v.is_current).map(v => (
        <div key={v.version} className="rounded-lg border border-border bg-card px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-foreground">v{v.version}</span>
              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">SUPERSEDED</span>
            </div>
            <span className="text-[9px] text-muted-foreground">{new Date(v.completed_at).toLocaleString()}</span>
          </div>
          {v.reopen_reason && (
            <p className="text-[9px] text-muted-foreground mt-0.5">Reopened: {v.reopen_reason}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────

function Section({ title, expanded, onToggle, children }: {
  title: string; expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/40 text-left">
        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        <span className="text-[10px] font-medium text-foreground">{title}</span>
      </button>
      {expanded && <div className="px-3 pb-2.5">{children}</div>}
    </div>
  );
}
