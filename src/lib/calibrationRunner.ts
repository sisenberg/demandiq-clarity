/**
 * ReviewerIQ — Calibration Runner v1.0.0
 *
 * Executes specialty review engine against benchmark cases,
 * compares output to expected outcomes, and produces mismatch reports.
 * Results are immutable once stored.
 */

import { runSpecialtyReview } from "@/lib/specialtyReviewEngine";
import { applyOverlays, type OverlayContext } from "@/lib/policyOverlayEngine";
import { SPECIALTY_REVIEW_ENGINE_VERSION } from "@/types/specialty-review";
import type { SpecialtyReviewRecommendation, SpecialtyIssueType, SupportLevel } from "@/types/specialty-review";
import type { PolicyProfile, OverlayRule } from "@/types/policy-overlay";
import type {
  CalibrationCase, CalibrationExpectedOutcome,
  CalibrationRun, CalibrationRunResult, CalibrationResultType,
  RulePerformanceMetric, ReviewerFeedbackEvent,
} from "@/types/policy-overlay";

// ─── Compare single case ───────────────────────────────

function compareResult(
  actual: SpecialtyReviewRecommendation,
  expected: CalibrationExpectedOutcome,
): { result_type: CalibrationResultType; mismatches: string[]; fp: string[]; fn: string[] } {
  const mismatches: string[] = [];
  const fp: string[] = [];
  const fn: string[] = [];

  // Support level
  if (actual.support_level !== expected.support_level) {
    mismatches.push(`support_level: expected ${expected.support_level}, got ${actual.support_level}`);
  }

  // Escalation
  if (actual.escalation_required !== expected.escalation_required) {
    mismatches.push(`escalation: expected ${expected.escalation_required}, got ${actual.escalation_required}`);
  }

  // Issue count range
  const issueCount = actual.issue_tags.length;
  if (issueCount < expected.min_issue_count) {
    mismatches.push(`issue_count: ${issueCount} < min ${expected.min_issue_count}`);
  }
  if (issueCount > expected.max_issue_count) {
    mismatches.push(`issue_count: ${issueCount} > max ${expected.max_issue_count}`);
  }

  // Required issue types
  const actualTypes = new Set(actual.issue_tags.map(t => t.type));
  for (const req of expected.required_issue_types) {
    if (!actualTypes.has(req)) {
      fn.push(req);
      mismatches.push(`missing required issue type: ${req}`);
    }
  }

  // Forbidden issue types
  for (const forbidden of expected.forbidden_issue_types) {
    if (actualTypes.has(forbidden)) {
      fp.push(forbidden);
      mismatches.push(`unexpected issue type present: ${forbidden}`);
    }
  }

  // Score ranges
  if (actual.documentation_sufficiency_score < expected.min_documentation_score) {
    mismatches.push(`doc_score: ${actual.documentation_sufficiency_score} < min ${expected.min_documentation_score}`);
  }
  if (actual.documentation_sufficiency_score > expected.max_documentation_score) {
    mismatches.push(`doc_score: ${actual.documentation_sufficiency_score} > max ${expected.max_documentation_score}`);
  }
  if (actual.necessity_support_score < expected.min_necessity_score) {
    mismatches.push(`nec_score: ${actual.necessity_support_score} < min ${expected.min_necessity_score}`);
  }
  if (actual.necessity_support_score > expected.max_necessity_score) {
    mismatches.push(`nec_score: ${actual.necessity_support_score} > max ${expected.max_necessity_score}`);
  }

  // Classify result
  let result_type: CalibrationResultType;
  if (mismatches.length === 0) {
    result_type = "match";
  } else if (fp.length > 0 && fn.length === 0) {
    result_type = "false_positive";
  } else if (fn.length > 0 && fp.length === 0) {
    result_type = "false_negative";
  } else if (mismatches.length <= 2 && fp.length === 0 && fn.length === 0) {
    result_type = "partial_match";
  } else {
    result_type = "needs_review";
  }

  return { result_type, mismatches, fp, fn };
}

// ─── Run calibration ──────────────────────────────────

