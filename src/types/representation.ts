// ─── Claimant Representation History ─────────────────
// Shared, append-only representation state tracking.
// Consumed by EvaluateIQ, NegotiateIQ, LitIQ, and analytics.

export type RepresentationStatus = 'represented' | 'unrepresented' | 'unknown';

export type RepresentationEventType =
  | 'representation_status_recorded'
  | 'representation_confirmed_unrepresented'
  | 'attorney_retained'
  | 'attorney_substituted'
  | 'attorney_withdrew';

/** A single append-only representation history entry */
export interface ClaimantRepresentationHistoryRecord {
  id: string;
  tenant_id: string;
  case_id: string;
  claimant_id: string;
  representation_status: RepresentationStatus;
  event_type: RepresentationEventType;
  attorney_name: string | null;
  firm_name: string | null;
  source_party_id: string | null;
  occurred_at: string;
  recorded_at: string;
  notes: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Derived representation summary for a claimant on a case */
export interface ClaimantRepresentationSummary {
  /** Current status derived from latest history record */
  representation_status_current: RepresentationStatus;
  /** Current attorney name (null if unrepresented/unknown) */
  represented_by_current_attorney_name: string | null;
  /** Current firm name (null if unrepresented/unknown) */
  represented_by_current_firm_name: string | null;
  /** True if claimant has transitioned between represented/unrepresented */
  representation_transition_flag: boolean;
  /** Total number of history records */
  representation_history_count: number;
  /** Timestamp when first marked represented (null if never) */
  represented_at: string | null;
  /** Timestamp when confirmed unrepresented (null if never) */
  unrepresented_confirmed_at: string | null;
  /** True if attorney was retained at any point during the claim */
  attorney_retained_during_claim_flag: boolean;
  /** True if attorney was retained after an initial offer was made — requires offer context */
  attorney_retained_after_initial_offer_flag: boolean;
  /** True if claim resolved while claimant was unrepresented */
  unrepresented_resolved_flag: boolean;
}

/**
 * Compute derived representation summary from an ordered history array.
 * History MUST be sorted by occurred_at ASC (oldest first).
 */
export function deriveRepresentationSummary(
  history: ClaimantRepresentationHistoryRecord[],
  options?: {
    /** Was an initial offer made before any attorney_retained event? */
    initialOfferDate?: string | null;
    /** Has the claim been resolved/closed? */
    claimResolved?: boolean;
  }
): ClaimantRepresentationSummary {
  const empty: ClaimantRepresentationSummary = {
    representation_status_current: 'unknown',
    represented_by_current_attorney_name: null,
    represented_by_current_firm_name: null,
    representation_transition_flag: false,
    representation_history_count: 0,
    represented_at: null,
    unrepresented_confirmed_at: null,
    attorney_retained_during_claim_flag: false,
    attorney_retained_after_initial_offer_flag: false,
    unrepresented_resolved_flag: false,
  };

  if (!history || history.length === 0) return empty;

  const sorted = [...history].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );

  const latest = sorted[sorted.length - 1];

  // Track unique statuses seen for transition detection
  const statusesSeen = new Set<RepresentationStatus>();
  let representedAt: string | null = null;
  let unrepresentedConfirmedAt: string | null = null;
  let attorneyRetainedDuringClaim = false;
  let attorneyRetainedAfterOffer = false;

  for (const record of sorted) {
    statusesSeen.add(record.representation_status);

    if (record.representation_status === 'represented' && !representedAt) {
      representedAt = record.occurred_at;
    }

    if (record.event_type === 'representation_confirmed_unrepresented' && !unrepresentedConfirmedAt) {
      unrepresentedConfirmedAt = record.occurred_at;
    }

    if (record.event_type === 'attorney_retained') {
      attorneyRetainedDuringClaim = true;
      if (
        options?.initialOfferDate &&
        new Date(record.occurred_at) > new Date(options.initialOfferDate)
      ) {
        attorneyRetainedAfterOffer = true;
      }
    }
  }

  // Transition flag: saw both represented AND unrepresented (not just unknown)
  const transitionFlag =
    statusesSeen.has('represented') && statusesSeen.has('unrepresented');

  // Unrepresented resolved: claim closed while current status is unrepresented
  const unrepresentedResolved =
    !!options?.claimResolved && latest.representation_status === 'unrepresented';

  return {
    representation_status_current: latest.representation_status,
    represented_by_current_attorney_name:
      latest.representation_status === 'represented' ? latest.attorney_name : null,
    represented_by_current_firm_name:
      latest.representation_status === 'represented' ? latest.firm_name : null,
    representation_transition_flag: transitionFlag,
    representation_history_count: sorted.length,
    represented_at: representedAt,
    unrepresented_confirmed_at: unrepresentedConfirmedAt,
    attorney_retained_during_claim_flag: attorneyRetainedDuringClaim,
    attorney_retained_after_initial_offer_flag: attorneyRetainedAfterOffer,
    unrepresented_resolved_flag: unrepresentedResolved,
  };
}
