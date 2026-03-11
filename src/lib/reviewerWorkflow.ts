/**
 * ReviewerIQ — Workflow State Machine, Completion Readiness, and Package Generation
 * v1.0.0
 *
 * Manages the module lifecycle: not_started → in_review → ready_to_complete → completed → reopened
 * Generates immutable versioned ReviewPackage artifacts for downstream consumption.
 */

import type { ReviewIssue, ReviewIssueDisposition } from "@/types/reviewer-issues";
import type { ReviewerBillLine } from "@/types/reviewer-bills";
import type {
  SpecialtyReviewRecommendation, SupportLevel, SpecialtyType,
  EpisodeOfCare,
} from "@/types/specialty-review";
import { SPECIALTY_REVIEW_ENGINE_VERSION } from "@/types/specialty-review";
import { OVERLAY_ENGINE_VERSION } from "@/types/policy-overlay";

// ─── Module State ──────────────────────────────────────

export type ReviewerModuleState =
  | "not_started"
  | "in_review"
  | "needs_attention"
  | "ready_to_complete"
  | "completed"
  | "reopened";

export const MODULE_STATE_LABEL: Record<ReviewerModuleState, string> = {
  not_started: "Not Started",
  in_review: "In Review",
  needs_attention: "Needs Attention",
  ready_to_complete: "Ready to Complete",
  completed: "Completed",
  reopened: "Reopened",
};

export type IssueResolutionStatus = "open" | "accepted" | "overridden" | "deferred";

export type CompletionGateStatus = "pending" | "passed" | "failed" | "waived_with_reason";

export type HandoffTarget = "EvaluateIQ" | "NegotiateIQ" | "LitIQ";

export type PackageArtifactType = "json" | "pdf" | "structured_summary";

// ─── Completion Flags ──────────────────────────────────

export interface CompletionFlags {
  specialty_review_complete: boolean;
  coding_review_complete: boolean;
  documentation_review_complete: boolean;
  reimbursement_review_complete: boolean;
  escalation_review_complete: boolean;
  package_generation_complete: boolean;
}

// ─── Completion Gate ───────────────────────────────────

export interface CompletionGate {
  id: string;
  label: string;
  status: CompletionGateStatus;
  detail: string;
  waive_reason?: string;
}

// ─── Readiness Assessment ──────────────────────────────

export interface CompletionReadiness {
  can_complete: boolean;
  module_state: ReviewerModuleState;
  flags: CompletionFlags;
  gates: CompletionGate[];
  blockers: string[];
  summary: {
    total_episodes: number;
    episodes_reviewed: number;
    total_issues: number;
    critical_unresolved: number;
    high_unresolved: number;
    escalations_pending: number;
    bills_pending: number;
    support_counts: Record<SupportLevel, number>;
    specialty_counts: Record<SpecialtyType, number>;
  };
}

// ─── Assess Completion ─────────────────────────────────

