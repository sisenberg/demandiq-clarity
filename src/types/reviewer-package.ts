/**
 * ReviewerIQ — Output Package Contract
 * Contract version: 1.0.0
 *
 * The stable, versioned output ReviewerIQ publishes for downstream modules
 * (EvaluateIQ, NegotiateIQ). Treat as a read-only handoff.
 */

import type { ReviewerBillLine, ReviewerBillHeader } from "./reviewer-bills";
import type { ReviewIssue } from "./reviewer-issues";
import type { TreatmentReviewRow } from "./revieweriq";

// ─── Financial Summary ──────────────────────────────────

export interface ReviewerFinancialSummary {
  total_billed: number;
  total_reference: number;
  total_questioned: number;
  total_accepted: number;
  total_reduced: number;
  total_disputed: number;
  /** By provider */
  by_provider: ProviderFinancialSummary[];
  /** By code category */
  by_code_category: CodeCategoryFinancialSummary[];
}

export interface ProviderFinancialSummary {
  provider_name: string;
  total_billed: number;
  total_reference: number;
  total_accepted: number;
  total_reduced: number;
  total_disputed: number;
  line_count: number;
  issue_count: number;
}

export interface CodeCategoryFinancialSummary {
  category: string;
  total_billed: number;
  total_reference: number;
  total_accepted: number;
  line_count: number;
}

// ─── Reviewer Package ──────────────────────────────────

export interface ReviewerPackage {
  /** Contract version */
  contract_version: string;
  /** Module metadata */
  module_id: "revieweriq";
  case_id: string;
  tenant_id: string;
  /** Completion metadata */
  completed_at: string | null;
  completed_by: string | null;
  version: number;
  /** Reviewed treatment records */
  treatment_reviews: TreatmentReviewRow[];
  /** Reviewed bill lines */
  bill_headers: ReviewerBillHeader[];
  bill_lines: ReviewerBillLine[];
  /** Review issues with dispositions */
  issues: ReviewIssue[];
  /** Financial summary */
  financial_summary: ReviewerFinancialSummary;
  /** Rationale summaries by provider */
  provider_rationales: ProviderRationale[];
  /** Evidence references used */
  evidence_count: number;
}

export interface ProviderRationale {
  provider_name: string;
  summary: string;
  accepted_amount: number;
  reduced_amount: number;
  disputed_amount: number;
  key_issues: string[];
}

export const REVIEWER_PACKAGE_VERSION = "1.0.0";
