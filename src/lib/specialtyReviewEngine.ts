/**
 * ReviewerIQ — Specialty Review Engine v1.0.0
 *
 * 3-layer architecture:
 *   Layer 1: Base coding/payment checks (NCCI, MUE, therapy units, global surgery)
 *   Layer 2: Specialty clinical logic (chiro, PT, ortho, pain mgmt, radiology, surgery)
 *   Layer 3: Jurisdiction/client overlay (pluggable — stub in v1)
 *
 * NEVER outputs "deny care." Uses support_level enum.
 * Every recommendation is explainable and evidence-linked.
 */

import { differenceInDays, differenceInWeeks, parseISO } from "date-fns";
import type { ReviewerTreatmentRecord } from "@/hooks/useReviewerTreatments";
import type { ReviewerBillLine } from "@/types/reviewer-bills";
import type {
  SpecialtyType, SupportLevel, EpisodePhase, SpecialtyIssueType,
  EpisodeOfCare, SpecialtyReviewRecommendation, SpecialtyIssueTag,
  SpecialtyEvidenceLink, ReimbursementAdjustmentReason,
  ClinicalFindings, ImagingFinding, ResponseToPriorTreatment,
  SPECIALTY_REVIEW_ENGINE_VERSION,
} from "@/types/specialty-review";

// ─── Specialty Classification ──────────────────────────

const SPECIALTY_VISIT_MAP: Record<string, SpecialtyType> = {
  chiropractic: "chiro",
  physical_therapy: "pt",
  outpatient: "ortho",
  follow_up: "ortho",
  pain_management: "pain_management",
  radiology: "radiology",
  surgery: "surgery",
  emergency: "ortho", // ER visits reviewed under ortho lens for injury assessment
};

const CHIRO_CODES = new Set(["98940", "98941", "98942", "98943"]);
const PT_EVAL_CODES = new Set(["97161", "97162", "97163", "97164"]);
const PT_TIMED_CODES = new Set(["97110", "97112", "97116", "97140", "97530", "97535", "97542"]);
const PASSIVE_CODES = new Set(["97010", "97012", "97014", "97032", "97035", "97036"]);
const IMAGING_CODES_ADVANCED = new Set(["72141", "72142", "72148", "72149", "72156", "72157", "73221", "73222", "73721", "73722", "70551", "70553"]);
const INJECTION_CODES = new Set(["64483", "64484", "62323", "27096", "20610", "20611", "J3301", "J1030"]);
const SURGERY_CODES = new Set(["22551", "63030", "29881", "27447", "23472", "29827", "63047", "22612"]);

// NCCI/PTP conflict pairs (simplified representative set)
const NCCI_CONFLICTS: [string, string][] = [
  ["97140", "97530"], // manual therapy + therapeutic activities on same date
  ["97110", "97530"], // ther ex + ther activities (context-dependent, flagged for review)
  ["72141", "72142"], // MRI c-spine w/o and w/ contrast same session
  ["64483", "64484"], // ESI primary + additional level bundling
  ["77003", "77012"], // fluoro guidance codes
];

// MUE limits (simplified — real system uses CMS quarterly updates)
const MUE_LIMITS: Record<string, number> = {
  "97110": 4, "97140": 4, "97530": 4, "97112": 4, "97116": 4,
  "97535": 4, "97542": 4,
  "98940": 1, "98941": 1, "98942": 1,
  "97161": 1, "97162": 1, "97163": 1, "97164": 1,
  "99213": 1, "99214": 1, "99243": 1,
};

// Global surgery day ranges (simplified)
const GLOBAL_SURGERY_DAYS: Record<string, number> = {
  "22551": 90, "63030": 90, "29881": 90, "27447": 90,
  "23472": 90, "29827": 90, "63047": 90, "22612": 90,
  "64483": 10, "62323": 10,
};

// ─── Episode Grouping ──────────────────────────────────

let epSeq = 0;
function epId(): string { return `ep-${++epSeq}`; }

