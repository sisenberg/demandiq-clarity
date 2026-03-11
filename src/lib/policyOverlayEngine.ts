/**
 * ReviewerIQ — Policy Overlay Engine v1.0.0
 *
 * Applies configurable overlays to base specialty review recommendations.
 * Chain order: jurisdiction → client → program → claim_type → specialty
 * Original base recommendation is ALWAYS preserved for audit.
 *
 * Safety: Protected categories cannot be suppressed without admin permission.
 */

import type {
  SpecialtyReviewRecommendation, SupportLevel, SpecialtyIssueTag,
} from "@/types/specialty-review";
import type {
  PolicyProfile, OverlayRule, OverlayRuleCondition, OverlayRuleAction,
  AppliedOverlay, OverlayAdjustedRecommendation, OverlayScope,
} from "@/types/policy-overlay";
import { OVERLAY_CHAIN_ORDER, PROTECTED_ESCALATION_CATEGORIES } from "@/types/policy-overlay";

// ─── Condition Evaluator ───────────────────────────────

function evaluateCondition(
  condition: OverlayRuleCondition,
  rec: SpecialtyReviewRecommendation,
  context: OverlayContext,
): boolean {
  const fieldValue = getFieldValue(condition.field, rec, context);
  if (fieldValue === undefined) return false;

  switch (condition.operator) {
    case "eq": return fieldValue === condition.value;
    case "neq": return fieldValue !== condition.value;
    case "gt": return typeof fieldValue === "number" && fieldValue > (condition.value as number);
    case "gte": return typeof fieldValue === "number" && fieldValue >= (condition.value as number);
    case "lt": return typeof fieldValue === "number" && fieldValue < (condition.value as number);
    case "lte": return typeof fieldValue === "number" && fieldValue <= (condition.value as number);
    case "in": return Array.isArray(condition.value) && condition.value.includes(String(fieldValue));
    case "contains": return typeof fieldValue === "string" && fieldValue.includes(String(condition.value));
    default: return false;
  }
}

function getFieldValue(
  field: string,
  rec: SpecialtyReviewRecommendation,
  context: OverlayContext,
): string | number | boolean | undefined {
  switch (field) {
    case "specialty_type": return rec.specialty_type;
    case "support_level": return rec.support_level;
    case "episode_phase": return rec.episode_phase;
    case "body_region": return rec.body_region;
    case "documentation_sufficiency_score": return rec.documentation_sufficiency_score;
    case "coding_integrity_score": return rec.coding_integrity_score;
    case "necessity_support_score": return rec.necessity_support_score;
    case "escalation_required": return rec.escalation_required;
    case "visit_count": return context.visit_count;
    case "jurisdiction": return context.jurisdiction;
    case "client_id": return context.client_id;
    case "claim_type": return context.claim_type;
    case "program": return context.program;
    default: return undefined;
  }
}

// ─── Action Applicator ─────────────────────────────────

