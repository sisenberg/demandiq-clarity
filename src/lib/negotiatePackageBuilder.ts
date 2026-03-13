/**
 * NegotiateIQ — Package Builder & Completion Validator
 *
 * Builds the NegotiatePackage v1 payload from session state,
 * strategy, rounds, notes, attorney intelligence, and calibration.
 * Validates completion requirements before publishing.
 */

import type { NegotiationViewModel } from "@/lib/negotiateViewModel";
import type { GeneratedStrategy, StrategyOverride } from "@/types/negotiate-strategy";
import type {
  NegotiationSessionRow,
  NegotiationRoundRow,
  NegotiationNoteRow,
  NegotiationSessionStatus,
  NegotiateRepresentationContext,
  SettlementRepresentationFields,
  TransferRepresentationFields,
} from "@/types/negotiate-persistence";

// ─── Outcome Types ──────────────────────────────────────

export type NegotiateOutcomeType =
  | "settled"
  | "impasse"
  | "transferred_forward"
  | "closed_without_settlement";

export const OUTCOME_LABELS: Record<NegotiateOutcomeType, string> = {
  settled: "Settled",
  impasse: "Impasse",
  transferred_forward: "Transferred Forward (LitIQ Candidate)",
  closed_without_settlement: "Closed Without Settlement",
};

// ─── NegotiatePackage v1 Payload ────────────────────────

export interface NegotiatePackagePayload {
  package_version: number;
  engine_version: string;
  generated_at: string;

  // Provenance
  source_eval_package_id: string;
  source_eval_package_version: number;
  source_eval_source_module: string;
  source_eval_source_package_version: number;

  // Session metadata
  session_id: string;
  session_status: NegotiationSessionStatus;
  session_started_at: string | null;
  session_completed_at: string | null;

  // Outcome
  outcome_type: NegotiateOutcomeType;
  final_settlement_amount: number | null;
  outcome_notes: string;
  unresolved_issues: string[];
  next_step_recommendations: string[];
  litigation_likely: boolean;

  // Strategy summary
  strategy_version: number;
  strategy_summary: {
    opening_offer: number;
    authority_ceiling: number;
    target_zone: { low: number; high: number };
    walk_away: number;
    concession_posture: string;
    rationale: string;
    key_drivers: string[];
    override_count: number;
  } | null;

  // Valuation reference (from EvaluatePackage)
  valuation_summary: {
    floor: number | null;
    likely: number | null;
    stretch: number | null;
    confidence: number | null;
    authority_recommendation: number | null;
    completeness_score: number;
  };

  // Offer/counter timeline
  round_timeline: Array<{
    round_number: number;
    our_offer: number | null;
    their_counteroffer: number | null;
    our_offer_at: string | null;
    their_counteroffer_at: string | null;
    authority_at_round: number | null;
  }>;
  total_rounds: number;

  // Authority posture
  final_authority: number | null;

  // Notes summary
  key_notes: Array<{
    content: string;
    note_type: string;
    created_at: string;
  }>;

  // Attorney intelligence summary
  attorney_intelligence: {
    attorney_name: string | null;
    firm_name: string | null;
    observations_count: number;
  } | null;

  // Calibration summary
  calibration_summary: {
    signals_count: number;
    high_confidence_count: number;
    jurisdiction_band: string | null;
  } | null;

  // ─── Required: Representation Context ─────────────────
  representation_context: NegotiateRepresentationContext;

  // ─── Outcome-Specific Representation Fields ───────────
  settlement_representation: SettlementRepresentationFields | null;
  transfer_representation: TransferRepresentationFields | null;
}

// ─── Completion Validation ──────────────────────────────

