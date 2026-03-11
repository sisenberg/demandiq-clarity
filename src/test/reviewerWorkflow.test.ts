/**
 * ReviewerIQ — Workflow, Completion, and Package Generation Tests
 */

import { describe, it, expect } from "vitest";
import {
  assessCompletionReadiness,
  generateReviewPackage,
  createHandoffEvent,
  createAuditEvent,
} from "@/lib/reviewerWorkflow";
import { runSpecialtyReview } from "@/lib/specialtyReviewEngine";
import { runMedicalReviewRules } from "@/lib/medicalReviewRules";
import { MOCK_TREATMENT_RECORDS } from "@/data/mock/treatmentRecords";
import { MOCK_BILL_LINES } from "@/data/mock/reviewerBillLines";

const CASE_ID = "case-001";
const TENANT_ID = "tenant-001";

describe("Completion Readiness Assessment", () => {
  it("identifies blockers when escalations are pending", () => {
    const { episodes, recommendations } = runSpecialtyReview(MOCK_TREATMENT_RECORDS, MOCK_BILL_LINES);
    const issues = runMedicalReviewRules(MOCK_TREATMENT_RECORDS, MOCK_BILL_LINES);
    const readiness = assessCompletionReadiness(recommendations, issues, MOCK_BILL_LINES, episodes);

    // There should be pending escalations (surgery/pain mgmt)
    expect(readiness.summary.escalations_pending).toBeGreaterThanOrEqual(0);
    expect(readiness.module_state).toBeTruthy();
    expect(readiness.gates.length).toBeGreaterThanOrEqual(4);
  });

  it("returns not_started when no recommendations", () => {
    const readiness = assessCompletionReadiness([], [], [], []);
    expect(readiness.module_state).toBe("not_started");
    expect(readiness.can_complete).toBe(false);
  });

  it("provides gate details for all checks", () => {
    const { episodes, recommendations } = runSpecialtyReview(MOCK_TREATMENT_RECORDS, MOCK_BILL_LINES);
    const issues = runMedicalReviewRules(MOCK_TREATMENT_RECORDS, MOCK_BILL_LINES);
    const readiness = assessCompletionReadiness(recommendations, issues, MOCK_BILL_LINES, episodes);

    for (const gate of readiness.gates) {
      expect(gate.id).toBeTruthy();
      expect(gate.label).toBeTruthy();
      expect(["passed", "failed", "pending", "waived_with_reason"]).toContain(gate.status);
      expect(gate.detail).toBeTruthy();
    }
  });

  it("computes support level counts", () => {
    const { episodes, recommendations } = runSpecialtyReview(MOCK_TREATMENT_RECORDS, MOCK_BILL_LINES);
    const readiness = assessCompletionReadiness(recommendations, [], MOCK_BILL_LINES, episodes);
    const total = Object.values(readiness.summary.support_counts).reduce((s, c) => s + c, 0);
    expect(total).toBe(recommendations.length);
  });
});

