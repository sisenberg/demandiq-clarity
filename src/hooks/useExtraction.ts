import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Invokes the process-document edge function for a given intake job.
 * This triggers the OCR/text-extraction pipeline asynchronously.
 */
export function useInvokeExtraction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const { data, error } = await supabase.functions.invoke("process-document", {
        body: { job_id: jobId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["intake-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["case-documents"] });
      queryClient.invalidateQueries({ queryKey: ["document-pages"] });
      if (data?.pages_extracted > 0) {
        toast.success(`Extracted ${data.pages_extracted} page(s) via ${data.extraction_method}`);
      }
    },
    onError: (err) => {
      toast.error(`Extraction failed: ${(err as Error).message}`);
    },
  });
}

/**
 * Fires extraction for all queued text_extraction jobs for a given case.
 */
export function useTriggerCaseExtraction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (caseId: string) => {
      // Get all queued text_extraction jobs for this case
      const { data: jobs, error } = await (supabase.from("intake_jobs") as any)
        .select("id")
        .eq("case_id", caseId)
        .eq("job_type", "text_extraction")
        .eq("status", "queued");

      if (error) throw error;
      if (!jobs || jobs.length === 0) {
        toast.info("No queued extraction jobs found");
        return [];
      }

      // Invoke extraction for each job (fire-and-forget pattern)
      const results = await Promise.allSettled(
        jobs.map((job: { id: string }) =>
          supabase.functions.invoke("process-document", {
            body: { job_id: job.id },
          })
        )
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      return { succeeded, failed, total: jobs.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["intake-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["case-documents"] });
      queryClient.invalidateQueries({ queryKey: ["document-pages"] });
      if (result && typeof result === "object" && "succeeded" in result) {
        toast.success(`Triggered extraction for ${result.succeeded}/${result.total} document(s)`);
      }
    },
    onError: (err) => {
      toast.error(`Failed to trigger extraction: ${(err as Error).message}`);
    },
  });
}
