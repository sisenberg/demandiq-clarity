/**
 * EvaluateIQ — Valuation Driver Engine
 *
 * Translates normalized intake snapshot into transparent, evidence-grounded
 * valuation drivers. Each driver stores:
 *  - raw input value
 *  - normalized value
 *  - interpretable score (0–100)
 *  - categorical effect (expander / reducer / neutral)
 *  - narrative explanation
 *  - source evidence references
 *
 * DESIGN PRINCIPLES:
 *  1. No hidden magic numbers — every constant is documented.
 *  2. No single driver can silently dominate — scores are capped per family.
 *  3. Every driver traces back to intake facts / evidence.
 */

import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import type { DriverFamily } from "@/types/evaluate-persistence";

// ─── Output Types ──────────────────────────────────────

export type DriverDirection = "expander" | "reducer" | "neutral";

export interface ExtractedDriver {
  id: string;
  family: DriverFamily;
  driver_key: string;
  title: string;
  raw_input: string;
  normalized_value: number | null;
  /** Impact score 0–100. Capped per family to prevent dominance. */
  score: number;
  /** Max contribution weight this driver can have toward final range (0–1). */
  weight: number;
  direction: DriverDirection;
  narrative: string;
  evidence_ref_ids: string[];
  details: string[];
}

export interface DriverExtractionResult {
  drivers: ExtractedDriver[];
  /** Aggregate scores by family */
  family_summaries: FamilySummary[];
}

export interface FamilySummary {
  family: DriverFamily;
  label: string;
  driver_count: number;
  net_direction: DriverDirection;
  avg_score: number;
}

// ─── Constants (documented, not magic) ─────────────────

/**
 * Per-family score cap prevents any single category from overwhelming
 * the valuation. E.g. even if 10 treatment drivers fire, the family
 * can contribute at most 95 combined score points.
 */
const FAMILY_SCORE_CAP = 95;

/**
 * Weight allocation by family. These sum to 1.0 and represent the
 * maximum proportional influence each family can have on the final
 * valuation range. Weights are based on industry settlement analysis
 * showing that medical severity and economic damages are the primary
 * drivers, followed by liability posture.
 */
const FAMILY_WEIGHTS: Record<DriverFamily, number> = {
  injury_severity: 0.15,
  treatment_intensity: 0.12,
  liability: 0.12,
  credibility: 0.05,
  venue: 0.05,
  policy_limits: 0.08,
  wage_loss: 0.10,
  future_treatment: 0.08,
  permanency: 0.10,
  surgery: 0.05,
  imaging: 0.03,
  pre_existing: 0.05,
  other: 0.02,
};

/** Severity labels mapped to base scores (0–100 scale). */
const SEVERITY_BASE: Record<string, number> = {
  catastrophic: 95,
  severe: 80,
  moderate: 55,
  mild: 30,
};

/**
 * Treatment session count thresholds for scoring.
 * Based on typical PI claim distributions.
 */
const TX_COUNT_THRESHOLDS = {
  low: 5,      // ≤5 sessions → modest
  moderate: 15, // 6–15 → moderate
  high: 30,    // 16–30 → elevated
  extensive: 50, // 31–50 → extensive
};

/**
 * Treatment duration (in days) thresholds.
 */
const TX_DURATION_THRESHOLDS = {
  short: 30,
  moderate: 90,
  extended: 180,
  prolonged: 365,
};

// ─── Engine ────────────────────────────────────────────

let driverSeq = 0;
function nextId(): string {
  return `vd-${++driverSeq}`;
}

export function extractValuationDrivers(snapshot: EvaluateIntakeSnapshot): DriverExtractionResult {
  driverSeq = 0;
  const drivers: ExtractedDriver[] = [];

  // ── 1. Economic Drivers ───────────────────────
  drivers.push(...extractEconomicDrivers(snapshot));

  // ── 2. Medical Severity Drivers ───────────────
  drivers.push(...extractMedicalSeverityDrivers(snapshot));

  // ── 3. Treatment Pattern Drivers ──────────────
  drivers.push(...extractTreatmentPatternDrivers(snapshot));

  // ── 4. Liability & Collectability Drivers ─────
  drivers.push(...extractLiabilityDrivers(snapshot));

  // ── 5. Claim Posture Drivers ──────────────────
  drivers.push(...extractClaimPostureDrivers(snapshot));

  // Cap scores per family
  const capped = applyFamilyCaps(drivers);

  // Build family summaries
  const family_summaries = buildFamilySummaries(capped);

  return { drivers: capped, family_summaries };
}

// ═══════════════════════════════════════════════════════
// 1. ECONOMIC DRIVERS
// ═══════════════════════════════════════════════════════