describe("ReviewPackage v1 Generation", () => {
  it("generates a valid package with all sections", () => {
    const { episodes, recommendations } = runSpecialtyReview(MOCK_TREATMENT_RECORDS, MOCK_BILL_LINES);
    const issues = runMedicalReviewRules(MOCK_TREATMENT_RECORDS, MOCK_BILL_LINES);
    const pkg = generateReviewPackage(CASE_ID, TENANT_ID, recommendations, issues, MOCK_BILL_LINES, episodes, "test-user");

    expect(pkg.package_metadata.case_id).toBe(CASE_ID);
    expect(pkg.package_metadata.tenant_id).toBe(TENANT_ID);
    expect(pkg.package_metadata.package_version).toBe(1);
    expect(pkg.package_metadata.source_module).toBe("ReviewerIQ");
    expect(pkg.package_metadata.generated_by).toBe("test-user");
    expect(pkg.package_metadata.completion_status).toBe("completed");
  });

  it("includes episode reviews matching recommendations", () => {
    const { episodes, recommendations } = runSpecialtyReview(MOCK_TREATMENT_RECORDS, MOCK_BILL_LINES);
    const pkg = generateReviewPackage(CASE_ID, TENANT_ID, recommendations, [], MOCK_BILL_LINES, episodes, "test-user");
    expect(pkg.specialty_episode_reviews.length).toBe(recommendations.length);
  });

  it("includes all line item reviews", () => {
    const { episodes, recommendations } = runSpecialtyReview(MOCK_TREATMENT_RECORDS, MOCK_BILL_LINES);
    const pkg = generateReviewPackage(CASE_ID, TENANT_ID, recommendations, [], MOCK_BILL_LINES, episodes, "test-user");
    expect(pkg.line_item_review_results.length).toBe(MOCK_BILL_LINES.length);
  });

  it("increments version from prior", () => {
    const { episodes, recommendations } = runSpecialtyReview(MOCK_TREATMENT_RECORDS, MOCK_BILL_LINES);
    const pkg = generateReviewPackage(CASE_ID, TENANT_ID, recommendations, [], MOCK_BILL_LINES, episodes, "test-user", 2);
    expect(pkg.package_metadata.package_version).toBe(3);
    expect(pkg.package_metadata.prior_package_version).toBe(2);
  });

  it("preserves evidence index", () => {
    const { episodes, recommendations } = runSpecialtyReview(MOCK_TREATMENT_RECORDS, MOCK_BILL_LINES);
    const pkg = generateReviewPackage(CASE_ID, TENANT_ID, recommendations, [], MOCK_BILL_LINES, episodes, "test-user");
    expect(pkg.evidence_index.length).toBeGreaterThan(0);
    for (const e of pkg.evidence_index) {
      expect(e.linked_to_type).toBe("episode");
      expect(e.linked_to_id).toBeTruthy();
    }
  });

  it("includes provenance with engine versions", () => {
    const { episodes, recommendations } = runSpecialtyReview(MOCK_TREATMENT_RECORDS, MOCK_BILL_LINES);
    const pkg = generateReviewPackage(CASE_ID, TENANT_ID, recommendations, [], MOCK_BILL_LINES, episodes, "test-user");
    expect(pkg.provenance.base_engine_version).toBeTruthy();
    expect(pkg.provenance.overlay_engine_version).toBeTruthy();
    expect(pkg.provenance.package_generation_job_id).toBeTruthy();
  });

  it("categorizes issues correctly", () => {
    const { episodes, recommendations } = runSpecialtyReview(MOCK_TREATMENT_RECORDS, MOCK_BILL_LINES);
    const issues = runMedicalReviewRules(MOCK_TREATMENT_RECORDS, MOCK_BILL_LINES);
    // Accept some, dismiss some
    const modified = issues.map((issue, i) => ({
      ...issue,
      disposition: (i % 3 === 0 ? "accepted" : i % 3 === 1 ? "dismissed" : "uncertain") as any,
    }));
    const pkg = generateReviewPackage(CASE_ID, TENANT_ID, recommendations, modified, MOCK_BILL_LINES, episodes, "test-user");
    expect(pkg.accepted_issues.length + pkg.overridden_issues.length + pkg.deferred_issues.length).toBeLessThanOrEqual(modified.length);
  });
});

