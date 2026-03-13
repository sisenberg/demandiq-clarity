/**
 * NegotiateIQ — Strategy Card UI
 *
 * Displays the generated strategy with override + reason capture
 * for overridable fields.
 */

import { useState, useCallback } from "react";
import type { GeneratedStrategy, StrategyOverride, OverridableField, ConcessionPosture, RepresentationPosture } from "@/types/negotiate-strategy";
import {
  Target,
  Shield,
  DollarSign,
  ArrowDownUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  X,
  Save,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface NegotiateStrategyCardProps {
  strategy: GeneratedStrategy;
  overrides: StrategyOverride[];
  onOverride: (override: StrategyOverride) => void;
  onSave: () => void;
  isSaving: boolean;
  strategyVersion: number | null;
}

const POSTURE_LABELS: Record<ConcessionPosture, { label: string; color: string }> = {
  conservative: { label: "Conservative", color: "text-[hsl(var(--status-approved))]" },
  standard: { label: "Standard", color: "text-primary" },
  flexible: { label: "Flexible", color: "text-[hsl(var(--status-attention))]" },
};

const REP_POSTURE_LABELS: Record<RepresentationPosture, string> = {
  direct_resolution_unrepresented: "Direct Resolution",
  early_resolution_unrepresented: "Early Resolution",
  documentation_guided_unrepresented: "Documentation-Guided",
  counsel_retention_risk: "Retention Risk",
  represented_balanced: "Balanced",
  represented_defensive: "Defensive",
  post_retention_strategy_reset: "Post-Retention Reset",
  litigation_prep: "Litigation Prep",
};

const NegotiateStrategyCard = ({
  strategy,
  overrides,
  onOverride,
  onSave,
  isSaving,
  strategyVersion,
}: NegotiateStrategyCardProps) => {
  const [expandedRationale, setExpandedRationale] = useState(false);

  const getEffective = <T,>(field: OverridableField, generated: T): T => {
    const ov = overrides.find((o) => o.field === field);
    return ov ? (ov.overrideValue as T) : generated;
  };

  const hasOverride = (field: OverridableField) => overrides.some((o) => o.field === field);
  const postureInfo = POSTURE_LABELS[getEffective("concessionPosture", strategy.concessionPosture.generated)];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-[hsl(var(--status-attention))]" />
          <h2 className="text-[13px] font-semibold text-foreground">Negotiation Strategy</h2>
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-accent text-muted-foreground">
            Engine v{strategy.engineVersion}
          </span>
          {strategyVersion != null && (
            <span className="text-[9px] font-medium text-muted-foreground">· Saved v{strategyVersion}</span>
          )}
        </div>
        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Save className="h-3 w-3" />
          {isSaving ? "Saving…" : "Save Strategy"}
        </button>
      </div>

      {/* Concession Posture */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-foreground">Concession Posture</span>
          </div>
          <OverridableBadge
            field="concessionPosture"
            hasOverride={hasOverride("concessionPosture")}
          />
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[14px] font-bold ${postureInfo.color}`}>{postureInfo.label}</span>
          <span className="text-[10px] text-muted-foreground flex-1">{strategy.concessionPosture.reason}</span>
        </div>
        <PostureOverrideRow
          field="concessionPosture"
          currentOverride={overrides.find((o) => o.field === "concessionPosture")}
          generated={strategy.concessionPosture.generated}
          onOverride={onOverride}
        />
      </div>

      {/* Representation Posture */}
      {strategy.representationPosture && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-foreground">Representation Posture</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-bold text-foreground">
              {REP_POSTURE_LABELS[strategy.representationPosture.generated] ?? strategy.representationPosture.generated}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">{strategy.representationPosture.reason}</p>
        </div>
      )}

      {/* Position Grid */}
      <div className="grid grid-cols-2 gap-3">
        <PositionCard
          field="openingOffer"
          icon={Target}
          label="Opening Offer"
          value={strategy.openingOffer.generated}
          reason={strategy.openingOffer.reason}
          overrides={overrides}
          onOverride={onOverride}
        />
        <PositionCard
          field="authorityCeiling"
          icon={Shield}
          label="Authority Ceiling"
          value={strategy.authorityCeiling.generated}
          reason={strategy.authorityCeiling.reason}
          overrides={overrides}
          onOverride={onOverride}
        />
        <TargetZoneCard
          strategy={strategy}
          overrides={overrides}
          onOverride={onOverride}
        />
        <PositionCard
          field="walkAwayThreshold"
          icon={TrendingDown}
          label="Walk-Away Threshold"
          value={strategy.walkAwayThreshold.generated}
          reason={strategy.walkAwayThreshold.reason}
          overrides={overrides}
          onOverride={onOverride}
        />
      </div>

      {/* Movement Plan */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold text-foreground">Movement Plan</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <MovementStep label="First Move" rec={strategy.movementPlan.firstMove} />
          <MovementStep label="Mid-Round" rec={strategy.movementPlan.midRoundMove} />
          <MovementStep label="Endgame" rec={strategy.movementPlan.endgameMove} />
        </div>
      </div>

      {/* Tactical Recommendations */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold text-foreground">Tactical Recommendations</span>
        </div>
        <div className="space-y-2">
          {strategy.tacticalRecommendations.map((t) => (
            <div key={t.type} className="flex items-start gap-2">
              {t.recommended ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--status-approved))] mt-0.5 shrink-0" />
              ) : (
                <X className="h-3.5 w-3.5 text-muted-foreground/40 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0">
                <span className="text-[11px] font-medium text-foreground capitalize">{t.type.replace(/_/g, " ")}</span>
                <span className={`ml-1.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  t.recommended ? "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]" : "bg-accent text-muted-foreground"
                }`}>
                  {t.recommended ? "Recommended" : "Not Recommended"}
                </span>
                <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{t.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rationale Summary */}
      <div className="rounded-xl border border-border bg-card p-4">
        <button
          onClick={() => setExpandedRationale(!expandedRationale)}
          className="flex items-center gap-2 w-full text-left"
        >
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold text-foreground flex-1">Rationale Summary</span>
          {expandedRationale ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
        </button>
        {expandedRationale && (
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-2">{strategy.rationaleSummary}</p>
        )}
      </div>
    </div>
  );
};

// ─── Position Card with Override ─────────────────────────

function PositionCard({
  field,
  icon: Icon,
  label,
  value,
  reason,
  overrides,
  onOverride,
}: {
  field: OverridableField;
  icon: React.ElementType;
  label: string;
  value: number;
  reason: string;
  overrides: StrategyOverride[];
  onOverride: (o: StrategyOverride) => void;
}) {
  const existing = overrides.find((o) => o.field === field);
  const effective = existing ? (existing.overrideValue as number) : value;
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [editReason, setEditReason] = useState("");

  const startEdit = () => {
    setEditValue(String(effective));
    setEditReason(existing?.reason ?? "");
    setEditing(true);
  };

  const confirmEdit = () => {
    const parsed = parseInt(editValue, 10);
    if (isNaN(parsed) || parsed < 0 || !editReason.trim()) return;
    onOverride({
      field,
      originalValue: value,
      overrideValue: parsed,
      reason: editReason.trim(),
      overriddenBy: null,
      overriddenAt: new Date().toISOString(),
    });
    setEditing(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        <OverridableBadge field={field} hasOverride={!!existing} />
      </div>

      {!editing ? (
        <>
          <p className="text-[16px] font-bold text-foreground">{fmtCurrency(effective)}</p>
          {existing && (
            <p className="text-[9px] text-muted-foreground line-through">{fmtCurrency(value)}</p>
          )}
          <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">{existing?.reason ?? reason}</p>
          <button
            onClick={startEdit}
            className="flex items-center gap-1 mt-2 text-[9px] font-medium text-primary hover:underline"
          >
            <Edit3 className="h-2.5 w-2.5" />
            Override
          </button>
        </>
      ) : (
        <OverrideForm
          editValue={editValue}
          setEditValue={setEditValue}
          editReason={editReason}
          setEditReason={setEditReason}
          onConfirm={confirmEdit}
          onCancel={() => setEditing(false)}
          type="currency"
        />
      )}
    </div>
  );
}

// ─── Target Zone Card ───────────────────────────────────

function TargetZoneCard({
  strategy,
  overrides,
  onOverride,
}: {
  strategy: GeneratedStrategy;
  overrides: StrategyOverride[];
  onOverride: (o: StrategyOverride) => void;
}) {
  const field: OverridableField = "targetSettlementZone";
  const existing = overrides.find((o) => o.field === field);
  const generated = strategy.targetSettlementZone.generated;
  const effective = existing ? (existing.overrideValue as { low: number; high: number }) : generated;
  const [editing, setEditing] = useState(false);
  const [editLow, setEditLow] = useState("");
  const [editHigh, setEditHigh] = useState("");
  const [editReason, setEditReason] = useState("");

  const startEdit = () => {
    setEditLow(String(effective.low));
    setEditHigh(String(effective.high));
    setEditReason(existing?.reason ?? "");
    setEditing(true);
  };

  const confirmEdit = () => {
    const low = parseInt(editLow, 10);
    const high = parseInt(editHigh, 10);
    if (isNaN(low) || isNaN(high) || low < 0 || high < low || !editReason.trim()) return;
    onOverride({
      field,
      originalValue: generated,
      overrideValue: { low, high },
      reason: editReason.trim(),
      overriddenBy: null,
      overriddenAt: new Date().toISOString(),
    });
    setEditing(false);
  };

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <DollarSign className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Target Zone</span>
        </div>
        <OverridableBadge field={field} hasOverride={!!existing} />
      </div>

      {!editing ? (
        <>
          <p className="text-[14px] font-bold text-foreground">
            {fmtCurrency(effective.low)} — {fmtCurrency(effective.high)}
          </p>
          {existing && (
            <p className="text-[9px] text-muted-foreground line-through">
              {fmtCurrency(generated.low)} — {fmtCurrency(generated.high)}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
            {existing?.reason ?? strategy.targetSettlementZone.reason}
          </p>
          <button
            onClick={startEdit}
            className="flex items-center gap-1 mt-2 text-[9px] font-medium text-primary hover:underline"
          >
            <Edit3 className="h-2.5 w-2.5" />
            Override
          </button>
        </>
      ) : (
        <div className="space-y-2 mt-2">
          <div className="flex gap-2">
            <input
              type="number"
              value={editLow}
              onChange={(e) => setEditLow(e.target.value)}
              className="flex-1 text-[11px] px-2 py-1.5 rounded-md border border-border bg-background text-foreground"
              placeholder="Low"
            />
            <input
              type="number"
              value={editHigh}
              onChange={(e) => setEditHigh(e.target.value)}
              className="flex-1 text-[11px] px-2 py-1.5 rounded-md border border-border bg-background text-foreground"
              placeholder="High"
            />
          </div>
          <textarea
            value={editReason}
            onChange={(e) => setEditReason(e.target.value)}
            className="w-full text-[11px] px-2 py-1.5 rounded-md border border-border bg-background text-foreground resize-none"
            rows={2}
            placeholder="Reason for override (required)"
          />
          <div className="flex gap-2">
            <button onClick={confirmEdit} className="text-[10px] font-semibold px-3 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
              Apply
            </button>
            <button onClick={() => setEditing(false)} className="text-[10px] font-medium px-3 py-1 rounded-md border border-border text-muted-foreground hover:bg-accent">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Posture Override Row ───────────────────────────────

function PostureOverrideRow({
  field,
  currentOverride,
  generated,
  onOverride,
}: {
  field: OverridableField;
  currentOverride: StrategyOverride | undefined;
  generated: ConcessionPosture;
  onOverride: (o: StrategyOverride) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<ConcessionPosture>(
    currentOverride ? (currentOverride.overrideValue as ConcessionPosture) : generated
  );
  const [reason, setReason] = useState(currentOverride?.reason ?? "");

  const confirm = () => {
    if (!reason.trim() || selected === generated) return;
    onOverride({
      field,
      originalValue: generated,
      overrideValue: selected,
      reason: reason.trim(),
      overriddenBy: null,
      overriddenAt: new Date().toISOString(),
    });
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 mt-2 text-[9px] font-medium text-primary hover:underline"
      >
        <Edit3 className="h-2.5 w-2.5" />
        Override Posture
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2 p-3 rounded-lg bg-accent/30 border border-border">
      <div className="flex gap-2">
        {(["conservative", "standard", "flexible"] as ConcessionPosture[]).map((p) => (
          <button
            key={p}
            onClick={() => setSelected(p)}
            className={`text-[10px] font-semibold px-3 py-1.5 rounded-md border transition-colors capitalize ${
              selected === p
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full text-[11px] px-2 py-1.5 rounded-md border border-border bg-background text-foreground resize-none"
        rows={2}
        placeholder="Reason for posture change (required)"
      />
      <div className="flex gap-2">
        <button onClick={confirm} disabled={!reason.trim() || selected === generated} className="text-[10px] font-semibold px-3 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          Apply
        </button>
        <button onClick={() => setEditing(false)} className="text-[10px] font-medium px-3 py-1 rounded-md border border-border text-muted-foreground hover:bg-accent">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Shared Sub-components ──────────────────────────────

function OverridableBadge({ field, hasOverride }: { field: string; hasOverride: boolean }) {
  return hasOverride ? (
    <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]">
      Overridden
    </span>
  ) : (
    <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
      Generated
    </span>
  );
}

function MovementStep({ label, rec }: { label: string; rec: { generated: number; reason: string } }) {
  return (
    <div className="rounded-lg border border-border bg-accent/30 px-3 py-2.5 text-center">
      <p className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-[13px] font-bold text-foreground mt-0.5">{fmtCurrency(rec.generated)}</p>
      <p className="text-[9px] text-muted-foreground mt-1 leading-relaxed">{rec.reason}</p>
    </div>
  );
}

function OverrideForm({
  editValue,
  setEditValue,
  editReason,
  setEditReason,
  onConfirm,
  onCancel,
  type,
}: {
  editValue: string;
  setEditValue: (v: string) => void;
  editReason: string;
  setEditReason: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  type: "currency";
}) {
  return (
    <div className="space-y-2 mt-2">
      <input
        type="number"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        className="w-full text-[11px] px-2 py-1.5 rounded-md border border-border bg-background text-foreground"
        placeholder="New value"
      />
      <textarea
        value={editReason}
        onChange={(e) => setEditReason(e.target.value)}
        className="w-full text-[11px] px-2 py-1.5 rounded-md border border-border bg-background text-foreground resize-none"
        rows={2}
        placeholder="Reason for override (required)"
      />
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={!editReason.trim()}
          className="text-[10px] font-semibold px-3 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Apply
        </button>
        <button onClick={onCancel} className="text-[10px] font-medium px-3 py-1 rounded-md border border-border text-muted-foreground hover:bg-accent">
          Cancel
        </button>
      </div>
    </div>
  );
}

function fmtCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export default NegotiateStrategyCard;
