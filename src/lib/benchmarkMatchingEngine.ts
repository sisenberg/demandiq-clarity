/**
 * EvaluateIQ — Benchmark Matching Engine
 *
 * Matches the current case against a corpus of historical outcomes
 * across configurable dimensions. Produces transparent match explanations,
 * similarity scores, and outlier indicators.
 *
 * Designed for seeded data now; real datasets slot in via the same interface.
 *
 * Engine version: 1.0.0
 */

import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";

export const BENCHMARK_ENGINE_VERSION = "1.0.0";

// ─── Types ─────────────────────────────────────────────

export type MatchQuality = "strong" | "moderate" | "weak" | "insufficient";

export type BenchmarkDimensionKey =
  | "injury_pattern"
  | "treatment_intensity"
  | "surgery_status"
  | "impairment_permanency"
  | "specials_band"
  | "functional_impact"
  | "venue"
  | "liability_posture"
  | "comparative_negligence";

export interface BenchmarkDimension {
  key: BenchmarkDimensionKey;
  label: string;
  weight: number;
  current_value: string;
  /** How this dimension was evaluated */
  scoring_method: string;
}

export interface BenchmarkCase {
  id: string;
  claim_number: string;
  jurisdiction: string;
  venue_county: string;
  injury_categories: string[];
  primary_body_parts: string[];
  has_surgery: boolean;
  has_permanency: boolean;
  has_impairment_rating: boolean;
  treatment_duration_days: number;
  provider_count: number;
  billed_specials: number;
  reviewed_specials: number;
  comparative_negligence_pct: number;
  liability_posture: string;
  settlement_amount: number;
  /** Flags for data quality */
  confidence_flags: string[];
}

export interface BenchmarkMatchResult {
  case_id: string;
  claim_number: string;
  settlement_amount: number;
  overall_similarity: number; // 0–100
  dimension_scores: DimensionMatchScore[];
  match_reasons: string[];
  key_differences: string[];
  is_outlier: boolean;
  outlier_reason: string | null;
  /** Whether this case was selected as a close match */
  selected: boolean;
  /** Why excluded if not selected */
  exclusion_reason: string | null;
}

export interface DimensionMatchScore {
  dimension: BenchmarkDimensionKey;
  label: string;
  similarity: number; // 0–100
  current_value: string;
  benchmark_value: string;
  contributes_to_match: boolean;
}

export interface BenchmarkSummary {
  engine_version: string;
  computed_at: string;

  /** Matching dimensions used */
  dimensions: BenchmarkDimension[];

  /** All candidates evaluated */
  candidate_count: number;
  /** Close matches selected */
  selected_count: number;
  /** Overall match quality */
  match_quality: MatchQuality;

  /** Selected close matches */
  selected_matches: BenchmarkMatchResult[];
  /** All candidates (including excluded) */
  all_candidates: BenchmarkMatchResult[];

  /** Aggregate settlement stats from selected matches */
  settlement_stats: {
    median: number | null;
    p25: number | null;
    p75: number | null;
    mean: number | null;
    min: number | null;
    max: number | null;
  };

  /** Top match reasons across selected cases */
  top_match_reasons: string[];
  /** Common differences */
  top_differences: string[];

  /** Outlier count */
  outlier_count: number;

  /** Confidence explanation */
  confidence_explanation: string;
}

// ─── Dimension Weights ─────────────────────────────────

const DIMENSION_CONFIGS: { key: BenchmarkDimensionKey; label: string; weight: number }[] = [
  { key: "injury_pattern", label: "Injury Pattern", weight: 20 },
  { key: "treatment_intensity", label: "Treatment Intensity", weight: 12 },
  { key: "surgery_status", label: "Surgery Status", weight: 15 },
  { key: "impairment_permanency", label: "Impairment / Permanency", weight: 12 },
  { key: "specials_band", label: "Specials Band", weight: 12 },
  { key: "functional_impact", label: "Functional Impact", weight: 8 },
  { key: "venue", label: "Venue / Jurisdiction", weight: 10 },
  { key: "liability_posture", label: "Liability Posture", weight: 7 },
  { key: "comparative_negligence", label: "Comparative Negligence", weight: 4 },
];

