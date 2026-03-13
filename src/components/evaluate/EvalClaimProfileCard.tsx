/**
 * EvaluateIQ — Claim Profile Classification Card
 *
 * Prominent display of the classified claim profile with
 * drill-down explanation panel.
 */

import { useState } from "react";
import type { ClaimProfileResult, ProfileReason, ClaimProfileCode } from "@/lib/claimProfileClassifier";
import { PROFILE_META } from "@/lib/claimProfileClassifier";
import {
  Fingerprint,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Info,
  ShieldAlert,
} from "lucide-react";

interface Props {
  profile: ClaimProfileResult;
}

const CONFIDENCE_CONFIG: Record<string, { icon: React.ElementType; label: string; className: string }> = {
  high: { icon: CheckCircle2, label: "High Confidence", className: "text-[hsl(var(--status-approved))]" },
  moderate: { icon: AlertTriangle, label: "Moderate Confidence", className: "text-[hsl(var(--status-attention))]" },
  low: { icon: ShieldAlert, label: "Low Confidence", className: "text-destructive" },
};

const WEIGHT_BADGE: Record<string, string> = {
  primary: "bg-primary/10 text-primary border-primary/20",
  supporting: "bg-accent text-muted-foreground border-border",
  negative: "bg-destructive/10 text-destructive border-destructive/20",
};

const EvalClaimProfileCard = ({ profile }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const meta = PROFILE_META[profile.primary];
  const conf = CONFIDENCE_CONFIG[profile.confidence];
  const ConfIcon = conf.icon;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* ── Header ─────────────────────────────── */}
      <div className="p-4 flex items-start gap-3">
        {/* Profile badge */}
        <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <span className="text-lg font-bold text-primary">{profile.primary}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground">{meta.label}</h3>
            <span className={`inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${conf.className} bg-background`}>
              <ConfIcon className="h-3 w-3" />
              {conf.label}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{meta.description}</p>

          {/* Secondary flags */}
          {profile.secondary_flags.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[9px] text-muted-foreground font-medium">Also:</span>
              {profile.secondary_flags.map(code => (
                <span
                  key={code}
                  className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-accent border border-border text-foreground"
                >
                  {code} · {PROFILE_META[code].label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground"
          aria-label={expanded ? "Collapse explanation" : "Expand explanation"}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* ── Explanation Drill-Down ──────────────── */}
      {expanded && (
        <div className="border-t border-border bg-muted/30 p-4 space-y-4">
          {/* Summary */}
          <div className="flex items-start gap-2">
            <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
            <p className="text-[11px] text-foreground leading-relaxed">{profile.explanation.summary}</p>
          </div>

          {/* Reasons */}
          <div>
            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Classification Reasons
            </h4>
            <div className="space-y-2">
              {profile.explanation.reasons.map((r, i) => (
                <ReasonRow key={i} reason={r} />
              ))}
            </div>
          </div>

          {/* Data gaps */}
          {profile.explanation.data_gaps.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Data Gaps
              </h4>
              <div className="space-y-1">
                {profile.explanation.data_gaps.map((gap, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] text-[hsl(var(--status-attention))]">
                    <HelpCircle className="h-3 w-3 shrink-0" />
                    <span>{gap}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function ReasonRow({ reason }: { reason: ProfileReason }) {
  return (
    <div className="flex items-start gap-2">
      <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${WEIGHT_BADGE[reason.weight]}`}>
        {reason.weight}
      </span>
      <div className="min-w-0">
        <span className="text-[11px] font-medium text-foreground">{reason.factor}</span>
        <span className="text-[10px] text-muted-foreground ml-1">— {reason.description}</span>
      </div>
    </div>
  );
}

export default EvalClaimProfileCard;
