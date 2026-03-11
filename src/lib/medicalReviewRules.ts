/**
 * ReviewerIQ — First-Pass Medical Reasonableness / Necessity Rules
 *
 * Explainable, evidence-linked rule checks. Each rule produces ReviewIssues
 * with machine explanations and evidence references.
 *
 * NOT a black-box AI reviewer — all rules are transparent and auditable.
 */

import { differenceInDays, parseISO } from "date-fns";
import type { ReviewerTreatmentRecord } from "@/hooks/useReviewerTreatments";
import type { ReviewerBillLine } from "@/types/reviewer-bills";
import type { ReviewIssue, ReviewIssueType, ReviewIssueSeverity, ReviewIssueEvidence } from "@/types/reviewer-issues";

// ─── Configuration ──────────────────────────────────────

export interface MedicalReviewConfig {
  /** Max visits per week before flagging excessive frequency */
  max_visits_per_week: number;
  /** Expected soft-tissue recovery window in days */
  soft_tissue_recovery_days: number;
  /** Passive modality codes (hot/cold, e-stim, ultrasound) */
  passive_modality_codes: string[];
  /** Max consecutive weeks of passive-only treatment */
  max_passive_only_weeks: number;
  /** Duplicate service date+code threshold */
  duplicate_tolerance_days: number;
  /** High-variance threshold % for pricing flags */
  high_variance_threshold_pct: number;
  /** Min objective findings length to be considered adequate */
  min_objective_findings_length: number;
  /** Jaccard similarity threshold for near-identical notes (0-1) */
  near_identical_note_threshold: number;
  /** Gap in days that triggers gap-then-intensive-care rule */
  treatment_gap_days: number;
  /** Visits per week after gap to be considered "intensive" */
  post_gap_intensive_visits_per_week: number;
  /** Provider utilization: min visits to trigger pattern analysis */
  provider_pattern_min_visits: number;
  /** Provider utilization: % of case total billed to flag */
  provider_concentration_pct: number;
  /** Rule engine version for audit metadata */
  rule_engine_version: string;
}

export const DEFAULT_MEDICAL_REVIEW_CONFIG: MedicalReviewConfig = {
  max_visits_per_week: 4,
  soft_tissue_recovery_days: 90,
  passive_modality_codes: ["97010", "97032", "97035", "97014"],
  max_passive_only_weeks: 4,
  duplicate_tolerance_days: 1,
  high_variance_threshold_pct: 200,
  min_objective_findings_length: 30,
  near_identical_note_threshold: 0.7,
  treatment_gap_days: 30,
  post_gap_intensive_visits_per_week: 3,
  provider_pattern_min_visits: 8,
  provider_concentration_pct: 60,
  rule_engine_version: "1.1.0",
};

// ─── Rule Engine ────────────────────────────────────────

let issueSeq = 0;
function issueId(): string {
  return `ri-${++issueSeq}`;
}

export function runMedicalReviewRules(
  treatments: ReviewerTreatmentRecord[],
  billLines: ReviewerBillLine[],
  config: MedicalReviewConfig = DEFAULT_MEDICAL_REVIEW_CONFIG,
): ReviewIssue[] {
  issueSeq = 0;
  const issues: ReviewIssue[] = [];
  const T = treatments[0]?.tenant_id ?? "";
  const C = treatments[0]?.case_id ?? "";

  issues.push(...checkExcessiveFrequency(treatments, config, T, C));
  issues.push(...checkBeyondRecoveryWindow(treatments, config, T, C));
  issues.push(...checkRepeatedPassiveModalities(treatments, config, T, C));
  issues.push(...checkDuplicateServices(treatments, config, T, C));
  issues.push(...checkEscalationWithoutFindings(treatments, config, T, C));
  issues.push(...checkBillNoTreatment(billLines, treatments, T, C));
  issues.push(...checkTreatmentNoBill(treatments, billLines, T, C));
  issues.push(...checkHighVariancePricing(billLines, config, T, C));
  issues.push(...checkCodeNoteMismatch(treatments, T, C));
  issues.push(...checkProlongedCareWeakFindings(treatments, config, T, C));
  issues.push(...checkNearIdenticalNotes(treatments, config, T, C));
  issues.push(...checkGapThenIntensiveCare(treatments, config, T, C));
  issues.push(...checkProviderUtilizationPattern(treatments, config, T, C));

  return issues;
}

