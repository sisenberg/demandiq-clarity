/**
 * EvaluateIQ — Modifier Panel
 *
 * Displays all defensibility and settlement posture modifiers
 * with their evidence, source, direction, and override controls.
 *
 * Shows:
 *  - Group headers with net effect
 *  - Individual modifier cards with evidence/explanation
 *  - Confidence degradation warnings
 *  - Supervisor override dialog
 *  - Representation status badge (reporting-ready)
 */

import { useState, useMemo, useCallback } from "react";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import type {
  ModifierRecord,
  ModifierGroup,
  ModifierDirection,
  ModifierGroupSummary,
  ModifierLayerResult,
  ModifierOverride,
  ConfidenceDegradation,
  RepresentationContext,
  ModifierConfidence,
} from "@/types/modifier-layer";
import {
  computeModifierLayer,
  MODIFIER_DEFINITIONS,
} from "@/lib/modifierLayerEngine";
import { useAuth } from "@/contexts/AuthContext";
import {
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  HelpCircle,
  Edit3,
  X,
  Check,
  FileText,
  Eye,
  Lock,
  Scale,
  Gavel,
  MapPin,
  User,
} from "lucide-react";

interface Props {
  snapshot: EvaluateIntakeSnapshot;
}

const GROUP_ICONS: Record<ModifierGroup, typeof Scale> = {
  liability: Scale,
  causation: Gavel,
  claim_posture: User,
  venue_forum: MapPin,
};

const EvalModifierPanel = ({ snapshot }: Props) => {
  const { user } = useAuth();
  const [overrides, setOverrides] = useState<ModifierOverride[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<ModifierGroup | null>(null);
  const [showDegradations, setShowDegradations] = useState(false);

  const result = useMemo(
    () => computeModifierLayer(snapshot, overrides),
    [snapshot, overrides],
  );

  const handleOverride = useCallback(
    (modId: string, value: string, direction: ModifierDirection, magnitude: number, reason: string) => {
      const mod = result.modifiers.find(m => m.id === modId);
      if (!mod) return;
      setOverrides(prev => {
        const existing = prev.filter(o => o.modifier_id !== modId);
        return [
          ...existing,
          {
            modifier_id: modId,
            original_value: mod.current_value,
            original_direction: mod.direction,
            original_magnitude: mod.effect_magnitude,
            override_value: value,
            override_direction: direction,
            override_magnitude: magnitude,
            override_reason: reason,
            overridden_by: user?.id ?? "unknown",
            overridden_by_name: user?.email ?? "Unknown",
            overridden_at: new Date().toISOString(),
          },
        ];
      });
    },
    [result.modifiers, user],
  );

  const removeOverride = useCallback((modId: string) => {
    setOverrides(prev => prev.filter(o => o.modifier_id !== modId));
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            Modifier Layer
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {result.applied_modifiers.length} applied · Net: <DirectionBadge direction={result.net_direction} magnitude={result.net_effect.mid_delta} />
            {result.overrides.length > 0 && (
              <span className="ml-1.5 text-[hsl(var(--status-attention))]">
                · {result.overrides.length} override(s)
              </span>
            )}
          </p>
        </div>
        <RepresentationBadge rep={result.representation} />
      </div>

      {/* Net effect summary */}
      <NetEffectBar result={result} />

      {/* Confidence degradations */}
      {result.confidence_degradations.length > 0 && (
        <button
          onClick={() => setShowDegradations(!showDegradations)}
          className="w-full rounded-lg border border-[hsl(var(--status-attention))]/20 bg-[hsl(var(--status-attention))]/5 px-3 py-2 flex items-center justify-between hover:bg-[hsl(var(--status-attention))]/10 transition-colors"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--status-attention))]" />
            <span className="text-[10px] font-semibold text-[hsl(var(--status-attention))]">
              {result.confidence_degradations.length} missing field(s) degrade confidence by {result.total_confidence_penalty} pts
            </span>
          </div>
          {showDegradations ? <ChevronDown className="h-3.5 w-3.5 text-[hsl(var(--status-attention))]" /> : <ChevronRight className="h-3.5 w-3.5 text-[hsl(var(--status-attention))]" />}
        </button>
      )}
      {showDegradations && result.confidence_degradations.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
          {result.confidence_degradations.map(d => (
            <DegradationRow key={d.modifier_id} degradation={d} />
          ))}
        </div>
      )}

      {/* Group cards */}
      <div className="space-y-2">
        {result.group_summaries.map(gs => (
          <GroupCard
            key={gs.group}
            summary={gs}
            modifiers={result.modifiers.filter(m => m.group === gs.group)}
            expanded={expandedGroup === gs.group}
            onToggle={() => setExpandedGroup(expandedGroup === gs.group ? null : gs.group)}
            overrides={overrides}
            onOverride={handleOverride}
            onRemoveOverride={removeOverride}
          />
        ))}
      </div>

      {/* Audit summary */}
      <p className="text-[9px] text-muted-foreground italic leading-relaxed px-1">
        {result.audit_summary}
      </p>
    </div>
  );
};

