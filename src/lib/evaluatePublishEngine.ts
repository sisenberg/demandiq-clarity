/**
 * EvaluateIQ — Publish Eligibility Engine
 *
 * Validates whether an evaluation is ready for publication.
 * Enforces required valuation outputs and state constraints.
 */

import type { EvaluatePackageV1, EvaluatePackagePublicationState } from "@/types/evaluate-package-v1";
import { VALID_PUBLICATION_TRANSITIONS } from "@/types/evaluate-package-v1";
import type { CorridorOverrideEntry } from "@/lib/evaluateOverrideEngine";

// ─── Eligibility Result ─────────────────────────────────

export interface PublishEligibility {
  eligible: boolean;
  blockers: PublishBlocker[];
  warnings: PublishWarning[];
}

export interface PublishBlocker {
  code: string;
  message: string;
  field?: string;
}

export interface PublishWarning {
  code: string;
  message: string;
}

// ─── Eligibility Check ─────────────────────────────────

export function checkPublishEligibility(
  pkg: EvaluatePackageV1 | null,
  moduleStatus: string | undefined,
  overrides: CorridorOverrideEntry[],
): PublishEligibility {
  const blockers: PublishBlocker[] = [];
  const warnings: PublishWarning[] = [];

  if (!pkg) {
    blockers.push({ code: "NO_PACKAGE", message: "No evaluation package has been assembled." });
    return { eligible: false, blockers, warnings };
  }

  // State gate: must be in accepted or overridden state
  const status = pkg.evaluation_status;
  if (status === "draft") {
    blockers.push({
      code: "DRAFT_STATE",
      message: "Package must be accepted or overridden before publishing. Accept the recommended corridor or apply an override first.",
    });
  }
  if (status === "published") {
    blockers.push({
      code: "ALREADY_PUBLISHED",
      message: "This package version is already published. Reopen the evaluation to create a new version.",
    });
  }

  // Module status gate
  if (!moduleStatus || moduleStatus === "not_started") {
    blockers.push({
      code: "MODULE_NOT_STARTED",
      message: "EvaluateIQ must be started before publishing.",
    });
  }

  // Required valuation outputs
  const sc = pkg.settlement_corridor;
  if (sc.range_floor == null && sc.range_likely == null && sc.range_stretch == null) {
    blockers.push({
      code: "NO_CORRIDOR",
      message: "No settlement corridor has been computed. Run the valuation engine first.",
      field: "settlement_corridor",
    });
  }

  if (pkg.merits.merits_score === 0 && pkg.factor_summaries.length === 0) {
    blockers.push({
      code: "NO_MERITS",
      message: "No merits assessment available. Factor scoring must complete before publishing.",
      field: "merits",
    });
  }

  // Claim profile required
  if (!pkg.claim_profile.claimant_name) {
    blockers.push({ code: "NO_CLAIMANT", message: "Claimant name is required.", field: "claim_profile.claimant_name" });
  }
  if (!pkg.claim_profile.date_of_loss) {
    blockers.push({ code: "NO_DOL", message: "Date of loss is required.", field: "claim_profile.date_of_loss" });
  }

  // Pending supervisory reviews block publish
  const pendingReviews = overrides.filter(o => o.supervisor_review_status === "pending");
  if (pendingReviews.length > 0) {
    blockers.push({
      code: "PENDING_SUPERVISOR_REVIEW",
      message: `${pendingReviews.length} override(s) pending supervisory review. Resolve before publishing.`,
    });
  }

  // Warnings
  if (pkg.documentation_sufficiency.score < 40) {
    warnings.push({
      code: "LOW_DOC_SUFFICIENCY",
      message: `Documentation sufficiency is ${pkg.documentation_sufficiency.label} (${pkg.documentation_sufficiency.score}%). Package may have limited defensibility.`,
    });
  }

  if (pkg.settlement_corridor.confidence_level === "low" || pkg.settlement_corridor.confidence_level === "insufficient") {
    warnings.push({
      code: "LOW_CONFIDENCE",
      message: `Corridor confidence is ${pkg.settlement_corridor.confidence_level}. Consider reviewing inputs.`,
    });
  }

  if (!pkg.explanation_ledger) {
    warnings.push({
      code: "NO_LEDGER",
      message: "Explanation ledger not available. Package will not be fully traceable.",
    });
  }

  if (pkg.benchmark_summary.match_quality === "no_match" || pkg.benchmark_summary.match_quality === "weak") {
    warnings.push({
      code: "WEAK_BENCHMARK",
      message: "Benchmark support is weak or unavailable. Corridor defensibility may be reduced.",
    });
  }

  return {
    eligible: blockers.length === 0,
    blockers,
    warnings,
  };
}

// ─── Publication Metadata ──────────────────────────────

export interface PublicationMetadata {
  packageVersion: number;
  supersededVersion: number | null;
  publishedAt: string;
  publishedBy: string;
  engineVersion: string;
  scoringLogicVersion: string;
  sourceModule: string;
  sourceVersion: number;
  corridorSummary: {
    floor: number | null;
    likely: number | null;
    stretch: number | null;
    isOverridden: boolean;
  };
  confidenceLevel: string;
  completenessScore: number;
}

export function buildPublicationMetadata(
  pkg: EvaluatePackageV1,
  existingVersions: number[],
  userId: string,
): PublicationMetadata {
  const maxExisting = existingVersions.length > 0 ? Math.max(...existingVersions) : null;
  const sc = pkg.settlement_corridor;
  const isOverridden = sc.selected_floor != null || sc.selected_likely != null || sc.selected_stretch != null;

  return {
    packageVersion: pkg.package_version,
    supersededVersion: maxExisting && maxExisting < pkg.package_version ? maxExisting : null,
    publishedAt: new Date().toISOString(),
    publishedBy: userId,
    engineVersion: pkg.engine_version,
    scoringLogicVersion: pkg.scoring_logic_version,
    sourceModule: pkg.source_module,
    sourceVersion: pkg.source_package_version,
    corridorSummary: {
      floor: isOverridden ? sc.selected_floor : sc.range_floor,
      likely: isOverridden ? sc.selected_likely : sc.range_likely,
      stretch: isOverridden ? sc.selected_stretch : sc.range_stretch,
      isOverridden,
    },
    confidenceLevel: sc.confidence_level,
    completenessScore: pkg.completeness_score,
  };
}
