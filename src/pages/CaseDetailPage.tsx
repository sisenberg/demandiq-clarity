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
  Calendar,
  MapPin,
  Hash,
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
    return <div className="p-8"><p className="text-sm text-muted-foreground">Loading…</p></div>;
  }

  if (!caseData) {
    return (
      <div className="p-8">
        <Link to="/cases" className="text-sm text-primary hover:underline flex items-center gap-1 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Cases
        </Link>
        <p className="text-sm text-muted-foreground">Case not found.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl">
      {/* Back */}
      <Link to="/cases" className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 mb-5 font-medium transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Cases
      </Link>

      {/* Case Header Card */}
      <div className="card-elevated px-6 py-5 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">
              {caseData.title || `${caseData.claimant} v. ${caseData.insured}`}
            </h1>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Hash className="h-3 w-3" /> {caseData.case_number}
              </span>
              {caseData.claim_number && (
                <span className="text-xs text-muted-foreground">Claim: {caseData.claim_number}</span>
              )}
              {caseData.date_of_loss && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" /> DOL: {caseData.date_of_loss}
                </span>
              )}
              {caseData.jurisdiction_state && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {caseData.jurisdiction_state}
                </span>
              )}
            </div>
          </div>
          <span className={CASE_STATUS_BADGE[caseData.case_status] ?? "status-badge-draft"}>
            {CASE_STATUS_LABEL[caseData.case_status] ?? caseData.case_status}
          </span>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
          {hasPermission(role, "upload_document") && (
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-accent transition-colors"
            >
              <Upload className="h-3.5 w-3.5" /> Upload Documents
            </button>
          )}
          {hasPermission(role, "trigger_processing") && documents.some((d) => d.document_status === "uploaded") && (
            <button
              onClick={() => triggerProcessing.mutate({ caseId: caseData.id })}
              disabled={triggerProcessing.isPending}
              className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
            >
              <Play className="h-3.5 w-3.5" /> Trigger Processing
            </button>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard icon={FileText} label="Documents" value={documents.length} />
        <StatCard icon={Cog} label="Jobs" value={jobs.length} />
        <StatCard
          icon={FileText}
          label="Pending Processing"
          value={documents.filter((d) => d.document_status === "uploaded").length}
        />
      </div>

      {/* Documents Card */}
      <div className="card-elevated overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Documents</h2>
          <span className="text-xs text-muted-foreground">({docsLoading ? "…" : documents.length})</span>
        </div>
        {documents.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="h-10 w-10 rounded-xl bg-accent mx-auto flex items-center justify-center mb-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left bg-muted/30">
                <th className="px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">File</th>
                <th className="px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Size</th>
                <th className="px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Pipeline</th>
                <th className="px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {documents.map((doc) => (
                <>
                  <tr
                    key={doc.id}
                    className="hover:bg-accent/30 transition-colors cursor-pointer"
                    onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                  >
                    <td className="px-5 py-3">
                      <Link
                        to={`/documents/${doc.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {doc.file_name}
                      </Link>
                    </td>
                    <td className="px-5 py-3"><DocumentTypeTag type={doc.document_type} /></td>
                    <td className="px-5 py-3 text-muted-foreground">{formatBytes(doc.file_size_bytes)}</td>
                    <td className="px-5 py-3">
                      <code className="text-[10px] bg-accent px-2 py-0.5 rounded-full text-muted-foreground font-medium">
                        {doc.pipeline_stage.replace(/_/g, " ")}
                      </code>
                    </td>
                    <td className="px-5 py-3">
                      <span className={DOC_STATUS_BADGE[doc.document_status] ?? "status-badge-draft"}>
                        {DOC_STATUS_LABEL[doc.document_status] ?? doc.document_status}
                      </span>
                    </td>
                  </tr>
                  {expandedDoc === doc.id && (
                    <tr key={`${doc.id}-pipeline`}>
                      <td colSpan={5} className="px-5 py-4 bg-muted/20">
                        <div className="max-w-xs">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Processing Pipeline</p>
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
      </div>

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
    <div className="card-elevated px-4 py-3.5">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-semibold text-card-foreground">{value}</p>
    </div>
  );
}

export default CaseDetailPage;
