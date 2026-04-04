import { X, FileText, Upload } from "lucide-react";
import IntakeUploadZone from "./IntakeUploadZone";

interface UploadDemandDialogProps {
  open: boolean;
  caseId: string;
  onClose: () => void;
  onComplete: () => void;
}

const UploadDemandDialog = ({ open, caseId, onClose, onComplete }: UploadDemandDialogProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Upload Demand Package</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Upload the demand letter and supporting documents to begin intake
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          <IntakeUploadZone caseId={caseId} onUploadComplete={onComplete} />
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-medium rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadDemandDialog;
