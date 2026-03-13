/**
 * EvaluateIQ — Right Panel
 * Tabbed panel with: Evidence, Factor Detail, Benchmark Detail, Audit Detail.
 */

import { useState } from "react";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import {
  ExternalLink,
  BarChart3,
  Scale,
  ScrollText,
  ChevronRight,
  FileText,
  Link2,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

type RightTab = "evidence" | "factors" | "benchmarks" | "audit";

const TABS: { key: RightTab; label: string; icon: React.ElementType }[] = [
  { key: "evidence", label: "Evidence", icon: ExternalLink },
  { key: "factors", label: "Factors", icon: Scale },
  { key: "benchmarks", label: "Benchmarks", icon: BarChart3 },
  { key: "audit", label: "Audit", icon: ScrollText },
];

interface Props {
  snapshot: EvaluateIntakeSnapshot | null;
  caseId: string | undefined;
}

const EvalRightPanel = ({ snapshot, caseId }: Props) => {
  const [activeTab, setActiveTab] = useState<RightTab>("evidence");

  return (
    <div className="w-[320px] shrink-0 border-l border-border bg-card overflow-y-auto h-full flex flex-col">
      {/* Tab bar */}
      <div className="shrink-0 border-b border-border px-2 pt-2">
        <div className="flex items-center gap-0.5">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
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
        {activeTab === "benchmarks" && <BenchmarksPanel />}
        {activeTab === "audit" && <AuditPanel caseId={caseId} />}
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

      {/* Injury evidence */}
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

      {/* Liability evidence */}
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

      {/* Billing evidence */}
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
    <div className="space-y-2">
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
    </div>
  );
}

// ─── Benchmarks Panel ───────────────────────────────────

function BenchmarksPanel() {
  return (
    <div className="space-y-3">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Benchmark Support</span>
      <div className="rounded-lg border border-border p-4 text-center">
        <BarChart3 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-[11px] font-medium text-foreground">Historical Calibration</p>
        <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed max-w-[220px] mx-auto">
          Comparable verdicts and settlements for similar injury profiles, jurisdictions, and liability postures will appear here.
        </p>
      </div>
      <div className="rounded-lg border border-border p-4 text-center">
        <Scale className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-[11px] font-medium text-foreground">Venue Analytics</p>
        <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed max-w-[220px] mx-auto">
          Jurisdiction-specific multipliers and historical outcome distributions.
        </p>
      </div>
    </div>
  );
}

// ─── Audit Panel ────────────────────────────────────────

function AuditPanel({ caseId }: { caseId: string | undefined }) {
  // Placeholder — will be wired to audit_events table
  const auditEntries = [
    { action: "Module started", time: "2 hours ago", actor: "System" },
    { action: "Snapshot created", time: "2 hours ago", actor: "System" },
    { action: "Valuation drivers extracted", time: "1 hour ago", actor: "Engine v1.0" },
    { action: "Range computed", time: "1 hour ago", actor: "Engine v1.0" },
  ];

  return (
    <div className="space-y-3">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Audit Trail</span>
      <div className="space-y-1">
        {auditEntries.map((entry, i) => (
          <div key={i} className="flex items-start gap-2.5 py-2 border-b border-border last:border-0">
            <Clock className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-foreground">{entry.action}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] text-muted-foreground">{entry.time}</span>
                <span className="text-[9px] text-muted-foreground">·</span>
                <span className="text-[9px] text-muted-foreground">{entry.actor}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
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

export default EvalRightPanel;