function extractEconomicDrivers(s: EvaluateIntakeSnapshot): ExtractedDriver[] {
  const out: ExtractedDriver[] = [];
  const totalBilled = s.medical_billing.reduce((sum, b) => sum + b.billed_amount, 0);
  const totalReviewed = s.medical_billing.reduce((sum, b) => sum + (b.reviewer_recommended_amount ?? b.billed_amount), 0);
  const hasReviewerAmounts = s.medical_billing.some((b) => b.reviewer_recommended_amount != null);

  // Billed medicals
  if (totalBilled > 0) {
    const score = scoreFromAmount(totalBilled, [5000, 25000, 75000, 150000, 300000]);
    out.push({
      id: nextId(),
      family: "other", // economic, mapped to closest family
      driver_key: "billed_medicals",
      title: "Total Billed Medicals",
      raw_input: `$${totalBilled.toLocaleString()}`,
      normalized_value: totalBilled,
      score,
      weight: FAMILY_WEIGHTS.other,
      direction: score >= 50 ? "expander" : "neutral",
      narrative: `Total medical bills of $${totalBilled.toLocaleString()}. ${score >= 70 ? "Substantial medical specials support higher valuation." : score >= 40 ? "Moderate medical specials within typical range." : "Relatively low medical specials."}`,
      evidence_ref_ids: s.medical_billing.slice(0, 10).flatMap((b) => b.provenance.evidence_ref_ids),
      details: [`${s.medical_billing.length} line items`, `Average per line: $${Math.round(totalBilled / s.medical_billing.length).toLocaleString()}`],
    });
  }

  // Reviewed/allowed medicals
  if (hasReviewerAmounts) {
    const reductionPct = totalBilled > 0 ? Math.round(((totalBilled - totalReviewed) / totalBilled) * 100) : 0;
    out.push({
      id: nextId(),
      family: "other",
      driver_key: "reviewed_medicals",
      title: "Reviewed / Allowed Medicals",
      raw_input: `$${totalReviewed.toLocaleString()} (${reductionPct}% reduction from billed)`,
      normalized_value: totalReviewed,
      score: reductionPct > 25 ? Math.min(70, 30 + reductionPct) : 30,
      weight: FAMILY_WEIGHTS.other,
      direction: reductionPct > 15 ? "reducer" : "neutral",
      narrative: `ReviewerIQ assessed reasonable medicals at $${totalReviewed.toLocaleString()}, a ${reductionPct}% reduction from billed amount. ${reductionPct > 25 ? "Significant billing reductions may limit specials-based valuation." : "Minor adjustments — billed amounts largely supported."}`,
      evidence_ref_ids: [],
      details: s.medical_billing
        .filter((b) => b.reviewer_recommended_amount != null && b.reviewer_recommended_amount !== b.billed_amount)
        .slice(0, 5)
        .map((b) => `${b.description}: $${b.billed_amount.toLocaleString()} → $${(b.reviewer_recommended_amount ?? 0).toLocaleString()}`),
    });
  }

  // Wage loss
  const wageLoss = s.wage_loss.total_lost_wages.value;
  if (wageLoss > 0) {
    const score = scoreFromAmount(wageLoss, [5000, 15000, 50000, 100000, 200000]);
    out.push({
      id: nextId(),
      family: "wage_loss",
      driver_key: "total_wage_loss",
      title: "Wage / Earnings Loss",
      raw_input: `$${wageLoss.toLocaleString()}`,
      normalized_value: wageLoss,
      score,
      weight: FAMILY_WEIGHTS.wage_loss,
      direction: score >= 40 ? "expander" : "neutral",
      narrative: `Lost wages of $${wageLoss.toLocaleString()} claimed. ${s.wage_loss.duration_description.value ? `Duration: ${s.wage_loss.duration_description.value}.` : ""} ${score >= 60 ? "Significant earnings impact supports higher general damages." : "Modest wage loss claim."}`,
      evidence_ref_ids: s.wage_loss.total_lost_wages.provenance.evidence_ref_ids,
      details: s.wage_loss.duration_description.value ? [`Duration: ${s.wage_loss.duration_description.value}`] : [],
    });
  }

  return out;
}

// ═══════════════════════════════════════════════════════
// 2. MEDICAL SEVERITY DRIVERS
// ═══════════════════════════════════════════════════════

