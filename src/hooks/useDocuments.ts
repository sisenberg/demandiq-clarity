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
  intake_status: string;
  file_hash: string | null;
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
      const { data, error } = await (supabase
        .from("case_documents") as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DocumentRow[];
    },
  });
}

/** Compute SHA-256 hash of a file as hex string */
async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface UploadFileProgress {
  file: File;
  status: "pending" | "uploading" | "creating_record" | "done" | "error";
  progress: number; // 0-100
  error?: string;
  documentId?: string;
  hash?: string;
}

export function useUploadDocuments() {
  const queryClient = useQueryClient();
  const { tenantId, user } = useAuth();

  return useMutation({
    mutationFn: async ({
      caseId,
      files,
      documentType,
      onFileProgress,
    }: {
      caseId: string;
      files: File[];
      documentType: string;
      onFileProgress?: (fileIndex: number, update: Partial<UploadFileProgress>) => void;
    }) => {
      if (!tenantId || !user) throw new Error("Not authenticated");
      const results: DocumentRow[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          // Hash
          onFileProgress?.(i, { status: "uploading", progress: 10 });
          const hash = await computeFileHash(file);
          onFileProgress?.(i, { progress: 30, hash });

          // Upload to storage
          const storagePath = `${tenantId}/${caseId}/${crypto.randomUUID()}_${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("case-documents")
            .upload(storagePath, file);
          if (uploadError) throw uploadError;
          onFileProgress?.(i, { progress: 70, status: "creating_record" });

          // Create document record with hash
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
              intake_status: "uploaded",
              file_hash: hash,
              uploaded_by: user.id,
            })
            .select()
            .single();
          if (error) throw error;

          onFileProgress?.(i, { status: "done", progress: 100, documentId: data.id });
          results.push(data as DocumentRow);

          // Auto-enqueue intake jobs for this document
          const { data: createdJobs } = await (supabase.from("intake_jobs") as any).insert([
            { tenant_id: tenantId, case_id: caseId, document_id: data.id, job_type: "text_extraction", status: "queued" },
            { tenant_id: tenantId, case_id: caseId, document_id: data.id, job_type: "duplicate_detection", status: "queued" },
          ]).select();

          // Fire-and-forget: invoke extraction for the text_extraction job
          if (createdJobs) {
            const textJob = createdJobs.find((j: any) => j.job_type === "text_extraction");
            if (textJob) {
              supabase.functions.invoke("process-document", {
                body: { job_id: textJob.id },
              }).catch((err) => console.warn("Auto-extraction invocation failed:", err));
            }
          }
        } catch (err: any) {
          onFileProgress?.(i, { status: "error", error: err.message, progress: 0 });
        }
      }
      return results;
    },
    onSuccess: (_, { caseId }) => {
      queryClient.invalidateQueries({ queryKey: ["case-documents", caseId] });
      queryClient.invalidateQueries({ queryKey: ["case-documents", "all"] });
      queryClient.invalidateQueries({ queryKey: ["intake-jobs", caseId] });
    },
    onError: (err) => {
      toast.error(`Upload failed: ${(err as Error).message}`);
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ docId, storagePath }: { docId: string; storagePath: string | null }) => {
      // Delete from storage first if path exists
      if (storagePath) {
        await supabase.storage.from("case-documents").remove([storagePath]);
      }
      const { error } = await (supabase.from("case_documents") as any)
        .delete()
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case-documents"] });
      toast.success("Document removed");
    },
    onError: (err) => {
      toast.error(`Delete failed: ${(err as Error).message}`);
    },
  });
}

export function useUpdateDocumentType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ docId, documentType }: { docId: string; documentType: string }) => {
      const { error } = await (supabase
        .from("case_documents") as any)
        .update({ document_type: documentType })
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case-documents"] });
    },
  });
}
