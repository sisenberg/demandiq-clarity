/**
 * NegotiateIQ — View Model Adapter
 *
 * Maps EvaluatePackagePayload or EvaluatePackageV1 (read-only upstream)
 * into a typed NegotiationViewModel for UI consumption without mutation.
 */

import type { EvaluatePackagePayload, ValuationRunAssumptionSummary } from "@/types/evaluate-persistence";
import type { EvaluatePackageV1 } from "@/types/evaluate-package-v1";
import type { ResolvedEvalPackage } from "@/hooks/useNegotiateEvalPackage";
import { isEvaluatePackageV1Shape } from "@/lib/evaluatePackageValidator";

/** Normalized flat view used internally for mapping */
interface NormalizedEvalPayload {
  package_version: number;
  engine_version: string;
  source_module: "demandiq" | "revieweriq";
  source_package_version: number;
  range_floor: number | null;
  range_likely: number | null;
  range_stretch: number | null;
  confidence: number | null;
  selected_floor: number | null;
  selected_likely: number | null;
  selected_stretch: number | null;
  authority_recommendation: number | null;
  rationale_notes: string;
  driver_summaries: ValuationRunAssumptionSummary[];
  explanation_ledger: EvaluatePackagePayload["explanation_ledger"];
  assumptions: Array<{ category: string; key: string; value: string; reason: string }>;
  total_billed: number;
  total_reviewed: number | null;
  completeness_score: number;
}

function normalizePayload(raw: EvaluatePackagePayload | EvaluatePackageV1): NormalizedEvalPayload {
  if (isEvaluatePackageV1Shape(raw)) {
    const v1 = raw as EvaluatePackageV1;
    return {
      package_version: v1.package_version,
      engine_version: v1.engine_version,
      source_module: v1.source_module,
      source_package_version: v1.source_package_version,
      range_floor: v1.settlement_corridor.range_floor,
      range_likely: v1.settlement_corridor.range_likely,
      range_stretch: v1.settlement_corridor.range_stretch,
      confidence: v1.settlement_corridor.confidence,
      selected_floor: v1.settlement_corridor.selected_floor,
      selected_likely: v1.settlement_corridor.selected_likely,
      selected_stretch: v1.settlement_corridor.selected_stretch,
      authority_recommendation: v1.settlement_corridor.authority_recommendation,
      rationale_notes: v1.settlement_corridor.rationale_notes,
      driver_summaries: v1.driver_summaries,
      explanation_ledger: v1.explanation_ledger,
      assumptions: v1.assumptions.map(a => ({ category: a.category, key: a.key, value: a.value, reason: a.reason })),
      total_billed: v1.total_billed,
      total_reviewed: v1.total_reviewed,
      completeness_score: v1.completeness_score,
    };
  }
  return raw as NormalizedEvalPayload;
}

// ─── View Model Types ───────────────────────────────────

export interface NegotiateProvenance {
  packageId: string;
  packageVersion: number;
  engineVersion: string;
  sourceModule: "demandiq" | "revieweriq";
  sourcePackageVersion: number;
  completedAt: string | null;
  completedBy: string | null;
}

export interface NegotiateValuationRange {
  floor: number | null;
  likely: number | null;
  stretch: number | null;
  confidence: number | null;
  /** Human-selected working range (may differ from engine range) */
  selectedFloor: number | null;
  selectedLikely: number | null;
  selectedStretch: number | null;
  authorityRecommendation: number | null;
}

export interface NegotiateSpecialsSummary {
  totalBilled: number;
  totalReviewed: number | null;
  reductionPercent: number | null;
}

export interface NegotiateDriverSummary {
  key: string;
  label: string;
  impact: "expander" | "reducer" | "neutral";
  description: string;
}

export interface NegotiateRisk {
  key: string;
  label: string;
  description: string;
  category: "gap" | "credibility" | "venue" | "causation" | "treatment" | "witness" | "liability" | "other";
}

export interface NegotiateAssumption {
  category: string;
  key: string;
  value: string;
  reason: string;
}

export interface NegotiateRepresentationView {
  /** Current representation status */
  status: "represented" | "unrepresented" | "unknown";
  /** Whether a transition between represented/unrepresented occurred */
  transitioned: boolean;
  /** Attorney retention risk (0-100), from EvaluatePackage */
  retentionRisk: number;
  /** Current attorney name */
  attorneyName: string | null;
  /** Current firm name */
  firmName: string | null;
  /** History count */
  historyCount: number;
  /** Whether attorney was retained during the claim */
  attorneyRetainedDuringClaim: boolean;
  /** Whether attorney was retained after initial offer */
  attorneyRetainedAfterInitialOffer: boolean;
}

export interface NegotiationViewModel {
  /** Read-only flag — UI must enforce no mutations */
  readonly: true;

  /** Package provenance — displayed prominently */
  provenance: NegotiateProvenance;

  /** Valuation range from EvaluateIQ */
  valuationRange: NegotiateValuationRange;

  /** Specials summary */
  specials: NegotiateSpecialsSummary;

  /** Key drivers increasing value */
  expanders: NegotiateDriverSummary[];

  /** Key drivers decreasing value */
  reducers: NegotiateDriverSummary[];

  /** Neutral / context drivers */
  neutralDrivers: NegotiateDriverSummary[];

  /** Notable risks, gaps, and concerns */
  risks: NegotiateRisk[];

  /** Adopted assumptions from evaluation */
  assumptions: NegotiateAssumption[];

