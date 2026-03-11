/**
 * ReviewerIQ — Specialty Review Tab
 * Displays episode cards with specialty-specific review recommendations,
 * filters by specialty/provider/issue type, and supports reviewer overrides.
 */

import { useState, useMemo, useCallback } from "react";
import {
  ChevronDown, ChevronRight, Filter, Search, X,
  Shield, AlertTriangle, CheckCircle2, HelpCircle,
  ArrowUpRight, Stethoscope, Activity, FileText,
  DollarSign, XCircle,
} from "lucide-react";
import type {
  SpecialtyType, SupportLevel, SpecialtyIssueType, EpisodePhase,
  EpisodeOfCare, SpecialtyReviewRecommendation, ReviewerOverride,
} from "@/types/specialty-review";
import {
  SPECIALTY_LABEL, SUPPORT_LEVEL_LABEL, SPECIALTY_ISSUE_TYPE_LABEL,
  EPISODE_PHASE_LABEL, SPECIALTY_REVIEW_ENGINE_VERSION,
} from "@/types/specialty-review";

// ─── Styling ───────────────────────────────────────────

const SUPPORT_STYLE: Record<SupportLevel, { color: string; bg: string; icon: React.ElementType }> = {
  supported: { color: "text-[hsl(var(--status-approved-foreground))]", bg: "bg-[hsl(var(--status-approved-bg))]", icon: CheckCircle2 },
  partially_supported: { color: "text-[hsl(var(--status-review-foreground))]", bg: "bg-[hsl(var(--status-review-bg))]", icon: HelpCircle },
  weakly_supported: { color: "text-[hsl(var(--status-attention-foreground))]", bg: "bg-[hsl(var(--status-attention-bg))]", icon: AlertTriangle },
  unsupported: { color: "text-[hsl(var(--status-failed-foreground))]", bg: "bg-[hsl(var(--status-failed-bg))]", icon: XCircle },
  escalate: { color: "text-[hsl(var(--status-processing-foreground))]", bg: "bg-[hsl(var(--status-processing-bg))]", icon: ArrowUpRight },
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-[hsl(var(--status-failed))]",
  high: "bg-[hsl(var(--status-attention))]",
  medium: "bg-[hsl(var(--status-review))]",
  low: "bg-muted-foreground",
  info: "bg-primary",
};

// ─── Props ─────────────────────────────────────────────

interface SpecialtyReviewTabProps {
  episodes: EpisodeOfCare[];
  recommendations: SpecialtyReviewRecommendation[];
  onOverride?: (recId: string, override: ReviewerOverride) => void;
}