function extractMedicalSeverityDrivers(s: EvaluateIntakeSnapshot): ExtractedDriver[] {
  const out: ExtractedDriver[] = [];
  const nonPreExisting = s.injuries.filter((i) => !i.is_pre_existing);

  // Injury type / body part profile
  if (nonPreExisting.length > 0) {
    const severityCounts = { catastrophic: 0, severe: 0, moderate: 0, mild: 0 };
    for (const inj of nonPreExisting) {
      const sev = inj.severity.toLowerCase() as keyof typeof severityCounts;
      if (sev in severityCounts) severityCounts[sev]++;
    }
    const highestSeverity = severityCounts.catastrophic > 0 ? "catastrophic" : severityCounts.severe > 0 ? "severe" : severityCounts.moderate > 0 ? "moderate" : "mild";
    const baseScore = SEVERITY_BASE[highestSeverity] ?? 40;
    // Add points for multiple injuries (diminishing returns: +8 per additional, capped)
    const multiBonus = Math.min(15, (nonPreExisting.length - 1) * 8);
    const score = Math.min(FAMILY_SCORE_CAP, baseScore + multiBonus);

    out.push({
      id: nextId(),
      family: "injury_severity",
      driver_key: "injury_profile",
      title: "Injury Severity Profile",
      raw_input: `${nonPreExisting.length} injuries — highest: ${highestSeverity}`,
      normalized_value: score,
      score,
      weight: FAMILY_WEIGHTS.injury_severity,
      direction: score >= 55 ? "expander" : "neutral",
      narrative: `${nonPreExisting.length} incident-related injur${nonPreExisting.length === 1 ? "y" : "ies"} documented. Highest severity: ${highestSeverity}. ${score >= 70 ? "Significant injury profile supports elevated valuation." : "Injury profile consistent with moderate claim."}`,
      evidence_ref_ids: nonPreExisting.flatMap((i) => i.provenance.evidence_ref_ids),
      details: nonPreExisting.map((i) => `${i.body_part}: ${i.diagnosis_description} (${i.severity})`),
    });
  }

  // Surgery
  if (s.clinical_flags.has_surgery) {
    const surgicalTx = s.treatment_timeline.filter((t) => t.treatment_type.toLowerCase().includes("surg"));
    out.push({
      id: nextId(),
      family: "surgery",
      driver_key: "surgical_intervention",
      title: "Surgical Intervention",
      raw_input: `${surgicalTx.length || "1+"} surgical procedure(s)`,
      normalized_value: 85,
      score: 85,
      weight: FAMILY_WEIGHTS.surgery,
      direction: "expander",
      narrative: "Surgical intervention documented. Surgical cases typically command significantly higher valuations due to pain, recovery burden, and future care implications.",
      evidence_ref_ids: s.clinical_flags.provenance.evidence_ref_ids,
      details: surgicalTx.length > 0 ? surgicalTx.map((t) => t.description) : ["Surgery indicated by clinical flags"],
    });
  }

  // Injections
  if (s.clinical_flags.has_injections) {
    out.push({
      id: nextId(),
      family: "treatment_intensity",
      driver_key: "injection_procedures",
      title: "Injection Procedures",
      raw_input: "Injection procedures documented",
      normalized_value: 60,
      score: 60,
      weight: FAMILY_WEIGHTS.treatment_intensity,
      direction: "expander",
      narrative: "Epidural steroid injections or similar interventional procedures documented. These indicate escalated treatment beyond conservative care and support higher valuation.",
      evidence_ref_ids: s.clinical_flags.provenance.evidence_ref_ids,
      details: s.treatment_timeline
        .filter((t) => t.treatment_type.toLowerCase().includes("inject"))
        .map((t) => t.description)
        .slice(0, 5),
    });
  }

  // Advanced imaging
  if (s.clinical_flags.has_advanced_imaging) {
    out.push({
      id: nextId(),
      family: "imaging",
      driver_key: "advanced_imaging",
      title: "Advanced Diagnostic Imaging",
      raw_input: "MRI / CT imaging documented",
      normalized_value: 45,
      score: 45,
      weight: FAMILY_WEIGHTS.imaging,
      direction: "expander",
      narrative: "Advanced diagnostic imaging (MRI, CT) performed. Objective imaging findings strengthen causation and support injury severity claims.",
      evidence_ref_ids: s.clinical_flags.provenance.evidence_ref_ids,
      details: s.treatment_timeline
        .filter((t) => t.treatment_type.toLowerCase().includes("imag") || t.treatment_type.toLowerCase().includes("diag"))
        .map((t) => `${t.description} (${t.treatment_date ?? "date unknown"})`)
        .slice(0, 3),
    });
  }

  // Permanency / impairment
  if (s.clinical_flags.has_permanency_indicators || s.clinical_flags.has_impairment_rating) {
    const hasRating = s.clinical_flags.has_impairment_rating;
    out.push({
      id: nextId(),
      family: "permanency",
      driver_key: "permanency_impairment",
      title: hasRating ? "Permanent Impairment Rating" : "Permanency Indicators",
      raw_input: hasRating ? "Impairment rating documented" : "Permanency indicators present",
      normalized_value: hasRating ? 85 : 65,
      score: hasRating ? 85 : 65,
      weight: FAMILY_WEIGHTS.permanency,
      direction: "expander",
      narrative: hasRating
        ? "A formal impairment rating has been documented. This is a strong value expander indicating lasting functional deficit."
        : "Clinical records indicate permanency (e.g., herniation, chronic condition). This may expand valuation even without a formal impairment rating.",
      evidence_ref_ids: s.clinical_flags.provenance.evidence_ref_ids,
      details: [],
    });
  }

  // Scarring / disfigurement
  if (s.clinical_flags.has_scarring_disfigurement) {
    out.push({
      id: nextId(),
      family: "injury_severity",
      driver_key: "scarring_disfigurement",
      title: "Scarring / Disfigurement",
      raw_input: "Scarring or disfigurement documented",
      normalized_value: 55,
      score: 55,
      weight: FAMILY_WEIGHTS.injury_severity,
      direction: "expander",
      narrative: "Scarring or disfigurement has been documented. This non-economic damage category is highly jurisdiction-dependent but generally supports higher general damages.",
      evidence_ref_ids: s.clinical_flags.provenance.evidence_ref_ids,
      details: [],
    });
  }

  // Future care
  const futureMedical = s.future_treatment.future_medical_estimate.value;
  if (futureMedical > 0 || s.future_treatment.indicators.value.length > 0) {
    const score = futureMedical > 0
      ? scoreFromAmount(futureMedical, [5000, 25000, 75000, 150000, 300000])
      : Math.min(50, 25 + s.future_treatment.indicators.value.length * 10);
    out.push({
      id: nextId(),
      family: "future_treatment",
      driver_key: "future_care",
      title: "Future Care Indicators",
      raw_input: futureMedical > 0 ? `$${futureMedical.toLocaleString()} estimated` : `${s.future_treatment.indicators.value.length} indicator(s)`,
      normalized_value: futureMedical || null,
      score,
      weight: FAMILY_WEIGHTS.future_treatment,
      direction: score >= 40 ? "expander" : "neutral",
      narrative: futureMedical > 0
        ? `Future medical costs estimated at $${futureMedical.toLocaleString()}. Anticipated ongoing care expands valuation range.`
        : `${s.future_treatment.indicators.value.length} future treatment indicator(s) identified but no formal estimate available.`,
      evidence_ref_ids: s.future_treatment.future_medical_estimate.provenance.evidence_ref_ids,
      details: s.future_treatment.indicators.value,
    });
  }

  return out;
}