  /** Rationale notes from evaluator */
  rationaleNotes: string;

  /** Completeness score at publish time */
  completenessScore: number;

  /** Representation context from EvaluatePackage */
  representation: NegotiateRepresentationView;
}

// ─── Adapter ────────────────────────────────────────────

export function buildNegotiationViewModel(
  pkg: ResolvedEvalPackage
): NegotiationViewModel {
  const p = normalizePayload(pkg.package_payload);

  const drivers = p.driver_summaries ?? [];
  const expanders = drivers.filter((d) => d.impact === "expander");
  const reducers = drivers.filter((d) => d.impact === "reducer");
  const neutralDrivers = drivers.filter((d) => d.impact === "neutral");

  // Derive risks from reducers + ledger concerns
  const risks = deriveRisks(p);

  const totalBilled = p.total_billed ?? 0;
  const totalReviewed = p.total_reviewed;
  const reductionPercent =
    totalReviewed != null && totalBilled > 0
      ? Math.round(((totalBilled - totalReviewed) / totalBilled) * 100)
      : null;

  return {
    readonly: true,

    provenance: {
      packageId: pkg.id,
      packageVersion: p.package_version,
      engineVersion: p.engine_version,
      sourceModule: p.source_module,
      sourcePackageVersion: p.source_package_version,
      completedAt: pkg.completed_at,
      completedBy: pkg.completed_by,
    },

    valuationRange: {
      floor: p.range_floor,
      likely: p.range_likely,
      stretch: p.range_stretch,
      confidence: p.confidence,
      selectedFloor: p.selected_floor,
      selectedLikely: p.selected_likely,
      selectedStretch: p.selected_stretch,
      authorityRecommendation: p.authority_recommendation,
    },

    specials: {
      totalBilled,
      totalReviewed,
      reductionPercent,
    },

    expanders,
    reducers,
    neutralDrivers,
    risks,

    assumptions: (p.assumptions ?? []).map((a) => ({
      category: a.category,
      key: a.key,
      value: a.value,
      reason: a.reason,
    })),

    rationaleNotes: p.rationale_notes ?? "",
    completenessScore: p.completeness_score ?? 0,

    representation: buildRepresentationView(pkg),
  };
}

// ─── Risk Derivation ────────────────────────────────────

function deriveRisks(p: NormalizedEvalPayload): NegotiateRisk[] {
  const risks: NegotiateRisk[] = [];

  // Mine reducers for risk signals
  const reducers = (p.driver_summaries ?? []).filter((d) => d.impact === "reducer");
  for (const r of reducers) {
    const category = inferRiskCategory(r);
    risks.push({
      key: r.key,
      label: r.label,
      description: r.description,
      category,
    });
  }

  // Mine ledger for concerns
  if (p.explanation_ledger?.entries) {
    for (const entry of p.explanation_ledger.entries) {
      if (entry.direction === "decrease" && !risks.some((r) => r.key === (entry.driver_key ?? entry.entry_key))) {
        risks.push({
          key: entry.driver_key ?? entry.entry_key,
          label: entry.title,
          description: entry.narrative,
          category: inferRiskCategoryFromKey(entry.driver_key ?? entry.entry_key),
        });
      }
    }
  }

  return risks;
}

function inferRiskCategory(d: ValuationRunAssumptionSummary): NegotiateRisk["category"] {
  const k = (d.key + " " + d.label + " " + d.description).toLowerCase();
  if (k.includes("credib")) return "credibility";
  if (k.includes("venue") || k.includes("jurisdiction")) return "venue";
  if (k.includes("causation") || k.includes("pre-existing") || k.includes("preexist")) return "causation";
  if (k.includes("gap") || k.includes("compliance") || k.includes("non-compl")) return "gap";
  if (k.includes("treatment") || k.includes("chiro") || k.includes("therapy")) return "treatment";
  if (k.includes("witness")) return "witness";
  if (k.includes("liabil") || k.includes("negligence") || k.includes("fault")) return "liability";
  return "other";
}

function inferRiskCategoryFromKey(key: string): NegotiateRisk["category"] {
  const k = key.toLowerCase();
  if (k.includes("credib")) return "credibility";
  if (k.includes("venue")) return "venue";
  if (k.includes("causat") || k.includes("pre_exist")) return "causation";
  if (k.includes("gap") || k.includes("compliance")) return "gap";
  if (k.includes("treatment")) return "treatment";
  if (k.includes("witness")) return "witness";
  if (k.includes("liabil") || k.includes("negligence")) return "liability";
  return "other";
}

// ─── Representation View Builder ────────────────────────

function buildRepresentationView(pkg: ResolvedEvalPackage): NegotiateRepresentationView {
  if (pkg.package_v1?.representation_context) {
    const rc = pkg.package_v1.representation_context;
    return {
      status: rc.representation_status_current,
      transitioned: rc.representation_transition_flag,
      retentionRisk: rc.attorney_retention_risk,
      attorneyName: rc.current_attorney_name,
      firmName: rc.current_firm_name,
      historyCount: rc.representation_history_count,
      attorneyRetainedDuringClaim: rc.attorney_retained_during_claim_flag,
      attorneyRetainedAfterInitialOffer: rc.attorney_retained_after_initial_offer_flag,
    };
  }
  return {
    status: "unknown",
    transitioned: false,
    retentionRisk: 0,
    attorneyName: null,
    firmName: null,
    historyCount: 0,
    attorneyRetainedDuringClaim: false,
    attorneyRetainedAfterInitialOffer: false,
  };
}
