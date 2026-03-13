/**
 * EvaluateIQ — Claim Profile Classifier v1
 *
 * Deterministic classification of claims into valuation profiles
 * based on ReviewPackage / intake snapshot facts.
 *
 * Profiles:
 *   A – Minor soft tissue / short-duration care
 *   B – Soft tissue with extended care and functional restriction
 *   C – Objective ortho / non-surgical
 *   D – Fracture / significant objective injury
 *   E – Injection / pain management escalation
 *   F – Surgery
 *   G – Permanent residual / impairment
 *   H – Mixed / multi-system injury
 *   Z – Insufficient data / provisional
 */

import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";

// ─── Profile Definition ────────────────────────────────

export type ClaimProfileCode = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "Z";

export interface ClaimProfileResult {
  primary: ClaimProfileCode;
  secondary_flags: ClaimProfileCode[];
  label: string;
  short_description: string;
  explanation: ProfileExplanation;
  confidence: "high" | "moderate" | "low";
}

export interface ProfileExplanation {
  reasons: ProfileReason[];
  summary: string;
  data_gaps: string[];
}

export interface ProfileReason {
  factor: string;
  description: string;
  weight: "primary" | "supporting" | "negative";
}

// ─── Profile Metadata ──────────────────────────────────

export const PROFILE_META: Record<ClaimProfileCode, { label: string; description: string; color: string }> = {
  A: { label: "Minor Soft Tissue", description: "Short-duration care, no objective findings, conservative treatment only", color: "hsl(var(--status-approved))" },
  B: { label: "Extended Soft Tissue", description: "Soft tissue with prolonged treatment, functional restrictions, or work impact", color: "hsl(var(--status-info))" },
  C: { label: "Objective Ortho (Non-Surgical)", description: "Documented objective orthopedic findings without surgical intervention", color: "hsl(var(--primary))" },
  D: { label: "Fracture / Significant Objective", description: "Fracture or significant objective injury documented on imaging", color: "hsl(var(--status-attention))" },
  E: { label: "Injection / Pain Management", description: "Escalation to injections, nerve blocks, or pain management protocols", color: "hsl(var(--status-attention))" },
  F: { label: "Surgical", description: "Surgical intervention documented with operative report", color: "hsl(var(--destructive))" },
  G: { label: "Permanent Residual / Impairment", description: "Permanent impairment rating or documented permanent residual", color: "hsl(var(--destructive))" },
  H: { label: "Mixed / Multi-System", description: "Multiple body systems involved or complex multi-injury pattern", color: "hsl(var(--status-attention))" },
  Z: { label: "Insufficient Data", description: "Not enough data to classify — provisional profile pending more information", color: "hsl(var(--muted-foreground))" },
};

// ─── Internal Signals ──────────────────────────────────

interface ClassificationSignals {
  injuryCount: number;
  hasSurgery: boolean;
  hasInjections: boolean;
  hasAdvancedImaging: boolean;
  hasPermanency: boolean;
  hasImpairmentRating: boolean;
  hasFracture: boolean;
  hasObjectiveFindings: boolean;
  treatmentDurationDays: number | null;
  providerCount: number;
  treatmentCount: number;
  totalBilled: number;
  bodyRegionCount: number;
  hasWorkRestrictions: boolean;
  hasFunctionalLimitations: boolean;
  hasGaps: boolean;
  gapCount: number;
  missingFieldCount: number;
}