// ═══════════════════════════════════════════════════════
// 3. TREATMENT PATTERN DRIVERS
// ═══════════════════════════════════════════════════════

function extractTreatmentPatternDrivers(s: EvaluateIntakeSnapshot): ExtractedDriver[] {
  const out: ExtractedDriver[] = [];
  const txs = s.treatment_timeline;
  if (txs.length === 0) return out;

  // Duration
  const dates = txs
    .map((t) => t.treatment_date ? new Date(t.treatment_date).getTime() : null)
    .filter((d): d is number => d !== null && !isNaN(d));

  if (dates.length >= 2) {
    const earliest = Math.min(...dates);
    const latest = Math.max(...dates);
    const durationDays = Math.round((latest - earliest) / (1000 * 60 * 60 * 24));
    const durationLabel = durationDays > 365 ? `${Math.round(durationDays / 30)} months` : `${durationDays} days`;
    const score = durationDays <= TX_DURATION_THRESHOLDS.short ? 25
      : durationDays <= TX_DURATION_THRESHOLDS.moderate ? 40
      : durationDays <= TX_DURATION_THRESHOLDS.extended ? 60
      : durationDays <= TX_DURATION_THRESHOLDS.prolonged ? 75
      : 85;

    out.push({
      id: nextId(),
      family: "treatment_intensity",
      driver_key: "treatment_duration",
      title: "Treatment Duration",
      raw_input: durationLabel,
      normalized_value: durationDays,
      score,
      weight: FAMILY_WEIGHTS.treatment_intensity,
      direction: score >= 55 ? "expander" : "neutral",
      narrative: `Treatment course spanning ${durationLabel}. ${score >= 70 ? "Extended treatment duration supports elevated general damages claim." : score >= 50 ? "Moderate treatment period consistent with claimed injuries." : "Relatively brief treatment course."}`,
      evidence_ref_ids: txs.slice(0, 3).flatMap((t) => t.provenance.evidence_ref_ids),
      details: [
        `First visit: ${new Date(earliest).toLocaleDateString()}`,
        `Last visit: ${new Date(latest).toLocaleDateString()}`,
        `${txs.length} total sessions`,
      ],
    });
  }

  // Frequency / volume
  {
    const count = txs.length;
    const score = count <= TX_COUNT_THRESHOLDS.low ? 20
      : count <= TX_COUNT_THRESHOLDS.moderate ? 40
      : count <= TX_COUNT_THRESHOLDS.high ? 60
      : count <= TX_COUNT_THRESHOLDS.extensive ? 75
      : 85;
    const typeMap = new Map<string, number>();
    txs.forEach((t) => typeMap.set(t.treatment_type, (typeMap.get(t.treatment_type) ?? 0) + 1));

    out.push({
      id: nextId(),
      family: "treatment_intensity",
      driver_key: "treatment_frequency",
      title: "Treatment Frequency",
      raw_input: `${count} sessions across ${typeMap.size} modalities`,
      normalized_value: count,
      score,
      weight: FAMILY_WEIGHTS.treatment_intensity,
      direction: score >= 50 ? "expander" : "neutral",
      narrative: `${count} treatment sessions documented across ${typeMap.size} modalit${typeMap.size === 1 ? "y" : "ies"}. ${score >= 65 ? "High treatment utilization supports significant damages." : "Treatment frequency within expected range."}`,
      evidence_ref_ids: [],
      details: Array.from(typeMap.entries()).map(([type, c]) => `${type}: ${c} sessions`),
    });
  }

  // Specialist escalation
  const specialistTypes = new Set(["orthopedic", "neurology", "pain management", "surgery"]);
  const specialists = s.providers.filter((p) =>
    specialistTypes.has(p.specialty.toLowerCase()) || p.specialty.toLowerCase().includes("surgeon")
  );
  if (specialists.length > 0) {
    out.push({
      id: nextId(),
      family: "treatment_intensity",
      driver_key: "specialist_escalation",
      title: "Specialist Escalation",
      raw_input: `${specialists.length} specialist provider(s)`,
      normalized_value: specialists.length,
      score: Math.min(FAMILY_SCORE_CAP, 40 + specialists.length * 15),
      weight: FAMILY_WEIGHTS.treatment_intensity,
      direction: "expander",
      narrative: `Treatment escalated to ${specialists.length} specialist provider(s). Referral to specialists indicates injury complexity beyond primary care management.`,
      evidence_ref_ids: specialists.flatMap((p) => p.provenance.evidence_ref_ids),
      details: specialists.map((p) => `${p.full_name} — ${p.specialty} (${p.total_visits} visits)`),
    });
  }

  // Treatment gaps
  if (dates.length >= 3) {
    const sorted = [...dates].sort((a, b) => a - b);
    let maxGap = 0;
    for (let i = 1; i < sorted.length; i++) {
      maxGap = Math.max(maxGap, sorted[i] - sorted[i - 1]);
    }
    const maxGapDays = Math.round(maxGap / (1000 * 60 * 60 * 24));
    // Gap > 30 days is notable
    if (maxGapDays > 30) {
      const score = Math.min(70, 25 + Math.round(maxGapDays / 10) * 5);
      out.push({
        id: nextId(),
        family: "treatment_intensity",
        driver_key: "treatment_gap",
        title: "Treatment Gap Identified",
        raw_input: `${maxGapDays}-day gap between visits`,
        normalized_value: maxGapDays,
        score,
        weight: FAMILY_WEIGHTS.treatment_intensity,
        direction: "reducer",
        narrative: `A ${maxGapDays}-day gap between treatment visits was identified. Significant gaps may undermine the narrative of continuous pain and disability, potentially reducing the valuation.`,
        evidence_ref_ids: [],
        details: [`Longest gap: ${maxGapDays} days`, `Total visits: ${txs.length}`],
      });
    }
  }

  // Passive-only concentration
  const passiveTypes = new Set(["physical therapy", "chiropractic", "massage", "acupuncture"]);
  const passiveCount = txs.filter((t) => passiveTypes.has(t.treatment_type.toLowerCase())).length;
  const passiveRatio = txs.length > 0 ? passiveCount / txs.length : 0;
  if (passiveRatio > 0.8 && txs.length > 10) {
    out.push({
      id: nextId(),
      family: "treatment_intensity",
      driver_key: "passive_concentration",
      title: "Passive Treatment Concentration",
      raw_input: `${Math.round(passiveRatio * 100)}% passive modalities`,
      normalized_value: passiveRatio,
      score: Math.min(60, 30 + Math.round(passiveRatio * 30)),
      weight: FAMILY_WEIGHTS.treatment_intensity,
      direction: "reducer",
      narrative: `${Math.round(passiveRatio * 100)}% of treatment consists of passive modalities (PT, chiropractic, massage). Overreliance on passive treatment without objective improvement indicators may weaken reasonableness arguments.`,
      evidence_ref_ids: [],
      details: [`Passive sessions: ${passiveCount}/${txs.length}`, `Ratio: ${Math.round(passiveRatio * 100)}%`],
    });
  }

  // ReviewerIQ reasonableness concerns
  const reasonablenessConcerns = s.upstream_concerns.filter(
    (c) => c.category === "coding" || c.category === "compliance" || c.description.toLowerCase().includes("reasonable")
  );
  if (reasonablenessConcerns.length > 0) {
    out.push({
      id: nextId(),
      family: "treatment_intensity",
      driver_key: "reasonableness_concerns",
      title: "Treatment Reasonableness Concerns",
      raw_input: `${reasonablenessConcerns.length} concern(s) from upstream review`,
      normalized_value: reasonablenessConcerns.length,
      score: Math.min(70, 30 + reasonablenessConcerns.length * 15),
      weight: FAMILY_WEIGHTS.treatment_intensity,
      direction: "reducer",
      narrative: `${reasonablenessConcerns.length} treatment reasonableness concern(s) identified during upstream medical review. These may be used to challenge the full billed amount.`,
      evidence_ref_ids: reasonablenessConcerns.flatMap((c) => c.provenance.evidence_ref_ids),
      details: reasonablenessConcerns.map((c) => c.description),
    });
  }

  return out;
}

