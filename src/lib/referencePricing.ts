/**
 * ReviewerIQ — Reference Pricing Service
 *
 * Configurable Medicare-aligned reimbursement reference layer.
 * Stores reference values separately from billed amounts.
 * Designed for modularity — future jurisdictions/rule sets can be added.
 */

import type { ReferencePriceEntry, ReferencePricingConfig } from "@/types/reviewer-bills";
import { DEFAULT_PRICING_CONFIG } from "@/types/reviewer-bills";

// ─── Medicare Fee Schedule (Representative 2024 Values) ──

const MEDICARE_FEE_SCHEDULE_2024: Record<string, { description: string; national_rate: number }> = {
  // E/M Codes
  "99281": { description: "ED visit, self-limited", national_rate: 48 },
  "99282": { description: "ED visit, low severity", national_rate: 88 },
  "99283": { description: "ED visit, moderate severity", national_rate: 148 },
  "99284": { description: "ED visit, high severity", national_rate: 268 },
  "99285": { description: "ED visit, critical severity", national_rate: 425 },
  "99213": { description: "Office visit, low complexity", national_rate: 98 },
  "99214": { description: "Office visit, moderate complexity", national_rate: 142 },
  "99215": { description: "Office visit, high complexity", national_rate: 198 },
  "99243": { description: "Consultation, moderate complexity", national_rate: 172 },
  "99244": { description: "Consultation, high complexity", national_rate: 252 },

  // Imaging
  "70450": { description: "CT head without contrast", national_rate: 142 },
  "72141": { description: "MRI cervical spine without contrast", national_rate: 380 },
  "72148": { description: "MRI lumbar spine without contrast", national_rate: 372 },
  "73721": { description: "MRI lower extremity joint", national_rate: 365 },
  "73221": { description: "MRI upper extremity joint", national_rate: 358 },
  "72110": { description: "Lumbar spine X-ray", national_rate: 62 },
  "72040": { description: "Cervical spine X-ray", national_rate: 52 },

  // Physical Therapy
  "97110": { description: "Therapeutic exercise, 15 min", national_rate: 38 },
  "97140": { description: "Manual therapy, 15 min", national_rate: 36 },
  "97530": { description: "Therapeutic activities, 15 min", national_rate: 38 },
  "97112": { description: "Neuromuscular re-education, 15 min", national_rate: 38 },
  "97035": { description: "Ultrasound, 15 min", national_rate: 18 },
  "97010": { description: "Hot/cold packs", national_rate: 8 },
  "97032": { description: "Electrical stimulation", national_rate: 22 },
  "97161": { description: "PT evaluation, low complexity", national_rate: 98 },
  "97162": { description: "PT evaluation, moderate complexity", national_rate: 118 },
  "97163": { description: "PT evaluation, high complexity", national_rate: 142 },

  // Injections
  "64483": { description: "Transforaminal epidural, cervical/thoracic", national_rate: 320 },
  "64484": { description: "Transforaminal epidural, each additional", national_rate: 148 },
  "62323": { description: "Interlaminar epidural, lumbar/sacral", national_rate: 258 },
  "20610": { description: "Joint injection, major", national_rate: 82 },
  "77003": { description: "Fluoroscopic guidance", national_rate: 68 },

  // Surgery (representative)
  "63030": { description: "Discectomy, single interspace", national_rate: 1250 },
  "22551": { description: "ACDF, single interspace", national_rate: 1680 },
  "29881": { description: "Knee arthroscopy with meniscectomy", national_rate: 620 },
};

// ─── Geographic Adjustment Factors ──────────────────────

const GPCI_FACTORS: Record<string, number> = {
  "CA - Sacramento": 1.12,
  "CA - Los Angeles": 1.18,
  "CA - San Francisco": 1.25,
  "NY - Manhattan": 1.28,
  "NY - Rest of State": 1.05,
  "TX - Houston": 1.02,
  "TX - Dallas": 1.01,
  "FL - Miami": 1.00,
  "IL - Chicago": 1.08,
  "National Average": 1.00,
};

// ─── Pricing Service ────────────────────────────────────

export function lookupReferencePrice(
  cptCode: string,
  config: ReferencePricingConfig = DEFAULT_PRICING_CONFIG,
): ReferencePriceEntry | null {
  const entry = MEDICARE_FEE_SCHEDULE_2024[cptCode];
  if (!entry) return null;

  const gpci = GPCI_FACTORS[config.default_locality] ?? 1.0;
  const adjusted = Math.round(entry.national_rate * gpci * 100) / 100;

  return {
    cpt_code: cptCode,
    description: entry.description,
    medicare_national: entry.national_rate,
    geographic_factor: gpci,
    adjusted_amount: adjusted,
    basis: `Medicare ${config.fee_schedule_year} national ($${entry.national_rate}) × GPCI ${gpci} (${config.default_locality})`,
    fee_schedule_year: config.fee_schedule_year,
    locality: config.default_locality,
  };
}

export function computeVariance(
  billedAmount: number,
  referenceAmount: number,
): { variance_amount: number; variance_pct: number } {
  const variance_amount = billedAmount - referenceAmount;
  const variance_pct = referenceAmount > 0
    ? Math.round((billedAmount / referenceAmount) * 100)
    : 0;
  return { variance_amount, variance_pct };
}

export function isHighVariance(
  variancePct: number,
  config: ReferencePricingConfig = DEFAULT_PRICING_CONFIG,
): boolean {
  return variancePct > config.high_variance_threshold_pct;
}

/**
 * Get all available CPT codes in the fee schedule.
 */
export function getAvailableCodes(): string[] {
  return Object.keys(MEDICARE_FEE_SCHEDULE_2024);
}

/**
 * Compute reference total for a set of CPT codes with quantities.
 */
export function computeReferenceTotal(
  lines: Array<{ cpt_code: string | null; units: number }>,
  config: ReferencePricingConfig = DEFAULT_PRICING_CONFIG,
): number {
  let total = 0;
  for (const line of lines) {
    if (!line.cpt_code) continue;
    const ref = lookupReferencePrice(line.cpt_code, config);
    if (ref) total += ref.adjusted_amount * line.units;
  }
  return total;
}
