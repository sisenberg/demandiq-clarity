import { useState } from "react";
import { Activity } from "lucide-react";
import { useCasePackage } from "@/hooks/useCasePackage";
import type { Injury } from "@/types";

const SEVERITY_COLOR: Record<string, string> = {
  minor: "hsl(var(--status-review))",
  moderate: "hsl(var(--status-attention))",
  severe: "hsl(var(--status-failed))",
  catastrophic: "hsl(var(--status-failed))",
  fatal: "hsl(var(--status-failed))",
};

const SEVERITY_BADGE: Record<string, string> = {
  minor: "status-badge-review",
  moderate: "status-badge-attention",
  severe: "status-badge-failed",
  catastrophic: "status-badge-failed",
  fatal: "status-badge-failed",
};

const BodyMap = () => {
  const { pkg } = useCasePackage();
  const [selected, setSelected] = useState<string | null>(null);
  const selectedInjury = pkg.injuries.find((i) => i.id === selected);

  return (
    <div className="card-elevated overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Findings by Body Region</h2>
        <span className="text-[10px] font-medium bg-accent text-muted-foreground px-2 py-0.5 rounded-full">
          {pkg.injuries.length} injuries
        </span>
      </div>

      <div className="flex flex-col sm:flex-row">
        {/* Body outline SVG area */}
        <div className="flex-1 flex items-center justify-center p-6 min-h-[380px] relative">
          <svg viewBox="0 0 100 100" className="w-full max-w-[200px] h-auto">
            <ellipse cx="50" cy="8" rx="6" ry="7" fill="none" stroke="hsl(var(--border))" strokeWidth="0.8" />
            <line x1="50" y1="15" x2="50" y2="18" stroke="hsl(var(--border))" strokeWidth="0.8" />
            <path d="M38 18 L38 50 L62 50 L62 18 Z" fill="none" stroke="hsl(var(--border))" strokeWidth="0.8" rx="3" />
            <path d="M38 20 L28 25 L25 45 L30 48 L33 30 L38 26" fill="none" stroke="hsl(var(--border))" strokeWidth="0.7" />
            <path d="M62 20 L72 25 L75 45 L70 48 L67 30 L62 26" fill="none" stroke="hsl(var(--border))" strokeWidth="0.7" />
            <path d="M42 50 L40 75 L38 90 L42 92 L44 76 L46 50" fill="none" stroke="hsl(var(--border))" strokeWidth="0.7" />
            <path d="M54 50 L56 75 L58 90 L54 92 L52 76 L50 50" fill="none" stroke="hsl(var(--border))" strokeWidth="0.7" />

            {pkg.injuries.map((injury) => (
              <g key={injury.id} className="cursor-pointer" onClick={() => setSelected(selected === injury.id ? null : injury.id)}>
                <circle cx={injury.map_x} cy={injury.map_y} r="4" fill="none" stroke={SEVERITY_COLOR[injury.severity]} strokeWidth="0.5" opacity="0.4">
                  <animate attributeName="r" from="3" to="6" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.5" to="0" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx={injury.map_x} cy={injury.map_y} r="2.5" fill={SEVERITY_COLOR[injury.severity]} stroke={selected === injury.id ? "hsl(var(--foreground))" : "hsl(var(--card))"} strokeWidth={selected === injury.id ? "1" : "0.6"} className="transition-all" />
              </g>
            ))}
          </svg>

          <div className="absolute bottom-4 left-4 flex flex-col gap-1">
            {(["severe", "moderate", "minor"] as const).map((sev) => (
              <div key={sev} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SEVERITY_COLOR[sev] }} />
                <span className="text-[10px] text-muted-foreground capitalize">{sev}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="sm:w-64 border-t sm:border-t-0 sm:border-l border-border bg-muted/20 overflow-y-auto">
          {selectedInjury ? (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className={SEVERITY_BADGE[selectedInjury.severity]}>{selectedInjury.severity}</span>
                <span className="text-xs font-semibold text-foreground">{selectedInjury.body_region}</span>
              </div>
              <h4 className="text-sm font-medium text-foreground mb-1">{selectedInjury.body_part}</h4>
              <p className="text-xs text-foreground leading-relaxed mb-3">{selectedInjury.diagnosis_description}</p>
              <div className="flex flex-col gap-2">
                <MetaLine label="ICD-10" value={selectedInjury.diagnosis_code} />
                <MetaLine label="Pre-existing" value={selectedInjury.is_pre_existing ? "Possible" : "No"} />
                {selectedInjury.evidence_refs.length > 0 && (
                  <MetaLine label="Source" value={`${selectedInjury.evidence_refs[0].doc_name}, ${selectedInjury.evidence_refs[0].page_label}`} />
                )}
              </div>
            </div>
          ) : (
            <div className="p-4">
              <p className="text-xs font-medium text-foreground mb-3">All Injuries</p>
              <div className="flex flex-col gap-2">
                {pkg.injuries.map((injury) => (
                  <button key={injury.id} onClick={() => setSelected(injury.id)} className="flex items-center gap-2 text-left p-2 rounded-lg hover:bg-accent/60 transition-colors">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: SEVERITY_COLOR[injury.severity] }} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{injury.body_part}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{injury.diagnosis_code}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      <p className="text-xs text-foreground mt-0.5">{value}</p>
    </div>
  );
}

export default BodyMap;
