/**
 * EvaluateIQ — Right Panel (Upgraded)
 * Tabbed panel with: Evidence, Factors, Benchmarks, Overrides, Audit.
 */

import { useState, useMemo } from "react";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import { computeBenchmarkMatching } from "@/lib/benchmarkMatchingEngine";
import { computeDocumentSufficiency } from "@/lib/documentSufficiencyEngine";
import type { CorridorOverrideEntry, EvalAuditEvent, CorridorValues } from "@/lib/evaluateOverrideEngine";
import { OVERRIDE_REASON_LABELS, computeBeforeAfter } from "@/lib/evaluateOverrideEngine";
import type { HumanAssumptionOverrides, AssumptionChangeEntry } from "@/hooks/useAssumptionOverrides";
import {
  ExternalLink,
  BarChart3,
  Scale,
  ScrollText,
  SlidersHorizontal,
  Link2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileSearch,
  Users,
  ArrowRightLeft,
  Replace,
  ShieldAlert,
  RotateCcw,
  User,
  MessageSquare,
  Cpu,
} from "lucide-react";

type RightTab = "evidence" | "factors" | "benchmarks" | "overrides" | "audit";

const TABS: { key: RightTab; label: string; icon: React.ElementType }[] = [
  { key: "evidence", label: "Evidence", icon: ExternalLink },
  { key: "factors", label: "Factors", icon: Scale },
  { key: "benchmarks", label: "Benchmarks", icon: BarChart3 },
  { key: "overrides", label: "Overrides", icon: SlidersHorizontal },
  { key: "audit", label: "Audit", icon: ScrollText },
];

interface Props {
  snapshot: EvaluateIntakeSnapshot | null;
  caseId: string | undefined;
  corridorOverrides?: CorridorOverrideEntry[];
  auditEvents?: EvalAuditEvent[];
  pendingReviewCount?: number;
  assumptionOverrides?: HumanAssumptionOverrides;
  assumptionChangeLog?: AssumptionChangeEntry[];
  activeOverrideCount?: number;
  onOpenOverrideDialog?: () => void;
}