export function groupIntoEpisodes(
  treatments: ReviewerTreatmentRecord[],
  billLines: ReviewerBillLine[],
): EpisodeOfCare[] {
  epSeq = 0;
  const episodes: EpisodeOfCare[] = [];

  // Group by provider + body region cluster
  const groupKey = (t: ReviewerTreatmentRecord) => {
    const provider = t.provider_name_normalized || t.provider_name_raw;
    const bodyRegion = t.body_parts?.[0] || "General";
    return `${provider}||${bodyRegion}`;
  };

  const groups = new Map<string, ReviewerTreatmentRecord[]>();
  for (const t of treatments) {
    if (!t.visit_date) continue;
    const key = groupKey(t);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  for (const [key, recs] of groups) {
    const [provider, bodyRegion] = key.split("||");
    const sorted = [...recs].sort((a, b) => a.visit_date!.localeCompare(b.visit_date!));
    const specialty = classifySpecialtyGroup(sorted);
    const dateStart = sorted[0].visit_date!;
    const dateEnd = sorted[sorted.length - 1].visit_date!;
    const spanDays = differenceInDays(parseISO(dateEnd), parseISO(dateStart));

    const diagCodes = [...new Set(sorted.flatMap(r => r.diagnoses.map(d => d.code)))];
    const treatmentIds = sorted.map(r => r.id);
    const linkedBillIds = billLines
      .filter(l => treatmentIds.includes(l.upstream_treatment_id || ""))
      .map(l => l.id);

    episodes.push({
      id: epId(),
      case_id: sorted[0].case_id,
      provider_name: provider,
      specialty,
      body_region: bodyRegion,
      laterality: extractLaterality(sorted),
      diagnosis_cluster: diagCodes,
      phase: classifyPhase(spanDays, specialty, sorted),
      date_start: dateStart,
      date_end: dateEnd,
      visit_count: sorted.length,
      treatment_ids: treatmentIds,
      bill_line_ids: linkedBillIds,
    });
  }

  return episodes;
}

function classifySpecialtyGroup(recs: ReviewerTreatmentRecord[]): SpecialtyType {
  // Check ALL records in the group — highest-acuity specialty wins
  const allCodes = recs.flatMap(r => r.procedures.map(p => p.code).filter(Boolean) as string[]);
  if (allCodes.some(c => SURGERY_CODES.has(c))) return "surgery";
  if (allCodes.some(c => INJECTION_CODES.has(c))) return "pain_management";
  if (allCodes.some(c => IMAGING_CODES_ADVANCED.has(c))) return "radiology";
  if (allCodes.some(c => CHIRO_CODES.has(c))) return "chiro";
  if (allCodes.some(c => PT_EVAL_CODES.has(c) || PT_TIMED_CODES.has(c))) return "pt";
  // Fallback to visit types — highest acuity wins
  const visitTypes = recs.map(r => r.visit_type);
  if (visitTypes.includes("surgery")) return "surgery";
  if (visitTypes.includes("pain_management")) return "pain_management";
  if (visitTypes.includes("radiology")) return "radiology";
  if (visitTypes.includes("chiropractic")) return "chiro";
  if (visitTypes.includes("physical_therapy")) return "pt";
  return SPECIALTY_VISIT_MAP[recs[0].visit_type] || "ortho";
}

function classifyPhase(spanDays: number, specialty: SpecialtyType, recs: ReviewerTreatmentRecord[]): EpisodePhase {
  // Post-op if any surgical codes present
  const hasSurgery = recs.some(r => r.procedures.some(p => p.code && SURGERY_CODES.has(p.code)));
  if (hasSurgery) return "postop";
  if (spanDays <= 30) return "acute";
  if (spanDays <= 90) return "subacute";
  return "chronic";
}

function extractLaterality(recs: ReviewerTreatmentRecord[]): string | null {
  const parts = recs.flatMap(r => r.body_parts || []);
  if (parts.some(p => /\bright\b/i.test(p))) return "right";
  if (parts.some(p => /\bleft\b/i.test(p))) return "left";
  if (parts.some(p => /\bbilateral\b/i.test(p))) return "bilateral";
  return null;
}

// ─── Extract Documentation Signals ─────────────────────

function extractClinicalFindings(recs: ReviewerTreatmentRecord[]): ClinicalFindings {
  const findings: ClinicalFindings = {
    rom_deficits: [], strength_deficits: [], neurological_deficits: [],
    special_tests: [], swelling_instability: [], pain_scores: [],
  };
  for (const r of recs) {
    const obj = (r.objective_findings || "").toLowerCase();
    if (/rom|range of motion|limited/.test(obj)) {
      findings.rom_deficits.push(r.objective_findings?.substring(0, 100) || "");
    }
    if (/strength|weakness|motor/.test(obj)) {
      findings.strength_deficits.push(r.objective_findings?.substring(0, 100) || "");
    }
    if (/neuro|reflex|sensation|radiculopathy/.test(obj)) {
      findings.neurological_deficits.push(r.objective_findings?.substring(0, 100) || "");
    }
    if (/spurling|straight leg|lachman|mcmurray|phalen|tinel/.test(obj)) {
      findings.special_tests.push(r.objective_findings?.substring(0, 100) || "");
    }
    if (/swelling|instability|effusion/.test(obj)) {
      findings.swelling_instability.push(r.objective_findings?.substring(0, 100) || "");
    }
    // Extract VAS/pain scores
    const vasMatch = (r.objective_findings || "").match(/(?:vas|pain\s*(?:score)?)\s*[:\s]*(\d+)\s*\/\s*10/i);
    if (vasMatch && r.visit_date) {
      findings.pain_scores.push({ date: r.visit_date, score: parseInt(vasMatch[1]) });
    }
  }
  return findings;
}

function extractImagingFindings(recs: ReviewerTreatmentRecord[]): ImagingFinding[] {
  return recs
    .filter(r => r.visit_type === "radiology" || r.procedures.some(p => p.code && IMAGING_CODES_ADVANCED.has(p.code)))
    .map(r => ({
      study_type: r.procedures.map(p => p.description).join(", ") || "Imaging study",
      date: r.visit_date || "",
      body_region: r.body_parts?.[0] || "Unknown",
      laterality: extractLaterality([r]),
      findings_summary: r.objective_findings || r.assessment_summary || "",
      classification: classifyImagingFinding(r) as ImagingFinding["classification"],
      supports_downstream_care: !!(r.objective_findings && r.objective_findings.length > 30),
      source_document_id: r.source_document_id,
      source_page: r.source_page_start,
    }));
}

function classifyImagingFinding(r: ReviewerTreatmentRecord): string {
  const text = `${r.objective_findings} ${r.assessment_summary}`.toLowerCase();
  if (/fracture|tear|rupture|acute|traumatic/.test(text)) return "acute_traumatic";
  if (/degenerative|spondylosis|arthritis|chronic/.test(text)) return "chronic_degenerative";
  if (/incidental|mild|minimal/.test(text) && !/herniation|stenosis/.test(text)) return "incidental";
  return "mixed";
}

// ─── Layer 1: Base Coding Checks ───────────────────────

function runCodingChecks(
  episode: EpisodeOfCare,
  billLines: ReviewerBillLine[],
  treatments: ReviewerTreatmentRecord[],
): SpecialtyIssueTag[] {
  const tags: SpecialtyIssueTag[] = [];
  const epLines = billLines.filter(l => episode.bill_line_ids.includes(l.id));

  // NCCI/PTP conflicts
  const linesByDate = new Map<string, ReviewerBillLine[]>();
  for (const l of epLines) {
    if (!l.service_date) continue;
    if (!linesByDate.has(l.service_date)) linesByDate.set(l.service_date, []);
    linesByDate.get(l.service_date)!.push(l);
  }

  for (const [date, dayLines] of linesByDate) {
    const codes = dayLines.map(l => l.cpt_code).filter(Boolean) as string[];
    for (const [c1, c2] of NCCI_CONFLICTS) {
      if (codes.includes(c1) && codes.includes(c2)) {
        tags.push({
          type: "bundling",
          label: `NCCI conflict: ${c1}/${c2}`,
          detail: `Codes ${c1} and ${c2} billed on ${date} may represent a bundling conflict per NCCI edits.`,
          severity: "medium",
        });
      }
    }

    // MUE checks
    for (const l of dayLines) {
      if (!l.cpt_code) continue;
      const limit = MUE_LIMITS[l.cpt_code];
      if (limit && l.units > limit) {
        tags.push({
          type: "coding",
          label: `MUE exceeded: ${l.cpt_code}`,
          detail: `${l.units} units billed for ${l.cpt_code} exceeds MUE limit of ${limit} per date of service.`,
          severity: "high",
        });
      }
    }

    // Therapy timed-unit plausibility (8-minute rule)
    const timedLines = dayLines.filter(l => l.cpt_code && PT_TIMED_CODES.has(l.cpt_code));
    const totalTimedUnits = timedLines.reduce((s, l) => s + l.units, 0);
    if (totalTimedUnits > 0) {
      const impliedMinutes = totalTimedUnits * 15;
      // More than 8 timed units = 120 min, which is implausible for single session
      if (totalTimedUnits > 8) {
        tags.push({
          type: "coding",
          label: "Implausible timed units",
          detail: `${totalTimedUnits} timed units (${impliedMinutes} min implied) on ${date} exceeds plausible single-session duration.`,
          severity: "high",
        });
      }
    }
  }

  // Global surgery bundling
  const surgeryLines = epLines.filter(l => l.cpt_code && GLOBAL_SURGERY_DAYS[l.cpt_code]);
  for (const surgLine of surgeryLines) {
    if (!surgLine.service_date) continue;
    const globalDays = GLOBAL_SURGERY_DAYS[surgLine.cpt_code!];
    const surgDate = parseISO(surgLine.service_date);

    const postOpLines = epLines.filter(l => {
      if (!l.service_date || l.id === surgLine.id) return false;
      const d = parseISO(l.service_date);
      const daysDiff = differenceInDays(d, surgDate);
      return daysDiff > 0 && daysDiff <= globalDays;
    });

    if (postOpLines.length > 0) {
      tags.push({
        type: "bundling",
        label: `Global surgery period: ${surgLine.cpt_code}`,
        detail: `${postOpLines.length} service(s) billed within ${globalDays}-day global period for ${surgLine.cpt_code}. These may be included in the surgical package unless complication/modifier applies.`,
        severity: "medium",
      });
    }
  }

  return tags;
}

// ─── Layer 2: Specialty Logic ──────────────────────────

function runChiroLogic(
  episode: EpisodeOfCare,
  treatments: ReviewerTreatmentRecord[],
  billLines: ReviewerBillLine[],
): { tags: SpecialtyIssueTag[]; docScore: number; necScore: number } {
  const tags: SpecialtyIssueTag[] = [];
  const recs = treatments.filter(t => episode.treatment_ids.includes(t.id));
  let docScore = 70;
  let necScore = 70;

  // Check for mechanism documentation
  const hasMechanism = recs.some(r => /mva|mvc|accident|fall|injury|collision/i.test(r.subjective_summary || ""));
  if (!hasMechanism) {
    tags.push({ type: "documentation", label: "No mechanism documented", detail: "No injury mechanism (MVA, fall, etc.) found in subjective notes.", severity: "medium" });
    docScore -= 15;
  }

  // Check for exam findings
  const hasExamFindings = recs.some(r => (r.objective_findings?.length || 0) > 30);
  if (!hasExamFindings) {
    tags.push({ type: "documentation", label: "Weak exam findings", detail: "Insufficient objective exam findings documented across visits.", severity: "high" });
    docScore -= 20;
  }

  // Check for treatment plan
  const hasPlan = recs.some(r => (r.plan_summary?.length || 0) > 20);
  if (!hasPlan) {
    tags.push({ type: "documentation", label: "No treatment plan", detail: "No structured treatment plan documented.", severity: "medium" });
    docScore -= 10;
  }

  // Cloned/identical notes detection
  const assessments = recs.map(r => r.assessment_summary || "").filter(a => a.length > 20);
  if (assessments.length >= 3) {
    const unique = new Set(assessments.map(a => a.toLowerCase().trim()));
    if (unique.size < assessments.length * 0.5) {
      tags.push({ type: "documentation", label: "Cloned/identical notes", detail: `${assessments.length - unique.size} visits appear to have identical or near-identical assessment text.`, severity: "high" });
      docScore -= 20;
      necScore -= 15;
    }
  }

  // Passive vs active modality ratio
  const epLines = billLines.filter(l => episode.bill_line_ids.includes(l.id));
  const passiveCount = epLines.filter(l => l.cpt_code && PASSIVE_CODES.has(l.cpt_code)).length;
  const manipCount = epLines.filter(l => l.cpt_code && CHIRO_CODES.has(l.cpt_code)).length;
  const totalProcLines = passiveCount + manipCount;
  if (totalProcLines > 0 && passiveCount / totalProcLines > 0.6) {
    tags.push({ type: "utilization", label: "High passive modality ratio", detail: `${passiveCount}/${totalProcLines} procedure lines are passive modalities. Expected greater proportion of active/manual treatment.`, severity: "medium" });
    necScore -= 10;
  }

  // Duration concern
  if (episode.phase === "chronic") {
    tags.push({ type: "medical_necessity", label: "Prolonged chiropractic care", detail: `Treatment spanning into chronic phase (>${90} days). Requires documented functional improvement to support continuation.`, severity: "high" });
    necScore -= 15;
  }

  // Unsupported frequency
  if (episode.visit_count > 3 * differenceInWeeks(parseISO(episode.date_end), parseISO(episode.date_start)) + 1) {
    tags.push({ type: "utilization", label: "Excessive visit frequency", detail: `${episode.visit_count} visits over the episode span exceeds expected frequency for chiropractic care.`, severity: "medium" });
    necScore -= 10;
  }

  return { tags, docScore: Math.max(0, docScore), necScore: Math.max(0, necScore) };
}

function runPTLogic(
  episode: EpisodeOfCare,
  treatments: ReviewerTreatmentRecord[],
  billLines: ReviewerBillLine[],
): { tags: SpecialtyIssueTag[]; docScore: number; necScore: number } {
  const tags: SpecialtyIssueTag[] = [];
  const recs = treatments.filter(t => episode.treatment_ids.includes(t.id));
  const epLines = billLines.filter(l => episode.bill_line_ids.includes(l.id));
  let docScore = 70;
  let necScore = 70;

  // Require evaluation
  const hasEval = epLines.some(l => l.cpt_code && PT_EVAL_CODES.has(l.cpt_code));
  if (!hasEval) {
    tags.push({ type: "documentation", label: "No PT evaluation billed", detail: "No initial evaluation code (97161-97164) found. PT services typically require an initial evaluation.", severity: "high" });
    docScore -= 20;
  }

  // Require measurable goals
  const hasGoals = recs.some(r => /goal|objective|improve|increase|decrease|return to/i.test(r.plan_summary || ""));
  if (!hasGoals) {
    tags.push({ type: "documentation", label: "No measurable goals", detail: "Treatment plan lacks documented measurable functional goals.", severity: "medium" });
    docScore -= 15;
  }

  // Passive modality predominance
  const passiveLines = epLines.filter(l => l.cpt_code && PASSIVE_CODES.has(l.cpt_code)).length;
  const activeLines = epLines.filter(l => l.cpt_code && PT_TIMED_CODES.has(l.cpt_code)).length;
  if (activeLines > 0 && passiveLines > activeLines) {
    tags.push({ type: "progression", label: "Passive > active treatment", detail: `${passiveLines} passive modality lines vs ${activeLines} active treatment lines. Expected greater emphasis on active rehabilitation.`, severity: "medium" });
    necScore -= 10;
  }

  // Repeated same codes without progression
  const codeCounts = new Map<string, number>();
  for (const l of epLines) { if (l.cpt_code) codeCounts.set(l.cpt_code, (codeCounts.get(l.cpt_code) || 0) + 1); }
  for (const [code, count] of codeCounts) {
    if (PT_TIMED_CODES.has(code) && count > 8) {
      tags.push({ type: "progression", label: `Repeated ${code} (${count}x)`, detail: `Code ${code} billed ${count} times without documented progression milestones.`, severity: "medium" });
    }
  }

  // Re-evaluations without status change
  const reEvalLines = epLines.filter(l => l.cpt_code === "97164");
  if (reEvalLines.length > 2) {
    tags.push({ type: "utilization", label: `${reEvalLines.length} re-evaluations`, detail: `${reEvalLines.length} re-evaluations billed. Re-evaluations should correspond to status changes, setbacks, or care milestones.`, severity: "medium" });
    necScore -= 5;
  }

  return { tags, docScore: Math.max(0, docScore), necScore: Math.max(0, necScore) };
}

function runOrthoLogic(
  episode: EpisodeOfCare,
  treatments: ReviewerTreatmentRecord[],
  billLines: ReviewerBillLine[],
  allTreatments: ReviewerTreatmentRecord[],
): { tags: SpecialtyIssueTag[]; docScore: number; necScore: number } {
  const tags: SpecialtyIssueTag[] = [];
  const recs = treatments.filter(t => episode.treatment_ids.includes(t.id));
  let docScore = 75;
  let necScore = 75;

  const findings = extractClinicalFindings(recs);

  // Extract objective findings adequacy
  if (findings.rom_deficits.length === 0 && findings.strength_deficits.length === 0) {
    tags.push({ type: "documentation", label: "No ROM/strength documented", detail: "No range of motion or strength deficits documented in orthopedic records.", severity: "high" });
    docScore -= 20;
  }

  // Imaging concordance for injections/surgery
  const hasEscalation = recs.some(r => r.procedures.some(p => p.code && (INJECTION_CODES.has(p.code) || SURGERY_CODES.has(p.code))));
  if (hasEscalation) {
    const imagingRecs = allTreatments.filter(t =>
      t.visit_type === "radiology" || t.procedures.some(p => p.code && IMAGING_CODES_ADVANCED.has(p.code))
    );
    if (imagingRecs.length === 0) {
      tags.push({ type: "medical_necessity", label: "Escalation without imaging", detail: "Injection or surgical procedure performed without documented imaging support.", severity: "critical" });
      docScore -= 20;
      necScore -= 25;
    }
  }

  // Body-part expansion
  const bodyParts = [...new Set(recs.flatMap(r => r.body_parts || []))];
  if (bodyParts.length > 3) {
    tags.push({ type: "causation", label: "Body-part expansion", detail: `${bodyParts.length} body regions treated (${bodyParts.join(", ")}). Requires clear causation link for each.`, severity: "medium" });
    necScore -= 10;
  }

  // Conservative care completion before escalation
  if (hasEscalation && episode.phase === "acute") {
    tags.push({ type: "timing", label: "Early escalation", detail: "Injection or surgical escalation during acute phase without documented conservative care trial.", severity: "high" });
    necScore -= 15;
  }

  return { tags, docScore: Math.max(0, docScore), necScore: Math.max(0, necScore) };
}

function runPainManagementLogic(
  episode: EpisodeOfCare,
  treatments: ReviewerTreatmentRecord[],
  billLines: ReviewerBillLine[],
  allTreatments: ReviewerTreatmentRecord[],
): { tags: SpecialtyIssueTag[]; docScore: number; necScore: number } {
  const tags: SpecialtyIssueTag[] = [];
  const recs = treatments.filter(t => episode.treatment_ids.includes(t.id));
  let docScore = 70;
  let necScore = 70;

  // Prior conservative care documentation
  const hasPriorConservative = allTreatments.some(t =>
    !episode.treatment_ids.includes(t.id) &&
    (t.visit_type === "physical_therapy" || t.visit_type === "chiropractic") &&
    t.visit_date && episode.date_start && t.visit_date < episode.date_start
  );
  if (!hasPriorConservative) {
    tags.push({ type: "medical_necessity", label: "No prior conservative care", detail: "Pain management procedures without documented prior conservative treatment trial.", severity: "high" });
    necScore -= 15;
  }

  // Repeat injections without documented benefit
  const injectionRecs = recs.filter(r => r.procedures.some(p => p.code && INJECTION_CODES.has(p.code)));
  if (injectionRecs.length > 2) {
    const hasDocumentedResponse = recs.some(r =>
      /improvement|relief|benefit|better|reduced/i.test(r.assessment_summary || "")
    );
    if (!hasDocumentedResponse) {
      tags.push({ type: "medical_necessity", label: "Repeat injections without benefit", detail: `${injectionRecs.length} injection procedures without documented durable benefit or functional improvement.`, severity: "critical" });
      necScore -= 25;
    }
  }

  // Opioid escalation flags
  const medMgmtRecs = recs.filter(r => r.medications?.some(m => /opioid|oxycodone|hydrocodone|morphine|fentanyl|tramadol/i.test(m.name)));
  if (medMgmtRecs.length > 0) {
    const hasRiskDiscussion = recs.some(r =>
      /risk|addiction|abuse|monitoring|uds|drug screen/i.test((r.plan_summary || "") + " " + (r.assessment_summary || ""))
    );
    if (!hasRiskDiscussion) {
      tags.push({ type: "documentation", label: "Opioid without risk documentation", detail: "Opioid medications prescribed without documented risk assessment, monitoring, or drug screening.", severity: "critical" });
      docScore -= 20;
    }
  }

  // Imaging support for procedures
  const hasImagingSupport = allTreatments.some(t =>
    (t.visit_type === "radiology" || t.procedures.some(p => p.code && IMAGING_CODES_ADVANCED.has(p.code))) &&
    t.visit_date && t.visit_date <= episode.date_start
  );
  if (injectionRecs.length > 0 && !hasImagingSupport) {
    tags.push({ type: "documentation", label: "Injection without imaging support", detail: "Injection procedure performed without documented pre-procedure imaging supporting the diagnosis.", severity: "high" });
    docScore -= 15;
  }

  return { tags, docScore: Math.max(0, docScore), necScore: Math.max(0, necScore) };
}

function runRadiologyLogic(
  episode: EpisodeOfCare,
  treatments: ReviewerTreatmentRecord[],
  billLines: ReviewerBillLine[],
  allTreatments: ReviewerTreatmentRecord[],
): { tags: SpecialtyIssueTag[]; docScore: number; necScore: number } {
  const tags: SpecialtyIssueTag[] = [];
  const recs = treatments.filter(t => episode.treatment_ids.includes(t.id));
  const epLines = billLines.filter(l => episode.bill_line_ids.includes(l.id));
  let docScore = 80;
  let necScore = 80;

  // Early advanced imaging without red flags
  const earliestTreatment = allTreatments
    .filter(t => t.visit_date)
    .sort((a, b) => a.visit_date!.localeCompare(b.visit_date!))[0];

  if (earliestTreatment && recs[0]?.visit_date) {
    const daysFromOnset = differenceInDays(parseISO(recs[0].visit_date), parseISO(earliestTreatment.visit_date!));
    if (daysFromOnset <= 14) {
      const hasRedFlags = allTreatments.some(t =>
        /fracture|neuro|cauda|weakness|bowel|bladder|progressive/i.test((t.objective_findings || "") + " " + (t.assessment_summary || ""))
      );
      if (!hasRedFlags) {
        tags.push({ type: "timing", label: "Early advanced imaging", detail: `Advanced imaging performed ${daysFromOnset} days from onset without documented red flags. Guidelines typically recommend conservative trial first.`, severity: "medium" });
        necScore -= 10;
      }
    }
  }

  // Duplicate studies
  const studyCodes = epLines.map(l => l.cpt_code).filter(Boolean) as string[];
  const dupes = studyCodes.filter((c, i) => studyCodes.indexOf(c) !== i);
  if (dupes.length > 0) {
    tags.push({ type: "duplication", label: "Duplicate imaging studies", detail: `Duplicate imaging codes detected: ${[...new Set(dupes)].join(", ")}. Verify clinical justification for repeat studies.`, severity: "high" });
    necScore -= 15;
  }

  // Findings classification
  const imagingFindings = extractImagingFindings(recs);
  const incidentalOnly = imagingFindings.every(f => f.classification === "incidental" || f.classification === "chronic_degenerative");
  if (incidentalOnly && imagingFindings.length > 0) {
    tags.push({ type: "causation", label: "No acute findings on imaging", detail: "All imaging findings classified as incidental or chronic/degenerative. Requires documentation linking findings to acute injury.", severity: "high" });
    necScore -= 15;
  }

  return { tags, docScore: Math.max(0, docScore), necScore: Math.max(0, necScore) };
}

function runSurgeryLogic(
  episode: EpisodeOfCare,
  treatments: ReviewerTreatmentRecord[],
  billLines: ReviewerBillLine[],
  allTreatments: ReviewerTreatmentRecord[],
): { tags: SpecialtyIssueTag[]; docScore: number; necScore: number } {
  const tags: SpecialtyIssueTag[] = [];
  const recs = treatments.filter(t => episode.treatment_ids.includes(t.id));
  let docScore = 70;
  let necScore = 70;

  // Imaging concordance required
  const hasImaging = allTreatments.some(t =>
    t.visit_type === "radiology" || t.procedures.some(p => p.code && IMAGING_CODES_ADVANCED.has(p.code))
  );
  if (!hasImaging) {
    tags.push({ type: "documentation", label: "Surgery without imaging", detail: "Surgical procedure performed without documented pre-operative imaging support.", severity: "critical" });
    docScore -= 25;
    necScore -= 25;
  }

  // Urgent exception path
  const isUrgent = recs.some(r =>
    /fracture|infection|cauda equina|instability|emergency|acute/i.test((r.assessment_summary || "") + " " + (r.objective_findings || ""))
  );

  // Conservative care required unless urgent
  if (!isUrgent) {
    const conservativeTrial = allTreatments.some(t =>
      !episode.treatment_ids.includes(t.id) &&
      (t.visit_type === "physical_therapy" || t.visit_type === "chiropractic" || t.visit_type === "pain_management") &&
      t.visit_date && t.visit_date < episode.date_start
    );
    if (!conservativeTrial) {
      tags.push({ type: "medical_necessity", label: "No conservative care before surgery", detail: "Surgical intervention without documented adequate trial of conservative treatment. No urgent exception identified.", severity: "critical" });
      necScore -= 30;
    }
  }

  // Objective deficits required
  const hasObjectiveDeficits = recs.some(r => (r.objective_findings?.length || 0) > 40);
  if (!hasObjectiveDeficits) {
    tags.push({ type: "documentation", label: "Weak pre-op objective findings", detail: "Pre-operative records lack adequate documented objective deficits supporting surgical indication.", severity: "high" });
    docScore -= 20;
  }

  // Always escalate surgery
  tags.push({ type: "medical_necessity", label: "Surgery requires human review", detail: "All surgical recommendations require mandatory human reviewer assessment per system safety policy.", severity: "info" });

  return { tags, docScore: Math.max(0, docScore), necScore: Math.max(0, necScore) };
}

// ─── Main Engine Entry Point ───────────────────────────

let recSeq = 0;
function recId(): string { return `sr-${++recSeq}`; }

export function runSpecialtyReview(
  treatments: ReviewerTreatmentRecord[],
  billLines: ReviewerBillLine[],
): { episodes: EpisodeOfCare[]; recommendations: SpecialtyReviewRecommendation[] } {
  recSeq = 0;
  const episodes = groupIntoEpisodes(treatments, billLines);
  const recommendations: SpecialtyReviewRecommendation[] = [];

  for (const episode of episodes) {
    const recs = treatments.filter(t => episode.treatment_ids.includes(t.id));
    if (recs.length === 0) continue;

    // Layer 1: Coding checks
    const codingTags = runCodingChecks(episode, billLines, treatments);
    const codingScore = Math.max(0, 100 - codingTags.length * 12);

    // Layer 2: Specialty logic
    let specialtyResult: { tags: SpecialtyIssueTag[]; docScore: number; necScore: number };

    switch (episode.specialty) {
      case "chiro":
        specialtyResult = runChiroLogic(episode, treatments, billLines);
        break;
      case "pt":
        specialtyResult = runPTLogic(episode, treatments, billLines);
        break;
      case "ortho":
        specialtyResult = runOrthoLogic(episode, treatments, billLines, treatments);
        break;
      case "pain_management":
        specialtyResult = runPainManagementLogic(episode, treatments, billLines, treatments);
        break;
      case "radiology":
        specialtyResult = runRadiologyLogic(episode, treatments, billLines, treatments);
        break;
      case "surgery":
        specialtyResult = runSurgeryLogic(episode, treatments, billLines, treatments);
        break;
      default:
        specialtyResult = { tags: [], docScore: 70, necScore: 70 };
    }

    const allTags = [...codingTags, ...specialtyResult.tags];

    // Compute support level
    const avgScore = (specialtyResult.docScore + codingScore + specialtyResult.necScore) / 3;
    const hasCritical = allTags.some(t => t.severity === "critical");
    const mustEscalate = episode.specialty === "surgery" || hasCritical;

    let supportLevel: SupportLevel;
    if (mustEscalate) supportLevel = "escalate";
    else if (avgScore >= 70) supportLevel = "supported";
    else if (avgScore >= 55) supportLevel = "partially_supported";
    else if (avgScore >= 40) supportLevel = "weakly_supported";
    else supportLevel = "unsupported";

    // Build evidence links
    const evidenceLinks: SpecialtyEvidenceLink[] = recs.slice(0, 3).map(r => ({
      source_document_id: r.source_document_id,
      source_page: r.source_page_start,
      quoted_text: r.source_snippet?.substring(0, 200) || "",
      relevance: "direct",
    }));

    // Build reimbursement adjustments
    const adjustments: ReimbursementAdjustmentReason[] = [];
    const epLines = billLines.filter(l => episode.bill_line_ids.includes(l.id));
    const totalBilled = epLines.reduce((s, l) => s + l.billed_amount, 0);

    if (supportLevel === "weakly_supported" || supportLevel === "unsupported") {
      adjustments.push({
        code: "SPEC-REVIEW-FLAG",
        description: `Specialty review: ${supportLevel.replace("_", " ")}`,
        adjustment_type: "flag_review",
        amount_impact: null,
        basis: `Combined documentation/coding/necessity scores below threshold. Total billed: $${totalBilled.toLocaleString()}.`,
      });
    }

    for (const tag of allTags) {
      if (tag.type === "bundling") {
        adjustments.push({
          code: tag.label.split(":")[0] || "BUNDLING",
          description: tag.detail,
          adjustment_type: "bundle",
          amount_impact: null,
          basis: tag.detail,
        });
      }
    }

    // Narrative explanation
    const narrative = buildNarrative(episode, allTags, supportLevel, specialtyResult.docScore, codingScore, specialtyResult.necScore);

    const now = new Date().toISOString();
    recommendations.push({
      id: recId(),
      case_id: episode.case_id,
      episode_id: episode.id,
      specialty_type: episode.specialty,
      provider: episode.provider_name,
      dates_of_service: { start: episode.date_start, end: episode.date_end },
      body_region: episode.body_region,
      laterality: episode.laterality,
      diagnosis_cluster: episode.diagnosis_cluster,
      episode_phase: episode.phase,
      documentation_sufficiency_score: specialtyResult.docScore,
      coding_integrity_score: codingScore,
      necessity_support_score: specialtyResult.necScore,
      support_level: supportLevel,
      confidence: Math.round(avgScore) / 100,
      escalation_required: mustEscalate,
      issue_tags: allTags,
      reimbursement_adjustments: adjustments,
      narrative_explanation: narrative,
      evidence_links: evidenceLinks,
      reviewer_override: null,
      created_at: now,
      updated_at: now,
    });
  }

  return { episodes, recommendations };
}

function buildNarrative(
  episode: EpisodeOfCare,
  tags: SpecialtyIssueTag[],
  supportLevel: SupportLevel,
  docScore: number,
  codingScore: number,
  necScore: number,
): string {
  const parts: string[] = [];
  parts.push(`${episode.provider_name} — ${episode.specialty.replace("_", " ")} episode (${episode.date_start} to ${episode.date_end}, ${episode.visit_count} visits, ${episode.phase} phase).`);
  parts.push(`Documentation sufficiency: ${docScore}/100. Coding integrity: ${codingScore}/100. Necessity support: ${necScore}/100.`);

  if (tags.length > 0) {
    parts.push(`Issues identified (${tags.length}):`);
    for (const tag of tags.slice(0, 5)) {
      parts.push(`• [${tag.severity.toUpperCase()}] ${tag.label}: ${tag.detail}`);
    }
    if (tags.length > 5) parts.push(`… and ${tags.length - 5} additional issues.`);
  }

  const levelLabel = supportLevel.replace(/_/g, " ");
  parts.push(`Overall support level: ${levelLabel}.`);

  if (supportLevel === "escalate") {
    parts.push("This episode requires mandatory human reviewer assessment before finalization.");
  }

  return parts.join("\n");
}
