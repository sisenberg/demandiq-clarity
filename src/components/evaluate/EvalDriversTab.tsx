import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import {
  TrendingUp,
  TrendingDown,
  FileText,
  ExternalLink,
  Bone,
  Activity,
  Scale,
  Shield,
  DollarSign,
  Brain,
} from "lucide-react";

interface Props {
  snapshot: EvaluateIntakeSnapshot;
}

// ─── Driver definitions derived from snapshot ───────────

interface ValuationDriver {
  id: string;
  title: string;
  category: "injury" | "treatment" | "liability" | "coverage" | "documentation" | "clinical";
  direction: "expander" | "reducer" | "neutral";
  score: number; // 0–100 impact score
  explanation: string;
  evidenceRefs: string[];
  details: string[];
}

function deriveDrivers(s: EvaluateIntakeSnapshot): ValuationDriver[] {
  const drivers: ValuationDriver[] = [];
  let seq = 0;

  // Injury severity
  const severeCount = s.injuries.filter((i) => i.severity.toLowerCase() === "severe" && !i.is_pre_existing).length;
  const modCount = s.injuries.filter((i) => i.severity.toLowerCase() === "moderate" && !i.is_pre_existing).length;
  if (severeCount > 0 || modCount > 0) {
    drivers.push({
      id: `drv-${++seq}`,
      title: "Injury Severity Profile",
      category: "injury",
      direction: severeCount > 0 ? "expander" : "neutral",
      score: Math.min(95, 40 + severeCount * 20 + modCount * 10),
      explanation: `${severeCount} severe and ${modCount} moderate injuries documented. ${severeCount > 0 ? "Severe injuries significantly expand the valuation range." : "Moderate injuries support mid-range valuation."}`,
      evidenceRefs: s.injuries.flatMap((i) => i.provenance.evidence_ref_ids),
      details: s.injuries.filter((i) => !i.is_pre_existing).map((i) => `${i.body_part}: ${i.diagnosis_description} (${i.severity})`),
    });
  }

  // Pre-existing conditions
  const preExisting = s.injuries.filter((i) => i.is_pre_existing);
  if (preExisting.length > 0) {
    drivers.push({
      id: `drv-${++seq}`,
      title: "Pre-existing Conditions",
      category: "injury",
      direction: "reducer",
      score: Math.min(80, 25 + preExisting.length * 15),
      explanation: `${preExisting.length} pre-existing condition(s) identified. Defense may argue reduced causation attribution.`,
      evidenceRefs: preExisting.flatMap((i) => i.provenance.evidence_ref_ids),
      details: preExisting.map((i) => `${i.body_part}: ${i.diagnosis_description}`),
    });
  }

  // Treatment volume
  if (s.treatment_timeline.length > 0) {
    const typeMap = new Map<string, number>();
    s.treatment_timeline.forEach((t) => typeMap.set(t.treatment_type, (typeMap.get(t.treatment_type) ?? 0) + 1));
    drivers.push({
      id: `drv-${++seq}`,
      title: "Treatment Volume & Duration",
      category: "treatment",
      direction: s.treatment_timeline.length > 15 ? "expander" : "neutral",
      score: Math.min(85, 30 + s.treatment_timeline.length * 3),
      explanation: `${s.treatment_timeline.length} treatment sessions across ${typeMap.size} modalities. ${s.treatment_timeline.length > 15 ? "Extended treatment course supports higher damages." : "Treatment course within moderate range."}`,
      evidenceRefs: s.treatment_timeline.slice(0, 5).flatMap((t) => t.provenance.evidence_ref_ids),
      details: Array.from(typeMap.entries()).map(([type, count]) => `${type}: ${count} sessions`),
    });
  }

  // Surgery flag
  if (s.clinical_flags.has_surgery) {
    drivers.push({
      id: `drv-${++seq}`,
      title: "Surgical Intervention",
      category: "clinical",
      direction: "expander",
      score: 85,
      explanation: "One or more surgical procedures documented. Surgical cases command significantly higher valuations due to pain, recovery time, and future care implications.",
      evidenceRefs: s.clinical_flags.provenance.evidence_ref_ids,
      details: s.treatment_timeline.filter((t) => t.treatment_type.toLowerCase().includes("surg")).map((t) => t.description),
    });
  }

  // Liability strength
  const supporting = s.liability_facts.filter((f) => f.supports_liability).length;
  const adverse = s.liability_facts.filter((f) => !f.supports_liability).length;
  if (s.liability_facts.length > 0) {
    drivers.push({
      id: `drv-${++seq}`,
      title: "Liability Strength",
      category: "liability",
      direction: supporting > adverse ? "expander" : adverse > supporting ? "reducer" : "neutral",
      score: Math.min(90, Math.abs(supporting - adverse) * 15 + 40),
      explanation: `${supporting} supporting vs ${adverse} adverse liability facts. ${supporting > adverse ? "Net positive liability posture favors claimant." : adverse > supporting ? "Adverse facts weaken liability position." : "Balanced liability posture."}`,
      evidenceRefs: s.liability_facts.flatMap((f) => f.provenance.evidence_ref_ids),
      details: s.liability_facts.map((f) => `${f.supports_liability ? "✓" : "✗"} ${f.fact_text}`),
    });
  }

  // Policy limits
  const maxLimit = s.policy_coverage.reduce((m, p) => Math.max(m, p.coverage_limit ?? 0), 0);
  if (maxLimit > 0) {
    drivers.push({
      id: `drv-${++seq}`,
      title: "Policy Limits",
      category: "coverage",
      direction: "neutral",
      score: 50,
      explanation: `Maximum available coverage of $${maxLimit.toLocaleString()}. ${maxLimit < 100000 ? "Low policy limits may cap practical recovery." : "Adequate policy limits available for settlement range."}`,
      evidenceRefs: [],
      details: s.policy_coverage.map((p) => `${p.carrier_name}: ${p.policy_type} — $${(p.coverage_limit ?? 0).toLocaleString()}`),
    });
  }

  // Upstream concerns
  const criticalConcerns = s.upstream_concerns.filter((c) => c.severity === "critical");
  if (criticalConcerns.length > 0) {
    drivers.push({
      id: `drv-${++seq}`,
      title: "Critical Upstream Concerns",
      category: "documentation",
      direction: "reducer",
      score: Math.min(80, 30 + criticalConcerns.length * 20),
      explanation: `${criticalConcerns.length} critical concern(s) surfaced from upstream review. These may materially impact defensibility.`,
      evidenceRefs: [],
      details: criticalConcerns.map((c) => `[${c.category}] ${c.description}`),
    });
  }

  return drivers.sort((a, b) => b.score - a.score);
}