// ─── Individual Rules ───────────────────────────────────

function makeIssue(
  partial: Omit<ReviewIssue, "id" | "disposition" | "disposition_rationale" | "disposition_by" | "disposition_at" | "disposition_history" | "created_at" | "updated_at">,
): ReviewIssue {
  const now = new Date().toISOString();
  return {
    ...partial,
    id: issueId(),
    disposition: "pending",
    disposition_rationale: "",
    disposition_by: null,
    disposition_at: null,
    disposition_history: [],
    created_at: now,
    updated_at: now,
  };
}

function makeEvidence(r: ReviewerTreatmentRecord): ReviewIssueEvidence {
  return {
    source_document_id: r.source_document_id,
    source_page: r.source_page_start,
    quoted_text: r.source_snippet?.substring(0, 200) || "",
    relevance: "direct",
  };
}

function checkExcessiveFrequency(
  treatments: ReviewerTreatmentRecord[],
  config: MedicalReviewConfig,
  T: string, C: string,
): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  // Group by provider
  const byProvider = groupByProvider(treatments);

  for (const [provider, recs] of byProvider) {
    const dated = recs.filter(r => r.visit_date).sort((a, b) => a.visit_date!.localeCompare(b.visit_date!));
    if (dated.length < 4) continue;

    // Sliding 7-day window
    for (let i = 0; i < dated.length; i++) {
      const windowStart = parseISO(dated[i].visit_date!);
      const windowEnd = new Date(windowStart.getTime() + 7 * 86400000);
      const windowVisits = dated.filter(r => {
        const d = parseISO(r.visit_date!);
        return d >= windowStart && d < windowEnd;
      });

      if (windowVisits.length > config.max_visits_per_week) {
        issues.push(makeIssue({
          tenant_id: T, case_id: C,
          issue_type: "excessive_visit_frequency",
          severity: "medium",
          title: `${windowVisits.length} visits in 7 days — ${provider}`,
          description: `${windowVisits.length} visits between ${dated[i].visit_date} and the following week exceeds the ${config.max_visits_per_week}/week threshold.`,
          machine_explanation: `Rule: Flag providers with >${config.max_visits_per_week} visits per rolling 7-day window. Found ${windowVisits.length} visits for ${provider}.`,
          affected_provider: provider,
          affected_date_start: dated[i].visit_date,
          affected_date_end: windowVisits[windowVisits.length - 1]?.visit_date ?? null,
          affected_bill_line_ids: [],
          affected_treatment_ids: windowVisits.map(r => r.id),
          evidence: windowVisits.slice(0, 3).map(makeEvidence),
          questioned_amount: 0,
        }));
        break; // One flag per provider
      }
    }
  }
  return issues;
}

function checkBeyondRecoveryWindow(
  treatments: ReviewerTreatmentRecord[],
  config: MedicalReviewConfig,
  T: string, C: string,
): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const softTissueTypes = new Set(["physical_therapy", "chiropractic"]);

  const byProvider = groupByProvider(treatments);
  for (const [provider, recs] of byProvider) {
    const stRecs = recs.filter(r => softTissueTypes.has(r.visit_type) && r.visit_date);
    if (stRecs.length < 2) continue;

    const sorted = stRecs.sort((a, b) => a.visit_date!.localeCompare(b.visit_date!));
    const first = parseISO(sorted[0].visit_date!);
    const last = parseISO(sorted[sorted.length - 1].visit_date!);
    const span = differenceInDays(last, first);

    if (span > config.soft_tissue_recovery_days) {
      const billedAfterWindow = stRecs.filter(r => {
        const d = parseISO(r.visit_date!);
        return differenceInDays(d, first) > config.soft_tissue_recovery_days;
      });
      const questionedAmt = billedAfterWindow.reduce((s, r) => s + (r.total_billed ?? 0), 0);

      issues.push(makeIssue({
        tenant_id: T, case_id: C,
        issue_type: "treatment_beyond_recovery_window",
        severity: "high",
        title: `Soft-tissue treatment spanning ${span} days — ${provider}`,
        description: `Treatment continues ${span - config.soft_tissue_recovery_days} days beyond the ${config.soft_tissue_recovery_days}-day expected soft-tissue recovery window.`,
        machine_explanation: `Rule: Flag soft-tissue modalities (PT/chiro) continuing beyond ${config.soft_tissue_recovery_days} days. First visit: ${sorted[0].visit_date}, Last: ${sorted[sorted.length - 1].visit_date}. ${billedAfterWindow.length} visit(s) beyond window.`,
        affected_provider: provider,
        affected_date_start: sorted[0].visit_date,
        affected_date_end: sorted[sorted.length - 1].visit_date,
        affected_bill_line_ids: [],
        affected_treatment_ids: billedAfterWindow.map(r => r.id),
        evidence: billedAfterWindow.slice(0, 2).map(makeEvidence),
        questioned_amount: questionedAmt,
      }));
    }
  }
  return issues;
}