export function assessCompletionReadiness(
  recommendations: SpecialtyReviewRecommendation[],
  issues: ReviewIssue[],
  billLines: ReviewerBillLine[],
  episodes: EpisodeOfCare[],
): CompletionReadiness {
  const gates: CompletionGate[] = [];
  const blockers: string[] = [];

  // 1. Specialty review executed
  const hasRecommendations = recommendations.length > 0;
  gates.push({
    id: "specialty_review",
    label: "Specialty review executed",
    status: hasRecommendations ? "passed" : "failed",
    detail: hasRecommendations
      ? `${recommendations.length} recommendations generated`
      : "No specialty review has been run",
  });
  if (!hasRecommendations) blockers.push("Specialty review has not been executed");

  // 2. All episodes have support recommendations
  const episodesWithRecs = new Set(recommendations.map(r => r.episode_id));
  const allCovered = episodes.every(e => episodesWithRecs.has(e.id));
  gates.push({
    id: "episodes_covered",
    label: "All episodes have recommendations",
    status: allCovered ? "passed" : "failed",
    detail: `${episodesWithRecs.size}/${episodes.length} episodes covered`,
  });
  if (!allCovered) blockers.push(`${episodes.length - episodesWithRecs.size} episode(s) missing recommendations`);

  // 3. High-risk escalations reviewed
  const pendingEscalations = recommendations.filter(
    r => r.escalation_required && !r.reviewer_override
  );
  gates.push({
    id: "escalations_reviewed",
    label: "High-risk escalations reviewed",
    status: pendingEscalations.length === 0 ? "passed" : "failed",
    detail: pendingEscalations.length === 0
      ? "All escalations addressed"
      : `${pendingEscalations.length} escalation(s) pending human review`,
  });
  if (pendingEscalations.length > 0) blockers.push(`${pendingEscalations.length} escalation(s) require human review`);

  // 4. Critical issues resolved
  const criticalUnresolved = issues.filter(
    i => i.severity === "critical" && i.disposition === "pending"
  );
  const highUnresolved = issues.filter(
    i => i.severity === "high" && i.disposition === "pending"
  );
  gates.push({
    id: "critical_issues",
    label: "Critical issues resolved",
    status: criticalUnresolved.length === 0 ? "passed" : "failed",
    detail: criticalUnresolved.length === 0
      ? "No unresolved critical issues"
      : `${criticalUnresolved.length} critical issue(s) still pending`,
  });
  if (criticalUnresolved.length > 0) blockers.push(`${criticalUnresolved.length} critical issue(s) pending resolution`);

  // 5. Reimbursement dispositions
  const pendingBills = billLines.filter(l => l.disposition === "pending");
  const billsReviewed = pendingBills.length <= billLines.length * 0.1;
  gates.push({
    id: "reimbursement_review",
    label: "Reimbursement review substantially complete",
    status: billsReviewed ? "passed" : "failed",
    detail: `${billLines.length - pendingBills.length}/${billLines.length} bill lines reviewed`,
  });
  if (!billsReviewed) blockers.push(`${pendingBills.length} bill line(s) pending disposition`);

  // 6. Evidence traceability
  const recsWithEvidence = recommendations.filter(r => r.evidence_links.length > 0);
  const hasEvidence = recsWithEvidence.length >= recommendations.length * 0.8;
  gates.push({
    id: "evidence_traceability",
    label: "Evidence traceability",
    status: hasEvidence ? "passed" : (recommendations.length === 0 ? "pending" : "failed"),
    detail: `${recsWithEvidence.length}/${recommendations.length} recommendations have evidence links`,
  });

  // Compute flags
  const flags: CompletionFlags = {
    specialty_review_complete: hasRecommendations,
    coding_review_complete: gates.every(g => g.id !== "critical_issues" || g.status === "passed"),
    documentation_review_complete: hasEvidence,
    reimbursement_review_complete: billsReviewed,
    escalation_review_complete: pendingEscalations.length === 0,
    package_generation_complete: false,
  };

  // Support counts
  const support_counts: Record<SupportLevel, number> = {
    supported: 0, partially_supported: 0, weakly_supported: 0, unsupported: 0, escalate: 0,
  };
  for (const r of recommendations) support_counts[r.support_level]++;

  const specialty_counts: Record<SpecialtyType, number> = {
    chiro: 0, pt: 0, ortho: 0, pain_management: 0, radiology: 0, surgery: 0,
  };
  for (const r of recommendations) specialty_counts[r.specialty_type]++;

  const can_complete = blockers.length === 0;
  let module_state: ReviewerModuleState;
  if (recommendations.length === 0) module_state = "not_started";
  else if (blockers.length > 0) module_state = criticalUnresolved.length > 0 || pendingEscalations.length > 0 ? "needs_attention" : "in_review";
  else module_state = "ready_to_complete";

  return {
    can_complete,
    module_state,
    flags,
    gates,
    blockers,
    summary: {
      total_episodes: episodes.length,
      episodes_reviewed: episodesWithRecs.size,
      total_issues: issues.length,
      critical_unresolved: criticalUnresolved.length,
      high_unresolved: highUnresolved.length,
      escalations_pending: pendingEscalations.length,
      bills_pending: pendingBills.length,
      support_counts,
      specialty_counts,
    },
  };
}

// ─── ReviewPackage v1 ──────────────────────────────────

