import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ExtractedFactRow } from "@/types/intake";

export function useCaseExtractedFacts(caseId: string | undefined) {
  return useQuery({
    queryKey: ["extracted-facts", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("extracted_facts") as any)
        .select("*")
        .eq("case_id", caseId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ExtractedFactRow[];
    },
  });
}

export function useDocumentExtractedFacts(documentId: string | undefined) {
  return useQuery({
    queryKey: ["extracted-facts", "document", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("extracted_facts") as any)
        .select("*")
        .eq("document_id", documentId!)
        .order("page_number", { ascending: true });
      if (error) throw error;
      return data as ExtractedFactRow[];
    },
  });
}
