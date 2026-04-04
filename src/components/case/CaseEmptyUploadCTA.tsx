import { useState } from "react";
import { Upload, FileText, ArrowRight } from "lucide-react";
import IntakeUploadZone from "./IntakeUploadZone";

interface CaseEmptyUploadCTAProps {
  caseId: string;
  onUploadComplete?: () => void;
}

const CaseEmptyUploadCTA = ({ caseId, onUploadComplete }: CaseEmptyUploadCTAProps) => {
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="card-elevated overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <Upload className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Upload Demand Package</h2>
      </div>

      <div className="p-5">
        {!showUpload ? (
          <div className="flex flex-col items-center text-center py-8">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <FileText className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1.5">
              No documents uploaded yet
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed mb-5">
              Upload a demand letter, medical records, billing statements, or other case documents to begin automated intake and extraction.
            </p>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 text-xs font-semibold px-5 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload Documents
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <IntakeUploadZone caseId={caseId} onUploadComplete={onUploadComplete} />
        )}
      </div>
    </div>
  );
};

export default CaseEmptyUploadCTA;