export function runCalibration(
  cases: CalibrationCase[],
  profiles?: PolicyProfile[],
  rulesByProfile?: Map<string, OverlayRule[]>,
  context?: OverlayContext,
  runBy: string = "system",
): CalibrationRun {
  const results: CalibrationRunResult[] = [];

  for (const cal of cases) {
    // Run engine
    const { recommendations } = runSpecialtyReview(cal.treatments, cal.bill_lines);

    // Pick the best-matching recommendation (by specialty)
    let rec = recommendations.find(r => r.specialty_type === cal.specialty);
    if (!rec && recommendations.length > 0) rec = recommendations[0];

    if (!rec) {
      results.push({
        calibration_case_id: cal.id,
        calibration_case_name: cal.name,
        specialty: cal.specialty,
        result_type: "false_negative",
        expected_support_level: cal.expected.support_level,
        actual_support_level: "supported",
        expected_escalation: cal.expected.escalation_required,
        actual_escalation: false,
        expected_issue_types: cal.expected.required_issue_types,
        actual_issue_types: [],
        false_positive_issues: [],
        false_negative_issues: cal.expected.required_issue_types,
        score_deltas: { documentation: 0, coding: 0, necessity: 0 },
        mismatches: ["No recommendation generated for this specialty"],
      });
      continue;
    }

    // Apply overlays if provided
    if (profiles && rulesByProfile && context) {
      const overlay = applyOverlays(rec, profiles, rulesByProfile, context);
      // Create adjusted rec for comparison
      rec = {
        ...rec,
        support_level: overlay.adjusted_support_level,
        documentation_sufficiency_score: overlay.adjusted_documentation_score,
        coding_integrity_score: overlay.adjusted_coding_score,
        necessity_support_score: overlay.adjusted_necessity_score,
        escalation_required: overlay.adjusted_escalation_required,
      };
    }

    const { result_type, mismatches, fp, fn } = compareResult(rec, cal.expected);

    results.push({
      calibration_case_id: cal.id,
      calibration_case_name: cal.name,
      specialty: cal.specialty,
      result_type,
      expected_support_level: cal.expected.support_level,
      actual_support_level: rec.support_level,
      expected_escalation: cal.expected.escalation_required,
      actual_escalation: rec.escalation_required,
      expected_issue_types: cal.expected.required_issue_types,
      actual_issue_types: [...new Set(rec.issue_tags.map(t => t.type))],
      false_positive_issues: fp,
      false_negative_issues: fn,
      score_deltas: {
        documentation: rec.documentation_sufficiency_score - cal.expected.min_documentation_score,
        coding: rec.coding_integrity_score,
        necessity: rec.necessity_support_score - cal.expected.min_necessity_score,
      },
      mismatches,
    });
  }

  const now = new Date().toISOString();
  return {
    id: `cal-run-${Date.now()}`,
    engine_version: SPECIALTY_REVIEW_ENGINE_VERSION,
    profile_version: profiles?.[0]?.version?.toString() || null,
    profile_id: profiles?.[0]?.id || null,
    run_at: now,
    run_by: runBy,
    total_cases: cases.length,
    match_count: results.filter(r => r.result_type === "match").length,
    partial_match_count: results.filter(r => r.result_type === "partial_match").length,
    false_positive_count: results.filter(r => r.result_type === "false_positive").length,
    false_negative_count: results.filter(r => r.result_type === "false_negative").length,
    needs_review_count: results.filter(r => r.result_type === "needs_review").length,
    results,
  };
}

// ─── Rule Performance from feedback events ─────────────

export function computeRulePerformance(
  feedbackEvents: ReviewerFeedbackEvent[],
): RulePerformanceMetric[] {
  const ruleMap = new Map<string, {
    firings: number;
    overrides: number;
    reasons: Map<string, number>;
  }>();

  for (const event of feedbackEvents) {
    for (const ruleId of event.rule_ids_involved) {
      if (!ruleMap.has(ruleId)) {
        ruleMap.set(ruleId, { firings: 0, overrides: 0, reasons: new Map() });
      }
      const entry = ruleMap.get(ruleId)!;
      entry.firings++;
      entry.overrides++;
      const reason = event.override_reason;
      entry.reasons.set(reason, (entry.reasons.get(reason) || 0) + 1);
    }
  }

  return Array.from(ruleMap.entries()).map(([ruleId, data]) => ({
    rule_id: ruleId,
    rule_name: ruleId,
    specialty: "all" as const,
    total_firings: data.firings,
    override_count: data.overrides,
    override_rate: data.firings > 0 ? data.overrides / data.firings : 0,
    top_override_reasons: Array.from(data.reasons.entries())
      .map(([reason, count]) => ({ reason: reason as any, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    false_positive_rate: 0,
    false_negative_rate: 0,
    avg_confidence_when_fired: 0,
  }));
}