export interface ReviewPackageV1 {
  package_metadata: {
    package_id: string;
    case_id: string;
    tenant_id: string;
    package_version: number;
    source_module: "ReviewerIQ";
    generated_at: string;
    generated_by: string;
    reviewer_module_version: string;
    specialty_rules_version: string;
    overlay_profile_ids_applied: string[];
    prior_package_version: number | null;
    completion_status: "completed" | "superseded";
  };
  reviewer_summary: {
    overall_review_status: ReviewerModuleState;
    total_episodes_reviewed: number;
    total_line_items_reviewed: number;
    high_risk_items_count: number;
    supported_count: number;
    partially_supported_count: number;
    weakly_supported_count: number;
    unsupported_count: number;
    escalated_count: number;
    accepted_issue_count: number;
    overridden_issue_count: number;
    deferred_issue_count: number;
  };
  specialty_episode_reviews: EpisodeReviewEntry[];
  line_item_review_results: LineItemReviewEntry[];
  accepted_issues: PackageIssueEntry[];
  overridden_issues: PackageIssueEntry[];
  deferred_issues: PackageIssueEntry[];
  documentation_quality_summary: string;
  coding_integrity_summary: string;
  escalation_summary: string;
  final_completion_summary: string;
  provenance: {
    base_engine_version: string;
    overlay_engine_version: string;
    overlay_versions: string[];
    calibration_profile_used: string | null;
    package_generation_job_id: string;
  };
  evidence_index: EvidenceIndexEntry[];
}

export interface EpisodeReviewEntry {
  episode_id: string;
  specialty_type: SpecialtyType;
  provider: string;
  dates_of_service: { start: string; end: string };
  body_region: string;
  laterality: string | null;
  diagnosis_cluster: string[];
  episode_phase: string;
  support_level: SupportLevel;
  documentation_sufficiency_score: number;
  coding_integrity_score: number;
  necessity_support_score: number;
  escalation_required: boolean;
  key_issues: string[];
  reviewer_disposition: string | null;
  reviewer_note: string;
  evidence_links: { doc_id: string | null; page: number | null; text: string }[];
}

export interface LineItemReviewEntry {
  line_item_id: string;
  cpt_hcpcs_code: string | null;
  modifiers: string[];
  billed_amount: number;
  recommended_amount: number | null;
  issue_tags: string[];
  support_level: SupportLevel | null;
  reimbursement_adjustment_reasons: string[];
  reviewer_disposition: string;
  override_reason: string;
  evidence_links: { doc_id: string | null; page: number | null; text: string }[];
}

export interface PackageIssueEntry {
  issue_id: string;
  issue_type: string;
  severity: string;
  title: string;
  description: string;
  disposition: string;
  disposition_rationale: string;
  questioned_amount: number;
}

export interface EvidenceIndexEntry {
  document_id: string | null;
  page: number | null;
  text: string;
  linked_to_type: "episode" | "line_item" | "issue";
  linked_to_id: string;
}

// ─── Generate ReviewPackage ────────────────────────────