function applyAction(
  action: OverlayRuleAction,
  rec: SpecialtyReviewRecommendation,
  adjusted: MutableAdjustment,
  rule: OverlayRule,
  profile: PolicyProfile,
): AppliedOverlay | null {
  const overlay: AppliedOverlay = {
    profile_id: profile.id,
    profile_name: profile.name,
    profile_version: profile.version,
    scope: profile.scope,
    scope_value: profile.scope_value,
    rule_id: rule.id,
    rule_name: rule.name,
    action_type: action.type,
    field_changed: action.target_field,
    original_value: null,
    adjusted_value: null,
    reason: rule.description,
  };

  switch (action.type) {
    case "threshold_adjustment": {
      if (!action.target_field || action.value == null) return null;
      const numVal = Number(action.value);
      if (action.target_field === "documentation_sufficiency_score") {
        overlay.original_value = adjusted.documentation_score;
        adjusted.documentation_score = Math.max(0, Math.min(100, adjusted.documentation_score + numVal));
        overlay.adjusted_value = adjusted.documentation_score;
      } else if (action.target_field === "coding_integrity_score") {
        overlay.original_value = adjusted.coding_score;
        adjusted.coding_score = Math.max(0, Math.min(100, adjusted.coding_score + numVal));
        overlay.adjusted_value = adjusted.coding_score;
      } else if (action.target_field === "necessity_support_score") {
        overlay.original_value = adjusted.necessity_score;
        adjusted.necessity_score = Math.max(0, Math.min(100, adjusted.necessity_score + numVal));
        overlay.adjusted_value = adjusted.necessity_score;
      }
      break;
    }
    case "escalation_override": {
      if (action.severity_mode === "escalation") {
        overlay.original_value = String(adjusted.escalation_required);
        adjusted.escalation_required = true;
        overlay.adjusted_value = "true";
      } else if (action.severity_mode === "informational") {
        // Cannot de-escalate protected categories
        if (!isProtectedEscalation(rec)) {
          overlay.original_value = String(adjusted.escalation_required);
          adjusted.escalation_required = false;
          overlay.adjusted_value = "false";
        } else {
          return null; // Silently skip — protected
        }
      }
      break;
    }
    case "issue_suppression": {
      if (action.target_field) {
        adjusted.suppressed_issue_ids.push(action.target_field);
        overlay.field_changed = action.target_field;
      }
      break;
    }
    case "issue_activation": {
      if (action.text) {
        adjusted.activated_issue_labels.push(action.text);
        overlay.field_changed = action.text;
      }
      break;
    }
    case "explanation_append": {
      if (action.text) {
        adjusted.explanation_additions.push(action.text);
      }
      break;
    }
    case "reimbursement_adjustment": {
      // Store as explanation for now — actual financial adjustments flow through the base engine
      if (action.text) {
        adjusted.explanation_additions.push(`[Reimbursement overlay] ${action.text}`);
      }
      break;
    }
  }

  return overlay;
}

function isProtectedEscalation(rec: SpecialtyReviewRecommendation): boolean {
  if (rec.specialty_type === "surgery") return true;
  return rec.issue_tags.some(t =>
    t.label.toLowerCase().includes("opioid") ||
    t.label.toLowerCase().includes("repeat injection") ||
    (t.type === "medical_necessity" && t.severity === "critical")
  );
}

// ─── Mutable adjustment tracking ───────────────────────

interface MutableAdjustment {
  documentation_score: number;
  coding_score: number;
  necessity_score: number;
  escalation_required: boolean;
  suppressed_issue_ids: string[];
  activated_issue_labels: string[];
  explanation_additions: string[];
}

// ─── Overlay Context ───────────────────────────────────

export interface OverlayContext {
  jurisdiction: string | null;
  client_id: string | null;
  claim_type: string | null;
  program: string | null;
  visit_count: number;
}

// ─── Support Level Recalculation ───────────────────────

function recalcSupportLevel(
  docScore: number,
  codingScore: number,
  necScore: number,
  escalation: boolean,
  hasCritical: boolean,
): SupportLevel {
  if (escalation || hasCritical) return "escalate";
  const avg = (docScore + codingScore + necScore) / 3;
  if (avg >= 70) return "supported";
  if (avg >= 55) return "partially_supported";
  if (avg >= 40) return "weakly_supported";
  return "unsupported";
}

// ─── Main Overlay Application ──────────────────────────

