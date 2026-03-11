import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DuplicateDocumentFlagRow, DuplicateFlagStatus } from "@/types/intake";

export function useCaseDuplicateFlags(caseId: string | undefined) {
  return useQuery({
    queryKey: ["duplicate-flags", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("duplicate_document_flags") as any)
        .select("*")
        .eq("case_id", caseId!)
        .order("flagged_at", { ascending: false });
      if (error) throw error;
      return data as DuplicateDocumentFlagRow[];
    },
  });
}

export function useResolveDuplicateFlag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      flagId,
      status,
      resolvedBy,
    }: {
      flagId: string;
      status: DuplicateFlagStatus;
      resolvedBy: string;
    }) => {
      const { error } = await (supabase.from("duplicate_document_flags") as any)
        .update({
          flag_status: status,
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedBy,
        })
        .eq("id", flagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["duplicate-flags"] });
      toast.success("Duplicate flag resolved");
    },
  });
}
