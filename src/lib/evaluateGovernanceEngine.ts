/**
 * EvaluateIQ — Governance Policy Engine
 *
 * Defines and enforces forbidden-factor policies for the valuation engine.
 * Prevents prohibited logic from influencing base merits valuation.
 *
 * FORBIDDEN IN BASE MERITS:
 *  - Plaintiff attorney identity or trial frequency
 *  - Representation status alone
 *  - Provider blacklists
 *  - Race, ethnicity, religion, or protected-class proxies
 *  - Neighborhood/ZIP-code proxies for demographics
 *  - Undocumented suppression logic
 *  - Raw LLM dollar valuation outputs
 *
 * Policy version: 1.0.0
 */

import type { FactorDefinition } from "@/types/factor-taxonomy";

// ─── Policy Version ────────────────────────────────────

export const GOVERNANCE_POLICY_VERSION = "1.0.0";
export const GOVERNANCE_POLICY_EFFECTIVE_DATE = "2026-03-13";

// ─── Forbidden Factor Categories ───────────────────────

export interface ForbiddenFactorCategory {
  id: string;
  label: string;
  description: string;
  examples: string[];
  /** Pattern matchers: factor IDs or partial matches that trigger this rule */
  id_patterns: string[];
  /** Input dependency names that are forbidden */
  forbidden_dependencies: string[];
}

export const FORBIDDEN_FACTOR_CATEGORIES: ForbiddenFactorCategory[] = [
  {
    id: "attorney_identity",
    label: "Plaintiff Attorney Identity",
    description: "Factors based on attorney name, firm, trial frequency, or reputation scoring.",
    examples: [
      "Attorney trial record",
      "Firm settlement history",
      "Attorney aggressiveness score",
    ],
    id_patterns: ["attorney_identity", "attorney_trial", "attorney_reputation", "firm_score", "attorney_aggress"],
    forbidden_dependencies: ["attorney_name", "attorney_firm", "attorney_trial_frequency", "attorney_score"],
  },
  {
    id: "representation_status",
    label: "Representation Status",
    description: "Using whether a claimant is represented or pro se as a standalone valuation factor.",
    examples: [
      "Pro se discount",
      "Represented claimant uplift",
    ],
    id_patterns: ["representation_status", "pro_se", "unrepresented"],
    forbidden_dependencies: ["is_represented", "representation_status"],
  },
  {
    id: "provider_blacklist",
    label: "Provider Blacklists",
    description: "Suppressing or discounting treatment based on provider identity rather than clinical merit.",
    examples: [
      "Provider reputation score",
      "Known litigation mill flag",
      "Provider blacklist lookup",
    ],
    id_patterns: ["provider_blacklist", "provider_reputation", "litigation_mill", "provider_score"],
    forbidden_dependencies: ["provider_blacklist", "provider_reputation_score", "provider_mill_flag"],
  },
  {
    id: "protected_class_proxy",
    label: "Protected Class Proxies",
    description: "Race, ethnicity, religion, national origin, gender, age (beyond medical relevance), disability status, or sexual orientation.",
    examples: [
      "Demographic profiling",
      "Ethnicity-based adjustment",
      "Religious practice factor",
    ],
    id_patterns: ["race", "ethnicity", "religion", "national_origin", "gender_factor", "demographic"],
    forbidden_dependencies: ["race", "ethnicity", "religion", "national_origin", "gender", "sexual_orientation"],
  },
  {
    id: "neighborhood_proxy",
    label: "Neighborhood / Geographic Proxies",
    description: "Using ZIP code, neighborhood, or census-tract data as a proxy for demographics or socioeconomic status.",
    examples: [
      "ZIP code income adjustment",
      "Neighborhood risk score",
      "Census tract weighting",
    ],
    id_patterns: ["zip_code_factor", "neighborhood", "census_tract", "socioeconomic"],
    forbidden_dependencies: ["zip_code", "neighborhood_score", "census_data", "median_income"],
  },
  {
    id: "undocumented_suppression",
    label: "Undocumented Suppression Logic",
    description: "Any hidden logic that silently reduces corridor values without explanation or audit trail.",
    examples: [
      "Silent discount factor",
      "Hidden reduction multiplier",
      "Unlogged corridor cap",
    ],
    id_patterns: ["silent_discount", "hidden_reduction", "unlogged_cap", "shadow_factor"],
    forbidden_dependencies: [],
  },
  {
    id: "raw_llm_valuation",
    label: "Raw LLM Dollar Outputs",
    description: "Using raw dollar amounts from language models without structured derivation from evidence-based factors.",
    examples: [
      "AI-predicted settlement amount",
      "LLM valuation estimate",
      "Model-generated dollar range",
    ],
    id_patterns: ["llm_valuation", "ai_predicted_amount", "model_estimate", "raw_ai_output"],
    forbidden_dependencies: ["llm_dollar_output", "ai_settlement_prediction", "model_valuation"],
  },
];

// ─── Governance Validation Result ──────────────────────