export interface CompletionValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateNegotiateCompletion(opts: {
  session: NegotiationSessionRow | null;
  strategy: { version: number; generated_strategy: GeneratedStrategy } | null;
  rounds: NegotiationRoundRow[];
  outcomeType: NegotiateOutcomeType | null;
  finalSettlement: number | null;
  outcomeNotes: string;
  representationContext?: NegotiateRepresentationContext | null;
}): CompletionValidation {
  const { session, strategy, rounds, outcomeType, finalSettlement, outcomeNotes, representationContext } = opts;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!session) {
    errors.push("No active negotiation session exists.");
  }

  if (!strategy) {
    errors.push("At least one strategy version must be saved.");
  }

  if (!outcomeType) {
    errors.push("An outcome type must be selected.");
  }

  if (outcomeType === "settled" && (finalSettlement == null || finalSettlement <= 0)) {
    errors.push("Settlement amount is required for a settled outcome.");
  }

  if (outcomeType !== "settled" && outcomeNotes != null && !outcomeNotes.trim()) {
    errors.push("Outcome notes are required for non-settlement outcomes.");
  }

  // ─── Representation validation ────────────────────────
  if (!representationContext) {
    errors.push("Representation context is required for package publication.");
  }

  if (outcomeType === "settled" && representationContext) {
    if (!representationContext.representation_status_at_outcome && !representationContext.representation_status_current) {
      errors.push("Representation status at settlement is required for settled outcomes.");
    }
  }

  if (outcomeType === "transferred_forward" && representationContext) {
    if (!representationContext.representation_status_at_outcome && !representationContext.representation_status_current) {
      errors.push("Representation status at transfer is required for transferred outcomes.");
    }
  }

  if (rounds.length === 0) {
    warnings.push("No negotiation rounds recorded. Package will reflect zero round history.");
  }

  if (outcomeType === "transferred_forward" && !outcomeNotes.toLowerCase().includes("lit")) {
    warnings.push("Consider noting litigation readiness details for LitIQ consumption.");
  }

  // Representation transition warning for downstream
  if (representationContext?.representation_transition_flag) {
    warnings.push("Representation changed during this claim. Package preserves transition history for downstream modules.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Package Builder ────────────────────────────────────

export function buildNegotiatePackage(opts: {
  vm: NegotiationViewModel;
  session: NegotiationSessionRow;
  strategy: { version: number; generated_strategy: GeneratedStrategy; overrides: StrategyOverride[] } | null;
  rounds: NegotiationRoundRow[];
  notes: NegotiationNoteRow[];
  outcomeType: NegotiateOutcomeType;
  finalSettlement: number | null;
  outcomeNotes: string;
  unresolvedIssues: string[];
  nextStepRecommendations: string[];
  litigationLikely: boolean;
  attorneyName: string | null;
  firmName: string | null;
  observationsCount: number;
  calibrationSignalsCount: number;
  calibrationHighConfCount: number;
  calibrationJurisdictionBand: string | null;
  representationContext?: NegotiateRepresentationContext | null;
}): NegotiatePackagePayload {
  const {
    vm, session, strategy, rounds, notes,
    outcomeType, finalSettlement, outcomeNotes,
    unresolvedIssues, nextStepRecommendations, litigationLikely,
    attorneyName, firmName, observationsCount,
    calibrationSignalsCount, calibrationHighConfCount, calibrationJurisdictionBand,
    representationContext,
  } = opts;

  const gen = strategy?.generated_strategy;

  // Build outcome-specific representation sections
  const repCtx = representationContext ?? null;
  if (!repCtx) {
    throw new Error("representation_context is required to build NegotiatePackage");
  }

  // Finalize representation_status_at_publication
  const finalizedRepCtx: NegotiateRepresentationContext = {
    ...repCtx,
    representation_status_at_publication: repCtx.representation_status_current,
    representation_status_at_outcome: repCtx.representation_status_at_outcome ?? repCtx.representation_status_current,
  };

  // Build settlement representation fields
  const settlementRep: SettlementRepresentationFields | null = outcomeType === "settled" ? {
    representation_status_at_settlement: finalizedRepCtx.representation_status_current,
    representation_transition_flag: finalizedRepCtx.representation_transition_flag,
    attorney_retained_during_claim_flag: finalizedRepCtx.attorney_retained_during_negotiation_flag,
    attorney_retained_after_initial_offer_flag: finalizedRepCtx.attorney_retained_after_initial_offer_flag,
    unrepresented_resolved_flag: finalizedRepCtx.representation_status_current === "unrepresented",
  } : null;

  // Build transfer representation fields
  const transferRep: TransferRepresentationFields | null = outcomeType === "transferred_forward" ? {
    representation_status_at_transfer: finalizedRepCtx.representation_status_current,
    representation_transition_flag: finalizedRepCtx.representation_transition_flag,
  } : null;

  // Build representation_history_summary if not already set
  if (!finalizedRepCtx.representation_history_summary) {
    finalizedRepCtx.representation_history_summary = buildRepresentationHistorySummary(finalizedRepCtx, outcomeType);
  }

  return {
    package_version: 1, // Will be overridden by DB version
    engine_version: "negotiate-v1.1.0",
    generated_at: new Date().toISOString(),

    source_eval_package_id: vm.provenance.packageId,
    source_eval_package_version: vm.provenance.packageVersion,
    source_eval_source_module: vm.provenance.sourceModule,
    source_eval_source_package_version: vm.provenance.sourcePackageVersion,

    session_id: session.id,
    session_status: session.status,
    session_started_at: session.started_at,
    session_completed_at: session.completed_at,

    outcome_type: outcomeType,
    final_settlement_amount: outcomeType === "settled" ? finalSettlement : null,
    outcome_notes: outcomeNotes,
    unresolved_issues: unresolvedIssues,
    next_step_recommendations: nextStepRecommendations,
    litigation_likely: litigationLikely,

    strategy_version: strategy?.version ?? 0,
    strategy_summary: gen ? {
      opening_offer: gen.openingOffer.generated,
      authority_ceiling: gen.authorityCeiling.generated,
      target_zone: gen.targetSettlementZone.generated,
      walk_away: gen.walkAwayThreshold.generated,
      concession_posture: gen.concessionPosture.generated,
      rationale: gen.rationaleSummary,
      key_drivers: gen.keyDrivers,
      override_count: strategy?.overrides?.length ?? 0,
    } : null,

    valuation_summary: {
      floor: vm.valuationRange.floor,
      likely: vm.valuationRange.likely,
      stretch: vm.valuationRange.stretch,
      confidence: vm.valuationRange.confidence,
      authority_recommendation: vm.valuationRange.authorityRecommendation,
      completeness_score: vm.completenessScore,
    },

    round_timeline: rounds.map((r) => ({
      round_number: r.round_number,
      our_offer: r.our_offer,
      their_counteroffer: r.their_counteroffer,
      our_offer_at: r.our_offer_at,
      their_counteroffer_at: r.their_counteroffer_at,
      authority_at_round: r.authority_at_round,
    })),
    total_rounds: rounds.length,

    final_authority: session.current_authority,

    key_notes: notes.slice(0, 20).map((n) => ({
      content: n.content,
      note_type: n.note_type,
      created_at: n.created_at,
    })),

    attorney_intelligence: (attorneyName || firmName) ? {
      attorney_name: attorneyName,
      firm_name: firmName,
      observations_count: observationsCount,
    } : null,

    calibration_summary: calibrationSignalsCount > 0 ? {
      signals_count: calibrationSignalsCount,
      high_confidence_count: calibrationHighConfCount,
      jurisdiction_band: calibrationJurisdictionBand,
    } : null,

    representation_context: finalizedRepCtx,
    settlement_representation: settlementRep,
    transfer_representation: transferRep,
  };
}

// ─── Representation History Summary Builder ─────────────

function buildRepresentationHistorySummary(
  ctx: NegotiateRepresentationContext,
  outcomeType: NegotiateOutcomeType,
): string {
  const parts: string[] = [];
  parts.push(`Current: ${ctx.representation_status_current}.`);

  if (ctx.representation_transition_flag) {
    parts.push(`Representation changed during claim (${ctx.representation_changes.length} transition(s)).`);
  }

  if (ctx.attorney_retained_during_negotiation_flag) {
    parts.push("Attorney retained during negotiation.");
  }

  if (ctx.unrepresented_resolved_flag) {
    parts.push("Claim resolved while claimant was unrepresented.");
  }

  if (outcomeType === "settled") {
    parts.push(`Status at settlement: ${ctx.representation_status_current}.`);
  } else if (outcomeType === "transferred_forward") {
    parts.push(`Status at transfer: ${ctx.representation_status_current}.`);
  }

  return parts.join(" ");
}