function extractSignals(snapshot: EvaluateIntakeSnapshot): ClassificationSignals {
  const flags = snapshot.clinical_flags;

  // Body region diversity
  const regions = new Set(snapshot.injuries.map(i => i.body_region).filter(Boolean));

  // Fracture detection from diagnosis codes/descriptions
  const hasFracture = snapshot.injuries.some(i =>
    i.diagnosis_code.startsWith("S") && /fractur/i.test(i.diagnosis_description) ||
    /fractur/i.test(i.diagnosis_description)
  );

  // Objective findings — imaging or fracture or objective ortho codes
  const hasObjective = flags.has_advanced_imaging || hasFracture ||
    snapshot.injuries.some(i =>
      /tear|rupture|herniat|stenosis|radiculop|myelop/i.test(i.diagnosis_description)
    );

  // Treatment duration
  const dates = snapshot.treatment_timeline
    .map(t => t.treatment_date)
    .filter((d): d is string => d != null)
    .map(d => new Date(d).getTime())
    .filter(t => !isNaN(t));
  const duration = dates.length >= 2
    ? Math.round((Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24))
    : null;

  // Work restrictions / functional limitations from upstream concerns
  const hasWorkRestrictions = snapshot.upstream_concerns.some(c =>
    /work.?restrict/i.test(c.description)
  ) || snapshot.wage_loss.total_lost_wages.value > 0;

  const hasFunctionalLimitations = snapshot.upstream_concerns.some(c =>
    /functional.?limit/i.test(c.description)
  );

  // Gaps
  const gapConcerns = snapshot.upstream_concerns.filter(c => c.category === "gap");

  return {
    injuryCount: snapshot.injuries.length,
    hasSurgery: flags.has_surgery,
    hasInjections: flags.has_injections,
    hasAdvancedImaging: flags.has_advanced_imaging,
    hasPermanency: flags.has_permanency_indicators,
    hasImpairmentRating: flags.has_impairment_rating,
    hasFracture,
    hasObjectiveFindings: hasObjective,
    treatmentDurationDays: duration,
    providerCount: snapshot.providers.length,
    treatmentCount: snapshot.treatment_timeline.length,
    totalBilled: snapshot.medical_billing.reduce((s, b) => s + b.billed_amount, 0),
    bodyRegionCount: regions.size,
    hasWorkRestrictions,
    hasFunctionalLimitations,
    hasGaps: gapConcerns.length > 0,
    gapCount: gapConcerns.length,
    missingFieldCount: snapshot.completeness_warnings.filter(w => w.status === "missing").length,
  };
}

// ─── Classifier ────────────────────────────────────────