const SELECTION_THRESHOLD = 45; // Minimum similarity to be "selected"
const OUTLIER_Z_THRESHOLD = 2.0;

// ─── Entry Point ───────────────────────────────────────

export function computeBenchmarkMatching(
  snapshot: EvaluateIntakeSnapshot,
  corpus: BenchmarkCase[] = SEEDED_BENCHMARK_CORPUS,
): BenchmarkSummary {
  const caseProfile = extractCaseProfile(snapshot);
  const dimensions = buildDimensions(caseProfile);

  // Score every candidate
  const allCandidates: BenchmarkMatchResult[] = corpus.map(bc =>
    scoreCandidate(bc, caseProfile, dimensions)
  );

  // Sort by similarity descending
  allCandidates.sort((a, b) => b.overall_similarity - a.overall_similarity);

  // Select close matches
  const selected = allCandidates.filter(c => c.overall_similarity >= SELECTION_THRESHOLD);
  selected.forEach(c => { c.selected = true; c.exclusion_reason = null; });

  const excluded = allCandidates.filter(c => c.overall_similarity < SELECTION_THRESHOLD);
  excluded.forEach(c => {
    c.selected = false;
    c.exclusion_reason = `Similarity ${c.overall_similarity}% below threshold (${SELECTION_THRESHOLD}%)`;
  });

  // Detect outliers in selected set
  if (selected.length >= 3) {
    const amounts = selected.map(s => s.settlement_amount);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const stdDev = Math.sqrt(amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / amounts.length);
    if (stdDev > 0) {
      for (const m of selected) {
        const z = Math.abs((m.settlement_amount - mean) / stdDev);
        if (z > OUTLIER_Z_THRESHOLD) {
          m.is_outlier = true;
          m.outlier_reason = `Settlement $${m.settlement_amount.toLocaleString()} is ${z.toFixed(1)} standard deviations from mean ($${Math.round(mean).toLocaleString()})`;
        }
      }
    }
  }

  // Stats from selected (non-outlier)
  const validSelected = selected.filter(s => !s.is_outlier);
  const stats = computeStats(validSelected.map(s => s.settlement_amount));

  // Aggregate reasons
  const reasonCounts = new Map<string, number>();
  const diffCounts = new Map<string, number>();
  for (const m of selected) {
    m.match_reasons.forEach(r => reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1));
    m.key_differences.forEach(d => diffCounts.set(d, (diffCounts.get(d) ?? 0) + 1));
  }
  const topReasons = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
  const topDiffs = [...diffCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);

  const matchQuality = qualityFromCount(selected.length, validSelected.length);
  const confidence = buildConfidenceExplanation(selected.length, validSelected.length, matchQuality, corpus.length);

  return {
    engine_version: BENCHMARK_ENGINE_VERSION,
    computed_at: new Date().toISOString(),
    dimensions,
    candidate_count: corpus.length,
    selected_count: selected.length,
    match_quality: matchQuality,
    selected_matches: selected,
    all_candidates: allCandidates,
    settlement_stats: stats,
    top_match_reasons: topReasons,
    top_differences: topDiffs,
    outlier_count: selected.filter(s => s.is_outlier).length,
    confidence_explanation: confidence,
  };
}

// ─── Case Profile Extraction ───────────────────────────

interface CaseProfile {
  injury_categories: string[];
  body_parts: string[];
  has_surgery: boolean;
  has_permanency: boolean;
  has_impairment: boolean;
  treatment_count: number;
  provider_count: number;
  treatment_duration_days: number;
  billed_specials: number;
  reviewed_specials: number;
  jurisdiction: string;
  venue_county: string;
  comparative_negligence_pct: number;
  liability_posture: string;
  has_severe_injuries: boolean;
}

