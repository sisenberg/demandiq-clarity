import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useCase } from "@/hooks/useCases";
import { useCaseDocuments, type DocumentRow } from "@/hooks/useDocuments";
import { useCaseJobs } from "@/hooks/useJobs";
import { useTriggerProcessing } from "@/hooks/useJobs";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import DocumentUpload from "@/components/case/DocumentUpload";
import JobsPanel from "@/components/case/JobsPanel";
import ProcessingPipeline from "@/components/case/ProcessingPipeline";
import DocumentTypeTag from "@/components/case/DocumentTypeTag";
import {
  ArrowLeft,
  FileText,
  Cog,
  Play,
  Upload,
} from "lucide-react";

const CASE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  intake_in_progress: "Intake In Progress",
  intake_complete: "Intake Complete",
  processing_in_progress: "Processing",
  complete: "Complete",
  exported: "Exported",
  closed: "Closed",
  failed: "Failed",
};

const CASE_STATUS_BADGE: Record<string, string> = {
  draft: "status-badge-draft",
  intake_in_progress: "status-badge-processing",
  intake_complete: "status-badge-approved",
  processing_in_progress: "status-badge-processing",
  complete: "status-badge-approved",
  exported: "status-badge-draft",
  closed: "status-badge-draft",
  failed: "status-badge-failed",
};

const DOC_STATUS_BADGE: Record<string, string> = {
  uploaded: "status-badge-draft",
  queued: "status-badge-draft",
  ocr_in_progress: "status-badge-processing",
  classified: "status-badge-processing",
  extracted: "status-badge-approved",
  needs_attention: "status-badge-attention",
  complete: "status-badge-approved",
  failed: "status-badge-failed",
};

const DOC_STATUS_LABEL: Record<string, string> = {
  uploaded: "Uploaded",
  queued: "Queued",
  ocr_in_progress: "OCR In Progress",
  classified: "Classified",
  extracted: "Extracted",
  needs_attention: "Needs Attention",
  complete: "Complete",
  failed: "Failed",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CaseDetailPage = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const { role } = useAuth();
  const { data: caseData, isLoading: caseLoading } = useCase(caseId);
  const { data: documents = [], isLoading: docsLoading } = useCaseDocuments(caseId);
  const { data: jobs = [], isLoading: jobsLoading } = useCaseJobs(caseId);
  const triggerProcessing = useTriggerProcessing();
  const [showUpload, setShowUpload] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  if (caseLoading) {
    return <div className="p-6"><p className="text-sm text-muted-foreground">Loading…</p></div>;
  }

  if (!caseData) {
    return (
      <div className="p-6">
        <Link to="/cases" className="text-sm text-primary hover:underline flex items-center gap-1 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Cases
        </Link>
        <p className="text-sm text-muted-foreground">Case not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <Link to="/cases" className="text-sm text-primary hover:underline flex items-center gap-1 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Cases
      </Link>

      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {caseData.title || `${caseData.claimant} v. ${caseData.insured}`}
          </h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            <span>{caseData.case_number}</span>
            {caseData.claim_number && <><span>·</span><span>Claim: {caseData.claim_number}</span></>}
            {caseData.date_of_loss && <><span>·</span><span>DOL: {caseData.date_of_loss}</span></>}
            <span>·</span>
            <span>{caseData.claimant} v. {caseData.insured}</span>
            {caseData.jurisdiction_state && <><span>·</span><span>{caseData.jurisdiction_state}</span></>}
          </div>
        </div>
        <span className={CASE_STATUS_BADGE[caseData.case_status] ?? "status-badge-draft"}>
          {CASE_STATUS_LABEL[caseData.case_status] ?? caseData.case_status}
        </span>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap gap-2 mb-6">
        {hasPermission(role, "upload_document") && (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-border bg-card text-foreground hover:bg-accent transition-colors"
          >
            <Upload className="h-3.5 w-3.5" /> Upload Documents
          </button>
        )}
        {hasPermission(role, "trigger_processing") && documents.some((d) => d.document_status === "uploaded") && (
          <button
            onClick={() => triggerProcessing.mutate({ caseId: caseData.id })}
            disabled={triggerProcessing.isPending}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" /> Trigger Processing
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        <StatCard icon={FileText} label="Documents" value={documents.length} />
        <StatCard icon={Cog} label="Jobs" value={jobs.length} />
        <StatCard
          icon={FileText}
          label="Pending Processing"
          value={documents.filter((d) => d.document_status === "uploaded").length}
        />
      </div>

      {/* Documents */}
      <Section title="Documents" count={documents.length} loading={docsLoading}>
        {documents.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">File</th>
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Size</th>
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Pipeline</th>
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {documents.map((doc) => (
                <>
                  <tr
                    key={doc.id}
                    className="hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        to={`/documents/${doc.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {doc.file_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5"><DocumentTypeTag type={doc.document_type} /></td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatBytes(doc.file_size_bytes)}</td>
                    <td className="px-4 py-2.5">
                      <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-foreground">
                        {doc.pipeline_stage.replace(/_/g, " ")}
                      </code>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={DOC_STATUS_BADGE[doc.document_status] ?? "status-badge-draft"}>
                        {DOC_STATUS_LABEL[doc.document_status] ?? doc.document_status}
                      </span>
                    </td>
                  </tr>
                  {expandedDoc === doc.id && (
                    <tr key={`${doc.id}-pipeline`}>
                      <td colSpan={5} className="px-4 py-3 bg-muted/30">
                        <div className="max-w-xs">
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Processing Pipeline</p>
                          <ProcessingPipeline currentStage={doc.pipeline_stage} documentStatus={doc.document_status} />
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Jobs */}
      <div className="mb-8">
        <JobsPanel jobs={jobs} loading={jobsLoading} />
      </div>

      <DocumentUpload caseId={caseData.id} open={showUpload} onClose={() => setShowUpload(false)} />
    </div>
  );
};

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="border border-border rounded-lg px-3 py-3 bg-card">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-semibold text-card-foreground">{value}</p>
    </div>
  );
}

function Section({ title, count, loading, children }: { title: string; count: number; loading?: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        {title}
        <span className="text-xs font-normal text-muted-foreground">({loading ? "…" : count})</span>
      </h2>
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {children}
      </div>
    </div>
  );
}

export default CaseDetailPage;
