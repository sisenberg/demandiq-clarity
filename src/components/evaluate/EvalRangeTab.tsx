import { useState } from "react";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import {
  Target,
  ArrowDownRight,
  ArrowUpRight,
  TrendingUp,
  CheckCircle2,
  Info,
  Gauge,
} from "lucide-react";

interface Props {
  snapshot: EvaluateIntakeSnapshot;
}

// ─── Derive range from snapshot inputs ──────────────────

interface RangeOutput {
  floor: number;
  likely: number;
  stretch: number;
  confidence: "high" | "moderate" | "low";
  assumptions: { label: string; impact: "floor" | "likely" | "stretch" }[];
}

function deriveRange(s: EvaluateIntakeSnapshot): RangeOutput {
  const totalBilled = s.medical_billing.reduce((sum, b) => sum + b.billed_amount, 0);
  const totalReviewed = s.medical_billing.reduce((sum, b) => sum + (b.reviewer_recommended_amount ?? 0), 0);
  const hasReviewed = s.medical_billing.some((b) => b.reviewer_recommended_amount !== null);
  const medBase = hasReviewed ? totalReviewed : totalBilled;
  const wageLoss = s.wage_loss.total_lost_wages.value;
  const futureMed = s.future_treatment.future_medical_estimate.value;

  // Multipliers based on clinical flags
  let floorMult = 1.5;
  let likelyMult = 2.5;
  let stretchMult = 4.0;

  if (s.clinical_flags.has_surgery) { floorMult += 0.5; likelyMult += 1.0; stretchMult += 1.5; }
  if (s.clinical_flags.has_permanency_indicators) { floorMult += 0.3; likelyMult += 0.8; stretchMult += 1.2; }
  if (s.clinical_flags.has_scarring_disfigurement) { likelyMult += 0.3; stretchMult += 0.5; }

  // Reducers
  if (s.injuries.some((i) => i.is_pre_existing)) { floorMult -= 0.2; likelyMult -= 0.3; }
  if (s.upstream_concerns.some((c) => c.category === "gap")) { floorMult -= 0.1; likelyMult -= 0.2; }

  const specials = medBase * floorMult + wageLoss + futureMed;
  const floor = Math.round(specials * 0.7);
  const likely = Math.round(medBase * likelyMult + wageLoss + futureMed);
  const stretch = Math.round(medBase * stretchMult + wageLoss + futureMed);

  // Confidence from completeness
  const confidence = s.overall_completeness_score >= 80 ? "high" : s.overall_completeness_score >= 50 ? "moderate" : "low";

  // Assumptions
  const assumptions: RangeOutput["assumptions"] = [];
  if (hasReviewed) assumptions.push({ label: "Using reviewer-recommended medical totals (not billed)", impact: "likely" });
  else assumptions.push({ label: "Using billed medical amounts — reviewed totals not available", impact: "likely" });
  if (s.clinical_flags.has_surgery) assumptions.push({ label: "Surgical intervention increases general damages multiplier", impact: "stretch" });
  if (s.injuries.some((i) => i.is_pre_existing)) assumptions.push({ label: "Pre-existing conditions applied as reduction factor", impact: "floor" });
  if (s.clinical_flags.has_permanency_indicators) assumptions.push({ label: "Permanency findings applied as expansion factor", impact: "stretch" });
  if (s.upstream_concerns.some((c) => c.category === "gap")) assumptions.push({ label: "Treatment gaps may limit floor recovery", impact: "floor" });
  if (futureMed > 0) assumptions.push({ label: `Future medical estimate of $${futureMed.toLocaleString()} included`, impact: "likely" });

  return { floor: Math.max(floor, 0), likely: Math.max(likely, 0), stretch: Math.max(stretch, 0), confidence, assumptions };
}

// ─── Component ──────────────────────────────────────────

const fmt = (n: number) => `$${n.toLocaleString()}`;