export function applyOverlays(
  recommendation: SpecialtyReviewRecommendation,
  profiles: PolicyProfile[],
  rulesByProfile: Map<string, OverlayRule[]>,
  context: OverlayContext,
): OverlayAdjustedRecommendation {
  const adjusted: MutableAdjustment = {
    documentation_score: recommendation.documentation_sufficiency_score,
    coding_score: recommendation.coding_integrity_score,
    necessity_score: recommendation.necessity_support_score,
    escalation_required: recommendation.escalation_required,
    suppressed_issue_ids: [],
    activated_issue_labels: [],
    explanation_additions: [],
  };

  const appliedOverlays: AppliedOverlay[] = [];

  // Sort profiles by overlay chain order
  const sortedProfiles = [...profiles]
    .filter(p => p.is_active)
    .sort((a, b) => {
      const aIdx = OVERLAY_CHAIN_ORDER.indexOf(a.scope);
      const bIdx = OVERLAY_CHAIN_ORDER.indexOf(b.scope);
      return aIdx - bIdx;
    });

  for (const profile of sortedProfiles) {
    const rules = (rulesByProfile.get(profile.id) || [])
      .filter(r => r.is_active)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of rules) {
      // Check all conditions (AND logic)
      const allMatch = rule.conditions.every(c =>
        evaluateCondition(c, recommendation, context)
      );

      if (!allMatch) continue;

      // Apply actions
      for (const action of rule.actions) {
        const applied = applyAction(action, recommendation, adjusted, rule, profile);
        if (applied) appliedOverlays.push(applied);
      }
    }
  }

  // Recalculate support level after overlays
  const hasCritical = recommendation.issue_tags.some(t => t.severity === "critical");
  const adjustedSupportLevel = recalcSupportLevel(
    adjusted.documentation_score,
    adjusted.coding_score,
    adjusted.necessity_score,
    adjusted.escalation_required,
    hasCritical,
  );

  return {
    base_support_level: recommendation.support_level,
    base_documentation_score: recommendation.documentation_sufficiency_score,
    base_coding_score: recommendation.coding_integrity_score,
    base_necessity_score: recommendation.necessity_support_score,
    base_escalation_required: recommendation.escalation_required,
    base_issue_count: recommendation.issue_tags.length,
    adjusted_support_level: adjustedSupportLevel,
    adjusted_documentation_score: adjusted.documentation_score,
    adjusted_coding_score: adjusted.coding_score,
    adjusted_necessity_score: adjusted.necessity_score,
    adjusted_escalation_required: adjusted.escalation_required,
    applied_overlays: appliedOverlays,
    overlay_explanation_additions: adjusted.explanation_additions,
    suppressed_issue_ids: adjusted.suppressed_issue_ids,
    activated_issue_labels: adjusted.activated_issue_labels,
  };
}

// ─── Simulation: Base vs Overlay comparison ────────────

export interface SimulationComparison {
  recommendation_id: string;
  base: {
    support_level: SupportLevel;
    documentation_score: number;
    coding_score: number;
    necessity_score: number;
    escalation_required: boolean;
    issue_count: number;
  };
  overlay: {
    support_level: SupportLevel;
    documentation_score: number;
    coding_score: number;
    necessity_score: number;
    escalation_required: boolean;
    issue_count: number;
    suppressed_count: number;
    activated_count: number;
    explanation_additions: string[];
  };
  deltas: {
    support_level_changed: boolean;
    documentation_delta: number;
    coding_delta: number;
    necessity_delta: number;
    escalation_changed: boolean;
  };
  applied_profiles: string[];
}

export function runSimulation(
  recommendation: SpecialtyReviewRecommendation,
  profiles: PolicyProfile[],
  rulesByProfile: Map<string, OverlayRule[]>,
  context: OverlayContext,
): SimulationComparison {
  const overlayResult = applyOverlays(recommendation, profiles, rulesByProfile, context);

  return {
    recommendation_id: recommendation.id,
    base: {
      support_level: recommendation.support_level,
      documentation_score: recommendation.documentation_sufficiency_score,
      coding_score: recommendation.coding_integrity_score,
      necessity_score: recommendation.necessity_support_score,
      escalation_required: recommendation.escalation_required,
      issue_count: recommendation.issue_tags.length,
    },
    overlay: {
      support_level: overlayResult.adjusted_support_level,
      documentation_score: overlayResult.adjusted_documentation_score,
      coding_score: overlayResult.adjusted_coding_score,
      necessity_score: overlayResult.adjusted_necessity_score,
      escalation_required: overlayResult.adjusted_escalation_required,
      issue_count: recommendation.issue_tags.length -
        overlayResult.suppressed_issue_ids.length +
        overlayResult.activated_issue_labels.length,
      suppressed_count: overlayResult.suppressed_issue_ids.length,
      activated_count: overlayResult.activated_issue_labels.length,
      explanation_additions: overlayResult.overlay_explanation_additions,
    },
    deltas: {
      support_level_changed: recommendation.support_level !== overlayResult.adjusted_support_level,
      documentation_delta: overlayResult.adjusted_documentation_score - recommendation.documentation_sufficiency_score,
      coding_delta: overlayResult.adjusted_coding_score - recommendation.coding_integrity_score,
      necessity_delta: overlayResult.adjusted_necessity_score - recommendation.necessity_support_score,
      escalation_changed: recommendation.escalation_required !== overlayResult.adjusted_escalation_required,
    },
    applied_profiles: overlayResult.applied_overlays.map(o => o.profile_name),
  };
}
