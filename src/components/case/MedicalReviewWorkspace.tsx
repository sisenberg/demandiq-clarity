/**
 * ReviewerIQ — Medical Review Workspace
 * Top-level container for the medical review section.
 * Integrates treatment timeline, issue workspace, financial summary, and bill review.
 */

import { useState, useMemo, useCallback } from "react";
import {
  Stethoscope, DollarSign, AlertTriangle, FileText, BarChart3,
  CheckCircle2, ClipboardList,
} from "lucide-react";
import TreatmentTimeline from "@/components/case/TreatmentTimeline";
import ReviewerIssueWorkspace from "@/components/case/ReviewerIssueWorkspace";
import FinancialReviewSummary from "@/components/case/FinancialReviewSummary";
import BillLineReviewTable from "@/components/case/BillLineReviewTable";
import type { ReviewIssueDisposition } from "@/types/reviewer-issues";
import { MOCK_BILL_LINES, MOCK_BILL_HEADERS } from "@/data/mock/reviewerBillLines";
import { MOCK_TREATMENT_RECORDS } from "@/data/mock/treatmentRecords";
import { runMedicalReviewRules } from "@/lib/medicalReviewRules";

type MedicalReviewTab = "treatments" | "issues" | "bills" | "financial";

const TABS: { key: MedicalReviewTab; label: string; icon: React.ElementType }[] = [
  { key: "treatments", label: "Treatment Timeline", icon: Stethoscope },
  { key: "issues", label: "Review Issues", icon: AlertTriangle },
  { key: "bills", label: "Bill Lines", icon: ClipboardList },
  { key: "financial", label: "Financial Summary", icon: BarChart3 },
];

interface MedicalReviewWorkspaceProps {
  caseId: string;
}

export default function MedicalReviewWorkspace({ caseId }: MedicalReviewWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<MedicalReviewTab>("treatments");
  const [billLines, setBillLines] = useState(MOCK_BILL_LINES);

  // Run medical review rules
  const issues = useMemo(() => {
    return runMedicalReviewRules(MOCK_TREATMENT_RECORDS, billLines);
  }, [billLines]);

  const [reviewIssues, setReviewIssues] = useState(issues);

  // Update issues when computed issues change
  useMemo(() => {
    setReviewIssues(issues);
  }, [issues]);

  const handleDisposition = useCallback((issueId: string, disposition: ReviewIssueDisposition, rationale: string) => {
    setReviewIssues(prev => prev.map(i =>
      i.id === issueId
        ? {
            ...i,
            disposition,
            disposition_rationale: rationale,
            disposition_at: new Date().toISOString(),
            disposition_by: "current-user",
            disposition_history: [
              ...i.disposition_history,
              { disposition, rationale, by: "current-user", at: new Date().toISOString() },
            ],
            updated_at: new Date().toISOString(),
          }
        : i
    ));
  }, []);

  const handleBillDisposition = useCallback((lineId: string, disposition: string, amount: number | null) => {
    setBillLines(prev => prev.map(l =>
      l.id === lineId
        ? { ...l, disposition: disposition as any, accepted_amount: amount, reviewed_at: new Date().toISOString() }
        : l
    ));
  }, []);

  const pendingIssues = reviewIssues.filter(i => i.disposition === "pending").length;
  const pendingBills = billLines.filter(l => l.disposition === "pending").length;

  return (
    <div className="flex flex-col gap-4">
      {/* Tab navigation */}
      <div className="flex items-center gap-1 bg-accent/30 rounded-lg p-1">
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const badge = tab.key === "issues" ? pendingIssues : tab.key === "bills" ? pendingBills : 0;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium rounded-md transition-all ${
                isActive
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
              {badge > 0 && (
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-[hsl(var(--status-review-bg))] text-[hsl(var(--status-review-foreground))]">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "treatments" && <TreatmentTimeline caseId={caseId} />}
      {activeTab === "issues" && <ReviewerIssueWorkspace issues={reviewIssues} onDisposition={handleDisposition} />}
      {activeTab === "bills" && <BillLineReviewTable billLines={billLines} onDisposition={handleBillDisposition} />}
      {activeTab === "financial" && <FinancialReviewSummary billLines={billLines} issues={reviewIssues} />}
    </div>
  );
}