function checkRepeatedPassiveModalities(
  treatments: ReviewerTreatmentRecord[],
  config: MedicalReviewConfig,
  T: string, C: string,
): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const passiveSet = new Set(config.passive_modality_codes);

  const byProvider = groupByProvider(treatments);
  for (const [provider, recs] of byProvider) {
    const dated = recs.filter(r => r.visit_date).sort((a, b) => a.visit_date!.localeCompare(b.visit_date!));
    let consecutivePassive = 0;
    const passiveRecs: ReviewerTreatmentRecord[] = [];

    for (const r of dated) {
      const codes = r.procedures.map(p => p.code).filter(Boolean) as string[];
      const allPassive = codes.length > 0 && codes.every(c => passiveSet.has(c));

      if (allPassive) {
        consecutivePassive++;
        passiveRecs.push(r);
      } else {
        consecutivePassive = 0;
        passiveRecs.length = 0;
      }

      if (consecutivePassive >= config.max_passive_only_weeks) {
        issues.push(makeIssue({
          tenant_id: T, case_id: C,
          issue_type: "repeated_passive_modalities",
          severity: "medium",
          title: `${consecutivePassive} consecutive passive-only visits — ${provider}`,
          description: `${consecutivePassive} visits using only passive modalities without progression to active treatment.`,
          machine_explanation: `Rule: Flag ≥${config.max_passive_only_weeks} consecutive visits where all procedure codes are passive modalities (${config.passive_modality_codes.join(", ")}). No active therapeutic exercise detected.`,
          affected_provider: provider,
          affected_date_start: passiveRecs[0]?.visit_date ?? null,
          affected_date_end: passiveRecs[passiveRecs.length - 1]?.visit_date ?? null,
          affected_bill_line_ids: [],
          affected_treatment_ids: passiveRecs.map(r => r.id),
          evidence: passiveRecs.slice(0, 2).map(makeEvidence),
          questioned_amount: passiveRecs.reduce((s, r) => s + (r.total_billed ?? 0), 0),
        }));
        break;
      }
    }
  }
  return issues;
}

function checkDuplicateServices(
  treatments: ReviewerTreatmentRecord[],
  config: MedicalReviewConfig,
  T: string, C: string,
): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const seen = new Map<string, ReviewerTreatmentRecord>();

  for (const r of treatments) {
    if (!r.visit_date) continue;
    for (const proc of r.procedures) {
      if (!proc.code) continue;
      const key = `${r.visit_date}|${proc.code}|${r.provider_name_normalized || r.provider_name_raw}`;
      const existing = seen.get(key);
      if (existing && existing.id !== r.id) {
        issues.push(makeIssue({
          tenant_id: T, case_id: C,
          issue_type: "duplicate_service",
          severity: "high",
          title: `Duplicate ${proc.code} on ${r.visit_date}`,
          description: `CPT ${proc.code} (${proc.description}) appears on ${r.visit_date} for the same provider — possible duplicate billing.`,
          machine_explanation: `Rule: Flag identical CPT code + service date + provider combinations. Matched records: ${existing.id} and ${r.id}.`,
          affected_provider: r.provider_name_normalized || r.provider_name_raw,
          affected_date_start: r.visit_date,
          affected_date_end: r.visit_date,
          affected_bill_line_ids: [],
          affected_treatment_ids: [existing.id, r.id],
          evidence: [makeEvidence(existing), makeEvidence(r)],
          questioned_amount: r.total_billed ?? 0,
        }));
      } else {
        seen.set(key, r);
      }
    }
  }
  return issues;
}