export function classifyClaimProfile(snapshot: EvaluateIntakeSnapshot): ClaimProfileResult {
  const s = extractSignals(snapshot);
  const reasons: ProfileReason[] = [];
  const secondaryFlags: ClaimProfileCode[] = [];

  // ── Insufficient data check ──
  if (s.injuryCount === 0 && s.treatmentCount === 0) {
    return {
      primary: "Z",
      secondary_flags: [],
      label: PROFILE_META.Z.label,
      short_description: PROFILE_META.Z.description,
      confidence: "low",
      explanation: {
        reasons: [{ factor: "No injury or treatment data", description: "The intake snapshot contains no injuries or treatments.", weight: "primary" }],
        summary: "Insufficient data to classify this claim. Awaiting upstream review completion.",
        data_gaps: ["injuries", "treatment_timeline"],
      },
    };
  }

  if (s.missingFieldCount >= 5) {
    reasons.push({ factor: "High missing field count", description: `${s.missingFieldCount} required fields are missing from the intake snapshot.`, weight: "primary" });
    return buildResult("Z", secondaryFlags, reasons, s, ["multiple intake fields"]);
  }

  // ── Profile G: Permanent Residual / Impairment ──
  if (s.hasPermanency || s.hasImpairmentRating) {
    reasons.push({ factor: "Permanency indicators", description: s.hasImpairmentRating ? "Formal impairment rating documented." : "Permanency indicators present in medical records.", weight: "primary" });
    if (s.hasSurgery) {
      secondaryFlags.push("F");
      reasons.push({ factor: "Surgical history", description: "Surgical intervention also documented.", weight: "supporting" });
    }
    if (s.bodyRegionCount >= 3) {
      secondaryFlags.push("H");
      reasons.push({ factor: "Multi-system involvement", description: `${s.bodyRegionCount} body regions affected.`, weight: "supporting" });
    }
    return buildResult("G", secondaryFlags, reasons, s);
  }

  // ── Profile F: Surgery ──
  if (s.hasSurgery) {
    reasons.push({ factor: "Surgical intervention", description: "Operative procedure documented in treatment records.", weight: "primary" });
    if (s.hasFracture) {
      secondaryFlags.push("D");
      reasons.push({ factor: "Fracture present", description: "Fracture diagnosis supports surgical classification.", weight: "supporting" });
    }
    if (s.hasInjections) {
      secondaryFlags.push("E");
      reasons.push({ factor: "Injection history", description: "Pain management injections also documented.", weight: "supporting" });
    }
    if (s.bodyRegionCount >= 3) {
      secondaryFlags.push("H");
      reasons.push({ factor: "Multi-system", description: `${s.bodyRegionCount} body regions involved.`, weight: "supporting" });
    }
    return buildResult("F", secondaryFlags, reasons, s);
  }

  // ── Profile H: Mixed / Multi-System ──
  if (s.bodyRegionCount >= 3 && s.injuryCount >= 4) {
    reasons.push({ factor: "Multi-system injury pattern", description: `${s.injuryCount} injuries across ${s.bodyRegionCount} body regions.`, weight: "primary" });
    if (s.hasObjectiveFindings) {
      secondaryFlags.push("C");
      reasons.push({ factor: "Objective findings", description: "Objective orthopedic findings documented.", weight: "supporting" });
    }
    return buildResult("H", secondaryFlags, reasons, s);
  }

  // ── Profile D: Fracture / Significant Objective ──
  if (s.hasFracture) {
    reasons.push({ factor: "Fracture diagnosis", description: "Fracture confirmed in injury diagnoses.", weight: "primary" });
    if (s.hasAdvancedImaging) {
      reasons.push({ factor: "Imaging confirmation", description: "Advanced imaging supports fracture diagnosis.", weight: "supporting" });
    }
    return buildResult("D", secondaryFlags, reasons, s);
  }

  // ── Profile E: Injection / Pain Management Escalation ──
  if (s.hasInjections) {
    reasons.push({ factor: "Injection / pain management", description: "Treatment escalated to injections or pain management protocols.", weight: "primary" });
    if (s.hasObjectiveFindings) {
      secondaryFlags.push("C");
      reasons.push({ factor: "Objective findings", description: "Objective orthopedic findings also present.", weight: "supporting" });
    }
    return buildResult("E", secondaryFlags, reasons, s);
  }

  // ── Profile C: Objective Ortho (Non-Surgical) ──
  if (s.hasObjectiveFindings) {
    reasons.push({ factor: "Objective orthopedic findings", description: "Imaging or clinical findings document structural pathology.", weight: "primary" });
    return buildResult("C", secondaryFlags, reasons, s);
  }

  // ── Profile B: Extended Soft Tissue ──
  const isExtended = (s.treatmentDurationDays != null && s.treatmentDurationDays > 90) ||
    s.providerCount >= 3 ||
    s.hasWorkRestrictions ||
    s.hasFunctionalLimitations;

  if (isExtended) {
    if (s.treatmentDurationDays != null && s.treatmentDurationDays > 90) {
      reasons.push({ factor: "Extended treatment duration", description: `${s.treatmentDurationDays} days of treatment (>90 day threshold).`, weight: "primary" });
    }
    if (s.providerCount >= 3) {
      reasons.push({ factor: "Multiple providers", description: `${s.providerCount} providers involved.`, weight: "supporting" });
    }
    if (s.hasWorkRestrictions) {
      reasons.push({ factor: "Work restrictions", description: "Work restrictions or wage loss documented.", weight: "supporting" });
    }
    if (s.hasFunctionalLimitations) {
      reasons.push({ factor: "Functional limitations", description: "Functional limitations documented in records.", weight: "supporting" });
    }
    return buildResult("B", secondaryFlags, reasons, s);
  }

  // ── Profile A: Minor Soft Tissue ──
  reasons.push({ factor: "Conservative treatment only", description: "No surgery, injections, objective findings, or extended care pattern.", weight: "primary" });
  if (s.treatmentDurationDays != null) {
    reasons.push({ factor: "Short duration", description: `${s.treatmentDurationDays} days of treatment.`, weight: "supporting" });
  }
  return buildResult("A", secondaryFlags, reasons, s);
}

// ─── Result Builder ────────────────────────────────────

function buildResult(
  primary: ClaimProfileCode,
  secondary: ClaimProfileCode[],
  reasons: ProfileReason[],
  signals: ClassificationSignals,
  dataGaps?: string[],
): ClaimProfileResult {
  const meta = PROFILE_META[primary];

  // Confidence based on data completeness
  let confidence: "high" | "moderate" | "low" = "high";
  if (signals.missingFieldCount >= 3) confidence = "low";
  else if (signals.missingFieldCount >= 1 || signals.hasGaps) confidence = "moderate";

  const gaps = dataGaps ?? [];
  if (signals.hasGaps) gaps.push(`${signals.gapCount} treatment gap(s) noted`);

  return {
    primary,
    secondary_flags: [...new Set(secondary)],
    label: meta.label,
    short_description: meta.description,
    confidence,
    explanation: {
      reasons,
      summary: `Classified as Profile ${primary} (${meta.label}). ${reasons.filter(r => r.weight === "primary").map(r => r.description).join(" ")}`,
      data_gaps: gaps,
    },
  };
}