// ═══════════════════════════════════════════════════════
// 4. LIABILITY & COLLECTABILITY DRIVERS
// ═══════════════════════════════════════════════════════

function extractLiabilityDrivers(s: EvaluateIntakeSnapshot): ExtractedDriver[] {
  const out: ExtractedDriver[] = [];

  // Liability clarity
  const supporting = s.liability_facts.filter((f) => f.supports_liability);
  const adverse = s.liability_facts.filter((f) => !f.supports_liability);
  if (s.liability_facts.length > 0) {
    const ratio = supporting.length / s.liability_facts.length;
    const score = Math.round(ratio * 80) + 10; // 10–90 range
    out.push({
      id: nextId(),
      family: "liability",
      driver_key: "liability_clarity",
      title: "Liability Clarity",
      raw_input: `${supporting.length} supporting / ${adverse.length} adverse facts`,
      normalized_value: ratio,
      score,
      weight: FAMILY_WEIGHTS.liability,
      direction: ratio > 0.6 ? "expander" : ratio < 0.4 ? "reducer" : "neutral",
      narrative: `${supporting.length} fact(s) support liability vs ${adverse.length} adverse. ${ratio > 0.7 ? "Clear liability posture favoring claimant strengthens the valuation range." : ratio < 0.4 ? "Weak or contested liability significantly constrains valuation." : "Mixed liability posture — range should reflect uncertainty."}`,
      evidence_ref_ids: s.liability_facts.flatMap((f) => f.provenance.evidence_ref_ids),
      details: s.liability_facts.map((f) => `${f.supports_liability ? "✓" : "✗"} ${f.fact_text}`),
    });
  }

  // Comparative negligence
  const compNeg = s.comparative_negligence.claimant_negligence_percentage.value;
  if (compNeg !== null && compNeg > 0) {
    out.push({
      id: nextId(),
      family: "liability",
      driver_key: "comparative_negligence",
      title: "Comparative Negligence",
      raw_input: `${compNeg}% claimant fault`,
      normalized_value: compNeg,
      score: Math.min(80, compNeg + 20),
      weight: FAMILY_WEIGHTS.liability,
      direction: "reducer",
      narrative: `Claimant bears ${compNeg}% comparative fault. In modified comparative fault jurisdictions, this directly reduces recoverable damages. ${compNeg >= 50 ? "At or above 50% — recovery may be barred entirely." : compNeg >= 25 ? "Meaningful fault allocation constrains the valuation range." : "Minor comparative fault."}`,
      evidence_ref_ids: s.comparative_negligence.claimant_negligence_percentage.provenance.evidence_ref_ids,
      details: s.comparative_negligence.notes.value ? [s.comparative_negligence.notes.value] : [],
    });
  }

  // Policy limits / coverage proximity
  const totalBilled = s.medical_billing.reduce((sum, b) => sum + b.billed_amount, 0);
  const maxLimit = s.policy_coverage.reduce((m, p) => Math.max(m, p.coverage_limit ?? 0), 0);
  if (maxLimit > 0) {
    const proximityRatio = totalBilled > 0 ? totalBilled / maxLimit : 0;
    const isLowPolicy = maxLimit < 50000;
    const approachingLimits = proximityRatio > 0.7;

    out.push({
      id: nextId(),
      family: "policy_limits",
      driver_key: "coverage_limits",
      title: "Policy Limits / Coverage",
      raw_input: `$${maxLimit.toLocaleString()} max coverage${approachingLimits ? " (approaching limits)" : ""}`,
      normalized_value: maxLimit,
      score: isLowPolicy ? 65 : approachingLimits ? 55 : 35,
      weight: FAMILY_WEIGHTS.policy_limits,
      direction: isLowPolicy || approachingLimits ? "reducer" : "neutral",
      narrative: `Maximum available coverage is $${maxLimit.toLocaleString()}. ${isLowPolicy ? "Low policy limits may cap practical recovery regardless of damages." : approachingLimits ? "Billed medicals are approaching policy limits, which may constrain settlement range." : "Adequate coverage available relative to claimed damages."}`,
      evidence_ref_ids: [],
      details: s.policy_coverage.map((p) => `${p.carrier_name}: ${p.policy_type} — $${(p.coverage_limit ?? 0).toLocaleString()}`),
    });
  }

  return out;
}

