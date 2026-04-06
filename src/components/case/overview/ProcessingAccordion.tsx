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
    <div className="border border-border/30 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3.5 py-2 flex items-center gap-1.5 hover:bg-accent/10 transition-colors"
      >
        <Settings className="h-2.5 w-2.5 text-muted-foreground/40" />
        <span className="text-[10px] text-muted-foreground/50">Processing Details</span>
        <span className="ml-auto">
          {open ? <ChevronDown className="h-2.5 w-2.5 text-muted-foreground/30" /> : <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/30" />}
        </span>
      </button>

      {open && (
        <div className="border-t border-border/20 px-3.5 py-3 flex flex-col gap-3">
          <div>
            <span className="text-[9px] font-medium text-muted-foreground/50 uppercase tracking-widest">Pipeline</span>
            <div className="mt-1.5 flex flex-col gap-1">
              {workflow.simplifiedSteps.map((step: any) => (
                <div key={step.label} className="flex items-center gap-2">
                  {step.status === "complete" && <CheckCircle2 className="h-2.5 w-2.5 text-[hsl(var(--status-approved))]/70" />}
                  {step.status === "active" && <Clock className="h-2.5 w-2.5 text-primary animate-pulse" />}
                  {step.status === "blocked" && <XCircle className="h-2.5 w-2.5 text-destructive" />}
                  {step.status === "pending" && <CircleDot className="h-2.5 w-2.5 text-muted-foreground/40" />}
                  <span className="text-[10px] text-foreground/70">{step.label}</span>
                  <span className={`text-[9px] ml-auto ${
                    step.status === "complete" ? "text-[hsl(var(--status-approved))]/60" :
                    step.status === "active" ? "text-primary/60" :
                    step.status === "blocked" ? "text-destructive/60" : "text-muted-foreground/30"
                  }`}>{step.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-border/15">
            <span className="text-[9px] font-medium text-muted-foreground/50 uppercase tracking-widest">Extraction</span>
            <div className="mt-1.5 grid grid-cols-3 gap-3">
              <div>
                <p className="text-[9px] text-muted-foreground/50">Documents</p>
                <p className="text-[11px] font-medium text-foreground/70">{completeDocs}/{documents.length}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground/50">Package</p>
                <p className="text-[11px] font-medium text-foreground/70">{intakePkg?.package_status?.replace(/_/g, " ") ?? "—"}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground/50">Version</p>
                <p className="text-[11px] font-medium text-foreground/70">v{intakePkg?.version ?? "—"}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessingAccordion;
