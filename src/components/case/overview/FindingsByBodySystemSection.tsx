import { useState, useMemo } from "react";
import { Activity, ChevronDown, ChevronRight, Bone, Brain, Heart, CircleDot, AlertTriangle } from "lucide-react";
import { useSourceDrawer } from "../SourceDrawer";

function mapInjuryToBodySystem(bodyPart: string, bodyRegion?: string): string {
  const bp = ((bodyPart || "") + " " + (bodyRegion || "")).toLowerCase();
  if (bp.includes("cervic") || bp.includes("neck")) return "Cervical";
  if (bp.includes("thorac") || bp.includes("upper back") || bp.includes("mid back")) return "Thoracic";
  if (bp.includes("lumbar") || bp.includes("lower back") || bp.includes("sacr")) return "Lumbar";
  if (bp.includes("shoulder") || bp.includes("elbow") || bp.includes("wrist") || bp.includes("hand") || bp.includes("arm")) return "Upper Extremity";
  if (bp.includes("hip") || bp.includes("knee") || bp.includes("ankle") || bp.includes("foot") || bp.includes("leg")) return "Lower Extremity";
  if (bp.includes("neuro") || bp.includes("brain") || bp.includes("head") || bp.includes("concuss") || bp.includes("radiculop")) return "Neurologic";
  if (bp.includes("function") || bp.includes("sleep") || bp.includes("mood") || bp.includes("anxiety") || bp.includes("ptsd")) return "Functional / Psychological";
  return "Other";
}

const BODY_SYSTEM_ICON: Record<string, React.ElementType> = {
  Cervical: Bone, Thoracic: Bone, Lumbar: Bone,
  "Upper Extremity": Activity, "Lower Extremity": Activity,
  Neurologic: Brain, "Functional / Psychological": Heart, Other: CircleDot,
};

interface BodySystemGroup {
  system: string;
  findings: any[];
}

/** Deduplicate findings by body_part name within each system, keeping the richest record */
function deduplicateFindings(injuries: any[]): any[] {
  const seen = new Map<string, any>();
  for (const inj of injuries) {
    const key = (inj.body_part || "").toLowerCase().trim();
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, inj);
    } else {
      // Keep the one with more data
      if ((inj.diagnosis_code && !existing.diagnosis_code) || (inj.first_date && !existing.first_date)) {
        seen.set(key, { ...existing, ...inj, evidence_refs: [...(existing.evidence_refs ?? []), ...(inj.evidence_refs ?? [])] });
      }
    }
  }
  return Array.from(seen.values());
}

function groupFindingsBySystem(injuries: any[]): BodySystemGroup[] {
  const deduped = deduplicateFindings(injuries);
  const groups: Record<string, any[]> = {};
  deduped.forEach((inj) => {
    const system = mapInjuryToBodySystem(inj.body_part, inj.body_region);
    if (!groups[system]) groups[system] = [];
    groups[system].push(inj);
  });
  const order = ["Cervical", "Thoracic", "Lumbar", "Upper Extremity", "Lower Extremity", "Neurologic", "Functional / Psychological", "Other"];
  return order.filter((s) => groups[s]).map((s) => ({ system: s, findings: groups[s] }));
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface FindingsByBodySystemSectionProps {
  injuries: any[];
}

const FindingsByBodySystemSection = ({ injuries }: FindingsByBodySystemSectionProps) => {
  const { openSource } = useSourceDrawer();
  const findings = useMemo(() => groupFindingsBySystem(injuries), [injuries]);
  const [expandedSystem, setExpandedSystem] = useState<string | null>(findings[0]?.system ?? null);
  const totalDeduped = findings.reduce((n, g) => n + g.findings.length, 0);

  if (findings.length === 0) {
    return (
      <section className="py-6 text-center">
        <p className="text-xs text-muted-foreground">No injury findings extracted yet.</p>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Findings by Body System</h2>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {totalDeduped} unique
        </span>
      </div>

      <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
        {findings.map((group, gi) => {
          const isExpanded = expandedSystem === group.system;
          const SystemIcon = BODY_SYSTEM_ICON[group.system] ?? CircleDot;

          return (
            <div key={group.system} className={gi > 0 ? "border-t border-border/30" : ""}>
              <button
                onClick={() => setExpandedSystem(isExpanded ? null : group.system)}
                className="w-full px-3.5 py-2 flex items-center gap-2 hover:bg-accent/20 transition-colors"
              >
                <SystemIcon className="h-3 w-3 text-muted-foreground/60" />
                <span className="text-[12px] font-medium text-foreground flex-1 text-left">{group.system}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">{group.findings.length}</span>
                {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground/40" /> : <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
              </button>

              {isExpanded && (
                <div className="border-t border-border/20">
                  {/* Header */}
                  <div className="grid grid-cols-[1fr_80px_90px_28px] gap-2 px-3.5 py-1 text-[9px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                    <span>Finding</span>
                    <span>First Date</span>
                    <span>Region</span>
                    <span></span>
                  </div>
                  {group.findings.map((f: any) => (
                    <div
                      key={f.id}
                      className="grid grid-cols-[1fr_80px_90px_28px] gap-2 px-3.5 py-1.5 hover:bg-accent/15 transition-colors items-center cursor-pointer border-t border-border/10"
                      onClick={() => {
                        if (f.evidence_refs?.length > 0) {
                          const ref = f.evidence_refs[0];
                          openSource({ docName: ref.doc_name, page: ref.page_label, excerpt: ref.quoted_text, relevance: ref.relevance });
                        }
                      }}
                    >
                      <div className="min-w-0">
                        <span className="text-[12px] text-foreground block truncate">{f.body_part}</span>
                        {f.diagnosis_code && (
                          <span className="text-[9px] font-mono text-muted-foreground/60">{f.diagnosis_code}</span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {f.first_date ? formatShortDate(f.first_date) : "—"}
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate">{f.body_region || "—"}</span>
                      <div className="flex justify-end">
                        {f.is_pre_existing && (
                          <AlertTriangle className="h-2.5 w-2.5 text-[hsl(var(--status-attention))]" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default FindingsByBodySystemSection;
