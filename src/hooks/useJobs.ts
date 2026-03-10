import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface JobRow {
  id: string;
  tenant_id: string;
  case_id: string;
  document_id: string | null;
  job_type: string;
  job_status: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  created_at: string;
}

export function useCaseJobs(caseId: string | undefined) {
  return useQuery({
    queryKey: ["jobs", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("jobs") as any)
        .select("*")
        .eq("case_id", caseId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as JobRow[];
    },
  });
}

export function useDocumentJobs(docId: string | undefined) {
  return useQuery({
    queryKey: ["jobs", "document", docId],
    enabled: !!docId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("jobs") as any)
        .select("*")
        .eq("document_id", docId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as JobRow[];
    },
  });
}

export function useTriggerProcessing() {
  const queryClient = useQueryClient();
  const { tenantId, user } = useAuth();

  return useMutation({
    mutationFn: async ({ caseId, documentId }: { caseId: string; documentId?: string }) => {
      if (!tenantId || !user) throw new Error("Not authenticated");

      const jobTypes = ["ocr", "document_extraction", "classification"] as const;
      const jobs = jobTypes.map((jt) => ({
        tenant_id: tenantId,
        case_id: caseId,
        document_id: documentId || null,
        job_type: jt,
        job_status: "queued",
      }));

      const { data, error } = await (supabase.from("jobs") as any).insert(jobs).select();
      if (error) throw error;

      // Simulate: mark first job as running after a brief delay
      if (data && data.length > 0) {
        setTimeout(async () => {
          await (supabase.from("jobs") as any)
            .update({ job_status: "running", started_at: new Date().toISOString() })
            .eq("id", data[0].id);
          queryClient.invalidateQueries({ queryKey: ["jobs"] });
        }, 1000);
      }

      return data as JobRow[];
    },
    onSuccess: (_, { caseId }) => {
      queryClient.invalidateQueries({ queryKey: ["jobs", caseId] });
      toast.success("Processing triggered");
    },
    onError: (err) => {
      toast.error(`Failed to trigger processing: ${err.message}`);
    },
  });
}

export function useRetryJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await (supabase.from("jobs") as any)
        .update({
          job_status: "queued",
          error_message: null,
          started_at: null,
          completed_at: null,
        })
        .eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Job queued for retry");
    },
  });
}
