// ─── Internal Platform Events for Representation ─────
// These event contracts define the shape of internal platform events
// emitted when claimant representation state changes.
// Downstream modules (EvaluateIQ, NegotiateIQ, LitIQ) subscribe to these.

export const REPRESENTATION_EVENTS = {
  RECORDED: 'casualtyiq.claimant.representation_recorded.v1',
  ATTORNEY_RETAINED: 'casualtyiq.claimant.attorney_retained.v1',
  ATTORNEY_SUBSTITUTED: 'casualtyiq.claimant.attorney_substituted.v1',
  ATTORNEY_WITHDREW: 'casualtyiq.claimant.attorney_withdrew.v1',
} as const;

export type RepresentationPlatformEventName =
  (typeof REPRESENTATION_EVENTS)[keyof typeof REPRESENTATION_EVENTS];

/** Payload shape for all representation platform events */
export interface RepresentationPlatformEventPayload {
  event_name: RepresentationPlatformEventName;
  tenant_id: string;
  case_id: string;
  claimant_id: string;
  representation_status: 'represented' | 'unrepresented' | 'unknown';
  event_type: string;
  attorney_name: string | null;
  firm_name: string | null;
  occurred_at: string;
  recorded_at: string;
  representation_transition_flag: boolean;
  record_id: string;
}

/** Read model returned by the GET endpoint */
export interface RepresentationContext {
  representation_status_current: 'represented' | 'unrepresented' | 'unknown';
  current_attorney_name: string | null;
  current_firm_name: string | null;
  representation_transition_flag: boolean;
  history_count: number;
}

/** Full GET response shape */
export interface RepresentationHistoryResponse {
  representation_context: RepresentationContext;
  history: Array<{
    id: string;
    tenant_id: string;
    case_id: string;
    claimant_id: string;
    representation_status: string;
    event_type: string;
    attorney_name: string | null;
    firm_name: string | null;
    source_party_id: string | null;
    occurred_at: string;
    recorded_at: string;
    notes: string | null;
    created_by_user_id: string | null;
    created_at: string;
    updated_at: string;
  }>;
}

/** POST response shape */
export interface RepresentationHistoryCreateResponse {
  representation_context: RepresentationContext;
  created_record_id: string;
  platform_event: string;
  idempotent?: boolean;
}
