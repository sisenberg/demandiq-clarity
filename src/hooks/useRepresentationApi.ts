import { useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import type {
  RepresentationHistoryResponse,
  RepresentationHistoryCreateResponse,
  RepresentationPlatformEventPayload,
} from '@/types/representation-events';
import { REPRESENTATION_EVENTS } from '@/types/representation-events';

/**
 * Invoke the representation-history edge function (GET).
 */
export function useRepresentationHistoryApi() {
  const fetchHistory = useCallback(
    async (caseId: string, claimantId: string): Promise<RepresentationHistoryResponse> => {
      const { data, error } = await supabase.functions.invoke('representation-history', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: undefined,
        // Query params passed via custom header workaround — edge function reads URL params
      });

      // Since supabase.functions.invoke doesn't support query params natively,
      // we construct the URL manually
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const session = (await supabase.auth.getSession()).data.session;

      const url = `${supabaseUrl}/functions/v1/representation-history?case_id=${encodeURIComponent(caseId)}&claimant_id=${encodeURIComponent(claimantId)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
        },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      return response.json();
    },
    []
  );

  return { fetchHistory };
}

/**
 * Invoke the representation-history edge function (POST).
 */
export function useRepresentationHistoryMutationApi() {
  const appendEvent = useCallback(
    async (
      caseId: string,
      claimantId: string,
      payload: {
        event_type: string;
        representation_status: string;
        attorney_name?: string | null;
        firm_name?: string | null;
        occurred_at?: string;
        notes?: string | null;
        source_party_id?: string | null;
      },
      idempotencyKey?: string
    ): Promise<RepresentationHistoryCreateResponse> => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const session = (await supabase.auth.getSession()).data.session;

      const url = `${supabaseUrl}/functions/v1/representation-history?case_id=${encodeURIComponent(caseId)}&claimant_id=${encodeURIComponent(claimantId)}`;

      const headers: Record<string, string> = {
        Authorization: `Bearer ${session?.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
        'Content-Type': 'application/json',
      };
      if (idempotencyKey) {
        headers['x-idempotency-key'] = idempotencyKey;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      return response.json();
    },
    []
  );

  return { appendEvent };
}

/**
 * Subscribe to real-time representation platform events for the tenant.
 * Automatically invalidates representation-history queries when events arrive.
 */
export function useRepresentationEventSubscription() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = profile?.tenant_id;

  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase.channel(`representation-events-${tenantId}`);

    const allEvents = Object.values(REPRESENTATION_EVENTS);
    for (const eventName of allEvents) {
      channel.on('broadcast', { event: eventName }, (payload) => {
        const data = payload.payload as RepresentationPlatformEventPayload;
        // Invalidate the specific claimant's history cache
        queryClient.invalidateQueries({
          queryKey: ['representation-history', data.case_id, data.claimant_id],
        });
      });
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);
}