// ─── Net Effect Bar ────────────────────────────────────

function NetEffectBar({ result }: { result: ModifierLayerResult }) {
  const { net_effect } = result;
  const maxAbs = Math.max(Math.abs(net_effect.low_delta), Math.abs(net_effect.mid_delta), Math.abs(net_effect.high_delta), 1);
  const center = 50;

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Net Corridor Effect</p>
      <div className="flex items-center gap-3">
        {(["low_delta", "mid_delta", "high_delta"] as const).map(band => {
          const val = net_effect[band];
          const label = band.replace("_delta", "").charAt(0).toUpperCase() + band.replace("_delta", "").slice(1);
          const width = Math.abs(val) / maxAbs * 40;
          const isNeg = val < 0;

          return (
            <div key={band} className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-muted-foreground">{label}</span>
                <span className={`text-[10px] font-semibold ${isNeg ? "text-destructive" : val > 0 ? "text-[hsl(var(--status-approved))]" : "text-muted-foreground"}`}>
                  {fmtDelta(val)}
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-accent overflow-hidden">
                <div className="absolute top-0 bottom-0 w-px bg-muted-foreground/30" style={{ left: `${center}%` }} />
                {val !== 0 && (
                  <div
                    className={`absolute top-0 bottom-0 rounded-full ${isNeg ? "bg-destructive/60" : "bg-[hsl(var(--status-approved))]/60"}`}
                    style={{
                      left: isNeg ? `${center - width}%` : `${center}%`,
                      width: `${width}%`,
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Group Card ────────────────────────────────────────

function GroupCard({
  summary,
  modifiers,
  expanded,
  onToggle,
  overrides,
  onOverride,
  onRemoveOverride,
}: {
  summary: ModifierGroupSummary;
  modifiers: ModifierRecord[];
  expanded: boolean;
  onToggle: () => void;
  overrides: ModifierOverride[];
  onOverride: (id: string, value: string, dir: ModifierDirection, mag: number, reason: string) => void;
  onRemoveOverride: (id: string) => void;
}) {
  const Icon = GROUP_ICONS[summary.group];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button onClick={onToggle} className="w-full p-4 text-left hover:bg-accent/30 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[12px] font-semibold text-foreground">{summary.label}</h3>
              <p className="text-[10px] text-muted-foreground">
                {summary.applied_count}/{summary.modifier_count} applied
                {summary.has_overrides && <span className="text-[hsl(var(--status-attention))] ml-1">· overridden</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <DirectionBadge direction={summary.net_direction} magnitude={summary.net_effect} />
            <ConfidenceDot confidence={summary.confidence} />
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {modifiers.map(m => (
            <ModifierRow
              key={m.id}
              modifier={m}
              override={overrides.find(o => o.modifier_id === m.id)}
              onOverride={onOverride}
              onRemoveOverride={onRemoveOverride}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modifier Row ──────────────────────────────────────

function ModifierRow({
  modifier,
  override,
  onOverride,
  onRemoveOverride,
}: {
  modifier: ModifierRecord;
  override?: ModifierOverride;
  onOverride: (id: string, value: string, dir: ModifierDirection, mag: number, reason: string) => void;
  onRemoveOverride: (id: string) => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideMagnitude, setOverrideMagnitude] = useState(modifier.effect_magnitude);
  const [overrideDirection, setOverrideDirection] = useState<ModifierDirection>(modifier.direction);

  const DirIcon = directionIcon(modifier.direction);
  const dirColor = directionColor(modifier.direction);
  const isOverridden = modifier.source === "supervisor_override";

  const submitOverride = () => {
    if (!overrideReason.trim()) return;
    onOverride(modifier.id, modifier.current_value, overrideDirection, overrideMagnitude, overrideReason);
    setShowOverrideForm(false);
    setOverrideReason("");
  };

  return (
    <div className={`bg-card ${!modifier.applied ? "opacity-60" : ""}`}>
      <button
        onClick={() => setShowDetail(!showDetail)}
        className="w-full px-4 py-3 text-left hover:bg-accent/20 transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <DirIcon className={`h-3.5 w-3.5 shrink-0 ${dirColor}`} />
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-foreground">{modifier.label}</span>
              {!modifier.applied && (
                <span className="text-[9px] text-muted-foreground ml-2 italic">skipped</span>
              )}
              {isOverridden && (
                <span className="text-[9px] text-[hsl(var(--status-attention))] ml-2 font-semibold">overridden</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-[10px] font-medium text-foreground bg-accent px-2 py-0.5 rounded-md">
              {modifier.current_value}
            </span>
            {modifier.applied && modifier.effect_magnitude !== 0 && (
              <span className={`text-[10px] font-semibold ${modifier.effect_magnitude > 0 ? "text-[hsl(var(--status-approved))]" : "text-destructive"}`}>
                {fmtDelta(modifier.effect_magnitude)}
              </span>
            )}
            <SourceBadge source={modifier.source} />
            <ConfidenceDot confidence={modifier.confidence} />
          </div>
        </div>
      </button>

      {showDetail && (
        <div className="px-4 pb-3 space-y-2.5 bg-muted/20">
          {/* Explanation */}
          <p className="text-[10px] text-foreground leading-relaxed">{modifier.explanation}</p>

          {/* Evidence */}
          <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
            <FileText className="h-3 w-3" />
            <span>Evidence: {modifier.evidence_summary}</span>
            {modifier.evidence_refs.length > 0 && (
              <span className="text-primary">({modifier.evidence_refs.length} ref{modifier.evidence_refs.length !== 1 ? "s" : ""})</span>
            )}
          </div>

          {/* Skip reason */}
          {modifier.skip_reason && (
            <p className="text-[9px] text-muted-foreground italic">Skipped: {modifier.skip_reason}</p>
          )}

          {/* Override info */}
          {override && (
            <div className="rounded-md border border-[hsl(var(--status-attention))]/20 bg-[hsl(var(--status-attention))]/5 p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-semibold text-[hsl(var(--status-attention))]">Supervisor Override</span>
                <button onClick={() => onRemoveOverride(modifier.id)} className="text-[9px] text-destructive hover:underline">Remove</button>
              </div>
              <p className="text-[9px] text-muted-foreground">
                Original: {override.original_value} ({fmtDelta(override.original_magnitude)}) →
                Override: {override.override_value} ({fmtDelta(override.override_magnitude)})
              </p>
              <p className="text-[9px] text-foreground/70">Reason: {override.override_reason}</p>
              <p className="text-[8px] text-muted-foreground">{override.overridden_by_name} · {new Date(override.overridden_at).toLocaleDateString()}</p>
            </div>
          )}

          {/* Override controls */}
          {!showOverrideForm && modifier.applied && !override && (
            <button
              onClick={() => setShowOverrideForm(true)}
              className="flex items-center gap-1.5 text-[9px] text-primary hover:underline"
            >
              <Edit3 className="h-3 w-3" /> Override severity
            </button>
          )}

          {showOverrideForm && (
            <div className="rounded-md border border-border bg-card p-3 space-y-2">
              <p className="text-[10px] font-semibold text-foreground">Override Modifier Severity</p>
              <div className="flex items-center gap-2">
                <label className="text-[9px] text-muted-foreground">Direction:</label>
                <select
                  value={overrideDirection}
                  onChange={e => setOverrideDirection(e.target.value as ModifierDirection)}
                  className="text-[10px] bg-accent border border-border rounded px-2 py-1"
                >
                  <option value="positive">Positive</option>
                  <option value="negative">Negative</option>
                  <option value="neutral">Neutral</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[9px] text-muted-foreground">Magnitude:</label>
                <input
                  type="number"
                  value={overrideMagnitude}
                  onChange={e => setOverrideMagnitude(Number(e.target.value))}
                  min={-30}
                  max={30}
                  className="text-[10px] bg-accent border border-border rounded px-2 py-1 w-20"
                />
              </div>
              <div>
                <label className="text-[9px] text-muted-foreground">Reason (required):</label>
                <textarea
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  placeholder="Explain why this override is appropriate..."
                  className="w-full text-[10px] bg-accent border border-border rounded px-2 py-1.5 mt-1 resize-none h-14"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={submitOverride}
                  disabled={!overrideReason.trim()}
                  className="flex items-center gap-1 text-[9px] font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-md disabled:opacity-50"
                >
                  <Check className="h-3 w-3" /> Apply Override
                </button>
                <button
                  onClick={() => setShowOverrideForm(false)}
                  className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground px-2 py-1.5"
                >
                  <X className="h-3 w-3" /> Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────

function RepresentationBadge({ rep }: { rep: RepresentationContext }) {
  const cls =
    rep.status === "represented"
      ? "bg-primary/10 text-primary"
      : rep.status === "unrepresented"
        ? "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]"
        : "bg-muted text-muted-foreground";
  const Icon = rep.status === "represented" ? UserCheck : rep.status === "unrepresented" ? UserX : HelpCircle;

  return (
    <div className={`flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-md ${cls}`}>
      <Icon className="h-3 w-3" />
      {rep.status === "represented" ? "Represented" : rep.status === "unrepresented" ? "Unrepresented" : "Unknown"}
      {rep.transitioned && <span className="text-[8px] opacity-70">(transitioned)</span>}
    </div>
  );
}

function DirectionBadge({ direction, magnitude }: { direction: ModifierDirection; magnitude: number }) {
  const cls =
    direction === "positive"
      ? "text-[hsl(var(--status-approved))]"
      : direction === "negative"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <span className={`text-[10px] font-semibold ${cls}`}>
      {fmtDelta(magnitude)}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  if (source === "system_derived") return null;
  const cls =
    source === "supervisor_override"
      ? "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]"
      : "bg-primary/10 text-primary";
  const label = source === "supervisor_override" ? "Override" : "Manual";
  return (
    <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded ${cls}`}>{label}</span>
  );
}

function ConfidenceDot({ confidence }: { confidence: ModifierConfidence }) {
  const cls =
    confidence === "high"
      ? "bg-[hsl(var(--status-approved))]"
      : confidence === "moderate"
        ? "bg-[hsl(var(--status-attention))]"
        : confidence === "low"
          ? "bg-muted-foreground/30"
          : "bg-destructive";
  return <div className={`h-2 w-2 rounded-full shrink-0 ${cls}`} title={`${confidence} confidence`} />;
}

function DegradationRow({ degradation }: { degradation: ConfidenceDegradation }) {
  return (
    <div className="flex items-center gap-2 text-[9px]">
      <AlertTriangle className="h-3 w-3 text-[hsl(var(--status-attention))] shrink-0" />
      <span className="text-foreground font-medium">{degradation.label}</span>
      <span className="text-destructive font-semibold">-{degradation.penalty} pts</span>
      <span className="text-muted-foreground">{degradation.impact_description}</span>
    </div>
  );
}

function directionIcon(dir: ModifierDirection) {
  switch (dir) {
    case "positive": return TrendingUp;
    case "negative": return TrendingDown;
    default: return Minus;
  }
}

function directionColor(dir: ModifierDirection) {
  switch (dir) {
    case "positive": return "text-[hsl(var(--status-approved))]";
    case "negative": return "text-destructive";
    default: return "text-muted-foreground";
  }
}

function fmtDelta(d: number): string {
  if (d === 0) return "±0";
  return d > 0 ? `+${d}` : `${d}`;
}

export default EvalModifierPanel;
