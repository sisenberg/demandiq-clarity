import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FactEvidenceLinkRow } from "@/types/intake";

export function useFactEvidenceLinks(factId: string | undefined) {
  return useQuery({
    queryKey: ["fact-evidence-links", factId],
    enabled: !!factId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("fact_evidence_links") as any)
        .select("*")
        .eq("fact_id", factId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as FactEvidenceLinkRow[];
    },
  });
}

export function useCaseFactEvidenceLinks(caseId: string | undefined) {
  return useQuery({
    queryKey: ["fact-evidence-links", "case", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("fact_evidence_links") as any)
        .select("*")
        .eq("case_id", caseId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as FactEvidenceLinkRow[];
    },
  });
}
