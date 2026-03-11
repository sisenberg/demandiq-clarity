import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DocumentPageRow } from "@/types/intake";

export function useDocumentPages(documentId: string | undefined) {
  return useQuery({
    queryKey: ["document-pages", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("document_pages") as any)
        .select("*")
        .eq("document_id", documentId!)
        .order("page_number", { ascending: true });
      if (error) throw error;
      return data as DocumentPageRow[];
    },
  });
}

export function useCaseDocumentPages(caseId: string | undefined) {
  return useQuery({
    queryKey: ["document-pages", "case", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("document_pages") as any)
        .select("*")
        .eq("case_id", caseId!)
        .order("document_id")
        .order("page_number", { ascending: true });
      if (error) throw error;
      return data as DocumentPageRow[];
    },
  });
}