function checkEscalationWithoutFindings(
  treatments: ReviewerTreatmentRecord[],
  config: MedicalReviewConfig,
  T: string, C: string,
): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const escalationCodes = new Set(["64483", "64484", "62323", "63030", "22551", "29881"]);

  for (const r of treatments) {
    const escalated = r.procedures.some(p => p.code && escalationCodes.has(p.code));
    if (!escalated) continue;

    const hasObjective = r.objective_findings && r.objective_findings.length > config.min_objective_findings_length;
    if (!hasObjective) {
      issues.push(makeIssue({
        tenant_id: T, case_id: C,
        issue_type: "escalation_without_findings",
        severity: "high",
        title: `Escalation lacking objective findings — ${r.visit_date || "unknown date"}`,
        description: `Invasive/interventional procedure performed without adequate documented objective findings.`,
        machine_explanation: `Rule: Flag escalation procedures (injections, surgery) where objective_findings is empty or <${config.min_objective_findings_length} chars. Record ${r.id} has ${r.objective_findings?.length ?? 0} chars of objective findings. (v${config.rule_engine_version})`,
        affected_provider: r.provider_name_normalized || r.provider_name_raw,
        affected_date_start: r.visit_date,
        affected_date_end: r.visit_date,
        affected_bill_line_ids: [],
        affected_treatment_ids: [r.id],
        evidence: [makeEvidence(r)],
        questioned_amount: r.total_billed ?? 0,
      }));
    }
  }
  return issues;
}

function checkBillNoTreatment(
  billLines: ReviewerBillLine[],
  treatments: ReviewerTreatmentRecord[],
  T: string, C: string,
): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const treatmentIds = new Set(treatments.map(t => t.id));

  for (const line of billLines) {
    if (!line.upstream_treatment_id || !treatmentIds.has(line.upstream_treatment_id)) {
      issues.push(makeIssue({
        tenant_id: T, case_id: C,
        issue_type: "bill_no_treatment_note",
        severity: "medium",
        title: `Bill line without treatment note — ${line.cpt_code || "no code"} on ${line.service_date || "unknown date"}`,
        description: `Bill for ${line.description} ($${line.billed_amount}) has no linked treatment record or supporting clinical documentation.`,
        machine_explanation: `Rule: Flag bill lines where upstream_treatment_id is null or does not match any treatment record. Line ${line.id} has no linked treatment.`,
        affected_provider: line.provider_name,
        affected_date_start: line.service_date,
        affected_date_end: line.service_date,
        affected_bill_line_ids: [line.id],
        affected_treatment_ids: [],
        evidence: [],
        questioned_amount: line.billed_amount,
      }));
    }
  }
  return issues;
}

function checkTreatmentNoBill(
  treatments: ReviewerTreatmentRecord[],
  billLines: ReviewerBillLine[],
  T: string, C: string,
): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const linkedTreatmentIds = new Set(billLines.map(l => l.upstream_treatment_id).filter(Boolean));

  for (const r of treatments) {
    if (r.visit_type === "ime") continue;
    if (!linkedTreatmentIds.has(r.id) && (r.total_billed == null || r.total_billed === 0)) {
      issues.push(makeIssue({
        tenant_id: T, case_id: C,
        issue_type: "treatment_no_bill",
        severity: "low",
        title: `Treatment without bill — ${r.visit_date || "unknown date"}`,
        description: `${r.provider_name_raw || "Unknown provider"} visit on ${r.visit_date || "unknown date"} has no corresponding billing.`,
        machine_explanation: `Rule: Flag treatment records with no linked bill line and $0 billed. Record ${r.id} has no billing.`,
        affected_provider: r.provider_name_normalized || r.provider_name_raw,
        affected_date_start: r.visit_date,
        affected_date_end: r.visit_date,
        affected_bill_line_ids: [],
        affected_treatment_ids: [r.id],
        evidence: [makeEvidence(r)],
        questioned_amount: 0,
      }));
    }
  }
  return issues;
}