export function generateReviewPackage(
  caseId: string,
  tenantId: string,
  recommendations: SpecialtyReviewRecommendation[],
  issues: ReviewIssue[],
  billLines: ReviewerBillLine[],
  episodes: EpisodeOfCare[],
  generatedBy: string,
  priorVersion: number | null = null,
  overlayProfileIds: string[] = [],
): ReviewPackageV1 {
  const now = new Date().toISOString();
  const packageVersion = (priorVersion ?? 0) + 1;
  const jobId = `pkg-gen-${Date.now()}`;

  // Episode reviews
  const episodeReviews: EpisodeReviewEntry[] = recommendations.map(rec => ({
    episode_id: rec.episode_id,
    specialty_type: rec.specialty_type,
    provider: rec.provider,
    dates_of_service: rec.dates_of_service,
    body_region: rec.body_region,
    laterality: rec.laterality,
    diagnosis_cluster: rec.diagnosis_cluster,
    episode_phase: rec.episode_phase,
    support_level: rec.reviewer_override?.override_support_level ?? rec.support_level,
    documentation_sufficiency_score: rec.documentation_sufficiency_score,
    coding_integrity_score: rec.coding_integrity_score,
    necessity_support_score: rec.necessity_support_score,
    escalation_required: rec.escalation_required,
    key_issues: rec.issue_tags.map(t => t.label),
    reviewer_disposition: rec.reviewer_override ? "overridden" : null,
    reviewer_note: rec.reviewer_override?.reason ?? "",
    evidence_links: rec.evidence_links.map(e => ({
      doc_id: e.source_document_id,
      page: e.source_page,
      text: e.quoted_text,
    })),
  }));

  // Line item reviews
  const lineItemReviews: LineItemReviewEntry[] = billLines.map(line => {
    const linkedRec = recommendations.find(r =>
      r.issue_tags.some(t => line.cpt_code && t.label.includes(line.cpt_code))
    );
    return {
      line_item_id: line.id,
      cpt_hcpcs_code: line.cpt_code || line.hcpcs_code,
      modifiers: line.modifiers,
      billed_amount: line.billed_amount,
      recommended_amount: line.accepted_amount ?? line.reference_amount,
      issue_tags: line.flags.map(f => f.type),
      support_level: linkedRec?.support_level ?? null,
      reimbursement_adjustment_reasons: line.reduction_reason ? [line.reduction_reason] : [],
      reviewer_disposition: line.disposition,
      override_reason: line.reviewer_notes,
      evidence_links: line.source_snippet ? [{ doc_id: null, page: line.source_page, text: line.source_snippet }] : [],
    };
  });

  // Categorize issues
  const acceptedIssues = issues.filter(i => i.disposition === "accepted" || i.disposition === "reduced");
  const overriddenIssues = issues.filter(i => i.disposition === "dismissed" || i.disposition === "escalated");
  const deferredIssues = issues.filter(i => i.disposition === "uncertain");

  const mapIssue = (i: ReviewIssue): PackageIssueEntry => ({
    issue_id: i.id,
    issue_type: i.issue_type,
    severity: i.severity,
    title: i.title,
    description: i.description,
    disposition: i.disposition,
    disposition_rationale: i.disposition_rationale,
    questioned_amount: i.questioned_amount,
  });

  // Evidence index
  const evidenceIndex: EvidenceIndexEntry[] = [];
  for (const rec of recommendations) {
    for (const ev of rec.evidence_links) {
      evidenceIndex.push({
        document_id: ev.source_document_id,
        page: ev.source_page,
        text: ev.quoted_text,
        linked_to_type: "episode",
        linked_to_id: rec.episode_id,
      });
    }
  }

  // Support counts
  const sc = { supported: 0, partially_supported: 0, weakly_supported: 0, unsupported: 0, escalate: 0 };
  for (const r of recommendations) sc[r.reviewer_override?.override_support_level ?? r.support_level]++;

  return {
    package_metadata: {
      package_id: `rp-${caseId}-v${packageVersion}`,
      case_id: caseId,
      tenant_id: tenantId,
      package_version: packageVersion,
      source_module: "ReviewerIQ",
      generated_at: now,
      generated_by: generatedBy,
      reviewer_module_version: "1.0.0",
      specialty_rules_version: SPECIALTY_REVIEW_ENGINE_VERSION,
      overlay_profile_ids_applied: overlayProfileIds,
      prior_package_version: priorVersion,
      completion_status: "completed",
    },
    reviewer_summary: {
      overall_review_status: "completed",
      total_episodes_reviewed: recommendations.length,
      total_line_items_reviewed: billLines.length,
      high_risk_items_count: recommendations.filter(r => r.escalation_required).length,
      supported_count: sc.supported,
      partially_supported_count: sc.partially_supported,
      weakly_supported_count: sc.weakly_supported,
      unsupported_count: sc.unsupported,
      escalated_count: sc.escalate,
      accepted_issue_count: acceptedIssues.length,
      overridden_issue_count: overriddenIssues.length,
      deferred_issue_count: deferredIssues.length,
    },
    specialty_episode_reviews: episodeReviews,
    line_item_review_results: lineItemReviews,
    accepted_issues: acceptedIssues.map(mapIssue),
    overridden_issues: overriddenIssues.map(mapIssue),
    deferred_issues: deferredIssues.map(mapIssue),
    documentation_quality_summary: buildDocSummary(recommendations),
    coding_integrity_summary: buildCodingSummary(recommendations),
    escalation_summary: buildEscalationSummary(recommendations),
    final_completion_summary: `ReviewerIQ review completed on ${now}. ${recommendations.length} episodes reviewed, ${billLines.length} line items assessed. Package version ${packageVersion}.`,
    provenance: {
      base_engine_version: SPECIALTY_REVIEW_ENGINE_VERSION,
      overlay_engine_version: OVERLAY_ENGINE_VERSION,
      overlay_versions: overlayProfileIds,
      calibration_profile_used: null,
      package_generation_job_id: jobId,
    },
    evidence_index: evidenceIndex,
  };
}

