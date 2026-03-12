/**
 * NegotiateIQ — Authority & Escalation Engine
 *
 * Lightweight authority management:
 * - Check if proposed moves exceed authority
 * - Auto-build escalation summary from case context
 * - Track escalation status
 */

import type { NegotiationViewModel } from "@/lib/negotiateViewModel";
import type { GeneratedStrategy } from "@/types/negotiate-strategy";
import type { NegotiationRoundRow } from "@/types/negotiate-persistence";

// ─── Types ──────────────────────────────────────────────

export type EscalationStatus =
  | "no_escalation_needed"
  | "escalation_recommended"
  | "awaiting_authority_decision"
  | "authority_updated";

export const ESCALATION_STATUS_LABELS: Record<EscalationStatus, string> = {
  no_escalation_needed: "No Escalation Needed",
  escalation_recommended: "Escalation Recommended",
  awaiting_authority_decision: "Awaiting Authority Decision",
  authority_updated: "Authority Updated",
};

export interface AuthorityCheck {
  currentAuthority: number | null;
  recommendedAuthority: number | null;
  proposedOffer: number | null;
  exceedsAuthority: boolean;
  exceedsBy: number | null;
  exceedsPct: number | null;
  escalationStatus: EscalationStatus;
}

export interface EscalationSummary {
  generatedAt: string;
  caseId: string;
  sections: EscalationSection[];
  requestedAmount: number | null;
  currentAuthority: number | null;
  reason: string;
}

export interface EscalationSection {
  heading: string;
  content: string;
}

// ─── Authority Check ────────────────────────────────────

export function checkAuthority(
  currentAuthority: number | null,
  recommendedAuthority: number | null,
  proposedOffer: number | null
): AuthorityCheck {
  const exceedsAuthority =
    currentAuthority != null &&
    proposedOffer != null &&
    proposedOffer > currentAuthority;

  const exceedsBy =
    exceedsAuthority && currentAuthority != null && proposedOffer != null
      ? proposedOffer - currentAuthority
      : null;

  const exceedsPct =
    exceedsBy != null && currentAuthority != null && currentAuthority > 0
      ? Math.round((exceedsBy / currentAuthority) * 100)
      : null;

  let escalationStatus: EscalationStatus = "no_escalation_needed";
  if (exceedsAuthority) {
    escalationStatus = "escalation_recommended";
  } else if (
    recommendedAuthority != null &&
    currentAuthority != null &&
    recommendedAuthority > currentAuthority
  ) {
    escalationStatus = "escalation_recommended";
  }

  return {
    currentAuthority,
    recommendedAuthority,
    proposedOffer,
    exceedsAuthority,
    exceedsBy,
    exceedsPct,
    escalationStatus,
  };
}

// ─── Escalation Summary Builder ─────────────────────────