function checkHighVariancePricing(
  billLines: ReviewerBillLine[],
  config: MedicalReviewConfig,
  T: string, C: string,
): ReviewIssue[] {
  const issues: ReviewIssue[] = [];

  for (const line of billLines) {
    if (line.reference_amount && line.variance_pct && line.variance_pct > config.high_variance_threshold_pct) {
      issues.push(makeIssue({
        tenant_id: T, case_id: C,
        issue_type: "high_variance_pricing",
        severity: line.variance_pct > 500 ? "high" : "medium",
        title: `${line.variance_pct}% of reference — ${line.cpt_code || "no code"}`,
        description: `Billed $${line.billed_amount.toLocaleString()} vs reference $${line.reference_amount.toLocaleString()} (${line.variance_pct}%). Variance: $${line.variance_amount?.toLocaleString()}.`,
        machine_explanation: `Rule: Flag lines where billed amount exceeds ${config.high_variance_threshold_pct}% of Medicare reference. CPT ${line.cpt_code}: $${line.billed_amount} billed vs $${line.reference_amount} reference = ${line.variance_pct}%.`,
        affected_provider: line.provider_name,
        affected_date_start: line.service_date,
        affected_date_end: line.service_date,
        affected_bill_line_ids: [line.id],
        affected_treatment_ids: line.upstream_treatment_id ? [line.upstream_treatment_id] : [],
        evidence: [],
        questioned_amount: line.variance_amount ?? 0,
      }));
    }
  }
  return issues;
}

function checkCodeNoteMismatch(
  treatments: ReviewerTreatmentRecord[],
  T: string, C: string,
): ReviewIssue[] {
  const issues: ReviewIssue[] = [];

  for (const r of treatments) {
    if (r.procedures.length === 0 && r.visit_type !== "ime" && r.assessment_summary && r.assessment_summary.length > 20) {
      issues.push(makeIssue({
        tenant_id: T, case_id: C,
        issue_type: "code_note_mismatch",
        severity: "low",
        title: `Treatment note without procedure codes — ${r.visit_date || "unknown date"}`,
        description: `Clinical note from ${r.provider_name_raw || "unknown"} has assessment but no procedure codes extracted.`,
        machine_explanation: `Rule: Flag records with clinical notes (assessment_summary > 20 chars) but zero procedure codes. Record ${r.id} has ${r.assessment_summary.length} chars of assessment but 0 procedures.`,
        affected_provider: r.provider_name_normalized || r.provider_name_raw,
        affected_date_start: r.visit_date,
        affected_date_end: r.visit_date,
        affected_bill_line_ids: [],
        affected_treatment_ids: [r.id],
        evidence: [makeEvidence(r)],
        questioned_amount: 0,
      }));
    }
  }
  return issues;
}

// ─── Clinical Phase 1 Rules ─────────────────────────────

function checkProlongedCareWeakFindings(
  treatments: ReviewerTreatmentRecord[],
  config: MedicalReviewConfig,
  T: string, C: string,
): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const byProvider = groupByProvider(treatments);

  for (const [provider, recs] of byProvider) {
    const dated = recs.filter(r => r.visit_date).sort((a, b) => a.visit_date!.localeCompare(b.visit_date!));
    if (dated.length < 4) continue;

    const first = parseISO(dated[0].visit_date!);
    const last = parseISO(dated[dated.length - 1].visit_date!);
    const span = differenceInDays(last, first);
    if (span <= config.soft_tissue_recovery_days) continue;

    // Check if objective findings are consistently weak across later visits
    const laterVisits = dated.filter(r => differenceInDays(parseISO(r.visit_date!), first) > config.soft_tissue_recovery_days);
    const weakCount = laterVisits.filter(r => !r.objective_findings || r.objective_findings.length < config.min_objective_findings_length).length;

    if (weakCount >= Math.ceil(laterVisits.length * 0.6)) {
      issues.push(makeIssue({
        tenant_id: T, case_id: C,
        issue_type: "prolonged_care_weak_findings",
        severity: "high",
        title: `Prolonged care (${span}d) with weak objective findings — ${provider}`,
        description: `${weakCount} of ${laterVisits.length} visits beyond the ${config.soft_tissue_recovery_days}-day window have insufficient objective findings.`,
        machine_explanation: `Rule: Flag providers treating beyond ${config.soft_tissue_recovery_days} days where ≥60% of later visits have objective_findings < ${config.min_objective_findings_length} chars. ${provider}: ${weakCount}/${laterVisits.length} weak. (v${config.rule_engine_version})`,
        affected_provider: provider,
        affected_date_start: laterVisits[0]?.visit_date ?? null,
        affected_date_end: laterVisits[laterVisits.length - 1]?.visit_date ?? null,
        affected_bill_line_ids: [],
        affected_treatment_ids: laterVisits.map(r => r.id),
        evidence: laterVisits.filter(r => !r.objective_findings || r.objective_findings.length < config.min_objective_findings_length).slice(0, 3).map(makeEvidence),
        questioned_amount: laterVisits.reduce((s, r) => s + (r.total_billed ?? 0), 0),
      }));
    }
  }
  return issues;
}