const EvalRightPanel = ({
  snapshot,
  caseId,
  corridorOverrides = [],
  auditEvents = [],
  pendingReviewCount = 0,
  assumptionOverrides,
  assumptionChangeLog = [],
  activeOverrideCount = 0,
  onOpenOverrideDialog,
}: Props) => {
  const [activeTab, setActiveTab] = useState<RightTab>("evidence");

  return (
    <div className="w-[320px] shrink-0 border-l border-border bg-card overflow-y-auto h-full flex flex-col hidden 2xl:flex">
      {/* Tab bar */}
      <div className="shrink-0 border-b border-border px-2 pt-2">
        <div className="flex items-center gap-0.5">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const badge = tab.key === "overrides" && (corridorOverrides.length + activeOverrideCount) > 0
              ? corridorOverrides.length + activeOverrideCount
              : tab.key === "audit" && pendingReviewCount > 0
                ? pendingReviewCount
                : null;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex items-center gap-1.5 whitespace-nowrap px-2.5 py-2 text-[10px] font-medium rounded-t-md transition-all ${
                  isActive
                    ? "text-primary bg-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                <tab.icon className="h-3 w-3" />
                {tab.label}
                {badge !== null && (
                  <span className="text-[7px] font-bold bg-primary/15 text-primary px-1 py-0.5 rounded-full min-w-[14px] text-center">
                    {badge}
                  </span>
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-[1.5px] bg-primary rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === "evidence" && <EvidencePanel snapshot={snapshot} />}
        {activeTab === "factors" && <FactorsPanel snapshot={snapshot} />}
        {activeTab === "benchmarks" && <BenchmarksPanel snapshot={snapshot} />}
        {activeTab === "overrides" && (
          <OverridesPanel
            corridorOverrides={corridorOverrides}
            assumptionChangeLog={assumptionChangeLog}
            activeOverrideCount={activeOverrideCount}
            onOpenOverrideDialog={onOpenOverrideDialog}
          />
        )}
        {activeTab === "audit" && (
          <AuditPanel
            auditEvents={auditEvents}
            pendingReviewCount={pendingReviewCount}
          />
        )}
      </div>
    </div>
  );
};

// ─── Evidence Panel ─────────────────────────────────────

function EvidencePanel({ snapshot }: { snapshot: EvaluateIntakeSnapshot | null }) {
  if (!snapshot) return <PlaceholderMessage message="No snapshot loaded" />;

  const evidenceRefs = new Set<string>();
  snapshot.injuries.forEach(i => i.provenance.evidence_ref_ids.forEach(r => evidenceRefs.add(r)));
  snapshot.treatment_timeline.forEach(t => t.provenance.evidence_ref_ids.forEach(r => evidenceRefs.add(r)));
  snapshot.liability_facts.forEach(f => f.provenance.evidence_ref_ids.forEach(r => evidenceRefs.add(r)));
  snapshot.medical_billing.forEach(b => b.provenance.evidence_ref_ids.forEach(r => evidenceRefs.add(r)));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Evidence References</span>
        <span className="text-[10px] text-muted-foreground">{evidenceRefs.size} total</span>
      </div>

      {snapshot.injuries.length > 0 && (
        <EvidenceGroup
          label="Injuries"
          items={snapshot.injuries.map(i => ({
            text: `${i.body_part} — ${i.diagnosis_description}`,
            refCount: i.provenance.evidence_ref_ids.length,
            confidence: i.provenance.confidence,
          }))}
        />
      )}

      {snapshot.liability_facts.length > 0 && (
        <EvidenceGroup
          label="Liability Facts"
          items={snapshot.liability_facts.map(f => ({
            text: f.fact_text,
            refCount: f.provenance.evidence_ref_ids.length,
            confidence: f.confidence,
          }))}
        />
      )}

      {snapshot.medical_billing.length > 0 && (
        <EvidenceGroup
          label="Medical Billing"
          items={snapshot.medical_billing.slice(0, 8).map(b => ({
            text: `${b.description} — $${b.billed_amount.toLocaleString()}`,
            refCount: b.provenance.evidence_ref_ids.length,
            confidence: b.provenance.confidence,
          }))}
        />
      )}
    </div>
  );
}

function EvidenceGroup({ label, items }: { label: string; items: { text: string; refCount: number; confidence: number | null }[] }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="px-3 py-2 bg-accent/30 border-b border-border">
        <span className="text-[10px] font-semibold text-foreground">{label}</span>
        <span className="text-[9px] text-muted-foreground ml-2">{items.length}</span>
      </div>
      <div className="divide-y divide-border/40">
        {items.map((item, i) => (
          <div key={i} className="px-3 py-2 hover:bg-accent/20 transition-colors">
            <p className="text-[10px] text-foreground leading-snug truncate">{item.text}</p>
            <div className="flex items-center gap-2 mt-1">
              {item.refCount > 0 && (
                <span className="text-[9px] text-primary flex items-center gap-0.5">
                  <Link2 className="h-2.5 w-2.5" /> {item.refCount} ref{item.refCount !== 1 ? "s" : ""}
                </span>
              )}
              {item.confidence !== null && (
                <span className={`text-[9px] ${item.confidence >= 0.8 ? "text-[hsl(var(--status-approved))]" : item.confidence >= 0.5 ? "text-[hsl(var(--status-attention))]" : "text-destructive"}`}>
                  {Math.round(item.confidence * 100)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Factors Panel ──────────────────────────────────────

function FactorsPanel({ snapshot }: { snapshot: EvaluateIntakeSnapshot | null }) {
  const docSuff = useMemo(() => snapshot ? computeDocumentSufficiency(snapshot) : null, [snapshot]);

  if (!snapshot) return <PlaceholderMessage message="No snapshot loaded" />;

  const factors = [
    { label: "Injury Count", value: String(snapshot.injuries.length), detail: `${snapshot.injuries.filter(i => !i.is_pre_existing).length} new, ${snapshot.injuries.filter(i => i.is_pre_existing).length} pre-existing` },
    { label: "Treatment Intensity", value: String(snapshot.treatment_timeline.length), detail: "total visits across all providers" },
    { label: "Provider Count", value: String(snapshot.providers.length), detail: "unique treating providers" },
    { label: "Surgery", value: snapshot.clinical_flags.has_surgery ? "Yes" : "No", detail: snapshot.clinical_flags.has_surgery ? "Surgical intervention documented" : "No surgery documented" },
    { label: "Permanency", value: snapshot.clinical_flags.has_permanency_indicators ? "Flagged" : "None", detail: snapshot.clinical_flags.has_permanency_indicators ? "Permanency indicators present" : "No permanency indicators" },
    { label: "Liability Facts", value: String(snapshot.liability_facts.length), detail: `${snapshot.liability_facts.filter(f => f.supports_liability).length} supporting, ${snapshot.liability_facts.filter(f => !f.supports_liability).length} adverse` },
    { label: "Comp. Negligence", value: snapshot.comparative_negligence.claimant_negligence_percentage.value !== null ? `${snapshot.comparative_negligence.claimant_negligence_percentage.value}%` : "N/A", detail: "Claimant contributory percentage" },
    { label: "Upstream Concerns", value: String(snapshot.upstream_concerns.length), detail: snapshot.upstream_concerns.length > 0 ? `${snapshot.upstream_concerns.filter(c => c.severity === "critical").length} critical` : "None flagged" },
  ];

  return (
    <div className="space-y-3">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Key Valuation Factors</span>
      {factors.map((f, i) => (
        <div key={i} className="rounded-lg border border-border p-2.5 hover:bg-accent/20 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-foreground">{f.label}</span>
            <span className="text-[11px] font-semibold text-foreground">{f.value}</span>
          </div>
          <p className="text-[9px] text-muted-foreground mt-0.5">{f.detail}</p>
        </div>
      ))}

      {docSuff && (
        <div className="rounded-lg border border-border p-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <FileSearch className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-semibold text-foreground">Documentation Sufficiency</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {docSuff.subcomponents.map(sub => (
              <div key={sub.key} className="flex items-center gap-1.5">
                <SuffDot label={sub.sufficiency} />
                <span className="text-[8px] text-muted-foreground truncate">{sub.label}</span>
                <span className="text-[8px] font-semibold text-foreground ml-auto">{sub.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SuffDot({ label }: { label: string }) {
  const cls = label === "strong" ? "bg-[hsl(var(--status-approved))]"
    : label === "adequate" ? "bg-primary"
      : label === "limited" ? "bg-[hsl(var(--status-attention))]"
        : "bg-destructive";
  return <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cls}`} />;
}

// ─── Benchmarks Panel ───────────────────────────────────

function BenchmarksPanel({ snapshot }: { snapshot: EvaluateIntakeSnapshot | null }) {
  const result = useMemo(() => snapshot ? computeBenchmarkMatching(snapshot) : null, [snapshot]);

  if (!snapshot || !result) return <PlaceholderMessage message="No snapshot loaded" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Benchmark Support</span>
        <QualityBadge quality={result.match_quality} />
      </div>

      {result.settlement_stats.median !== null && (
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="Median" value={`$${result.settlement_stats.median.toLocaleString()}`} highlight />
          <MiniStat label="P25–P75" value={result.settlement_stats.p25 && result.settlement_stats.p75 ? `$${result.settlement_stats.p25.toLocaleString()} – $${result.settlement_stats.p75.toLocaleString()}` : "—"} />
        </div>
      )}

      <p className="text-[9px] text-muted-foreground leading-relaxed">
        {result.selected_count} match(es) from {result.candidate_count} candidates.
        {result.outlier_count > 0 && ` ${result.outlier_count} outlier(s) excluded from stats.`}
      </p>

      {result.selected_matches.slice(0, 5).map(m => (
        <div key={m.case_id} className="rounded-lg border border-border p-2.5 hover:bg-accent/20 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-foreground">{m.claim_number}</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-foreground">${m.settlement_amount.toLocaleString()}</span>
              <span className={`text-[8px] font-semibold px-1 py-0.5 rounded ${
                m.overall_similarity >= 70 ? "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]"
                : "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]"
              }`}>
                {m.overall_similarity}%
              </span>
            </div>
          </div>
          {m.is_outlier && (
            <span className="text-[8px] text-[hsl(var(--status-attention))] font-semibold uppercase">Outlier</span>
          )}
          {m.match_reasons.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {m.match_reasons.slice(0, 2).map((r, i) => (
                <span key={i} className="text-[7px] bg-accent px-1 py-0.5 rounded text-muted-foreground">{r}</span>
              ))}
            </div>
          )}
        </div>
      ))}

      {result.selected_count === 0 && (
        <div className="text-center py-4">
          <Users className="h-5 w-5 text-muted-foreground/30 mx-auto mb-1.5" />
          <p className="text-[10px] text-muted-foreground">No close matches in current corpus.</p>
        </div>
      )}
    </div>
  );
}

function QualityBadge({ quality }: { quality: string }) {
  const cls = quality === "strong" ? "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]"
    : quality === "moderate" ? "bg-primary/10 text-primary"
      : quality === "weak" ? "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]"
        : "bg-destructive/10 text-destructive";
  return (
    <span className={`text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${cls}`}>
      {quality}
    </span>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-2 ${highlight ? "bg-primary/5 border border-primary/20" : "bg-accent/50"}`}>
      <div className="text-[8px] text-muted-foreground">{label}</div>
      <div className={`text-[10px] font-bold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

// ─── Overrides Panel (Real Data) ────────────────────────

function OverridesPanel({
  corridorOverrides,
  assumptionChangeLog,
  activeOverrideCount,
  onOpenOverrideDialog,
}: {
  corridorOverrides: CorridorOverrideEntry[];
  assumptionChangeLog: AssumptionChangeEntry[];
  activeOverrideCount: number;
  onOpenOverrideDialog?: () => void;
}) {
  const totalOverrides = corridorOverrides.length + activeOverrideCount;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Override History</span>
        {totalOverrides > 0 && (
          <span className="text-[8px] font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">
            {totalOverrides} active
          </span>
        )}
      </div>

      {/* CTA button */}
      {onOpenOverrideDialog && (
        <button
          onClick={onOpenOverrideDialog}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5 text-primary text-[10px] font-semibold hover:bg-primary/10 transition-colors"
        >
          <ArrowRightLeft className="h-3 w-3" />
          Override Corridor
        </button>
      )}

      {/* Corridor overrides */}
      {corridorOverrides.length > 0 && (
        <div className="space-y-2">
          <span className="text-[9px] font-semibold text-muted-foreground">Corridor Overrides</span>
          {corridorOverrides.map(o => {
            const comparison = computeBeforeAfter(o.system_corridor, o.override_corridor);
            const actionIcon = o.action === "accept_recommended" ? CheckCircle2
              : o.action === "override_corridor" ? ArrowRightLeft
              : Replace;
            const ActionIcon = actionIcon;
            return (
              <div key={o.id} className={`rounded-lg border p-2.5 ${
                o.requires_supervisor_review ? "border-[hsl(var(--status-attention))]/30 bg-[hsl(var(--status-attention))]/5" : "border-border"
              }`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <ActionIcon className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-semibold text-foreground">
                    {o.action === "accept_recommended" ? "Accepted" : o.action === "override_corridor" ? "Overridden" : "Replaced"}
                  </span>
                  {o.requires_supervisor_review && (
                    <span className={`text-[7px] font-bold uppercase px-1 py-0.5 rounded ${
                      o.supervisor_review_status === "pending"
                        ? "bg-[hsl(var(--status-attention))]/15 text-[hsl(var(--status-attention))]"
                        : o.supervisor_review_status === "approved"
                          ? "bg-[hsl(var(--status-approved))]/15 text-[hsl(var(--status-approved))]"
                          : "bg-destructive/15 text-destructive"
                    }`}>
                      {o.supervisor_review_status}
                    </span>
                  )}
                </div>

                {/* Before/After mini */}
                {o.action !== "accept_recommended" && (
                  <div className="grid grid-cols-3 gap-1 mb-1.5 text-center">
                    <div>
                      <p className="text-[7px] text-muted-foreground">Floor</p>
                      <p className="text-[8px] text-muted-foreground line-through">{o.system_corridor.low}</p>
                      <p className="text-[9px] font-semibold text-foreground">{o.override_corridor.low}</p>
                    </div>
                    <div>
                      <p className="text-[7px] text-muted-foreground">Mid</p>
                      <p className="text-[8px] text-muted-foreground line-through">{o.system_corridor.mid}</p>
                      <p className="text-[9px] font-bold text-primary">{o.override_corridor.mid}</p>
                    </div>
                    <div>
                      <p className="text-[7px] text-muted-foreground">Ceil</p>
                      <p className="text-[8px] text-muted-foreground line-through">{o.system_corridor.high}</p>
                      <p className="text-[9px] font-semibold text-foreground">{o.override_corridor.high}</p>
                    </div>
                  </div>
                )}

                <p className="text-[8px] text-muted-foreground">
                  <span className="font-semibold">{OVERRIDE_REASON_LABELS[o.reason_code]}</span>
                </p>
                <p className="text-[8px] text-muted-foreground italic mt-0.5 line-clamp-2">{o.rationale}</p>
                {o.evidence_note && (
                  <p className="text-[7px] text-primary mt-0.5">📎 {o.evidence_note}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5 text-[7px] text-muted-foreground/60">
                  <span>{o.actor_name}</span>
                  <span>·</span>
                  <span>{new Date(o.timestamp).toLocaleString()}</span>
                  <span>·</span>
                  <span className="flex items-center gap-0.5"><Cpu className="h-2 w-2" />v{o.logic_version}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assumption overrides */}
      {assumptionChangeLog.length > 0 && (
        <div className="space-y-2">
          <span className="text-[9px] font-semibold text-muted-foreground">Assumption Changes</span>
          {assumptionChangeLog.slice(0, 10).map((entry, i) => (
            <div key={i} className="rounded-lg border border-border p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-foreground">{entry.label}</span>
                <span className="text-[8px] text-muted-foreground">
                  {formatValue(entry.previous_value)} → {formatValue(entry.new_value)}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <MessageSquare className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                <p className="text-[8px] text-muted-foreground italic truncate">{entry.reason}</p>
              </div>
              <p className="text-[7px] text-muted-foreground/60 mt-0.5">
                {entry.changed_by_name} · {new Date(entry.changed_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {totalOverrides === 0 && assumptionChangeLog.length === 0 && (
        <div className="rounded-lg bg-accent/50 p-3">
          <p className="text-[9px] text-muted-foreground leading-relaxed">
            No overrides have been applied. Use the <span className="font-semibold">Override Corridor</span> button
            or the <span className="font-semibold">Range Output</span> tab to modify assumptions.
            All changes are logged with timestamps and user attribution.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Audit Panel (Real Data) ────────────────────────────

function AuditPanel({
  auditEvents,
  pendingReviewCount,
}: {
  auditEvents: EvalAuditEvent[];
  pendingReviewCount: number;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Audit Trail</span>
        <div className="flex items-center gap-2">
          {pendingReviewCount > 0 && (
            <span className="text-[7px] font-bold bg-[hsl(var(--status-attention))]/15 text-[hsl(var(--status-attention))] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <ShieldAlert className="h-2.5 w-2.5" /> {pendingReviewCount} pending
            </span>
          )}
          <span className="text-[9px] text-muted-foreground">{auditEvents.length} events</span>
        </div>
      </div>

      <div className="space-y-0">
        {auditEvents.map((event, i) => {
          const severityColor = event.severity === "critical" ? "bg-destructive"
            : event.severity === "warning" ? "bg-[hsl(var(--status-attention))]"
            : "bg-primary/40";
          const isOverrideEvent = event.override_id !== null;

          return (
            <div key={event.id} className={`flex items-start gap-2.5 py-2 border-b border-border/50 last:border-0 group hover:bg-accent/20 rounded px-1 -mx-1 transition-colors ${
              isOverrideEvent ? "bg-primary/3" : ""
            }`}>
              <div className="mt-1 flex flex-col items-center">
                <span className={`h-1.5 w-1.5 rounded-full ${severityColor} group-hover:scale-125 transition-transform`} />
                {i < auditEvents.length - 1 && <span className="w-px h-full bg-border mt-0.5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] font-medium text-foreground">{event.label}</p>
                  {isOverrideEvent && (
                    <span className="text-[7px] font-bold bg-primary/10 text-primary px-1 py-0.5 rounded">OVERRIDE</span>
                  )}
                  {event.severity === "warning" && (
                    <AlertTriangle className="h-2.5 w-2.5 text-[hsl(var(--status-attention))]" />
                  )}
                </div>
                <p className="text-[8px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">{event.detail}</p>

                {/* Before/After for override events */}
                {isOverrideEvent && event.before_value && event.after_value && (
                  <div className="flex items-center gap-2 mt-1 text-[8px]">
                    <span className="text-muted-foreground line-through">
                      {(event.before_value as CorridorValues).low}–{(event.before_value as CorridorValues).mid}–{(event.before_value as CorridorValues).high}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-primary font-semibold">
                      {(event.after_value as CorridorValues).low}–{(event.after_value as CorridorValues).mid}–{(event.after_value as CorridorValues).high}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-0.5">
                  <Clock className="h-2.5 w-2.5 text-muted-foreground/50" />
                  <span className="text-[8px] text-muted-foreground">{new Date(event.timestamp).toLocaleString()}</span>
                  <span className="text-[8px] text-muted-foreground">·</span>
                  <span className="text-[8px] text-muted-foreground">{event.actor_name}</span>
                  <span className="text-[8px] text-muted-foreground flex items-center gap-0.5">
                    · <Cpu className="h-2 w-2" />v{event.logic_version}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {auditEvents.length === 0 && (
        <PlaceholderMessage message="No audit events recorded" />
      )}
    </div>
  );
}

function PlaceholderMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-32">
      <p className="text-[11px] text-muted-foreground italic">{message}</p>
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "default";
  if (typeof v === "number") return v.toString();
  return String(v);
}

export default EvalRightPanel;