// ─── Component ──────────────────────────────────────────

const categoryIcon: Record<string, React.ElementType> = {
  injury: Bone,
  treatment: Activity,
  liability: Scale,
  coverage: Shield,
  documentation: FileText,
  clinical: Brain,
};

const EvalDriversTab = ({ snapshot }: Props) => {
  const drivers = deriveDrivers(snapshot);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-semibold text-foreground">Valuation Drivers</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Factors derived from upstream data that influence the valuation range. Each driver is traceable to source evidence.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-[hsl(var(--status-attention))]" /> Expanders
          </span>
          <span className="flex items-center gap-1.5">
            <TrendingDown className="h-3 w-3 text-[hsl(var(--status-approved))]" /> Reducers
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {drivers.map((driver) => (
          <DriverCard key={driver.id} driver={driver} />
        ))}
      </div>
    </div>
  );
};

function DriverCard({ driver }: { driver: ValuationDriver }) {
  const Icon = categoryIcon[driver.category] ?? FileText;
  const dirColor = driver.direction === "expander"
    ? "border-l-[hsl(var(--status-attention))]"
    : driver.direction === "reducer"
      ? "border-l-[hsl(var(--status-approved))]"
      : "border-l-muted-foreground/30";

  const DirIcon = driver.direction === "expander" ? TrendingUp : driver.direction === "reducer" ? TrendingDown : Scale;

  return (
    <div className={`card-elevated border-l-[3px] ${dirColor} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-[12px] font-semibold text-foreground">{driver.title}</h4>
              <DirIcon className={`h-3.5 w-3.5 ${
                driver.direction === "expander" ? "text-[hsl(var(--status-attention))]" : driver.direction === "reducer" ? "text-[hsl(var(--status-approved))]" : "text-muted-foreground"
              }`} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{driver.explanation}</p>
          </div>
        </div>

        {/* Impact score */}
        <div className="shrink-0 text-center">
          <div className={`text-[18px] font-bold tracking-tight ${
            driver.score >= 70 ? "text-foreground" : "text-muted-foreground"
          }`}>
            {driver.score}
          </div>
          <p className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">Impact</p>
        </div>
      </div>

      {/* Details */}
      {driver.details.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <ul className="space-y-1">
            {driver.details.slice(0, 5).map((d, i) => (
              <li key={i} className="text-[10px] text-foreground/80 leading-snug pl-3 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:h-1 before:w-1 before:rounded-full before:bg-muted-foreground/30">
                {d}
              </li>
            ))}
            {driver.details.length > 5 && (
              <li className="text-[10px] text-muted-foreground pl-3">+{driver.details.length - 5} more</li>
            )}
          </ul>
        </div>
      )}

      {/* Evidence refs */}
      {driver.evidenceRefs.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5">
          <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground">
            {driver.evidenceRefs.length} evidence reference{driver.evidenceRefs.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}

export default EvalDriversTab;
