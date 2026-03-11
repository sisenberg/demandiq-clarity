import { useState } from "react";
import { Activity } from "lucide-react";

interface InjuryMarker {
  id: string;
  label: string;
  bodyRegion: string;
  diagnosis: string;
  icdCode: string;
  severity: "minor" | "moderate" | "severe";
  source: string;
  /** Position as percentage of the SVG viewbox (0–100) */
  x: number;
  y: number;
}

const MOCK_INJURIES: InjuryMarker[] = [
  {
    id: "inj-1",
    label: "Cervical Spine",
    bodyRegion: "Neck",
    diagnosis: "Disc herniation C5-C6 with foraminal narrowing",
    icdCode: "M50.12",
    severity: "severe",
    source: "MRI Report — Regional Radiology, pg. 7",
    x: 50,
    y: 18,
  },
  {
    id: "inj-2",
    label: "Right Shoulder",
    bodyRegion: "Shoulder",
    diagnosis: "Rotator cuff strain, right shoulder contusion",
    icdCode: "S46.011A",
    severity: "moderate",
    source: "ER Records — Mercy General, pg. 1",
    x: 34,
    y: 24,
  },
  {
    id: "inj-3",
    label: "Lumbar Spine",
    bodyRegion: "Lower Back",
    diagnosis: "Lumbar strain L4-L5, possible pre-existing degenerative changes",
    icdCode: "M54.5",
    severity: "moderate",
    source: "Dr. Chen Ortho Eval, pg. 3",
    x: 50,
    y: 42,
  },
  {
    id: "inj-4",
    label: "Right Knee",
    bodyRegion: "Knee",
    diagnosis: "Medial meniscus tear, right knee",
    icdCode: "S83.211A",
    severity: "moderate",
    source: "MRI Report — Regional Radiology, pg. 12",
    x: 44,
    y: 68,
  },
  {
    id: "inj-5",
    label: "Left Wrist",
    bodyRegion: "Wrist",
    diagnosis: "Scaphoid fracture, non-displaced",
    icdCode: "S62.001A",
    severity: "minor",
    source: "X-Ray Report — Mercy General, pg. 2",
    x: 68,
    y: 48,
  },
];

const SEVERITY_COLOR: Record<string, string> = {
  minor: "hsl(var(--status-review))",
  moderate: "hsl(var(--status-attention))",
  severe: "hsl(var(--status-failed))",
};

const SEVERITY_BADGE: Record<string, string> = {
  minor: "status-badge-review",
  moderate: "status-badge-attention",
  severe: "status-badge-failed",
};

const BodyMap = () => {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedInjury = MOCK_INJURIES.find((i) => i.id === selected);

  return (
    <div className="card-elevated overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Findings by Body Region</h2>
        <span className="text-[10px] font-medium bg-accent text-muted-foreground px-2 py-0.5 rounded-full">
          {MOCK_INJURIES.length} injuries
        </span>
      </div>

      <div className="flex flex-col sm:flex-row">
        {/* Body outline SVG area */}
        <div className="flex-1 flex items-center justify-center p-6 min-h-[380px] relative">
          <svg viewBox="0 0 100 100" className="w-full max-w-[200px] h-auto">
            {/* Simplified body outline */}
            {/* Head */}
            <ellipse cx="50" cy="8" rx="6" ry="7" fill="none" stroke="hsl(var(--border))" strokeWidth="0.8" />
            {/* Neck */}
            <line x1="50" y1="15" x2="50" y2="18" stroke="hsl(var(--border))" strokeWidth="0.8" />
            {/* Torso */}
            <path d="M38 18 L38 50 L62 50 L62 18 Z" fill="none" stroke="hsl(var(--border))" strokeWidth="0.8" rx="3" />
            {/* Left arm */}
            <path d="M38 20 L28 25 L25 45 L30 48 L33 30 L38 26" fill="none" stroke="hsl(var(--border))" strokeWidth="0.7" />
            {/* Right arm */}
            <path d="M62 20 L72 25 L75 45 L70 48 L67 30 L62 26" fill="none" stroke="hsl(var(--border))" strokeWidth="0.7" />
            {/* Left leg */}
            <path d="M42 50 L40 75 L38 90 L42 92 L44 76 L46 50" fill="none" stroke="hsl(var(--border))" strokeWidth="0.7" />
            {/* Right leg */}
            <path d="M54 50 L56 75 L58 90 L54 92 L52 76 L50 50" fill="none" stroke="hsl(var(--border))" strokeWidth="0.7" />

            {/* Injury markers */}
            {MOCK_INJURIES.map((injury) => (
              <g
                key={injury.id}
                className="cursor-pointer"
                onClick={() => setSelected(selected === injury.id ? null : injury.id)}
              >
                {/* Pulse ring */}
                <circle
                  cx={injury.x}
                  cy={injury.y}
                  r="4"
                  fill="none"
                  stroke={SEVERITY_COLOR[injury.severity]}
                  strokeWidth="0.5"
                  opacity="0.4"
                >
                  <animate
                    attributeName="r"
                    from="3"
                    to="6"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    from="0.5"
                    to="0"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>
                {/* Main dot */}
                <circle
                  cx={injury.x}
                  cy={injury.y}
                  r="2.5"
                  fill={SEVERITY_COLOR[injury.severity]}
                  stroke={selected === injury.id ? "hsl(var(--foreground))" : "hsl(var(--card))"}
                  strokeWidth={selected === injury.id ? "1" : "0.6"}
                  className="transition-all"
                />
              </g>
            ))}
          </svg>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 flex flex-col gap-1">
            {(["severe", "moderate", "minor"] as const).map((sev) => (
              <div key={sev} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: SEVERITY_COLOR[sev] }}
                />
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
                <span className={SEVERITY_BADGE[selectedInjury.severity]}>
                  {selectedInjury.severity}
                </span>
                <span className="text-xs font-semibold text-foreground">{selectedInjury.bodyRegion}</span>
              </div>
              <h4 className="text-sm font-medium text-foreground mb-1">{selectedInjury.label}</h4>
              <p className="text-xs text-foreground leading-relaxed mb-3">
                {selectedInjury.diagnosis}
              </p>
              <div className="flex flex-col gap-2">
                <MetaLine label="ICD-10" value={selectedInjury.icdCode} />
                <MetaLine label="Source" value={selectedInjury.source} />
              </div>
            </div>
          ) : (
            <div className="p-4">
              <p className="text-xs font-medium text-foreground mb-3">All Injuries</p>
              <div className="flex flex-col gap-2">
                {MOCK_INJURIES.map((injury) => (
                  <button
                    key={injury.id}
                    onClick={() => setSelected(injury.id)}
                    className="flex items-center gap-2 text-left p-2 rounded-lg hover:bg-accent/60 transition-colors"
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: SEVERITY_COLOR[injury.severity] }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{injury.label}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{injury.icdCode}</p>
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
