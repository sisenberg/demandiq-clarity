import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface DocumentRow {
  id: string;
  tenant_id: string;
  case_id: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  storage_path: string | null;
  page_count: number | null;
  document_status: string;
  document_type: string;
  pipeline_stage: string;
  extracted_text: string | null;
  uploaded_by: string;
  extracted_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useCaseDocuments(caseId: string | undefined) {
  return useQuery({
    queryKey: ["case-documents", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("case_documents") as any)
        .select("*")
        .eq("case_id", caseId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DocumentRow[];
    },
  });
}

export function useDocument(docId: string | undefined) {
  return useQuery({
    queryKey: ["case-documents", "detail", docId],
    enabled: !!docId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("case_documents") as any)
        .select("*")
        .eq("id", docId!)
        .single();
      if (error) throw error;
      return data as DocumentRow;
    },
  });
}

export function useAllDocuments() {
  return useQuery({
    queryKey: ["case-documents", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DocumentRow[];
    },
  });
}

export function useUploadDocuments() {
  const queryClient = useQueryClient();
  const { tenantId, user } = useAuth();

  return useMutation({
    mutationFn: async ({ caseId, files, documentType }: { caseId: string; files: File[]; documentType: string }) => {
      if (!tenantId || !user) throw new Error("Not authenticated");
      const results: DocumentRow[] = [];

      for (const file of files) {
        // Upload to storage
        const storagePath = `${tenantId}/${caseId}/${crypto.randomUUID()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("case-documents")
          .upload(storagePath, file);
        if (uploadError) throw uploadError;

        // Create document record
        const { data, error } = await (supabase
          .from("case_documents") as any)
          .insert({
            case_id: caseId,
            file_name: file.name,
            file_type: file.type || "application/octet-stream",
            file_size_bytes: file.size,
            storage_path: storagePath,
            document_status: "uploaded",
            document_type: documentType,
            pipeline_stage: "upload_received",
            uploaded_by: user.id,
          })
          .select()
          .single();
        if (error) throw error;
        results.push(data as DocumentRow);
      }
      return results;
    },
    onSuccess: (_, { caseId }) => {
      queryClient.invalidateQueries({ queryKey: ["case-documents", caseId] });
      queryClient.invalidateQueries({ queryKey: ["case-documents", "all"] });
      toast.success("Documents uploaded");
    },
    onError: (err) => {
      toast.error(`Upload failed: ${err.message}`);
    },
  });
}

export function useUpdateDocumentType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ docId, documentType }: { docId: string; documentType: string }) => {
      const { error } = await supabase
        .from("case_documents")
        .update({ document_type: documentType as any })
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case-documents"] });
    },
  });
}
