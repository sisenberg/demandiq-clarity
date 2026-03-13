/**
 * EvaluateIQ — Placeholder Valuation Cards
 * Claim Profile, Merits Corridor, Adjusted Settlement Corridor,
 * Documentation Sufficiency, Benchmark Support, Top Drivers,
 * Top Suppressors, Uncertainty Drivers.
 */

import {
  User,
  Scale,
  Target,
  FileCheck,
  BarChart3,
  TrendingUp,
  TrendingDown,
  HelpCircle,
  Gauge,
  AlertTriangle,
  Shield,
  Activity,
} from "lucide-react";

interface CardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  status?: "ready" | "pending" | "empty";
  children?: React.ReactNode;
}

function ValuationCard({ icon: Icon, title, description, status = "pending", children }: CardProps) {
  const statusConfig = {
    ready: { label: "Ready", color: "text-[hsl(var(--status-approved))]", bg: "bg-[hsl(var(--status-approved))]/10" },
    pending: { label: "Pending", color: "text-[hsl(var(--status-attention))]", bg: "bg-[hsl(var(--status-attention))]/10" },
    empty: { label: "Awaiting Data", color: "text-muted-foreground", bg: "bg-accent" },
  };

  const sc = statusConfig[status];

  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-[12px] font-semibold text-foreground">{title}</h3>
          </div>
        </div>
        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${sc.color} ${sc.bg}`}>
          {sc.label}
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">{description}</p>
      {children && <div className="mt-3 pt-3 border-t border-border">{children}</div>}
    </div>
  );
}

// ─── Exported Card Grid ─────────────────────────────────

const EvalValuationCards = () => {
  return (
    <div className="space-y-4">
      {/* Top row: Claim Profile + Documentation Sufficiency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ValuationCard
          icon={User}
          title="Claim Profile"
          description="Consolidated injury profile, treatment intensity, and claimant demographics forming the valuation baseline."
          status="pending"
        >
          <div className="space-y-1.5">
            <PlaceholderRow label="Primary Injuries" />
            <PlaceholderRow label="Treatment Duration" />
            <PlaceholderRow label="Impairment Rating" />
            <PlaceholderRow label="Liability Posture" />
          </div>
        </ValuationCard>

        <ValuationCard
          icon={FileCheck}
          title="Documentation Sufficiency"
          description="Assessment of documentation completeness across medical records, billing, liability evidence, and coverage verification."
          status="pending"
        >
          <div className="space-y-1.5">
            <SufficiencyRow label="Medical Records" percent={null} />
            <SufficiencyRow label="Billing Records" percent={null} />
            <SufficiencyRow label="Liability Evidence" percent={null} />
            <SufficiencyRow label="Coverage Docs" percent={null} />
          </div>
        </ValuationCard>
      </div>

      {/* Merits Corridor */}
      <ValuationCard
        icon={Scale}
        title="Merits Corridor"
        description="Range boundaries derived from case merits including injury severity, treatment reasonableness, liability strength, and documented permanency. This corridor represents the evidence-supported valuation zone before policy and strategic adjustments."
        status="pending"
      >
        <div className="flex items-center gap-4">
          <CorridorPlaceholder label="Floor" />
          <div className="flex-1 h-2 rounded-full bg-accent relative overflow-hidden">
            <div className="absolute inset-y-0 left-[15%] right-[15%] rounded-full bg-primary/20" />
          </div>
          <CorridorPlaceholder label="Ceiling" />
        </div>
      </ValuationCard>

      {/* Adjusted Settlement Corridor */}
      <ValuationCard
        icon={Target}
        title="Adjusted Settlement Corridor"
        description="Final corridor after applying venue multipliers, policy caps, comparative negligence adjustments, and human-adopted assumption overrides. This is the publishable settlement range."
        status="pending"
      >
        <div className="grid grid-cols-3 gap-3">
          <CorridorBand label="Conservative" sublabel="Floor" />
          <CorridorBand label="Likely" sublabel="Target" primary />
          <CorridorBand label="Stretch" sublabel="Ceiling" />
        </div>
      </ValuationCard>

      {/* Benchmark Support */}
      <ValuationCard
        icon={BarChart3}
        title="Benchmark Support"
        description="Historical comparable outcomes calibrated by injury type, jurisdiction, treatment profile, and liability posture. Provides confidence anchoring for the derived corridor."
        status="empty"
      >
        <div className="text-center py-4">
          <BarChart3 className="h-6 w-6 text-muted-foreground/20 mx-auto mb-1.5" />
          <p className="text-[10px] text-muted-foreground">Calibration data will populate when historical corpus is available for this profile.</p>
        </div>
      </ValuationCard>

      {/* Drivers Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Value Drivers */}
        <ValuationCard
          icon={TrendingUp}
          title="Top Value Drivers"
          description="Factors that expand the valuation range upward."
          status="pending"
        >
          <div className="space-y-1.5">
            <DriverPlaceholder label="Surgical intervention" direction="up" />
            <DriverPlaceholder label="Permanency indicators" direction="up" />
            <DriverPlaceholder label="Future medical needs" direction="up" />
          </div>
        </ValuationCard>

        {/* Top Suppressors */}
        <ValuationCard
          icon={TrendingDown}
          title="Top Suppressors"
          description="Factors that compress the valuation range downward."
          status="pending"
        >
          <div className="space-y-1.5">
            <DriverPlaceholder label="Pre-existing conditions" direction="down" />
            <DriverPlaceholder label="Treatment gaps" direction="down" />
            <DriverPlaceholder label="Comparative negligence" direction="down" />
          </div>
        </ValuationCard>

        {/* Uncertainty Drivers */}
        <ValuationCard
          icon={HelpCircle}
          title="Uncertainty Drivers"
          description="Factors introducing valuation uncertainty requiring human judgment."
          status="pending"
        >
          <div className="space-y-1.5">
            <DriverPlaceholder label="Incomplete medical records" direction="uncertain" />
            <DriverPlaceholder label="Disputed causation" direction="uncertain" />
            <DriverPlaceholder label="Venue variability" direction="uncertain" />
          </div>
        </ValuationCard>
      </div>
    </div>
  );
};

// ─── Sub-components ─────────────────────────────────────

function PlaceholderRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-[10px] text-muted-foreground/40 italic">—</span>
    </div>
  );
}

function SufficiencyRow({ label, percent }: { label: string; percent: number | null }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground flex-1">{label}</span>
      <div className="w-16 h-1.5 rounded-full bg-accent overflow-hidden">
        {percent !== null && (
          <div className="h-full rounded-full bg-primary/60" style={{ width: `${percent}%` }} />
        )}
      </div>
      <span className="text-[9px] text-muted-foreground w-8 text-right">{percent !== null ? `${percent}%` : "—"}</span>
    </div>
  );
}

function CorridorPlaceholder({ label }: { label: string }) {
  return (
    <div className="text-center shrink-0">
      <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-[14px] font-bold text-muted-foreground/30 mt-0.5">$—</p>
    </div>
  );
}

function CorridorBand({ label, sublabel, primary }: { label: string; sublabel: string; primary?: boolean }) {
  return (
    <div className={`text-center rounded-lg border p-3 ${primary ? "border-primary/30 bg-primary/5" : "border-border bg-accent/30"}`}>
      <p className={`text-[10px] font-semibold ${primary ? "text-primary" : "text-foreground"}`}>{label}</p>
      <p className="text-[9px] text-muted-foreground mt-0.5">{sublabel}</p>
      <p className={`text-[16px] font-bold mt-1 ${primary ? "text-primary" : "text-muted-foreground/30"}`}>$—</p>
    </div>
  );
}

function DriverPlaceholder({ label, direction }: { label: string; direction: "up" | "down" | "uncertain" }) {
  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : HelpCircle;
  const color = direction === "up"
    ? "text-[hsl(var(--status-attention))]"
    : direction === "down"
      ? "text-[hsl(var(--status-approved))]"
      : "text-muted-foreground";

  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-3 w-3 ${color} shrink-0`} />
      <span className="text-[10px] text-foreground">{label}</span>
    </div>
  );
}

export default EvalValuationCards;