export function buildEscalationSummary(opts: {
  caseId: string;
  vm: NegotiationViewModel;
  strategy: GeneratedStrategy | null;
  rounds: NegotiationRoundRow[];
  currentAuthority: number | null;
  requestedAmount: number;
  reason: string;
  currentDemand: number | null;
  currentCounter: number | null;
}): EscalationSummary {
  const { caseId, vm, strategy, rounds, currentAuthority, requestedAmount, reason, currentDemand, currentCounter } = opts;
  const sections: EscalationSection[] = [];

  // 1. Valuation Summary
  const range = vm.valuationRange;
  sections.push({
    heading: "EvaluatePackage Valuation",
    content: [
      `Package Version: v${vm.provenance.packageVersion} (${vm.provenance.sourceModule})`,
      `Floor: ${fmt(range.floor)} | Likely: ${fmt(range.likely)} | Stretch: ${fmt(range.stretch)}`,
      range.confidence != null ? `Confidence: ${(range.confidence * 100).toFixed(0)}%` : null,
      range.authorityRecommendation != null ? `Recommended Authority: ${fmt(range.authorityRecommendation)}` : null,
      `Completeness: ${vm.completenessScore}%`,
    ].filter(Boolean).join("\n"),
  });

  // 2. Active Strategy
  if (strategy) {
    sections.push({
      heading: "Active Negotiation Strategy",
      content: [
        `Opening Offer: ${fmt(strategy.openingOffer.generated)}`,
        `Authority Ceiling: ${fmt(strategy.authorityCeiling.generated)}`,
        `Target Zone: ${fmt(strategy.targetSettlementZone.generated.low)} – ${fmt(strategy.targetSettlementZone.generated.high)}`,
        `Walk-Away: ${fmt(strategy.walkAwayThreshold.generated)}`,
        `Posture: ${strategy.concessionPosture.generated}`,
        `Rationale: ${strategy.rationaleSummary}`,
      ].join("\n"),
    });
  }

  // 3. Round History
  if (rounds.length > 0) {
    const roundLines = rounds.map((r) => {
      const parts = [`Round ${r.round_number}`];
      if (r.our_offer != null) parts.push(`Our offer: ${fmt(r.our_offer)}`);
      if (r.their_counteroffer != null) parts.push(`Their counter: ${fmt(r.their_counteroffer)}`);
      return parts.join(" — ");
    });
    sections.push({
      heading: `Round History (${rounds.length} round${rounds.length !== 1 ? "s" : ""})`,
      content: roundLines.join("\n"),
    });
  }

  // 4. Current Position
  sections.push({
    heading: "Current Position",
    content: [
      currentDemand != null ? `Current Demand: ${fmt(currentDemand)}` : "No demand on record",
      currentCounter != null ? `Latest Counteroffer: ${fmt(currentCounter)}` : "No counteroffer on record",
      `Current Authority: ${currentAuthority != null ? fmt(currentAuthority) : "Not set"}`,
    ].join("\n"),
  });

  // 5. Authority Request
  sections.push({
    heading: "Authority Adjustment Request",
    content: [
      `Requested Authority: ${fmt(requestedAmount)}`,
      currentAuthority != null
        ? `Increase from current: ${fmt(requestedAmount - currentAuthority)} (+${currentAuthority > 0 ? Math.round(((requestedAmount - currentAuthority) / currentAuthority) * 100) : 0}%)`
        : "No prior authority set",
      `Reason: ${reason}`,
    ].join("\n"),
  });

  // 6. Key Drivers
  if (vm.expanders.length > 0 || vm.reducers.length > 0) {
    const driverLines = [
      ...vm.expanders.slice(0, 3).map((d) => `↑ ${d.label}: ${d.description}`),
      ...vm.reducers.slice(0, 3).map((d) => `↓ ${d.label}: ${d.description}`),
    ];
    sections.push({
      heading: "Key Valuation Drivers",
      content: driverLines.join("\n"),
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    caseId,
    sections,
    requestedAmount,
    currentAuthority,
    reason,
  };
}

// ─── Format Summary as Text ─────────────────────────────

export function formatEscalationSummaryText(summary: EscalationSummary): string {
  const lines: string[] = [
    "═══════════════════════════════════════════",
    "  SUPERVISOR AUTHORITY REVIEW SUMMARY",
    "═══════════════════════════════════════════",
    "",
    `Generated: ${new Date(summary.generatedAt).toLocaleString("en-US")}`,
    `Case: ${summary.caseId}`,
    "",
  ];

  for (const section of summary.sections) {
    lines.push(`── ${section.heading} ${"─".repeat(Math.max(0, 40 - section.heading.length))}`);
    lines.push(section.content);
    lines.push("");
  }

  lines.push("═══════════════════════════════════════════");
  lines.push("  END OF ESCALATION SUMMARY");
  lines.push("═══════════════════════════════════════════");

  return lines.join("\n");
}

function fmt(n: number | null): string {
  if (n == null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}
