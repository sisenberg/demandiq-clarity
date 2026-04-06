import { useState } from "react";
import { Settings, ChevronDown, ChevronRight, CheckCircle2, Clock, XCircle, CircleDot } from "lucide-react";
import type { DocumentRow } from "@/hooks/useDocuments";
import { isDocumentReady } from "@/lib/statuses";

interface ProcessingAccordionProps {
  workflow: any;
  documents: DocumentRow[];
  intakePkg: any;
}

const ProcessingAccordion = ({ workflow, documents, intakePkg }: ProcessingAccordionProps) => {
  const [open, setOpen] = useState(false);
  const completeDocs = documents.filter((d) => isDocumentReady(d.document_status)).length;

  return (
    <div className="border border-border/40 rounded-lg overflow-hidden bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-accent/20 transition-colors"
      >
        <Settings className="h-3 w-3 text-muted-foreground/60" />
        <span className="text-[11px] text-muted-foreground">Processing Details</span>
        <span className="ml-auto">
          {open ? <ChevronDown className="h-3 w-3 text-muted-foreground/40" /> : <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
        </span>
      </button>

      {open && (
        <div className="border-t border-border/30 p-4 flex flex-col gap-3">
          <div>
            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Pipeline Steps</span>
            <div className="mt-2 flex flex-col gap-1.5">
              {workflow.simplifiedSteps.map((step: any) => (
                <div key={step.label} className="flex items-center gap-2.5">
                  {step.status === "complete" && <CheckCircle2 className="h-3 w-3 text-[hsl(var(--status-approved))]" />}
                  {step.status === "active" && <Clock className="h-3 w-3 text-primary animate-pulse" />}
                  {step.status === "blocked" && <XCircle className="h-3 w-3 text-destructive" />}
                  {step.status === "pending" && <CircleDot className="h-3 w-3 text-muted-foreground" />}
                  <span className="text-[11px] text-foreground">{step.label}</span>
                  <span className={`text-[9px] font-medium ml-auto ${
                    step.status === "complete" ? "text-[hsl(var(--status-approved))]" :
                    step.status === "active" ? "text-primary" :
                    step.status === "blocked" ? "text-destructive" : "text-muted-foreground"
                  }`}>{step.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-border/30">
            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">OCR & Extraction</span>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground">Documents</p>
                <p className="text-[12px] font-semibold text-foreground">{completeDocs}/{documents.length}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Package</p>
                <p className="text-[12px] font-semibold text-foreground">{intakePkg?.package_status?.replace(/_/g, " ") ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Version</p>
                <p className="text-[12px] font-semibold text-foreground">v{intakePkg?.version ?? "—"}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessingAccordion;
