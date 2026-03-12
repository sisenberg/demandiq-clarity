/**
 * Lightweight CSV/JSON parser for calibration corpus import.
 * Handles CSV with headers and JSON arrays.
 */

import { CSV_FIELD_MAP, type HistoricalClaimInsert } from "@/types/calibration";

export function parseCSV(text: string): Partial<HistoricalClaimInsert>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) =>
    h.trim().replace(/^["']|["']$/g, "").toLowerCase().replace(/\s+/g, "_")
  );

  const records: Partial<HistoricalClaimInsert>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      const mappedField = CSV_FIELD_MAP[header];
      if (mappedField && idx < values.length) {
        row[mappedField] = values[idx].trim();
      }
    });

    if (Object.keys(row).length > 0) {
      records.push(row as Partial<HistoricalClaimInsert>);
    }
  }

  return records;
}

export function parseJSON(text: string): Partial<HistoricalClaimInsert>[] {
  const parsed = JSON.parse(text);
  const arr = Array.isArray(parsed) ? parsed : [parsed];

  return arr.map((item: Record<string, unknown>) => {
    const row: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(item)) {
      const normalized = key.toLowerCase().replace(/\s+/g, "_");
      const mapped = CSV_FIELD_MAP[normalized];
      if (mapped) {
        row[mapped] = value;
      } else if (isValidField(normalized)) {
        row[normalized] = value;
      }
    }
    return row as Partial<HistoricalClaimInsert>;
  });
}

const VALID_FIELDS = new Set<string>([
  "final_settlement_amount", "outcome_notes", "loss_date", "venue_state",
  "venue_county", "jurisdiction", "claim_number", "attorney_name", "attorney_firm",
  "provider_names", "injury_categories", "primary_body_parts", "has_surgery",
  "has_injections", "has_imaging", "has_hospitalization", "has_permanency",
  "billed_specials", "reviewed_specials", "wage_loss", "treatment_duration_days",
  "treatment_provider_count", "policy_limits", "policy_type", "liability_posture",
  "comparative_negligence_pct",
]);

function isValidField(key: string): boolean {
  return VALID_FIELDS.has(key);
}

/** Simple CSV line parser that handles quoted fields */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