function checkNearIdenticalNotes(
  treatments: ReviewerTreatmentRecord[],
  config: MedicalReviewConfig,
  T: string, C: string,
): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const byProvider = groupByProvider(treatments);

  for (const [provider, recs] of byProvider) {
    const dated = recs.filter(r => r.visit_date && r.assessment_summary && r.assessment_summary.length > 10)
      .sort((a, b) => a.visit_date!.localeCompare(b.visit_date!));
    if (dated.length < 3) continue;

    // Compare consecutive notes using Jaccard similarity on word tokens
    const identicalPairs: Array<[ReviewerTreatmentRecord, ReviewerTreatmentRecord]> = [];
    for (let i = 1; i < dated.length; i++) {
      const sim = jaccardSimilarity(dated[i - 1].assessment_summary, dated[i].assessment_summary);
      if (sim >= config.near_identical_note_threshold) {
        identicalPairs.push([dated[i - 1], dated[i]]);
      }
    }

    if (identicalPairs.length >= 2) {
      const allAffected = [...new Set(identicalPairs.flatMap(([a, b]) => [a.id, b.id]))];
      issues.push(makeIssue({
        tenant_id: T, case_id: C,
        issue_type: "near_identical_notes",
        severity: "medium",
        title: `${identicalPairs.length} near-identical note pairs — ${provider}`,
        description: `${identicalPairs.length} consecutive visit pairs have assessment notes with ≥${Math.round(config.near_identical_note_threshold * 100)}% similarity, suggesting templated or copy-pasted documentation.`,
        machine_explanation: `Rule: Flag providers with ≥2 consecutive note pairs exceeding ${config.near_identical_note_threshold} Jaccard similarity. ${provider}: ${identicalPairs.length} pairs. (v${config.rule_engine_version})`,
        affected_provider: provider,
        affected_date_start: identicalPairs[0][0].visit_date,
        affected_date_end: identicalPairs[identicalPairs.length - 1][1].visit_date,
        affected_bill_line_ids: [],
        affected_treatment_ids: allAffected,
        evidence: identicalPairs.slice(0, 2).flatMap(([a, b]) => [makeEvidence(a), makeEvidence(b)]),
        questioned_amount: 0,
      }));
    }
  }
  return issues;
}

