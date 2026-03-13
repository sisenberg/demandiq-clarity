/**
 * EvaluateIQ — Documentation Sufficiency Card
 *
 * Displays the overall documentation sufficiency score, all 8 subcomponent
 * scores, plain-language findings, valuation effects, and a "what is weak"
 * coaching panel.
 */

import { useMemo, useState } from "react";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import {
  computeDocumentSufficiency,
  type DocumentSufficiencyResult,
  type DocSubcomponentScore,
  type SufficiencyLabel,
  type SufficiencyImpact,
  type ValuationEffect,
} from "@/lib/documentSufficiencyEngine";
import {
  FileSearch,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  ArrowDownRight,
  Expand,
  ShieldAlert,
  Target,
} from "lucide-react";

interface Props {
  snapshot: EvaluateIntakeSnapshot;
}

const EvalDocSufficiencyCard = ({ snapshot }: Props) => {
  const [showSubs, setShowSubs] = useState(true);
  const [showEffects, setShowEffects] = useState(false);
  const [showGaps, setShowGaps] = useState(false);

  const result = useMemo(() => computeDocumentSufficiency(snapshot), [snapshot]);

  return (
    <div className="card-elevated overflow-hidden">
      {/* Header */}
      <div className="p-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileSearch className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-[13px] font-semibold text-foreground">Documentation Sufficiency</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {result.critical_weakness_count > 0
                ? `${result.critical_weakness_count} critical weakness(es) detected`
                : "All documentation areas assessed"}
            </p>
          </div>
          <ScoreBadge score={result.overall_score} label={result.overall_label} />
        </div>

        {/* Overall gauge */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
              Overall Score
            </span>
            <span className="text-sm font-bold text-foreground">{result.overall_score}/100</span>
          </div>
          <div className="relative h-2.5 rounded-full bg-accent overflow-hidden">
            <div
              className={`absolute top-0 left-0 bottom-0 rounded-full transition-all ${scoreBarColor(result.overall_label)}`}
              style={{ width: `${result.overall_score}%` }}
            />
          </div>
        </div>

        {/* Key findings */}
        {result.findings.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {result.findings.slice(0, 4).map((f, i) => (
              <div key={i} className="flex items-start gap-2">
                <FindingIcon finding={f} />
                <p className="text-[10px] text-muted-foreground leading-relaxed flex-1">{f}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subcomponents */}
      <SectionToggle
        label={`Subcomponent Scores (${result.subcomponents.length})`}
        icon={<Target className="h-3.5 w-3.5 text-muted-foreground" />}
        open={showSubs}
        onToggle={() => setShowSubs(!showSubs)}
      />
      {showSubs && (
        <div className="px-5 pb-4 border-t border-border pt-3 space-y-2">
          {result.subcomponents.map(sub => (
            <SubcomponentRow key={sub.key} sub={sub} />
          ))}
        </div>
      )}

      {/* Valuation Effects */}
      {result.valuation_effects.length > 0 && (
        <>
          <SectionToggle
            label={`Valuation Effects (${result.valuation_effects.length})`}
            icon={<AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />}
            open={showEffects}
            onToggle={() => setShowEffects(!showEffects)}
          />
          {showEffects && (
            <div className="px-5 pb-4 border-t border-border pt-3 space-y-2">
              {result.valuation_effects.map((eff, i) => (
                <EffectRow key={i} effect={eff} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Gaps Panel */}
      {result.all_gaps.length > 0 && (
        <>
          <SectionToggle
            label={`What Is Weak (${result.all_gaps.length} gap${result.all_gaps.length !== 1 ? "s" : ""})`}
            icon={<ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />}
            open={showGaps}
            onToggle={() => setShowGaps(!showGaps)}
          />
          {showGaps && (
            <div className="px-5 pb-4 border-t border-border pt-3">
              <div className="rounded-lg bg-accent/50 p-3 space-y-1.5">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Documentation Gaps — Adjuster Reference
                </p>
                {result.all_gaps.map((gap, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <XCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                    <p className="text-[10px] text-foreground leading-relaxed">{gap}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Sub-components ────────────────────────────────────

function ScoreBadge({ score, label }: { score: number; label: SufficiencyLabel }) {
  const cls = label === "strong"
    ? "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]"
    : label === "adequate"
      ? "bg-primary/10 text-primary"
      : label === "limited"
        ? "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]"
        : "bg-destructive/10 text-destructive";

  return (
    <div className={`px-2.5 py-1 rounded-lg text-center ${cls}`}>
      <div className="text-sm font-bold">{score}</div>
      <div className="text-[8px] font-semibold uppercase tracking-wider">{label}</div>
    </div>
  );
}

function SubcomponentRow({ sub }: { sub: DocSubcomponentScore }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-accent/20 transition-colors"
      >
        <SufficiencyDot label={sub.sufficiency} />
        <span className="text-[11px] font-medium text-foreground flex-1 text-left">{sub.label}</span>
        <span className="text-[10px] font-bold text-foreground">{sub.score}</span>
        <div className="w-16 h-1.5 rounded-full bg-accent overflow-hidden">
          <div
            className={`h-full rounded-full ${scoreBarColor(sub.sufficiency)}`}
            style={{ width: `${sub.score}%` }}
          />
        </div>
        {expanded
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-border pt-2 space-y-2">
          <p className="text-[10px] text-muted-foreground leading-relaxed">{sub.finding}</p>

          {sub.impact !== "none" && (
            <div className="flex items-start gap-1.5">
              <ImpactIcon impact={sub.impact} />
              <p className="text-[10px] text-foreground font-medium">{sub.impact_description}</p>
            </div>
          )}

          {sub.gaps.length > 0 && (
            <div className="space-y-1">
              {sub.gaps.map((gap, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <XCircle className="h-2.5 w-2.5 text-destructive shrink-0 mt-0.5" />
                  <span className="text-[9px] text-muted-foreground">{gap}</span>
                </div>
              ))}
            </div>
          )}

          {sub.inputs.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {sub.inputs.map((inp, i) => (
                <span key={i} className="text-[8px] bg-accent px-1.5 py-0.5 rounded text-muted-foreground">
                  {inp}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EffectRow({ effect }: { effect: ValuationEffect }) {
  const Icon = effect.effect === "widens_range" ? Expand
    : effect.effect === "suppresses_midpoint" ? ArrowDownRight
      : effect.effect === "excludes_component" ? XCircle
        : AlertTriangle;

  const color = effect.effect === "excludes_component" ? "text-destructive"
    : effect.effect === "suppresses_midpoint" ? "text-[hsl(var(--status-attention))]"
      : "text-[hsl(var(--status-review))]";

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border p-3">
      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${color}`} />
      <div className="flex-1">
        <p className="text-[11px] font-semibold text-foreground">{effect.label}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{effect.description}</p>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {effect.triggered_by.map(key => (
            <span key={key} className="text-[8px] bg-accent px-1.5 py-0.5 rounded text-muted-foreground capitalize">
              {key.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionToggle({ label, icon, open, onToggle }: {
  label: string; icon: React.ReactNode; open: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full px-5 py-3 border-t border-border flex items-center justify-between hover:bg-accent/30 transition-colors"
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[11px] font-semibold text-foreground">{label}</span>
      </div>
      {open
        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
        : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </button>
  );
}

function SufficiencyDot({ label }: { label: SufficiencyLabel }) {
  const cls = label === "strong" ? "bg-[hsl(var(--status-approved))]"
    : label === "adequate" ? "bg-primary"
      : label === "limited" ? "bg-[hsl(var(--status-attention))]"
        : "bg-destructive";
  return <span className={`h-2 w-2 rounded-full shrink-0 ${cls}`} />;
}

function FindingIcon({ finding }: { finding: string }) {
  const lower = finding.toLowerCase();
  if (lower.includes("suppressed") || lower.includes("not credited") || lower.includes("not included") || lower.includes("absent")) {
    return <AlertTriangle className="h-3 w-3 text-[hsl(var(--status-attention))] shrink-0 mt-0.5" />;
  }
  if (lower.includes("well-supported") || lower.includes("well-documented") || lower.includes("adequately")) {
    return <CheckCircle2 className="h-3 w-3 text-[hsl(var(--status-approved))] shrink-0 mt-0.5" />;
  }
  return <Info className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />;
}

function ImpactIcon({ impact }: { impact: SufficiencyImpact }) {
  if (impact === "excludes_component") return <XCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />;
  if (impact === "suppresses_midpoint") return <ArrowDownRight className="h-3 w-3 text-[hsl(var(--status-attention))] shrink-0 mt-0.5" />;
  if (impact === "widens_range") return <Expand className="h-3 w-3 text-[hsl(var(--status-review))] shrink-0 mt-0.5" />;
  return <AlertTriangle className="h-3 w-3 text-[hsl(var(--status-review))] shrink-0 mt-0.5" />;
}

function scoreBarColor(label: SufficiencyLabel): string {
  switch (label) {
    case "strong": return "bg-[hsl(var(--status-approved))]";
    case "adequate": return "bg-primary";
    case "limited": return "bg-[hsl(var(--status-attention))]";
    case "insufficient": return "bg-destructive";
  }
}

export default EvalDocSufficiencyCard;