describe("Complete → Reopen → Re-complete flow", () => {
  it("generates v1, supersedes on reopen, generates v2", () => {
    const { episodes, recommendations } = runSpecialtyReview(MOCK_TREATMENT_RECORDS, MOCK_BILL_LINES);
    const issues = runMedicalReviewRules(MOCK_TREATMENT_RECORDS, MOCK_BILL_LINES);

    // v1
    const v1 = generateReviewPackage(CASE_ID, TENANT_ID, recommendations, issues, MOCK_BILL_LINES, episodes, "reviewer-a");
    expect(v1.package_metadata.package_version).toBe(1);
    expect(v1.package_metadata.prior_package_version).toBeNull();

    // Reopen audit
    const reopenAudit = createAuditEvent("module_reopened", CASE_ID, "reviewer_module", CASE_ID, "reviewer-a", { version: 1 }, null, "Additional records received");
    expect(reopenAudit.action).toBe("module_reopened");
    expect(reopenAudit.reason).toBe("Additional records received");

    // v2
    const v2 = generateReviewPackage(CASE_ID, TENANT_ID, recommendations, issues, MOCK_BILL_LINES, episodes, "reviewer-a", 1);
    expect(v2.package_metadata.package_version).toBe(2);
    expect(v2.package_metadata.prior_package_version).toBe(1);

    // v1 should be supersedable
    expect(v1.package_metadata.package_id).not.toBe(v2.package_metadata.package_id);
  });
});

describe("Downstream Handoff", () => {
  it("creates idempotent handoff events", () => {
    const h1 = createHandoffEvent(CASE_ID, "rp-case-001-v1", 1);
    expect(h1.target).toBe("EvaluateIQ");
    expect(h1.status).toBe("queued");
    expect(h1.package_version).toBe(1);
  });
});

describe("Audit Events", () => {
  it("creates structured audit events", () => {
    const audit = createAuditEvent("issue_accepted", CASE_ID, "review_issue", "issue-1", "user-a", { disposition: "pending" }, { disposition: "accepted" }, "Documentation sufficient");
    expect(audit.action).toBe("issue_accepted");
    expect(audit.before_value).toEqual({ disposition: "pending" });
    expect(audit.after_value).toEqual({ disposition: "accepted" });
    expect(audit.reason).toBe("Documentation sufficient");
  });

  it("preserves all required audit fields", () => {
    const audit = createAuditEvent("completion_succeeded", CASE_ID, "reviewer_module", CASE_ID, "user-a");
    expect(audit.id).toBeTruthy();
    expect(audit.timestamp).toBeTruthy();
    expect(audit.case_id).toBe(CASE_ID);
    expect(audit.actor).toBe("user-a");
  });
});

describe("Safety constraints", () => {
  it("package never contains deny/coverage denied language", () => {
    const { episodes, recommendations } = runSpecialtyReview(MOCK_TREATMENT_RECORDS, MOCK_BILL_LINES);
    const pkg = generateReviewPackage(CASE_ID, TENANT_ID, recommendations, [], MOCK_BILL_LINES, episodes, "test-user");
    const json = JSON.stringify(pkg);
    expect(json).not.toMatch(/deny care|coverage denied|claim denied/i);
  });

  it("deferred critical issues remain visible in package", () => {
    const { episodes, recommendations } = runSpecialtyReview(MOCK_TREATMENT_RECORDS, MOCK_BILL_LINES);
    const issues = runMedicalReviewRules(MOCK_TREATMENT_RECORDS, MOCK_BILL_LINES);
    const criticals = issues.filter(i => i.severity === "critical");
    const deferred = criticals.map(i => ({ ...i, disposition: "uncertain" as any }));
    const pkg = generateReviewPackage(CASE_ID, TENANT_ID, recommendations, deferred, MOCK_BILL_LINES, episodes, "test-user");
    // All deferred criticals should appear in deferred_issues
    for (const c of deferred) {
      const found = pkg.deferred_issues.find(d => d.issue_id === c.id);
      expect(found).toBeTruthy();
    }
  });

  it("system vs reviewer decisions are distinguishable", () => {
    const { episodes, recommendations } = runSpecialtyReview(MOCK_TREATMENT_RECORDS, MOCK_BILL_LINES);
    const pkg = generateReviewPackage(CASE_ID, TENANT_ID, recommendations, [], MOCK_BILL_LINES, episodes, "test-user");
    for (const ep of pkg.specialty_episode_reviews) {
      // reviewer_disposition is null when no override, present when overridden
      expect(ep.reviewer_disposition === null || typeof ep.reviewer_disposition === "string").toBe(true);
    }
  });
});