function buildDocSummary(recs: SpecialtyReviewRecommendation[]): string {
  if (recs.length === 0) return "No episodes to assess.";
  const avg = Math.round(recs.reduce((s, r) => s + r.documentation_sufficiency_score, 0) / recs.length);
  const weak = recs.filter(r => r.documentation_sufficiency_score < 50).length;
  return `Average documentation sufficiency: ${avg}/100. ${weak} episode(s) with scores below 50.`;
}

function buildCodingSummary(recs: SpecialtyReviewRecommendation[]): string {
  if (recs.length === 0) return "No episodes to assess.";
  const avg = Math.round(recs.reduce((s, r) => s + r.coding_integrity_score, 0) / recs.length);
  const issues = recs.filter(r => r.issue_tags.some(t => t.type === "coding" || t.type === "bundling")).length;
  return `Average coding integrity: ${avg}/100. ${issues} episode(s) with coding/bundling issues.`;
}

function buildEscalationSummary(recs: SpecialtyReviewRecommendation[]): string {
  const escalated = recs.filter(r => r.escalation_required);
  if (escalated.length === 0) return "No episodes required escalation.";
  const reviewed = escalated.filter(r => r.reviewer_override).length;
  return `${escalated.length} episode(s) flagged for escalation. ${reviewed} reviewed by human reviewer.`;
}

// ─── Downstream Handoff ────────────────────────────────

export interface DownstreamHandoffEvent {
  id: string;
  case_id: string;
  package_id: string;
  package_version: number;
  target: HandoffTarget;
  status: "not_sent" | "queued" | "delivered" | "failed";
  sent_at: string | null;
  error: string | null;
}

export function createHandoffEvent(
  caseId: string,
  packageId: string,
  packageVersion: number,
  target: HandoffTarget = "EvaluateIQ",
): DownstreamHandoffEvent {
  return {
    id: `hoff-${Date.now()}`,
    case_id: caseId,
    package_id: packageId,
    package_version: packageVersion,
    target,
    status: "queued",
    sent_at: new Date().toISOString(),
    error: null,
  };
}

// ─── Package Version History ───────────────────────────

export interface PackageVersionEntry {
  version: number;
  package_id: string;
  status: "completed" | "superseded";
  completed_by: string;
  completed_at: string;
  reopen_reason: string | null;
  is_current: boolean;
}

// ─── Audit Event Types ─────────────────────────────────

export type ReviewerAuditAction =
  | "issue_accepted"
  | "issue_overridden"
  | "issue_deferred"
  | "reimbursement_changed"
  | "escalation_dispositioned"
  | "completion_attempted"
  | "completion_succeeded"
  | "completion_failed"
  | "module_reopened"
  | "handoff_created"
  | "package_generated";

export interface ReviewerAuditEvent {
  id: string;
  action: ReviewerAuditAction;
  case_id: string;
  entity_type: string;
  entity_id: string;
  actor: string;
  timestamp: string;
  before_value: unknown;
  after_value: unknown;
  reason: string;
}

export function createAuditEvent(
  action: ReviewerAuditAction,
  caseId: string,
  entityType: string,
  entityId: string,
  actor: string,
  before: unknown = null,
  after: unknown = null,
  reason: string = "",
): ReviewerAuditEvent {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    action,
    case_id: caseId,
    entity_type: entityType,
    entity_id: entityId,
    actor,
    timestamp: new Date().toISOString(),
    before_value: before,
    after_value: after,
    reason,
  };
}
