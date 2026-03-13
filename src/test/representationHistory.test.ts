import { describe, it, expect } from 'vitest';
import {
  deriveRepresentationSummary,
  ClaimantRepresentationHistoryRecord,
} from '@/types/representation';

const base: Omit<ClaimantRepresentationHistoryRecord, 'id' | 'representation_status' | 'event_type' | 'occurred_at' | 'attorney_name' | 'firm_name'> = {
  tenant_id: 't1',
  case_id: 'c1',
  claimant_id: 'cl1',
  source_party_id: null,
  recorded_at: '2024-01-01T00:00:00Z',
  notes: null,
  created_by_user_id: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

function rec(
  id: string,
  status: 'represented' | 'unrepresented' | 'unknown',
  eventType: ClaimantRepresentationHistoryRecord['event_type'],
  occurredAt: string,
  attorney?: string | null,
  firm?: string | null
): ClaimantRepresentationHistoryRecord {
  return { ...base, id, representation_status: status, event_type: eventType, occurred_at: occurredAt, attorney_name: attorney ?? null, firm_name: firm ?? null };
}

describe('deriveRepresentationSummary', () => {
  it('returns unknown for empty history', () => {
    const s = deriveRepresentationSummary([]);
    expect(s.representation_status_current).toBe('unknown');
    expect(s.representation_history_count).toBe(0);
  });

  it('marks unrepresented claimant', () => {
    const s = deriveRepresentationSummary([
      rec('1', 'unrepresented', 'representation_confirmed_unrepresented', '2024-03-01T00:00:00Z'),
    ]);
    expect(s.representation_status_current).toBe('unrepresented');
    expect(s.unrepresented_confirmed_at).toBe('2024-03-01T00:00:00Z');
    expect(s.representation_transition_flag).toBe(false);
  });

  it('detects transition from unrepresented to represented', () => {
    const s = deriveRepresentationSummary([
      rec('1', 'unrepresented', 'representation_confirmed_unrepresented', '2024-01-01T00:00:00Z'),
      rec('2', 'represented', 'attorney_retained', '2024-06-01T00:00:00Z', 'Jane Doe', 'Doe Law'),
    ]);
    expect(s.representation_status_current).toBe('represented');
    expect(s.represented_by_current_attorney_name).toBe('Jane Doe');
    expect(s.represented_by_current_firm_name).toBe('Doe Law');
    expect(s.representation_transition_flag).toBe(true);
    expect(s.attorney_retained_during_claim_flag).toBe(true);
  });

  it('handles attorney substitution', () => {
    const s = deriveRepresentationSummary([
      rec('1', 'represented', 'attorney_retained', '2024-01-01T00:00:00Z', 'A', 'Firm A'),
      rec('2', 'represented', 'attorney_substituted', '2024-06-01T00:00:00Z', 'B', 'Firm B'),
    ]);
    expect(s.represented_by_current_attorney_name).toBe('B');
    expect(s.represented_by_current_firm_name).toBe('Firm B');
    expect(s.representation_history_count).toBe(2);
  });

  it('detects attorney retained after initial offer', () => {
    const s = deriveRepresentationSummary(
      [
        rec('1', 'unrepresented', 'representation_confirmed_unrepresented', '2024-01-01T00:00:00Z'),
        rec('2', 'represented', 'attorney_retained', '2024-08-01T00:00:00Z', 'X', 'X Law'),
      ],
      { initialOfferDate: '2024-05-01T00:00:00Z' }
    );
    expect(s.attorney_retained_after_initial_offer_flag).toBe(true);
  });

  it('detects unrepresented resolved', () => {
    const s = deriveRepresentationSummary(
      [rec('1', 'unrepresented', 'representation_confirmed_unrepresented', '2024-01-01T00:00:00Z')],
      { claimResolved: true }
    );
    expect(s.unrepresented_resolved_flag).toBe(true);
  });

  it('handles attorney withdrawal back to unrepresented', () => {
    const s = deriveRepresentationSummary([
      rec('1', 'represented', 'attorney_retained', '2024-01-01T00:00:00Z', 'A', 'Firm A'),
      rec('2', 'unrepresented', 'attorney_withdrew', '2024-06-01T00:00:00Z'),
    ]);
    expect(s.representation_status_current).toBe('unrepresented');
    expect(s.represented_by_current_attorney_name).toBeNull();
    expect(s.representation_transition_flag).toBe(true);
  });
});