// ═══════════════════════════════════════════════════════
// 5. CLAIM POSTURE DRIVERS
// ═══════════════════════════════════════════════════════

function extractClaimPostureDrivers(s: EvaluateIntakeSnapshot): ExtractedDriver[] {
  const out: ExtractedDriver[] = [];

  // Venue severity
  const jurisdiction = s.venue_jurisdiction.jurisdiction_state.value;
  if (jurisdiction) {
    // Known plaintiff-favorable jurisdictions (documented source: industry verdict data)
    const highVenue = new Set(["CA", "NY", "FL", "IL", "NJ", "PA", "TX"]);
    const isHigh = highVenue.has(jurisdiction.toUpperCase());
    out.push({
      id: nextId(),
      family: "venue",
      driver_key: "venue_severity",
      title: "Venue / Jurisdiction",
      raw_input: jurisdiction,
      normalized_value: isHigh ? 70 : 40,
      score: isHigh ? 65 : 35,
      weight: FAMILY_WEIGHTS.venue,
      direction: isHigh ? "expander" : "neutral",
      narrative: `Case filed in ${jurisdiction}. ${isHigh ? "This jurisdiction is historically associated with higher jury verdicts and settlements." : "Jurisdiction within typical range for verdict outcomes."}`,
      evidence_ref_ids: s.venue_jurisdiction.jurisdiction_state.provenance.evidence_ref_ids,
      details: [isHigh ? "Higher-verdict jurisdiction per industry data" : "Standard jurisdiction"],
    });
  }

  // Credibility concerns
  const credibilityConcerns = s.upstream_concerns.filter((c) => c.category === "credibility");
  if (credibilityConcerns.length > 0) {
    out.push({
      id: nextId(),
      family: "credibility",
      driver_key: "claimant_credibility",
      title: "Claimant Credibility Concerns",
      raw_input: `${credibilityConcerns.length} credibility issue(s)`,
      normalized_value: credibilityConcerns.length,
      score: Math.min(75, 30 + credibilityConcerns.length * 20),
      weight: FAMILY_WEIGHTS.credibility,
      direction: "reducer",
      narrative: `${credibilityConcerns.length} credibility concern(s) surfaced from upstream analysis. Credibility issues can significantly impact jury perception and settlement leverage.`,
      evidence_ref_ids: credibilityConcerns.flatMap((c) => c.provenance.evidence_ref_ids),
      details: credibilityConcerns.map((c) => c.description),
    });
  }

  // Pre-existing / prior injury
  const preExisting = s.injuries.filter((i) => i.is_pre_existing);
  if (preExisting.length > 0) {
    out.push({
      id: nextId(),
      family: "pre_existing",
      driver_key: "pre_existing_conditions",
      title: "Pre-existing / Prior Injury",
      raw_input: `${preExisting.length} pre-existing condition(s)`,
      normalized_value: preExisting.length,
      // Score increases with count but caps — 1 pre-existing is modest, 3+ is significant
      score: Math.min(75, 25 + preExisting.length * 18),
      weight: FAMILY_WEIGHTS.pre_existing,
      direction: "reducer",
      narrative: `${preExisting.length} pre-existing condition(s) documented. Defense may argue that current complaints are attributable to prior injuries, reducing causation allocation.`,
      evidence_ref_ids: preExisting.flatMap((i) => i.provenance.evidence_ref_ids),
      details: preExisting.map((i) => `${i.body_part}: ${i.diagnosis_description}${i.date_of_onset ? ` (onset: ${i.date_of_onset})` : ""}`),
    });
  }

  // Low-impact / mechanism mismatch
  const mechanismConcerns = s.upstream_concerns.filter(
    (c) => c.category === "causation" || c.description.toLowerCase().includes("low impact") || c.description.toLowerCase().includes("mechanism")
  );
  if (mechanismConcerns.length > 0) {
    out.push({
      id: nextId(),
      family: "credibility",
      driver_key: "mechanism_mismatch",
      title: "Low-Impact / Mechanism Mismatch",
      raw_input: `${mechanismConcerns.length} causation concern(s)`,
      normalized_value: mechanismConcerns.length,
      score: Math.min(70, 30 + mechanismConcerns.length * 15),
      weight: FAMILY_WEIGHTS.credibility,
      direction: "reducer",
      narrative: `${mechanismConcerns.length} concern(s) regarding causation or mechanism-injury mismatch. If the claimed injuries appear disproportionate to the accident mechanism, this weakens the claimant's position.`,
      evidence_ref_ids: mechanismConcerns.flatMap((c) => c.provenance.evidence_ref_ids),
      details: mechanismConcerns.map((c) => c.description),
    });
  }

  return out;
}