function extractCaseProfile(snap: EvaluateIntakeSnapshot): CaseProfile {
  const treatments = snap.treatment_timeline;
  const sortedDates = treatments
    .filter(t => t.treatment_date)
    .map(t => new Date(t.treatment_date!).getTime())
    .sort((a, b) => a - b);

  const durationDays = sortedDates.length >= 2
    ? Math.round((sortedDates[sortedDates.length - 1] - sortedDates[0]) / (1000 * 60 * 60 * 24))
    : 0;

  const billed = snap.medical_billing.reduce((s, b) => s + b.billed_amount, 0);
  const reviewed = snap.medical_billing.reduce((s, b) => s + (b.reviewer_recommended_amount ?? b.paid_amount ?? b.billed_amount), 0);

  return {
    injury_categories: [...new Set(snap.injuries.map(i => i.body_region))],
    body_parts: [...new Set(snap.injuries.map(i => i.body_part))],
    has_surgery: snap.clinical_flags.has_surgery,
    has_permanency: snap.clinical_flags.has_permanency_indicators,
    has_impairment: snap.clinical_flags.has_impairment_rating,
    treatment_count: treatments.length,
    provider_count: new Set(treatments.map(t => t.provider_name)).size,
    treatment_duration_days: durationDays,
    billed_specials: billed,
    reviewed_specials: reviewed,
    jurisdiction: snap.venue_jurisdiction.jurisdiction_state.value,
    venue_county: snap.venue_jurisdiction.venue_county.value ?? "",
    comparative_negligence_pct: snap.comparative_negligence.claimant_negligence_percentage.value ?? 0,
    liability_posture: snap.liability_facts.some(f => f.supports_liability) ? "favorable" : "disputed",
    has_severe_injuries: snap.injuries.some(i => i.severity === "severe" || i.severity === "critical"),
  };
}

function buildDimensions(profile: CaseProfile): BenchmarkDimension[] {
  return DIMENSION_CONFIGS.map(cfg => ({
    key: cfg.key,
    label: cfg.label,
    weight: cfg.weight,
    current_value: dimensionValue(cfg.key, profile),
    scoring_method: dimensionMethod(cfg.key),
  }));
}

function dimensionValue(key: BenchmarkDimensionKey, p: CaseProfile): string {
  switch (key) {
    case "injury_pattern": return p.body_parts.join(", ") || "None";
    case "treatment_intensity": return `${p.treatment_count} visits / ${p.treatment_duration_days}d`;
    case "surgery_status": return p.has_surgery ? "Yes" : "No";
    case "impairment_permanency": return p.has_permanency ? (p.has_impairment ? "Rated" : "Indicated") : "None";
    case "specials_band": return `$${p.reviewed_specials.toLocaleString()}`;
    case "functional_impact": return p.has_severe_injuries ? "Severe" : p.has_impairment ? "Moderate" : "Mild";
    case "venue": return `${p.jurisdiction}${p.venue_county ? ` / ${p.venue_county}` : ""}`;
    case "liability_posture": return p.liability_posture;
    case "comparative_negligence": return `${p.comparative_negligence_pct}%`;
  }
}

function dimensionMethod(key: BenchmarkDimensionKey): string {
  switch (key) {
    case "injury_pattern": return "Jaccard overlap of body regions";
    case "treatment_intensity": return "Normalized duration and visit count comparison";
    case "surgery_status": return "Binary match";
    case "impairment_permanency": return "Ordinal proximity (none < indicated < rated)";
    case "specials_band": return "Log-ratio within ±50% band";
    case "functional_impact": return "Ordinal severity proximity";
    case "venue": return "State match (exact) + county bonus";
    case "liability_posture": return "Categorical match";
    case "comparative_negligence": return "Absolute difference within 20% tolerance";
  }
}

// ─── Candidate Scoring ─────────────────────────────────

