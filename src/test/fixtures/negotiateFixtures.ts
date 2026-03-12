/**
 * NegotiateIQ — Test Fixtures
 *
 * Five seeded negotiate scenarios tied to EvaluatePackage-backed cases.
 * All data is fictional per docs/compliance/data-classification.md §2.
 *
 * SCENARIOS:
 *  1. Reasonable counter, likely settlement — soft tissue, good liability
 *  2. Excessive demand, slow movement — high billed, attorney aggressive
 *  3. Weak liability, hold/no-move — comp neg case
 *  4. Known attorney from prior matters — venue-severity case
 *  5. Near authority ceiling, escalation needed — surgery case
 */

import type { NegotiationViewModel, NegotiateProvenance, NegotiateValuationRange, NegotiateSpecialsSummary, NegotiateDriverSummary, NegotiateRisk, NegotiateAssumption } from "@/lib/negotiateViewModel";
import type { NegotiationSessionRow, NegotiationRoundRow, NegotiationNoteRow } from "@/types/negotiate-persistence";
import type { GeneratedStrategy, StrategyOverride } from "@/types/negotiate-strategy";
import type { HistoricalClaimForCalibration } from "@/lib/negotiateCalibrationEngine";

const TENANT_ID = "tenant-negotiate-fixture";
const NOW = "2026-03-10T00:00:00Z";

// ─── Helper: Build NegotiationViewModel ─────────────────

function buildVM(overrides: Partial<NegotiationViewModel>): NegotiationViewModel {
  return {
    readonly: true,
    provenance: {
      packageId: "eval-pkg-fixture-1",
      packageVersion: 1,
      engineVersion: "evaluate-v1.0.0",
      sourceModule: "demandiq",
      sourcePackageVersion: 1,
      completedAt: NOW,
      completedBy: "fixture-user",
    },
    valuationRange: {
      floor: 15000,
      likely: 22000,
      stretch: 30000,
      confidence: 0.72,
      selectedFloor: null,
      selectedLikely: null,
      selectedStretch: null,
      authorityRecommendation: null,
    },
    specials: { totalBilled: 12000, totalReviewed: 8000, reductionPercent: 33 },
    expanders: [],
    reducers: [],
    neutralDrivers: [],
    risks: [],
    assumptions: [],
    rationaleNotes: "",
    completenessScore: 78,
    ...overrides,
  };
}