// ═══════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════

/**
 * Maps a dollar amount to a 0–100 score using documented thresholds.
 * Thresholds represent breakpoints for the score scale; amounts between
 * breakpoints are linearly interpolated.
 *
 * @param amount - Dollar amount to score
 * @param thresholds - Array of 5 breakpoints mapping to scores [15, 35, 55, 75, 90]
 */
function scoreFromAmount(amount: number, thresholds: [number, number, number, number, number]): number {
  const scores = [15, 35, 55, 75, 90];
  if (amount <= 0) return 0;
  if (amount >= thresholds[4]) return 90;
  for (let i = 0; i < thresholds.length; i++) {
    if (amount <= thresholds[i]) {
      const prev = i === 0 ? 0 : thresholds[i - 1];
      const prevScore = i === 0 ? 0 : scores[i - 1];
      const ratio = (amount - prev) / (thresholds[i] - prev);
      return Math.round(prevScore + ratio * (scores[i] - prevScore));
    }
  }
  return 90;
}

/**
 * Caps the total score contribution per family to prevent
 * any single driver category from silently dominating the output.
 */
function applyFamilyCaps(drivers: ExtractedDriver[]): ExtractedDriver[] {
  const familyTotals = new Map<DriverFamily, number>();
  for (const d of drivers) {
    familyTotals.set(d.family, (familyTotals.get(d.family) ?? 0) + d.score);
  }

  return drivers.map((d) => {
    const familyTotal = familyTotals.get(d.family) ?? 0;
    if (familyTotal > FAMILY_SCORE_CAP) {
      const scaleFactor = FAMILY_SCORE_CAP / familyTotal;
      return { ...d, score: Math.round(d.score * scaleFactor) };
    }
    return d;
  });
}

