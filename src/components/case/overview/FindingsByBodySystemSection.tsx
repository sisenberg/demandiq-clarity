import { useState } from "react";
import { Activity, ChevronDown, ChevronRight, Bone, Brain, Heart, CircleDot, AlertTriangle } from "lucide-react";
import { useSourceDrawer } from "../SourceDrawer";

// ─── Body region mapping ─────────────────────────────
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
  Cervical: Bone,
  Thoracic: Bone,
  Lumbar: Bone,
  "Upper Extremity": Activity,
  "Lower Extremity": Activity,
  Neurologic: Brain,
  "Functional / Psychological": Heart,
  Other: CircleDot,
};

interface BodySystemGroup {
  system: string;
  findings: any[];
}

function groupFindingsBySystem(injuries: any[]): BodySystemGroup[] {
  const groups: Record<string, any[]> = {};
  injuries.forEach((inj) => {
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
  const findings = groupFindingsBySystem(injuries);
  const [expandedSystem, setExpandedSystem] = useState<string | null>(findings[0]?.system ?? null);

  if (findings.length === 0) {
    return (
      <section className="py-8 text-center">
        <Activity className="h-5 w-5 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No injury findings extracted yet.</p>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Findings by Body System</h2>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {injuries.length} finding{injuries.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="border border-border/60 rounded-lg overflow-hidden bg-card">
        {findings.map((group, gi) => {
          const isExpanded = expandedSystem === group.system;
          const SystemIcon = BODY_SYSTEM_ICON[group.system] ?? CircleDot;

          return (
            <div key={group.system} className={gi > 0 ? "border-t border-border/40" : ""}>
              <button
                onClick={() => setExpandedSystem(isExpanded ? null : group.system)}
                className="w-full px-4 py-2.5 flex items-center gap-2.5 hover:bg-accent/30 transition-colors"
              >
                <SystemIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[13px] font-medium text-foreground flex-1 text-left">{group.system}</span>
                <span className="text-[11px] text-muted-foreground">{group.findings.length}</span>
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />}
              </button>

              {isExpanded && (
                <div className="border-t border-border/30">
                  {/* Header row */}
                  <div className="grid grid-cols-[1fr_90px_80px_40px] gap-3 px-4 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    <span>Finding</span>
                    <span>First Date</span>
                    <span>Region</span>
                    <span></span>
                  </div>
                  {group.findings.map((f: any) => (
                    <div
                      key={f.id}
                      className="grid grid-cols-[1fr_90px_80px_40px] gap-3 px-4 py-2 hover:bg-accent/20 transition-colors items-center cursor-pointer border-t border-border/20"
                      onClick={() => {
                        if (f.evidence_refs?.length > 0) {
                          const ref = f.evidence_refs[0];
                          openSource({ docName: ref.doc_name, page: ref.page_label, excerpt: ref.quoted_text, relevance: ref.relevance });
                        }
                      }}
                    >
                      <div className="min-w-0">
                        <span className="text-[13px] text-foreground block truncate">{f.body_part}</span>
                        {f.diagnosis_code && (
                          <span className="text-[10px] font-mono text-muted-foreground">{f.diagnosis_code}</span>
                        )}
                      </div>
                      <span className="text-[12px] text-muted-foreground tabular-nums">
                        {f.first_date ? formatShortDate(f.first_date) : "—"}
                      </span>
                      <span className="text-[12px] text-muted-foreground">{f.body_region || "—"}</span>
                      <div className="flex justify-end">
                        {f.is_pre_existing && (
                          <AlertTriangle className="h-3 w-3 text-[hsl(var(--status-attention))]" />
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