function scoreCandidate(
  bc: BenchmarkCase,
  profile: CaseProfile,
  dimensions: BenchmarkDimension[],
): BenchmarkMatchResult {
  const dimScores: DimensionMatchScore[] = [];
  const reasons: string[] = [];
  const diffs: string[] = [];

  for (const dim of dimensions) {
    const score = scoreDimension(dim.key, profile, bc);
    const bcValue = benchmarkDimensionValue(dim.key, bc);
    dimScores.push({
      dimension: dim.key,
      label: dim.label,
      similarity: score,
      current_value: dim.current_value,
      benchmark_value: bcValue,
      contributes_to_match: score >= 60,
    });
    if (score >= 75) reasons.push(`${dim.label}: closely matched`);
    else if (score < 30) diffs.push(`${dim.label}: significant difference`);
  }

  // Weighted average
  let wSum = 0, wTotal = 0;
  for (let i = 0; i < dimScores.length; i++) {
    wSum += dimScores[i].similarity * DIMENSION_CONFIGS[i].weight;
    wTotal += DIMENSION_CONFIGS[i].weight;
  }
  const overall = Math.round(wSum / wTotal);

  return {
    case_id: bc.id,
    claim_number: bc.claim_number,
    settlement_amount: bc.settlement_amount,
    overall_similarity: overall,
    dimension_scores: dimScores,
    match_reasons: reasons,
    key_differences: diffs,
    is_outlier: false,
    outlier_reason: null,
    selected: false,
    exclusion_reason: null,
  };
}

function scoreDimension(key: BenchmarkDimensionKey, p: CaseProfile, bc: BenchmarkCase): number {
  switch (key) {
    case "injury_pattern": {
      const current = new Set(p.injury_categories);
      const bench = new Set(bc.primary_body_parts.map(b => b.toLowerCase()));
      if (current.size === 0 && bench.size === 0) return 100;
      const union = new Set([...current, ...bench]);
      const intersection = [...current].filter(x => bench.has(x));
      return Math.round((intersection.length / union.size) * 100);
    }
    case "treatment_intensity": {
      const durationSim = 100 - Math.min(100, Math.abs(p.treatment_duration_days - bc.treatment_duration_days) / 3);
      const provSim = 100 - Math.min(100, Math.abs(p.provider_count - bc.provider_count) * 15);
      return Math.round((durationSim + provSim) / 2);
    }
    case "surgery_status":
      return p.has_surgery === bc.has_surgery ? 100 : 0;
    case "impairment_permanency": {
      const pLevel = p.has_impairment ? 2 : p.has_permanency ? 1 : 0;
      const bLevel = bc.has_impairment_rating ? 2 : bc.has_permanency ? 1 : 0;
      return 100 - Math.abs(pLevel - bLevel) * 50;
    }
    case "specials_band": {
      if (p.reviewed_specials === 0 && bc.reviewed_specials === 0) return 100;
      const ratio = Math.max(p.reviewed_specials, 1) / Math.max(bc.reviewed_specials, 1);
      const logRatio = Math.abs(Math.log(ratio));
      return Math.round(Math.max(0, 100 - logRatio * 120));
    }
    case "functional_impact": {
      const pLevel = p.has_severe_injuries ? 2 : p.has_impairment ? 1 : 0;
      const bLevel = bc.has_permanency ? 2 : bc.has_impairment_rating ? 1 : 0;
      return 100 - Math.abs(pLevel - bLevel) * 40;
    }
    case "venue":
      if (p.jurisdiction === bc.jurisdiction) return bc.venue_county.toLowerCase() === p.venue_county.toLowerCase() ? 100 : 75;
      return 20;
    case "liability_posture":
      return p.liability_posture === bc.liability_posture ? 100 : 30;
    case "comparative_negligence": {
      const diff = Math.abs(p.comparative_negligence_pct - bc.comparative_negligence_pct);
      return Math.round(Math.max(0, 100 - diff * 5));
    }
  }
}

function benchmarkDimensionValue(key: BenchmarkDimensionKey, bc: BenchmarkCase): string {
  switch (key) {
    case "injury_pattern": return bc.primary_body_parts.join(", ") || "None";
    case "treatment_intensity": return `${bc.provider_count} providers / ${bc.treatment_duration_days}d`;
    case "surgery_status": return bc.has_surgery ? "Yes" : "No";
    case "impairment_permanency": return bc.has_impairment_rating ? "Rated" : bc.has_permanency ? "Indicated" : "None";
    case "specials_band": return `$${bc.reviewed_specials.toLocaleString()}`;
    case "functional_impact": return bc.has_permanency ? "Severe" : bc.has_impairment_rating ? "Moderate" : "Mild";
    case "venue": return `${bc.jurisdiction}${bc.venue_county ? ` / ${bc.venue_county}` : ""}`;
    case "liability_posture": return bc.liability_posture;
    case "comparative_negligence": return `${bc.comparative_negligence_pct}%`;
  }
}