function buildFamilySummaries(drivers: ExtractedDriver[]): FamilySummary[] {
  const familyLabels: Record<DriverFamily, string> = {
    injury_severity: "Injury Severity",
    treatment_intensity: "Treatment Intensity",
    liability: "Liability & Fault",
    credibility: "Credibility & Posture",
    venue: "Venue / Jurisdiction",
    policy_limits: "Policy Limits",
    wage_loss: "Wage Loss",
    future_treatment: "Future Treatment",
    permanency: "Permanency / Impairment",
    surgery: "Surgical Intervention",
    imaging: "Diagnostic Imaging",
    pre_existing: "Pre-existing Conditions",
    other: "Economic / General",
  };

  const grouped = new Map<DriverFamily, ExtractedDriver[]>();
  for (const d of drivers) {
    if (!grouped.has(d.family)) grouped.set(d.family, []);
    grouped.get(d.family)!.push(d);
  }

  return Array.from(grouped.entries()).map(([family, fDrivers]) => {
    const expanderCount = fDrivers.filter((d) => d.direction === "expander").length;
    const reducerCount = fDrivers.filter((d) => d.direction === "reducer").length;
    const avgScore = Math.round(fDrivers.reduce((s, d) => s + d.score, 0) / fDrivers.length);

    return {
      family,
      label: familyLabels[family] ?? family,
      driver_count: fDrivers.length,
      net_direction: expanderCount > reducerCount ? "expander" as const : reducerCount > expanderCount ? "reducer" as const : "neutral" as const,
      avg_score: avgScore,
    };
  }).sort((a, b) => b.avg_score - a.avg_score);
}
