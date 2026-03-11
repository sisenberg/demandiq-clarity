import type { JobRow } from "@/hooks/useJobs";
import { useRetryJob } from "@/hooks/useJobs";
import { Cog, RotateCcw } from "lucide-react";

const JOB_TYPE_LABEL: Record<string, string> = {
  ocr: "OCR",
  document_extraction: "Document Extraction",
  chronology_generation: "Chronology Generation",
  issue_flagging: "Issue Flagging",
  package_export: "Package Export",
  classification: "Classification",
};

const JOB_STATUS_BADGE: Record<string, string> = {
  queued: "status-badge-draft",
  running: "status-badge-processing",
  completed: "status-badge-approved",
  failed: "status-badge-failed",
};

interface JobsPanelProps {
  jobs: JobRow[];
  loading?: boolean;
}

const JobsPanel = ({ jobs, loading }: JobsPanelProps) => {
  const retryJob = useRetryJob();

  if (loading) {
    return (
      <div className="card-elevated p-5">
        <p className="text-xs text-muted-foreground">Loading jobs…</p>
      </div>
    );
  }

  return (
    <div className="card-elevated overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <Cog className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Jobs</h3>
        <span className="text-xs text-muted-foreground">({jobs.length})</span>
      </div>
      {jobs.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-xs text-muted-foreground">No jobs yet</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left bg-muted/30">
              <th className="px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
              <th className="px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Retries</th>
              <th className="px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Error</th>
              <th className="px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-accent/30 transition-colors">
                <td className="px-5 py-3">
                  <code className="text-[10px] bg-accent px-2 py-0.5 rounded-full text-muted-foreground font-medium">
                    {JOB_TYPE_LABEL[job.job_type] ?? job.job_type}
                  </code>
                </td>
                <td className="px-5 py-3">
                  <span className={JOB_STATUS_BADGE[job.job_status] ?? "status-badge-draft"}>
                    {job.job_status}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs text-muted-foreground">
                  {job.retry_count}/{job.max_retries}
                </td>
                <td className="px-5 py-3 text-xs text-destructive max-w-[200px] truncate">
                  {job.error_message ?? "—"}
                </td>
                <td className="px-5 py-3">
                  {job.job_status === "failed" && job.retry_count < job.max_retries && (
                    <button
                      onClick={() => retryJob.mutate(job.id)}
                      className="flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                    >
                      <RotateCcw className="h-3 w-3" /> Retry
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default JobsPanel;