export interface GovernanceViolation {
  factor_id: string;
  factor_name: string;
  category_id: string;
  category_label: string;
  violation_type: "id_match" | "dependency_match" | "prohibited_flag";
  detail: string;
  severity: "critical";
}

export interface GovernanceValidation {
  valid: boolean;
  policy_version: string;
  effective_date: string;
  factors_scanned: number;
  violations: GovernanceViolation[];
  /** Factors explicitly marked prohibited in registry */
  prohibited_factors: string[];
  /** Active factor count after filtering */
  active_factor_count: number;
  validated_at: string;
}

// ─── Validation Engine ─────────────────────────────────

/**
 * Validates a set of factor definitions against the forbidden-factor policy.
 * Returns violations for any factor that matches forbidden patterns.
 */
export function validateFactorGovernance(factors: FactorDefinition[]): GovernanceValidation {
  const violations: GovernanceViolation[] = [];
  const prohibitedFactors: string[] = [];

  for (const factor of factors) {
    // Check explicit prohibited flag
    if (factor.prohibited) {
      prohibitedFactors.push(factor.id);
      continue; // Already blocked by registry — not a violation
    }

    // Check against each forbidden category
    for (const category of FORBIDDEN_FACTOR_CATEGORIES) {
      // ID pattern match
      const idMatch = category.id_patterns.some(pattern =>
        factor.id.toLowerCase().includes(pattern.toLowerCase())
      );
      if (idMatch) {
        violations.push({
          factor_id: factor.id,
          factor_name: factor.name,
          category_id: category.id,
          category_label: category.label,
          violation_type: "id_match",
          detail: `Factor ID "${factor.id}" matches forbidden pattern in category "${category.label}".`,
          severity: "critical",
        });
      }

      // Dependency match
      const depMatch = factor.input_dependencies.some(dep =>
        category.forbidden_dependencies.some(fd =>
          dep.toLowerCase().includes(fd.toLowerCase())
        )
      );
      if (depMatch) {
        const matchedDeps = factor.input_dependencies.filter(dep =>
          category.forbidden_dependencies.some(fd => dep.toLowerCase().includes(fd.toLowerCase()))
        );
        violations.push({
          factor_id: factor.id,
          factor_name: factor.name,
          category_id: category.id,
          category_label: category.label,
          violation_type: "dependency_match",
          detail: `Factor "${factor.name}" depends on forbidden input(s): ${matchedDeps.join(", ")}.`,
          severity: "critical",
        });
      }
    }
  }

  const activeFactors = factors.filter(f => f.is_active && !f.prohibited);

  return {
    valid: violations.length === 0,
    policy_version: GOVERNANCE_POLICY_VERSION,
    effective_date: GOVERNANCE_POLICY_EFFECTIVE_DATE,
    factors_scanned: factors.length,
    violations,
    prohibited_factors: prohibitedFactors,
    active_factor_count: activeFactors.length,
    validated_at: new Date().toISOString(),
  };
}

// ─── Runtime Guard ─────────────────────────────────────

/**
 * Runtime guard that throws if any active factor violates governance policy.
 * Called at scoring engine initialization.
 */
export function enforceGovernancePolicy(factors: FactorDefinition[]): GovernanceValidation {
  const validation = validateFactorGovernance(factors);
  if (!validation.valid) {
    const violationSummary = validation.violations
      .map(v => `[${v.category_label}] ${v.factor_name}: ${v.detail}`)
      .join("; ");
    throw new Error(
      `GOVERNANCE VIOLATION: ${validation.violations.length} forbidden factor(s) detected. ` +
      `Policy v${GOVERNANCE_POLICY_VERSION}. Details: ${violationSummary}`
    );
  }
  return validation;
}

// ─── Governance Summary (for UI) ───────────────────────

export interface GovernanceSummary {
  policyVersion: string;
  effectiveDate: string;
  totalFactors: number;
  activeFactors: number;
  prohibitedFactors: number;
  forbiddenCategories: number;
  governanceStatus: "compliant" | "violation";
  violations: GovernanceViolation[];
  logicVersions: {
    scoringEngine: string;
    benchmarkEngine: string;
    corridorEngine: string;
    profileWeighting: string;
  };
}

export function buildGovernanceSummary(
  allFactors: FactorDefinition[],
  logicVersions: GovernanceSummary["logicVersions"],
): GovernanceSummary {
  const validation = validateFactorGovernance(allFactors);
  return {
    policyVersion: GOVERNANCE_POLICY_VERSION,
    effectiveDate: GOVERNANCE_POLICY_EFFECTIVE_DATE,
    totalFactors: allFactors.length,
    activeFactors: validation.active_factor_count,
    prohibitedFactors: validation.prohibited_factors.length,
    forbiddenCategories: FORBIDDEN_FACTOR_CATEGORIES.length,
    governanceStatus: validation.valid ? "compliant" : "violation",
    violations: validation.violations,
    logicVersions,
  };
}
