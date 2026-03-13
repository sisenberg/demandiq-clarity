import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  ClaimantRepresentationHistoryRecord,
  ClaimantRepresentationSummary,
  RepresentationStatus,
  RepresentationEventType,
  deriveRepresentationSummary,
} from '@/types/representation';

// ─── Read: fetch full history for a claimant on a case ──────

export function useRepresentationHistory(caseId: string | undefined, claimantId: string | undefined) {
  return useQuery({
    queryKey: ['representation-history', caseId, claimantId],
    enabled: !!caseId && !!claimantId,
    queryFn: async (): Promise<ClaimantRepresentationHistoryRecord[]> => {
      const { data, error } = await supabase
        .from('claimant_representation_history')
        .select('*')
        .eq('case_id', caseId!)
        .eq('claimant_id', claimantId!)
        .order('occurred_at', { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as ClaimantRepresentationHistoryRecord[];
    },
  });
}

// ─── Read: derived summary ──────────────────────────────────

export function useRepresentationSummary(
  caseId: string | undefined,
  claimantId: string | undefined,
  options?: { initialOfferDate?: string | null; claimResolved?: boolean }
): { summary: ClaimantRepresentationSummary | null; isLoading: boolean } {
  const { data: history, isLoading } = useRepresentationHistory(caseId, claimantId);

  if (isLoading || !history) return { summary: null, isLoading };

  return {
    summary: deriveRepresentationSummary(history, options),
    isLoading: false,
  };
}

// ─── Write: append a representation event ───────────────────

interface AppendRepresentationEventInput {
  caseId: string;
  claimantId: string;
  representationStatus: RepresentationStatus;
  eventType: RepresentationEventType;
  attorneyName?: string | null;
  firmName?: string | null;
  sourcePartyId?: string | null;
  occurredAt?: string;
  notes?: string | null;
}

export function useAppendRepresentationEvent() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (input: AppendRepresentationEventInput) => {
      const tenantId = profile?.tenant_id;
      if (!tenantId) throw new Error('No tenant context');

      const record = {
        tenant_id: tenantId,
        case_id: input.caseId,
        claimant_id: input.claimantId,
        representation_status: input.representationStatus,
        event_type: input.eventType,
        attorney_name: input.attorneyName ?? null,
        firm_name: input.firmName ?? null,
        source_party_id: input.sourcePartyId ?? null,
        occurred_at: input.occurredAt ?? new Date().toISOString(),
        recorded_at: new Date().toISOString(),
        notes: input.notes ?? null,
        created_by_user_id: profile?.id ?? null,
      };

      const { data, error } = await supabase
        .from('claimant_representation_history')
        .insert(record as any)
        .select()
        .single();

      if (error) throw error;

      // Audit log the representation change
      await supabase.from('audit_events').insert({
        tenant_id: tenantId,
        case_id: input.caseId,
        actor_user_id: profile?.id ?? '00000000-0000-0000-0000-000000000000',
        entity_type: 'claimant_representation_history',
        entity_id: (data as any).id,
        action_type: 'created',
        after_value: record as any,
      } as any);

      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['representation-history', variables.caseId, variables.claimantId],
      });
    },
  });
}
