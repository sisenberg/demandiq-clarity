/**
 * NegotiateIQ — Draft persistence hooks
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { logNegotiationEvent } from "@/hooks/useNegotiateSession";

const T = (name: string) => supabase.from(name as any) as any;

export interface DraftVersionRow {
  id: string;
  session_id: string;
  case_id: string;
  tenant_id: string;
  draft_type: string;
  title: string;
  external_content: string;
  internal_notes: string;
  tone: string;
  version: number;
  is_final: boolean;
  context_snippets: unknown[];
  engine_version: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useNegotiateDrafts(sessionId: string | undefined) {
  return useQuery<DraftVersionRow[]>({
    queryKey: ["negotiate-drafts", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await T("negotiate_draft_versions")
        .select("*")
        .eq("session_id", sessionId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DraftVersionRow[];
    },
  });
}

export function useSaveNegotiateDraft() {
  const qc = useQueryClient();
  const { user, tenantId } = useAuth();

  return useMutation({
    mutationFn: async ({
      sessionId,
      caseId,
      draftType,
      title,
      externalContent,
      internalNotes,
      tone,
      contextSnippets,
      engineVersion,
      isFinal,
    }: {
      sessionId: string;
      caseId: string;
      draftType: string;
      title: string;
      externalContent: string;
      internalNotes: string;
      tone: string;
      contextSnippets: unknown[];
      engineVersion: string;
      isFinal?: boolean;
    }) => {
      if (!user || !tenantId) throw new Error("Not authenticated");

      // Get next version
      const { data: existing } = await T("negotiate_draft_versions")
        .select("version")
        .eq("session_id", sessionId)
        .eq("draft_type", draftType)
        .order("version", { ascending: false })
        .limit(1);

      const nextVersion = (existing?.[0]?.version ?? 0) + 1;

      const { data, error } = await T("negotiate_draft_versions")
        .insert({
          session_id: sessionId,
          case_id: caseId,
          tenant_id: tenantId,
          draft_type: draftType,
          title,
          external_content: externalContent,
          internal_notes: internalNotes,
          tone,
          version: nextVersion,
          is_final: isFinal ?? false,
          context_snippets: contextSnippets,
          engine_version: engineVersion,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error) throw error;

      await logNegotiationEvent({
        sessionId,
        caseId,
        tenantId,
        actorId: user.id,
        eventType: "draft_generated",
        summary: `${isFinal ? "Final draft" : "Draft"} saved: ${title} v${nextVersion}`,
        afterValue: { draft_type: draftType, version: nextVersion, is_final: isFinal ?? false },
      });

      return data as { id: string };
    },
    onSuccess: (_, { sessionId }) => {
      qc.invalidateQueries({ queryKey: ["negotiate-drafts", sessionId] });
      qc.invalidateQueries({ queryKey: ["negotiate-events", sessionId] });
      toast.success("Draft saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