function checkGapThenIntensiveCare(
  treatments: ReviewerTreatmentRecord[],
  config: MedicalReviewConfig,
  T: string, C: string,
): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const byProvider = groupByProvider(treatments);

  for (const [provider, recs] of byProvider) {
    const dated = recs.filter(r => r.visit_date).sort((a, b) => a.visit_date!.localeCompare(b.visit_date!));
    if (dated.length < 3) continue;

    for (let i = 1; i < dated.length; i++) {
      const gap = differenceInDays(parseISO(dated[i].visit_date!), parseISO(dated[i - 1].visit_date!));
      if (gap < config.treatment_gap_days) continue;

      // Check intensity in 14-day window after gap
      const gapEnd = parseISO(dated[i].visit_date!);
      const windowEnd = new Date(gapEnd.getTime() + 14 * 86400000);
      const postGapVisits = dated.filter(r => {
        const d = parseISO(r.visit_date!);
        return d >= gapEnd && d <= windowEnd;
      });

      const visitsPerWeek = postGapVisits.length / 2;
      if (visitsPerWeek >= config.post_gap_intensive_visits_per_week) {
        issues.push(makeIssue({
          tenant_id: T, case_id: C,
          issue_type: "gap_then_intensive_care",
          severity: "medium",
          title: `${gap}-day gap then ${postGapVisits.length} visits in 2 weeks — ${provider}`,
          description: `After a ${gap}-day treatment gap, ${postGapVisits.length} visits occurred in the following 14 days (${visitsPerWeek.toFixed(1)}/week), suggesting resumed intensive care without documented clinical justification.`,
          machine_explanation: `Rule: Flag ≥${config.treatment_gap_days}-day gaps followed by ≥${config.post_gap_intensive_visits_per_week} visits/week in the next 14 days. Gap: ${dated[i - 1].visit_date} → ${dated[i].visit_date} (${gap}d). Post-gap: ${postGapVisits.length} visits. (v${config.rule_engine_version})`,
          affected_provider: provider,
          affected_date_start: dated[i - 1].visit_date,
          affected_date_end: postGapVisits[postGapVisits.length - 1]?.visit_date ?? null,
          affected_bill_line_ids: [],
          affected_treatment_ids: postGapVisits.map(r => r.id),
          evidence: postGapVisits.slice(0, 3).map(makeEvidence),
          questioned_amount: postGapVisits.reduce((s, r) => s + (r.total_billed ?? 0), 0),
        }));
        break; // One flag per provider
      }
    }
  }
  return issues;
}

function checkProviderUtilizationPattern(
  treatments: ReviewerTreatmentRecord[],
  config: MedicalReviewConfig,
  T: string, C: string,
): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const totalBilled = treatments.reduce((s, r) => s + (r.total_billed ?? 0), 0);
  if (totalBilled === 0) return issues;

  const byProvider = groupByProvider(treatments);
  for (const [provider, recs] of byProvider) {
    if (recs.length < config.provider_pattern_min_visits) continue;

    const providerBilled = recs.reduce((s, r) => s + (r.total_billed ?? 0), 0);
    const concentration = (providerBilled / totalBilled) * 100;

    if (concentration >= config.provider_concentration_pct) {
      const dated = recs.filter(r => r.visit_date).sort((a, b) => a.visit_date!.localeCompare(b.visit_date!));
      issues.push(makeIssue({
        tenant_id: T, case_id: C,
        issue_type: "provider_utilization_pattern",
        severity: "medium",
        title: `${provider} accounts for ${Math.round(concentration)}% of case billing`,
        description: `${recs.length} visits totaling $${providerBilled.toLocaleString()} represent ${Math.round(concentration)}% of total case billing ($${totalBilled.toLocaleString()}). Elevated concentration warrants closer review.`,
        machine_explanation: `Rule: Flag providers with ≥${config.provider_pattern_min_visits} visits representing ≥${config.provider_concentration_pct}% of total case billing. ${provider}: ${recs.length} visits, $${providerBilled.toLocaleString()} / $${totalBilled.toLocaleString()} = ${Math.round(concentration)}%. (v${config.rule_engine_version})`,
        affected_provider: provider,
        affected_date_start: dated[0]?.visit_date ?? null,
        affected_date_end: dated[dated.length - 1]?.visit_date ?? null,
        affected_bill_line_ids: [],
        affected_treatment_ids: recs.map(r => r.id),
        evidence: recs.slice(0, 3).map(makeEvidence),
        questioned_amount: 0, // Informational, not questioned
      }));
    }
  }
  return issues;
}

// ─── Helpers ────────────────────────────────────────────

function jaccardSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const tokensA = new Set(a.toLowerCase().split(/\s+/).filter(t => t.length > 2));
  const tokensB = new Set(b.toLowerCase().split(/\s+/).filter(t => t.length > 2));
  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokensA) if (tokensB.has(t)) intersection++;
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Exported for testing */
export { jaccardSimilarity };

function groupByProvider(treatments: ReviewerTreatmentRecord[]): Map<string, ReviewerTreatmentRecord[]> {
  const map = new Map<string, ReviewerTreatmentRecord[]>();
  for (const r of treatments) {
    const key = r.provider_name_normalized || r.provider_name_raw || "Unknown";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return map;
}