// ─── Stats ─────────────────────────────────────────────

function computeStats(amounts: number[]) {
  if (amounts.length === 0) return { median: null, p25: null, p75: null, mean: null, min: null, max: null };
  const sorted = [...amounts].sort((a, b) => a - b);
  const n = sorted.length;
  return {
    median: percentile(sorted, 50),
    p25: percentile(sorted, 25),
    p75: percentile(sorted, 75),
    mean: Math.round(sorted.reduce((a, b) => a + b, 0) / n),
    min: sorted[0],
    max: sorted[n - 1],
  };
}

function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
}

function qualityFromCount(selected: number, valid: number): MatchQuality {
  if (valid >= 5) return "strong";
  if (valid >= 3) return "moderate";
  if (valid >= 1) return "weak";
  return "insufficient";
}

function buildConfidenceExplanation(selected: number, valid: number, quality: MatchQuality, total: number): string {
  if (quality === "insufficient") {
    return `No comparable cases found in the corpus of ${total} claims. Benchmark support is unavailable for this case profile.`;
  }
  if (quality === "weak") {
    return `Only ${valid} comparable case(s) found from ${total} in the corpus. Benchmark data provides directional support only and should not be relied upon for anchoring.`;
  }
  if (quality === "moderate") {
    return `${valid} comparable cases identified from ${total} in the corpus. Benchmark support is moderate — settlement range is indicative but may not capture full variance.`;
  }
  return `${valid} comparable cases identified from ${total} in the corpus. Strong benchmark support provides reliable anchoring for the settlement corridor.`;
}

// ─── Seeded Benchmark Corpus ───────────────────────────
// Placeholder data designed for replacement with real datasets.

