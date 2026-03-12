/**
 * NegotiateIQ — Persistence Types
 *
 * TypeScript contracts for all negotiation-specific tables.
 */

// ─── Session Status ─────────────────────────────────────

export type NegotiationSessionStatus =
  | "not_started"
  | "strategy_ready"
  | "active_negotiation"
  | "pending_response"
  | "settled"
  | "impasse"
  | "escalated"
  | "closed_no_settlement"
  | "transferred_to_litiq_candidate";

// ─── Event Types ────────────────────────────────────────

export type NegotiationEventType =
  | "offer_made"
  | "counteroffer_received"
  | "hold"
  | "bracket_proposed"
  | "support_requested"
  | "authority_adjusted"
  | "draft_generated"
  | "note_added"
  | "session_completed"
  | "status_changed"
  | "strategy_override";

// ─── Session ────────────────────────────────────────────

export interface NegotiationSessionRow {
  id: string;
  case_id: string;
  tenant_id: string;
  eval_package_id: string;
  eval_package_version: number;
  active_strategy_id: string | null;
  status: NegotiationSessionStatus;
  current_authority: number | null;
  current_last_offer: number | null;
  current_counteroffer: number | null;
  current_range_floor: number | null;
  current_range_ceiling: number | null;
  final_settlement_amount: number | null;
  final_outcome_notes: string;
  started_at: string | null;
  started_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Round ──────────────────────────────────────────────

export interface NegotiationRoundRow {
  id: string;
  session_id: string;
  case_id: string;
  tenant_id: string;
  round_number: number;
  our_offer: number | null;
  their_counteroffer: number | null;
  our_offer_at: string | null;
  their_counteroffer_at: string | null;
  authority_at_round: number | null;
  strategy_version_id: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

// ─── Event ──────────────────────────────────────────────

export interface NegotiationEventRow {
  id: string;
  session_id: string;
  round_id: string | null;
  case_id: string;
  tenant_id: string;
  event_type: NegotiationEventType;
  actor_user_id: string;
  summary: string;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── Note ───────────────────────────────────────────────

export interface NegotiationNoteRow {
  id: string;
  session_id: string;
  round_id: string | null;
  case_id: string;
  tenant_id: string;
  author_id: string;
  content: string;
  note_type: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Draft ──────────────────────────────────────────────

export interface NegotiationDraftRow {
  id: string;
  session_id: string;
  round_id: string | null;
  case_id: string;
  tenant_id: string;
  draft_type: string;
  title: string;
  content_json: Record<string, unknown>;
  content_text: string;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ─── Outcome ────────────────────────────────────────────

export interface NegotiationOutcomeRow {
  id: string;
  session_id: string;
  case_id: string;
  tenant_id: string;
  outcome_type: string;
  settlement_amount: number | null;
  total_rounds: number;
  initial_offer: number | null;
  initial_counteroffer: number | null;
  final_offer: number | null;
  final_counteroffer: number | null;
  eval_range_floor: number | null;
  eval_range_likely: number | null;
  eval_range_stretch: number | null;
  outcome_notes: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

// ─── Counteroffer ───────────────────────────────────────

export interface NegotiationCounterofferRow {
  id: string;
  session_id: string;
  round_id: string | null;
  case_id: string;
  tenant_id: string;
  direction: "sent" | "received";
  amount: number;
  received_at: string;
  source_channel: string;
  notes: string;
  attachment_path: string | null;
  recorded_by: string;
  created_at: string;
}

// ─── Party Profile ──────────────────────────────────────

export interface NegotiationPartyProfileRow {
  id: string;
  session_id: string;
  case_id: string;
  tenant_id: string;
  party_id: string | null;
  party_role: string;
  display_name: string;
  firm_name: string;
  known_style: string;
  aggressiveness_rating: number | null;
  prior_case_notes: string;
  observations: unknown[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ─── Valid Status Transitions ───────────────────────────

export const VALID_STATUS_TRANSITIONS: Record<NegotiationSessionStatus, NegotiationSessionStatus[]> = {
  not_started: ["strategy_ready"],
  strategy_ready: ["active_negotiation"],
  active_negotiation: ["pending_response", "settled", "impasse", "escalated", "closed_no_settlement"],
  pending_response: ["active_negotiation", "settled", "impasse", "escalated", "closed_no_settlement"],
  settled: [],
  impasse: ["active_negotiation", "escalated", "closed_no_settlement", "transferred_to_litiq_candidate"],
  escalated: ["active_negotiation", "closed_no_settlement", "transferred_to_litiq_candidate"],
  closed_no_settlement: ["transferred_to_litiq_candidate"],
  transferred_to_litiq_candidate: [],
};