function buildSession(overrides: Partial<NegotiationSessionRow>): NegotiationSessionRow {
  return {
    id: "session-fixture-1",
    case_id: "case-negotiate-1",
    tenant_id: TENANT_ID,
    eval_package_id: "eval-pkg-fixture-1",
    eval_package_version: 1,
    active_strategy_id: null,
    status: "active_negotiation",
    current_authority: 25000,
    current_last_offer: null,
    current_counteroffer: null,
    current_range_floor: null,
    current_range_ceiling: null,
    final_settlement_amount: null,
    final_outcome_notes: "",
    started_at: NOW,
    started_by: "fixture-user",
    completed_at: null,
    completed_by: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function buildRound(n: number, ourOffer: number | null, theirCounter: number | null, overrides: Partial<NegotiationRoundRow> = {}): NegotiationRoundRow {
  return {
    id: `round-fixture-${n}`,
    session_id: "session-fixture-1",
    case_id: "case-negotiate-1",
    tenant_id: TENANT_ID,
    round_number: n,
    our_offer: ourOffer,
    their_counteroffer: theirCounter,
    our_offer_at: ourOffer != null ? NOW : null,
    their_counteroffer_at: theirCounter != null ? NOW : null,
    authority_at_round: 25000,
    strategy_version_id: null,
    notes: "",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function buildNote(content: string, noteType: string = "general"): NegotiationNoteRow {
  return {
    id: `note-fixture-${Math.random().toString(36).slice(2, 8)}`,
    session_id: "session-fixture-1",
    round_id: null,
    case_id: "case-negotiate-1",
    tenant_id: TENANT_ID,
    author_id: "fixture-user",
    content,
    note_type: noteType,
    is_internal: true,
    created_at: NOW,
    updated_at: NOW,
  };
}

// ════════════════════════════════════════════════════════
// SCENARIO 1: Reasonable counter, likely settlement
// Soft tissue, good liability, counter is within target zone
// ════════════════════════════════════════════════════════

export const SCENARIO_REASONABLE = {
  label: "Reasonable counter — likely settlement",
  vm: buildVM({
    provenance: { packageId: "eval-pkg-reasonable", packageVersion: 1, engineVersion: "evaluate-v1.0.0", sourceModule: "demandiq", sourcePackageVersion: 1, completedAt: NOW, completedBy: "fixture-user" },
    valuationRange: { floor: 15000, likely: 22000, stretch: 30000, confidence: 0.72, selectedFloor: null, selectedLikely: null, selectedStretch: null, authorityRecommendation: null },
    specials: { totalBilled: 12000, totalReviewed: 8000, reductionPercent: 33 },
    expanders: [
      { key: "documented_treatment", label: "Documented Treatment", impact: "expander", description: "Consistent PT course supports claimed injuries" },
    ],
    reducers: [
      { key: "minor_impact", label: "Low-speed impact", impact: "reducer", description: "Vehicle damage photos show minor contact" },
    ],
    risks: [],
    completenessScore: 82,
  }),
  session: buildSession({
    id: "session-reasonable",
    case_id: "case-negotiate-reasonable",
    current_authority: 25000,
    current_last_offer: 16000,
    current_counteroffer: 21000,
    status: "active_negotiation",
  }),
  rounds: [
    buildRound(1, 10000, 35000, { session_id: "session-reasonable", case_id: "case-negotiate-reasonable" }),
    buildRound(2, 14000, 27000, { session_id: "session-reasonable", case_id: "case-negotiate-reasonable" }),
    buildRound(3, 16000, 21000, { session_id: "session-reasonable", case_id: "case-negotiate-reasonable" }),
  ],
  notes: [
    buildNote("Claimant counsel responsive and reasonable. Moving toward resolution."),
    buildNote("Counter within target zone — recommend closing near $19K–$20K."),
  ],
  expectedState: {
    shouldRecommendSettlement: true,
    authorityWarning: false,
    postureZone: "within_target" as const,
  },
};

// ════════════════════════════════════════════════════════
// SCENARIO 2: Excessive demand, slow movement
// High billed medicals, attorney starts very high and barely moves
// ════════════════════════════════════════════════════════

export const SCENARIO_EXCESSIVE_DEMAND = {
  label: "Excessive demand — slow movement",
  vm: buildVM({
    provenance: { packageId: "eval-pkg-excessive", packageVersion: 1, engineVersion: "evaluate-v1.0.0", sourceModule: "revieweriq", sourcePackageVersion: 1, completedAt: NOW, completedBy: "fixture-user" },
    valuationRange: { floor: 18000, likely: 28000, stretch: 38000, confidence: 0.65, selectedFloor: null, selectedLikely: null, selectedStretch: null, authorityRecommendation: null },
    specials: { totalBilled: 46500, totalReviewed: 24900, reductionPercent: 46 },
    expanders: [
      { key: "surgery_documented", label: "Documented Surgery", impact: "expander", description: "L4-L5 microdiscectomy supported by imaging" },
    ],
    reducers: [
      { key: "excessive_chiro", label: "Excessive Chiropractic", impact: "reducer", description: "48 chiropractic sessions exceed guidelines" },
      { key: "billing_inflation", label: "Billing Inflation", impact: "reducer", description: "46% reduction on reviewed specials" },
    ],
    risks: [
      { key: "treatment_excess", label: "Over-treatment", description: "Treatment volume exceeds normative ranges", category: "treatment" },
    ],
    completenessScore: 78,
  }),
  session: buildSession({
    id: "session-excessive",
    case_id: "case-negotiate-excessive",
    current_authority: 30000,
    current_last_offer: 16000,
    current_counteroffer: 85000,
    status: "active_negotiation",
  }),
  rounds: [
    buildRound(1, 12000, 120000, { session_id: "session-excessive", case_id: "case-negotiate-excessive" }),
    buildRound(2, 14500, 95000, { session_id: "session-excessive", case_id: "case-negotiate-excessive" }),
    buildRound(3, 15500, 88000, { session_id: "session-excessive", case_id: "case-negotiate-excessive" }),
    buildRound(4, 16000, 85000, { session_id: "session-excessive", case_id: "case-negotiate-excessive" }),
  ],
  notes: [
    buildNote("Claimant counsel anchored at 4x specials. Minimal movement over 4 rounds.", "concern"),
    buildNote("Attorney demands full specials emphasis — refuses to acknowledge reviewer reductions."),
  ],
  expectedState: {
    shouldRecommendSettlement: false,
    authorityWarning: false,
    postureZone: "outside_not_moving" as const,
  },
};

// ════════════════════════════════════════════════════════
// SCENARIO 3: Weak liability, hold/no-move
// Comparative negligence case with claimant partially at fault
// ════════════════════════════════════════════════════════

export const SCENARIO_WEAK_LIABILITY = {
  label: "Weak liability — hold/no-move recommended",
  vm: buildVM({
    provenance: { packageId: "eval-pkg-weak-liab", packageVersion: 1, engineVersion: "evaluate-v1.0.0", sourceModule: "demandiq", sourcePackageVersion: 1, completedAt: NOW, completedBy: "fixture-user" },
    valuationRange: { floor: 8000, likely: 14000, stretch: 20000, confidence: 0.45, selectedFloor: null, selectedLikely: null, selectedStretch: null, authorityRecommendation: null },
    specials: { totalBilled: 18100, totalReviewed: 12000, reductionPercent: 34 },
    expanders: [],
    reducers: [
      { key: "comp_neg_25pct", label: "25% Comparative Negligence", impact: "reducer", description: "Claimant bears 25% fault per accident reconstruction" },
      { key: "liability_dispute", label: "Liability Disputed", impact: "reducer", description: "Multiple witnesses with conflicting accounts" },
      { key: "credibility_issue", label: "Credibility Concerns", impact: "reducer", description: "Social media inconsistent with claimed limitations" },
    ],
    risks: [
      { key: "liability_weak", label: "Weak Liability", description: "Claimant 25% at fault", category: "liability" },
      { key: "credibility_social", label: "Social Media Risk", description: "Active social media contradicts injury claims", category: "credibility" },
    ],
    completenessScore: 85,
  }),
  session: buildSession({
    id: "session-weak-liab",
    case_id: "case-negotiate-weak-liab",
    current_authority: 15000,
    current_last_offer: 7000,
    current_counteroffer: 45000,
    status: "active_negotiation",
  }),
  rounds: [
    buildRound(1, 5000, 55000, { session_id: "session-weak-liab", case_id: "case-negotiate-weak-liab" }),
    buildRound(2, 7000, 45000, { session_id: "session-weak-liab", case_id: "case-negotiate-weak-liab" }),
  ],
  notes: [
    buildNote("Claimant's social media shows active hiking/running during claimed disability period.", "concern"),
    buildNote("Hold position recommended until claimant makes credible movement."),
  ],
  expectedState: {
    shouldRecommendSettlement: false,
    authorityWarning: false,
    postureZone: "outside_not_moving" as const,
  },
};

// ════════════════════════════════════════════════════════
// SCENARIO 4: Known attorney from prior matters
// Venue-severity case with attorney history in historical_claims
// ════════════════════════════════════════════════════════

export const SCENARIO_KNOWN_ATTORNEY = {
  label: "Known attorney — prior closed matters in corpus",
  vm: buildVM({
    provenance: { packageId: "eval-pkg-known-atty", packageVersion: 1, engineVersion: "evaluate-v1.0.0", sourceModule: "revieweriq", sourcePackageVersion: 1, completedAt: NOW, completedBy: "fixture-user" },
    valuationRange: { floor: 25000, likely: 38000, stretch: 52000, confidence: 0.68, selectedFloor: null, selectedLikely: null, selectedStretch: null, authorityRecommendation: 42000 },
    specials: { totalBilled: 24800, totalReviewed: 20500, reductionPercent: 17 },
    expanders: [
      { key: "injections_documented", label: "Pain Management Injections", impact: "expander", description: "3 epidural injections supported by imaging" },
      { key: "permanency_rating", label: "Permanency Rating", impact: "expander", description: "8% whole person impairment rating documented" },
    ],
    reducers: [
      { key: "venue_neutral", label: "Neutral Venue", impact: "reducer", description: "Jurisdiction historically produces moderate awards" },
    ],
    risks: [],
    completenessScore: 88,
  }),
  session: buildSession({
    id: "session-known-atty",
    case_id: "case-negotiate-known-atty",
    current_authority: 42000,
    current_last_offer: 28000,
    current_counteroffer: 65000,
    status: "active_negotiation",
  }),
  rounds: [
    buildRound(1, 18000, 90000, { session_id: "session-known-atty", case_id: "case-negotiate-known-atty" }),
    buildRound(2, 24000, 75000, { session_id: "session-known-atty", case_id: "case-negotiate-known-atty" }),
    buildRound(3, 28000, 65000, { session_id: "session-known-atty", case_id: "case-negotiate-known-atty" }),
  ],
  notes: [
    buildNote("Attorney R. Patterson — known from 4 prior matters. Tends to start very high but settles near 55% of original demand."),
    buildNote("Historical pattern: typically requires 4-5 rounds. Responds well to bracket strategy."),
  ],
  attorneyProfile: {
    name: "R. Patterson",
    firm: "Patterson & Associates",
    priorCases: 4,
    avgDemandToSettlementRatio: 0.55,
    typicalRounds: 5,
  },
  historicalClaims: [
    {
      final_settlement_amount: 38000,
      billed_specials: 22000,
      reviewed_specials: 18000,
      attorney_name: "R. Patterson",
      attorney_firm: "Patterson & Associates",
      jurisdiction: "FL",
      venue_state: "FL",
      injury_categories: ["cervical_disc"],
      primary_body_parts: ["Cervical Spine"],
      has_surgery: false,
      has_injections: true,
      has_permanency: true,
      liability_posture: "clear",
      treatment_duration_days: 180,
    },
    {
      final_settlement_amount: 28000,
      billed_specials: 19000,
      reviewed_specials: 15000,
      attorney_name: "R. Patterson",
      attorney_firm: "Patterson & Associates",
      jurisdiction: "FL",
      venue_state: "FL",
      injury_categories: ["soft_tissue"],
      primary_body_parts: ["Lumbar Spine"],
      has_surgery: false,
      has_injections: false,
      has_permanency: false,
      liability_posture: "clear",
      treatment_duration_days: 120,
    },
  ] as HistoricalClaimForCalibration[],
  expectedState: {
    shouldRecommendSettlement: false,
    authorityWarning: false,
  },
};

// ════════════════════════════════════════════════════════
// SCENARIO 5: Near authority ceiling — escalation needed
// Surgery case where strategy ceiling is nearly exhausted
// ════════════════════════════════════════════════════════

export const SCENARIO_NEAR_CEILING = {
  label: "Near authority ceiling — escalation required",
  vm: buildVM({
    provenance: { packageId: "eval-pkg-ceiling", packageVersion: 1, engineVersion: "evaluate-v1.0.0", sourceModule: "revieweriq", sourcePackageVersion: 1, completedAt: NOW, completedBy: "fixture-user" },
    valuationRange: { floor: 45000, likely: 65000, stretch: 85000, confidence: 0.78, selectedFloor: null, selectedLikely: null, selectedStretch: null, authorityRecommendation: 70000 },
    specials: { totalBilled: 105100, totalReviewed: 78000, reductionPercent: 26 },
    expanders: [
      { key: "surgery_two_sites", label: "Two Surgical Sites", impact: "expander", description: "Lumbar discectomy + knee arthroscopy" },
      { key: "wage_loss_documented", label: "Documented Wage Loss", impact: "expander", description: "$35,000 lost wages verified by employer" },
      { key: "future_treatment", label: "Future Medical Needs", impact: "expander", description: "$15,000 estimated future treatment" },
    ],
    reducers: [],
    risks: [],
    completenessScore: 91,
  }),
  session: buildSession({
    id: "session-ceiling",
    case_id: "case-negotiate-ceiling",
    current_authority: 55000,
    current_last_offer: 52000,
    current_counteroffer: 58000,
    status: "active_negotiation",
  }),
  rounds: [
    buildRound(1, 35000, 110000, { session_id: "session-ceiling", case_id: "case-negotiate-ceiling" }),
    buildRound(2, 42000, 85000, { session_id: "session-ceiling", case_id: "case-negotiate-ceiling" }),
    buildRound(3, 48000, 68000, { session_id: "session-ceiling", case_id: "case-negotiate-ceiling" }),
    buildRound(4, 52000, 58000, { session_id: "session-ceiling", case_id: "case-negotiate-ceiling" }),
  ],
  notes: [
    buildNote("Gap narrowing rapidly. Counter at $58K is above authority of $55K."),
    buildNote("Recommended authority: $70K per EvaluatePackage. Escalation needed."),
  ],
  expectedState: {
    shouldRecommendSettlement: false,
    authorityExceeded: true,
    escalationRecommended: true,
    postureZone: "beyond_ceiling" as const,
  },
};

// ─── All Negotiate Fixtures ─────────────────────────────

export const ALL_NEGOTIATE_FIXTURES = [
  SCENARIO_REASONABLE,
  SCENARIO_EXCESSIVE_DEMAND,
  SCENARIO_WEAK_LIABILITY,
  SCENARIO_KNOWN_ATTORNEY,
  SCENARIO_NEAR_CEILING,
];
