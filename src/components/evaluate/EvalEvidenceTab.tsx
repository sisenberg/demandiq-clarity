import { useState } from "react";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import {
  FileText,
  Search,
  ChevronRight,
  ExternalLink,
  Bone,
  Activity,
  Scale,
  Shield,
  DollarSign,
  AlertTriangle,
} from "lucide-react";

interface Props {
  snapshot: EvaluateIntakeSnapshot;
}

// ─── Group evidence by section ──────────────────────────

interface EvidenceGroup {
  section: string;
  icon: React.ElementType;
  items: EvidenceItem[];
}

interface EvidenceItem {
  label: string;
  description: string;
  refIds: string[];
  source: string;
  confidence: number | null;
}

function buildEvidenceGroups(s: EvaluateIntakeSnapshot): EvidenceGroup[] {
  const groups: EvidenceGroup[] = [];

  // Injuries
  const injuryItems: EvidenceItem[] = s.injuries.map((inj) => ({
    label: `${inj.body_part} — ${inj.diagnosis_description}`,
    description: `${inj.severity} · ${inj.diagnosis_code}${inj.is_pre_existing ? " · Pre-existing" : ""}`,
    refIds: inj.provenance.evidence_ref_ids,
    source: inj.provenance.source_module === "revieweriq" ? "ReviewerIQ" : "DemandIQ",
    confidence: inj.provenance.confidence,
  }));
  if (injuryItems.length > 0) groups.push({ section: "Injuries", icon: Bone, items: injuryItems });

  // Treatments
  const txItems: EvidenceItem[] = s.treatment_timeline.slice(0, 20).map((tx) => ({
    label: `${tx.treatment_type} — ${tx.provider_name}`,
    description: tx.description,
    refIds: tx.provenance.evidence_ref_ids,
    source: tx.provenance.source_module === "revieweriq" ? "ReviewerIQ" : "DemandIQ",
    confidence: tx.provenance.confidence,
  }));
  if (txItems.length > 0) groups.push({ section: "Treatments", icon: Activity, items: txItems });

  // Liability
  const liabItems: EvidenceItem[] = s.liability_facts.map((f) => ({
    label: f.supports_liability ? "Supporting" : "Adverse",
    description: f.fact_text,
    refIds: f.provenance.evidence_ref_ids,
    source: f.provenance.source_module === "revieweriq" ? "ReviewerIQ" : "DemandIQ",
    confidence: f.confidence,
  }));
  if (liabItems.length > 0) groups.push({ section: "Liability Facts", icon: Scale, items: liabItems });

  // Coverage
  const covItems: EvidenceItem[] = s.policy_coverage.map((p) => ({
    label: `${p.carrier_name} — ${p.policy_type}`,
    description: `Limit: $${(p.coverage_limit ?? 0).toLocaleString()} · Deductible: $${(p.deductible ?? 0).toLocaleString()}`,
    refIds: p.provenance.evidence_ref_ids,
    source: p.provenance.source_module === "revieweriq" ? "ReviewerIQ" : "DemandIQ",
    confidence: p.provenance.confidence,
  }));
  if (covItems.length > 0) groups.push({ section: "Policy & Coverage", icon: Shield, items: covItems });

  // Billing
  const billItems: EvidenceItem[] = s.medical_billing.slice(0, 15).map((b) => ({
    label: `${b.description} — ${b.provider_name}`,
    description: `Billed: $${b.billed_amount.toLocaleString()}${b.reviewer_recommended_amount != null ? ` · Reviewed: $${b.reviewer_recommended_amount.toLocaleString()}` : ""}`,
    refIds: b.provenance.evidence_ref_ids,
    source: b.provenance.source_module === "revieweriq" ? "ReviewerIQ" : "DemandIQ",
    confidence: b.provenance.confidence,
  }));
  if (billItems.length > 0) groups.push({ section: "Medical Billing", icon: DollarSign, items: billItems });

  // Concerns
  const concernItems: EvidenceItem[] = s.upstream_concerns.map((c) => ({
    label: `[${c.category}] ${c.severity}`,
    description: c.description,
    refIds: c.provenance.evidence_ref_ids,
    source: c.provenance.source_module === "revieweriq" ? "ReviewerIQ" : "DemandIQ",
    confidence: c.provenance.confidence,
  }));
  if (concernItems.length > 0) groups.push({ section: "Upstream Concerns", icon: AlertTriangle, items: concernItems });

  return groups;
}

// ─── Component ──────────────────────────────────────────

const EvalEvidenceTab = ({ snapshot }: Props) => {
  const groups = buildEvidenceGroups(snapshot);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string>(groups[0]?.section ?? "");

  const filtered = search.trim()
    ? groups.map((g) => ({
        ...g,
        items: g.items.filter((item) =>
          `${item.label} ${item.description}`.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter((g) => g.items.length > 0)
    : groups;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[13px] font-semibold text-foreground">Evidence Traceability</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Drill from any valuation input back to its source evidence references.
        </p>
      </div>

      {/* Search */}
      <div className="search-input max-w-sm">
        <Search className="h-3.5 w-3.5" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search evidence items…"
          className="bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground/50 outline-none w-full"
        />
      </div>

      {/* Groups */}
      <div className="space-y-2">
        {filtered.map((group) => (
          <div key={group.section} className="card-elevated overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === group.section ? "" : group.section)}
              className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-accent/30 transition-colors"
            >
              <group.icon className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-[12px] font-semibold text-foreground flex-1 text-left">{group.section}</span>
              <span className="text-[10px] text-muted-foreground">{group.items.length} items</span>
              <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded === group.section ? "rotate-90" : ""}`} />
            </button>
            {expanded === group.section && (
              <div className="border-t border-border divide-y divide-border/40">
                {group.items.map((item, i) => (
                  <div key={i} className="px-4 py-3 hover:bg-accent/20 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-foreground">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{item.description}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {item.confidence !== null && (
                          <span className={`confidence-dot ${item.confidence >= 0.8 ? "confidence-high" : item.confidence >= 0.5 ? "confidence-medium" : "confidence-low"}`} />
                        )}
                        <span className="text-[9px] font-medium text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{item.source}</span>
                      </div>
                    </div>
                    {item.refIds.length > 0 && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className="text-[9px] text-primary font-medium">{item.refIds.length} evidence ref{item.refIds.length !== 1 ? "s" : ""}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EvalEvidenceTab;