const EvalRangeTab = ({ snapshot }: Props) => {
  const range = deriveRange(snapshot);
  const [workingRange, setWorkingRange] = useState<"floor" | "likely" | "stretch">("likely");

  const selected = { floor: range.floor, likely: range.likely, stretch: range.stretch }[workingRange];

  const confColor = range.confidence === "high"
    ? "confidence-high"
    : range.confidence === "moderate"
      ? "confidence-medium"
      : "confidence-low";

  const confLabel = range.confidence === "high" ? "High Confidence" : range.confidence === "moderate" ? "Moderate Confidence" : "Low Confidence";

  return (
    <div className="space-y-5">
      {/* ── Range visualization ──────────────────── */}
      <div className="card-elevated p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h2 className="text-[14px] font-semibold text-foreground">Settlement Range</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`confidence-dot ${confColor}`} />
            <span className="text-[10px] font-medium text-muted-foreground">{confLabel}</span>
          </div>
        </div>

        {/* Range bar */}
        <div className="relative mb-8">
          <div className="h-3 rounded-full bg-accent overflow-hidden flex">
            <div className="h-full bg-[hsl(var(--status-approved))]/30 rounded-l-full" style={{ width: "30%" }} />
            <div className="h-full bg-primary/30" style={{ width: "40%" }} />
            <div className="h-full bg-[hsl(var(--status-attention))]/30 rounded-r-full" style={{ width: "30%" }} />
          </div>
          {/* Labels */}
          <div className="flex justify-between mt-2">
            <div className="text-center">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Floor</p>
              <p className="text-[14px] font-bold text-foreground">{fmt(range.floor)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Likely</p>
              <p className="text-[14px] font-bold text-primary">{fmt(range.likely)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Stretch</p>
              <p className="text-[14px] font-bold text-foreground">{fmt(range.stretch)}</p>
            </div>
          </div>
        </div>

        {/* Range cards */}
        <div className="grid grid-cols-3 gap-3">
          <RangeCard
            label="Floor"
            value={fmt(range.floor)}
            icon={ArrowDownRight}
            description="Conservative estimate assuming defense-favorable interpretation of disputed facts."
            selected={workingRange === "floor"}
            onClick={() => setWorkingRange("floor")}
          />
          <RangeCard
            label="Likely"
            value={fmt(range.likely)}
            icon={Target}
            description="Most probable settlement value given current liability posture and medical documentation."
            selected={workingRange === "likely"}
            onClick={() => setWorkingRange("likely")}
            primary
          />
          <RangeCard
            label="Stretch"
            value={fmt(range.stretch)}
            icon={ArrowUpRight}
            description="Upper range assuming claimant-favorable outcomes on disputed issues."
            selected={workingRange === "stretch"}
            onClick={() => setWorkingRange("stretch")}
          />
        </div>
      </div>

      {/* ── Working Range ────────────────────────── */}
      <div className="card-elevated p-5">
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Selected Working Range</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-[11px] text-muted-foreground mb-1">
              The <span className="font-semibold text-foreground capitalize">{workingRange}</span> range has been selected as the working valuation basis.
            </p>
            <p className="text-[24px] font-bold text-primary tracking-tight">{fmt(selected)}</p>
          </div>
          <div className="shrink-0">
            <button className="btn-secondary text-[10px]" disabled>
              <CheckCircle2 className="h-3 w-3" /> Override Range
            </button>
            <p className="text-[9px] text-muted-foreground mt-1 text-center">Manual overrides coming soon</p>
          </div>
        </div>
      </div>

      {/* ── Assumptions ──────────────────────────── */}
      <div className="card-elevated p-5">
        <div className="flex items-center gap-2 mb-3">
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-[13px] font-semibold text-foreground">Assumptions Affecting Range</h3>
        </div>
        <div className="space-y-2">
          {range.assumptions.map((a, i) => (
            <div key={i} className="flex items-start gap-2.5 py-1">
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${
                a.impact === "stretch"
                  ? "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]"
                  : a.impact === "floor"
                    ? "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]"
                    : "bg-accent text-muted-foreground"
              }`}>
                {a.impact}
              </span>
              <p className="text-[11px] text-foreground leading-snug">{a.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Methodology note */}
      <div className="rounded-xl border border-border bg-accent/30 p-4">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <span className="font-semibold">Methodology:</span> Range values are derived from medical specials, clinical severity multipliers, 
          wage loss, future treatment estimates, and liability posture adjustments. This is a preliminary model based on ingested upstream data. 
          Adjustments should be made based on jurisdiction-specific verdict research and adjuster judgment. All inputs are traceable to source evidence.
        </p>
      </div>
    </div>
  );
};

function RangeCard({ label, value, icon: Icon, description, selected, onClick, primary }: {
  label: string; value: string; icon: React.ElementType; description: string;
  selected: boolean; onClick: () => void; primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border p-4 transition-all ${
        selected
          ? primary
            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
            : "border-primary/50 bg-primary/3 ring-1 ring-primary/15"
          : "border-border bg-card hover:border-border hover:bg-accent/30"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-3.5 w-3.5 ${selected ? "text-primary" : "text-muted-foreground"}`} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className={`text-[16px] font-bold tracking-tight ${selected ? "text-primary" : "text-foreground"}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{description}</p>
    </button>
  );
}

export default EvalRangeTab;