export const SEEDED_BENCHMARK_CORPUS: BenchmarkCase[] = [
  {
    id: "bm-001", claim_number: "HC-2024-00142",
    jurisdiction: "PA", venue_county: "Philadelphia",
    injury_categories: ["soft_tissue"], primary_body_parts: ["neck", "back"],
    has_surgery: false, has_permanency: false, has_impairment_rating: false,
    treatment_duration_days: 90, provider_count: 2,
    billed_specials: 8500, reviewed_specials: 7200,
    comparative_negligence_pct: 0, liability_posture: "favorable",
    settlement_amount: 18000, confidence_flags: [],
  },
  {
    id: "bm-002", claim_number: "HC-2024-00287",
    jurisdiction: "PA", venue_county: "Montgomery",
    injury_categories: ["soft_tissue"], primary_body_parts: ["neck"],
    has_surgery: false, has_permanency: false, has_impairment_rating: false,
    treatment_duration_days: 60, provider_count: 1,
    billed_specials: 4200, reviewed_specials: 3800,
    comparative_negligence_pct: 10, liability_posture: "favorable",
    settlement_amount: 9500, confidence_flags: [],
  },
  {
    id: "bm-003", claim_number: "HC-2024-00391",
    jurisdiction: "PA", venue_county: "Philadelphia",
    injury_categories: ["soft_tissue", "radiculopathy"], primary_body_parts: ["neck", "back", "shoulder"],
    has_surgery: false, has_permanency: true, has_impairment_rating: false,
    treatment_duration_days: 180, provider_count: 4,
    billed_specials: 22000, reviewed_specials: 18500,
    comparative_negligence_pct: 0, liability_posture: "favorable",
    settlement_amount: 42000, confidence_flags: [],
  },
  {
    id: "bm-004", claim_number: "HC-2023-01102",
    jurisdiction: "PA", venue_county: "Allegheny",
    injury_categories: ["orthopedic"], primary_body_parts: ["knee"],
    has_surgery: true, has_permanency: true, has_impairment_rating: true,
    treatment_duration_days: 365, provider_count: 5,
    billed_specials: 68000, reviewed_specials: 52000,
    comparative_negligence_pct: 0, liability_posture: "favorable",
    settlement_amount: 125000, confidence_flags: [],
  },
  {
    id: "bm-005", claim_number: "HC-2024-00512",
    jurisdiction: "FL", venue_county: "Miami-Dade",
    injury_categories: ["soft_tissue"], primary_body_parts: ["neck", "back"],
    has_surgery: false, has_permanency: false, has_impairment_rating: false,
    treatment_duration_days: 120, provider_count: 3,
    billed_specials: 14000, reviewed_specials: 11000,
    comparative_negligence_pct: 0, liability_posture: "favorable",
    settlement_amount: 28000, confidence_flags: [],
  },
  {
    id: "bm-006", claim_number: "HC-2024-00623",
    jurisdiction: "PA", venue_county: "Philadelphia",
    injury_categories: ["soft_tissue"], primary_body_parts: ["neck"],
    has_surgery: false, has_permanency: false, has_impairment_rating: false,
    treatment_duration_days: 45, provider_count: 1,
    billed_specials: 3500, reviewed_specials: 3000,
    comparative_negligence_pct: 20, liability_posture: "disputed",
    settlement_amount: 5500, confidence_flags: [],
  },
  {
    id: "bm-007", claim_number: "HC-2023-00834",
    jurisdiction: "PA", venue_county: "Delaware",
    injury_categories: ["soft_tissue", "radiculopathy"], primary_body_parts: ["neck", "back"],
    has_surgery: false, has_permanency: true, has_impairment_rating: true,
    treatment_duration_days: 240, provider_count: 4,
    billed_specials: 32000, reviewed_specials: 26000,
    comparative_negligence_pct: 5, liability_posture: "favorable",
    settlement_amount: 55000, confidence_flags: [],
  },
  {
    id: "bm-008", claim_number: "HC-2024-00945",
    jurisdiction: "TX", venue_county: "Harris",
    injury_categories: ["soft_tissue"], primary_body_parts: ["back"],
    has_surgery: false, has_permanency: false, has_impairment_rating: false,
    treatment_duration_days: 75, provider_count: 2,
    billed_specials: 6000, reviewed_specials: 5200,
    comparative_negligence_pct: 15, liability_posture: "favorable",
    settlement_amount: 10000, confidence_flags: [],
  },
  {
    id: "bm-009", claim_number: "HC-2023-01287",
    jurisdiction: "CA", venue_county: "Los Angeles",
    injury_categories: ["orthopedic", "soft_tissue"], primary_body_parts: ["neck", "shoulder"],
    has_surgery: true, has_permanency: true, has_impairment_rating: true,
    treatment_duration_days: 300, provider_count: 6,
    billed_specials: 85000, reviewed_specials: 62000,
    comparative_negligence_pct: 0, liability_posture: "favorable",
    settlement_amount: 175000, confidence_flags: [],
  },
  {
    id: "bm-010", claim_number: "HC-2024-01053",
    jurisdiction: "PA", venue_county: "Philadelphia",
    injury_categories: ["soft_tissue"], primary_body_parts: ["neck", "back"],
    has_surgery: false, has_permanency: false, has_impairment_rating: false,
    treatment_duration_days: 100, provider_count: 3,
    billed_specials: 12000, reviewed_specials: 9800,
    comparative_negligence_pct: 0, liability_posture: "favorable",
    settlement_amount: 22000, confidence_flags: [],
  },
  {
    id: "bm-011", claim_number: "HC-2024-01178",
    jurisdiction: "NJ", venue_county: "Essex",
    injury_categories: ["soft_tissue"], primary_body_parts: ["neck"],
    has_surgery: false, has_permanency: false, has_impairment_rating: false,
    treatment_duration_days: 55, provider_count: 2,
    billed_specials: 5800, reviewed_specials: 4900,
    comparative_negligence_pct: 0, liability_posture: "favorable",
    settlement_amount: 14000, confidence_flags: [],
  },
  {
    id: "bm-012", claim_number: "HC-2023-01456",
    jurisdiction: "PA", venue_county: "Chester",
    injury_categories: ["orthopedic"], primary_body_parts: ["back"],
    has_surgery: true, has_permanency: true, has_impairment_rating: false,
    treatment_duration_days: 270, provider_count: 4,
    billed_specials: 45000, reviewed_specials: 38000,
    comparative_negligence_pct: 0, liability_posture: "favorable",
    settlement_amount: 85000, confidence_flags: [],
  },
];
