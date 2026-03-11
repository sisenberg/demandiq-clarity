import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { IntakeJobRow, IntakeJobType } from "@/types/intake";

export function useCaseIntakeJobs(caseId: string | undefined) {
  return useQuery({
    queryKey: ["intake-jobs", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("intake_jobs") as any)
        .select("*")
        .eq("case_id", caseId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as IntakeJobRow[];
    },
  });
}

export function useDocumentIntakeJobs(documentId: string | undefined) {
  return useQuery({
    queryKey: ["intake-jobs", "document", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("intake_jobs") as any)
        .select("*")
        .eq("document_id", documentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as IntakeJobRow[];
    },
  });
}

export function useCreateIntakeJob() {
  const queryClient = useQueryClient();
  const { tenantId } = useAuth();

  return useMutation({
    mutationFn: async ({
      caseId,
      documentId,
      jobType,
    }: {
      caseId: string;
      documentId?: string;
      jobType: IntakeJobType;
    }) => {
      if (!tenantId) throw new Error("Not authenticated");
      const { data, error } = await (supabase.from("intake_jobs") as any)
        .insert({
          tenant_id: tenantId,
          case_id: caseId,
          document_id: documentId || null,
          job_type: jobType,
          status: "queued",
        })
        .select()
        .single();
      if (error) throw error;
      return data as IntakeJobRow;
    },
    onSuccess: (_, { caseId }) => {
      queryClient.invalidateQueries({ queryKey: ["intake-jobs", caseId] });
      toast.success("Intake job queued");
    },
    onError: (err) => {
      toast.error(`Failed to create intake job: ${(err as Error).message}`);
    },
  });
}

export function useRetryIntakeJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await (supabase.from("intake_jobs") as any)
        .update({
          status: "queued",
          error_message: null,
          started_at: null,
          completed_at: null,
        })
        .eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intake-jobs"] });
      toast.success("Intake job queued for retry");
    },
  });
}
