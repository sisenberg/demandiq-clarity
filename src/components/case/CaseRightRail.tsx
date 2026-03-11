import { useState } from "react";
import type { CaseRow } from "@/hooks/useCases";
import type { DocumentRow } from "@/hooks/useDocuments";
import { MessageSquare, Sparkles, FileText, AlertTriangle, Send } from "lucide-react";

interface CaseRightRailProps {
  caseData: CaseRow;
  documents: DocumentRow[];
}

const CaseRightRail = ({ caseData, documents }: CaseRightRailProps) => {
  const [activeTab, setActiveTab] = useState<"summary" | "chat" | "flags">("summary");

  const tabs = [
    { key: "summary" as const, label: "AI Summary", icon: Sparkles },
    { key: "chat" as const, label: "Chat", icon: MessageSquare },
    { key: "flags" as const, label: "Flags", icon: AlertTriangle },
  ];

  const completeDocs = documents.filter((d) => d.document_status === "complete" || d.document_status === "extracted").length;
  const totalDocs = documents.length;

  return (
    <aside className="w-full lg:w-[var(--evidence-width)] shrink-0 bg-card border-l border-border flex flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "summary" && (
          <div className="flex flex-col gap-4">
            {/* Case Summary Card */}
            <div className="rounded-xl bg-background border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Case Summary</h3>
              </div>
              <p className="text-xs text-foreground leading-relaxed">
                {caseData.claimant} claims personal injury sustained on {caseData.date_of_loss || "date pending"} involving {caseData.insured}. 
                Case is currently in <strong>{caseData.case_status.replace(/_/g, " ")}</strong> status
                {caseData.jurisdiction_state ? ` under ${caseData.jurisdiction_state} jurisdiction` : ""}.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <MiniStat label="Documents" value={`${totalDocs}`} />
                <MiniStat label="Processed" value={`${completeDocs}/${totalDocs}`} />
                <MiniStat label="Priority" value={caseData.priority} />
                <MiniStat label="State" value={caseData.jurisdiction_state || "—"} />
              </div>
            </div>

            {/* Key Findings */}
            <div className="rounded-xl bg-background border border-border p-4">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Key Findings</h3>
              <div className="flex flex-col gap-2">
                <Finding
                  type="info"
                  text={`${totalDocs} document${totalDocs !== 1 ? "s" : ""} uploaded to case file`}
                />
                {totalDocs > 0 && completeDocs < totalDocs && (
                  <Finding
                    type="warning"
                    text={`${totalDocs - completeDocs} document${totalDocs - completeDocs !== 1 ? "s" : ""} pending processing`}
                  />
                )}
                {caseData.case_status === "draft" && (
                  <Finding
                    type="info"
                    text="Case intake has not started yet"
                  />
                )}
                {caseData.priority === "urgent" && (
                  <Finding
                    type="alert"
                    text="This case is marked as urgent priority"
                  />
                )}
              </div>
            </div>

            {/* Document Summary */}
            {documents.length > 0 && (
              <div className="rounded-xl bg-background border border-border p-4">
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Recent Documents</h3>
                <div className="flex flex-col gap-1.5">
                  {documents.slice(0, 5).map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2 py-1">
                      <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-xs text-foreground truncate flex-1">{doc.file_name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {doc.document_status.replace(/_/g, " ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "chat" && (
          <div className="flex flex-col h-full">
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="h-10 w-10 rounded-xl bg-accent mx-auto flex items-center justify-center mb-3">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">
                  AI case assistant will appear here.
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Ask questions about the case, documents, or strategy.
                </p>
              </div>
            </div>
            {/* Chat input */}
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                placeholder="Ask about this case…"
                className="flex-1 px-3 py-2 text-xs border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-colors"
              />
              <button className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {activeTab === "flags" && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl bg-background border border-border p-4">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Issue Flags</h3>
              {totalDocs === 0 ? (
                <p className="text-xs text-muted-foreground">Upload and process documents to generate flags.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  <Finding type="warning" text="Pre-existing condition detected — lumbar region" />
                  <Finding type="alert" text="3-month treatment gap identified" />
                  <Finding type="info" text="Medical records cross-referenced with billing" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-card border border-border px-3 py-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold text-foreground capitalize mt-0.5">{value}</p>
    </div>
  );
}

function Finding({ type, text }: { type: "info" | "warning" | "alert"; text: string }) {
  const dotColor =
    type === "alert"
      ? "bg-destructive"
      : type === "warning"
      ? "bg-[hsl(var(--status-review))]"
      : "bg-primary";

  return (
    <div className="flex items-start gap-2.5 py-1">
      <span className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
      <span className="text-xs text-foreground leading-relaxed">{text}</span>
    </div>
  );
}

export default CaseRightRail;