export default function SpecialtyReviewTab({ episodes, recommendations, onOverride }: SpecialtyReviewTabProps) {
  const [specialtyFilter, setSpecialtyFilter] = useState<SpecialtyType | null>(null);
  const [supportFilter, setSupportFilter] = useState<SupportLevel | null>(null);
  const [issueTypeFilter, setIssueTypeFilter] = useState<SpecialtyIssueType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRecs, setExpandedRecs] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return recommendations.filter(r => {
      if (specialtyFilter && r.specialty_type !== specialtyFilter) return false;
      if (supportFilter && r.support_level !== supportFilter) return false;
      if (issueTypeFilter && !r.issue_tags.some(t => t.type === issueTypeFilter)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!`${r.provider} ${r.body_region} ${r.narrative_explanation}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [recommendations, specialtyFilter, supportFilter, issueTypeFilter, searchQuery]);

  // Counts
  const specialtyCounts = useMemo(() => {
    const c: Partial<Record<SpecialtyType, number>> = {};
    for (const r of recommendations) c[r.specialty_type] = (c[r.specialty_type] || 0) + 1;
    return c;
  }, [recommendations]);

  const supportCounts = useMemo(() => {
    const c: Partial<Record<SupportLevel, number>> = {};
    for (const r of recommendations) c[r.support_level] = (c[r.support_level] || 0) + 1;
    return c;
  }, [recommendations]);

  const escalationCount = recommendations.filter(r => r.escalation_required).length;
  const totalIssues = recommendations.reduce((s, r) => s + r.issue_tags.length, 0);

  const toggleRec = (id: string) => {
    setExpandedRecs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <SummaryCard icon={Activity} label="Episodes" value={episodes.length} />
        <SummaryCard icon={Shield} label="Recommendations" value={recommendations.length} />
        <SummaryCard icon={AlertTriangle} label="Total Issues" value={totalIssues} alert={totalIssues > 0} />
        <SummaryCard icon={ArrowUpRight} label="Require Escalation" value={escalationCount} alert={escalationCount > 0} />
      </div>

      {/* Specialty filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[9px] text-muted-foreground font-medium mr-1">Specialty:</span>
        {(Object.entries(specialtyCounts) as [SpecialtyType, number][]).map(([spec, count]) => (
          <button
            key={spec}
            onClick={() => setSpecialtyFilter(specialtyFilter === spec ? null : spec)}
            className={`text-[9px] font-medium px-2 py-1 rounded-md border transition-colors ${
              specialtyFilter === spec ? "border-primary/30 bg-primary/5 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {SPECIALTY_LABEL[spec]} ({count})
          </button>
        ))}
      </div>

      {/* Support level filter + search */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text" placeholder="Search episodes…" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-[11px] rounded-lg border border-border bg-card focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="h-3 w-3 text-muted-foreground" /></button>}
        </div>

        {(Object.entries(supportCounts) as [SupportLevel, number][]).map(([lvl, count]) => {
          const style = SUPPORT_STYLE[lvl];
          const isActive = supportFilter === lvl;
          return (
            <button
              key={lvl}
              onClick={() => setSupportFilter(isActive ? null : lvl)}
              className={`text-[9px] font-medium px-2 py-1 rounded-md border transition-colors ${
                isActive ? `${style.bg} ${style.color} border-current/20` : "border-border bg-card text-muted-foreground"
              }`}
            >
              {SUPPORT_LEVEL_LABEL[lvl]} ({count})
            </button>
          );
        })}

        <div className="ml-auto text-[10px] text-muted-foreground">
          v{SPECIALTY_REVIEW_ENGINE_VERSION} · {filtered.length} results
        </div>
      </div>

      {/* Episode cards */}
      <div className="flex flex-col gap-2">
        {filtered.map(rec => (
          <EpisodeCard
            key={rec.id}
            recommendation={rec}
            episode={episodes.find(e => e.id === rec.episode_id)!}
            expanded={expandedRecs.has(rec.id)}
            onToggle={() => toggleRec(rec.id)}
            onOverride={onOverride}
          />
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-[12px]">
            No specialty review recommendations match the current filters.
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-border bg-accent/20 px-3 py-2 text-[9px] text-muted-foreground">
        <strong>Notice:</strong> Specialty review recommendations are clinical review aids, not medical diagnoses or legal advice.
        All findings require human reviewer assessment. Surgery, opioid escalation, and repeat invasive procedures always require mandatory human review.
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────

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

function EpisodeCard({
  recommendation: rec, episode, expanded, onToggle, onOverride,
}: {
  recommendation: SpecialtyReviewRecommendation;
  episode: EpisodeOfCare;
  expanded: boolean;
  onToggle: () => void;
  onOverride?: (recId: string, override: ReviewerOverride) => void;
}) {
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideLevel, setOverrideLevel] = useState<SupportLevel | "">("");
  const style = SUPPORT_STYLE[rec.support_level];
  const SupportIcon = style.icon;

  const handleOverride = useCallback(() => {
    if (!overrideLevel || !overrideReason.trim() || !onOverride) return;
    onOverride(rec.id, {
      original_support_level: rec.support_level,
      override_support_level: overrideLevel as SupportLevel,
      reason: overrideReason,
      overridden_by: "current-user",
      overridden_at: new Date().toISOString(),
    });
    setOverrideReason("");
    setOverrideLevel("");
  }, [rec.id, rec.support_level, overrideLevel, overrideReason, onOverride]);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-accent/40 transition-colors text-left">
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-semibold ${style.bg} ${style.color}`}>
          <SupportIcon className="h-3 w-3" />
          {SUPPORT_LEVEL_LABEL[rec.support_level]}
        </div>
        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
          {SPECIALTY_LABEL[rec.specialty_type]}
        </span>
        <span className="text-[11px] font-medium text-foreground flex-1 truncate">{rec.provider}</span>
        <span className="text-[9px] text-muted-foreground">{rec.body_region}</span>
        <span className="text-[9px] text-muted-foreground">{rec.dates_of_service.start} → {rec.dates_of_service.end}</span>
        <span className="text-[9px] text-muted-foreground">{episode.visit_count}v</span>
        {rec.issue_tags.length > 0 && (
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-[hsl(var(--status-review-bg))] text-[hsl(var(--status-review-foreground))]">
            {rec.issue_tags.length}
          </span>
        )}
        {rec.escalation_required && (
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-[hsl(var(--status-failed-bg))] text-[hsl(var(--status-failed-foreground))]">
            ESC
          </span>
        )}
        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t border-border px-3 pb-3 space-y-3 pt-2">
          {/* Scores */}
          <div className="grid grid-cols-3 gap-2">
            <ScoreBar label="Documentation" score={rec.documentation_sufficiency_score} />
            <ScoreBar label="Coding Integrity" score={rec.coding_integrity_score} />
            <ScoreBar label="Necessity Support" score={rec.necessity_support_score} />
          </div>

          {/* Episode metadata */}
          <div className="flex items-center gap-3 text-[9px] text-muted-foreground flex-wrap">
            <span>Phase: {EPISODE_PHASE_LABEL[rec.episode_phase]}</span>
            {rec.laterality && <span>Laterality: {rec.laterality}</span>}
            <span>Diagnoses: {rec.diagnosis_cluster.join(", ") || "—"}</span>
            <span>Confidence: {Math.round(rec.confidence * 100)}%</span>
          </div>

          {/* Issue tags */}
          {rec.issue_tags.length > 0 && (
            <div className="space-y-1">
              <p className="text-[9px] font-medium text-muted-foreground">Issues ({rec.issue_tags.length})</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {rec.issue_tags.map((tag, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md bg-accent/30 px-2 py-1.5">
                    <div className={`h-2 w-2 rounded-full shrink-0 mt-1 ${SEVERITY_DOT[tag.severity]}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-semibold text-foreground">{tag.label}</span>
                        <span className="text-[8px] px-1 py-0.5 rounded bg-accent text-muted-foreground">{SPECIALTY_ISSUE_TYPE_LABEL[tag.type]}</span>
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{tag.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reimbursement adjustments */}
          {rec.reimbursement_adjustments.length > 0 && (
            <div className="space-y-1">
              <p className="text-[9px] font-medium text-muted-foreground">Reimbursement Adjustments</p>
              {rec.reimbursement_adjustments.map((adj, i) => (
                <div key={i} className="rounded-md bg-accent/30 px-2 py-1 text-[9px]">
                  <span className="font-semibold text-foreground">{adj.code}</span>
                  <span className="text-muted-foreground ml-1">— {adj.description}</span>
                  {adj.amount_impact != null && (
                    <span className="text-[hsl(var(--status-failed))] ml-1">(${adj.amount_impact.toLocaleString()})</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Narrative */}
          <div className="rounded-md bg-accent/40 px-2.5 py-2">
            <p className="text-[9px] font-medium text-muted-foreground mb-1">Explanation</p>
            <p className="text-[10px] text-foreground/80 whitespace-pre-line">{rec.narrative_explanation}</p>
          </div>

          {/* Evidence */}
          {rec.evidence_links.length > 0 && (
            <div className="space-y-1">
              <p className="text-[9px] font-medium text-muted-foreground">Evidence</p>
              {rec.evidence_links.map((ev, i) => (
                <div key={i} className="rounded bg-card border border-border px-2 py-1 text-[9px]">
                  <span className="text-foreground/80">"{ev.quoted_text}"</span>
                  {ev.source_page && <span className="text-muted-foreground ml-1">— pg. {ev.source_page}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Override */}
          {rec.reviewer_override ? (
            <div className="rounded-md border border-primary/20 bg-primary/5 px-2.5 py-2">
              <p className="text-[9px] font-medium text-primary">Reviewer Override Applied</p>
              <p className="text-[9px] text-foreground/80 mt-0.5">
                {SUPPORT_LEVEL_LABEL[rec.reviewer_override.original_support_level]} → {SUPPORT_LEVEL_LABEL[rec.reviewer_override.override_support_level]}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Reason: {rec.reviewer_override.reason}</p>
            </div>
          ) : onOverride && (
            <div className="space-y-1.5">
              <p className="text-[9px] font-medium text-muted-foreground">Reviewer Override</p>
              <div className="flex items-center gap-2">
                <select
                  value={overrideLevel}
                  onChange={e => setOverrideLevel(e.target.value as SupportLevel)}
                  className="text-[10px] px-2 py-1 rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select new level…</option>
                  {(["supported", "partially_supported", "weakly_supported", "unsupported", "escalate"] as SupportLevel[]).map(l => (
                    <option key={l} value={l}>{SUPPORT_LEVEL_LABEL[l]}</option>
                  ))}
                </select>
              </div>
              <textarea
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                placeholder="Enter reason for override…"
                className="w-full px-2 py-1.5 text-[10px] rounded-lg border border-border bg-card focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                rows={2}
              />
              <button
                onClick={handleOverride}
                disabled={!overrideLevel || !overrideReason.trim()}
                className="text-[10px] font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Apply Override
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 70 ? "bg-[hsl(var(--status-approved))]" : score >= 50 ? "bg-[hsl(var(--status-review))]" : "bg-[hsl(var(--status-failed))]";
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[8px] font-medium text-muted-foreground">{label}</span>
        <span className="text-[9px] font-semibold text-foreground">{score}</span>
      </div>
      <div className="h-1.5 rounded-full bg-accent overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
