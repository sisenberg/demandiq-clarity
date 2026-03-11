/**
 * ReviewerIQ — Bill Normalization Pipeline Tests
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeDate,
  normalizeCptCode,
  normalizeHcpcsCode,
  normalizeIcdCode,
  normalizeModifiers,
  normalizeRevenueCode,
  normalizeCurrency,
  normalizeUnits,
  normalizeProviderName,
  normalizeBill,
  linkBillLinesToTreatments,
  resetIdCounters,
  confidenceTier,
} from "@/lib/billNormalization";
import type { RawBillInput } from "@/types/reviewer-bills";
import type { ReviewerTreatmentRecord } from "@/hooks/useReviewerTreatments";

// ─── Date Normalization ─────────────────────────────────

describe("normalizeDate", () => {
  it("parses ISO format", () => {
    expect(normalizeDate("2024-11-15")).toBe("2024-11-15");
    expect(normalizeDate("2024-11-15T12:00:00Z")).toBe("2024-11-15");
  });

  it("parses MM/DD/YYYY", () => {
    expect(normalizeDate("11/15/2024")).toBe("2024-11-15");
    expect(normalizeDate("1/5/2024")).toBe("2024-01-05");
  });

  it("parses MM/DD/YY", () => {
    expect(normalizeDate("11/15/24")).toBe("2024-11-15");
    expect(normalizeDate("03/10/25")).toBe("2025-03-10");
  });

  it("parses MM-DD-YYYY", () => {
    expect(normalizeDate("11-15-2024")).toBe("2024-11-15");
  });

  it("parses text month format", () => {
    expect(normalizeDate("November 15, 2024")).toBe("2024-11-15");
    expect(normalizeDate("January 5, 2025")).toBe("2025-01-05");
  });

  it("returns null for empty/invalid", () => {
    expect(normalizeDate("")).toBeNull();
    expect(normalizeDate("   ")).toBeNull();
    expect(normalizeDate("not a date")).toBeNull();
  });
});

// ─── Code Normalization ─────────────────────────────────

describe("normalizeCptCode", () => {
  it("accepts valid 5-digit codes", () => {
    expect(normalizeCptCode("99213")).toEqual({ code: "99213", valid: true });
    expect(normalizeCptCode("97110")).toEqual({ code: "97110", valid: true });
  });

  it("strips non-digits", () => {
    expect(normalizeCptCode("9921-3")).toEqual({ code: "99213", valid: true });
  });

  it("rejects invalid codes", () => {
    expect(normalizeCptCode("123")).toEqual({ code: "123", valid: false });
    expect(normalizeCptCode("")).toEqual({ code: null, valid: false });
  });
});

describe("normalizeHcpcsCode", () => {
  it("accepts letter + 4 digits", () => {
    expect(normalizeHcpcsCode("J1234")).toEqual({ code: "J1234", valid: true });
    expect(normalizeHcpcsCode("a1234")).toEqual({ code: "A1234", valid: true });
  });

  it("rejects invalid", () => {
    expect(normalizeHcpcsCode("12345")).toEqual({ code: "12345", valid: false });
    expect(normalizeHcpcsCode("")).toEqual({ code: null, valid: false });
  });
});

describe("normalizeIcdCode", () => {
  it("accepts valid ICD-10 codes", () => {
    expect(normalizeIcdCode("M50.12")).toEqual({ code: "M50.12", valid: true });
    expect(normalizeIcdCode("S13.4XXA")).toEqual({ code: "S13.4XXA", valid: true });
  });

  it("adds period if missing", () => {
    expect(normalizeIcdCode("M5012")).toEqual({ code: "M50.12", valid: true });
  });

  it("rejects invalid", () => {
    expect(normalizeIcdCode("")).toEqual({ code: null, valid: false });
    expect(normalizeIcdCode("12345")).toEqual({ code: "12345", valid: false });
  });
});

describe("normalizeModifiers", () => {
  it("normalizes valid modifiers", () => {
    expect(normalizeModifiers(["25", "59"])).toEqual(["25", "59"]);
    expect(normalizeModifiers(["tc", "26"])).toEqual(["TC", "26"]);
  });

  it("filters invalid modifiers", () => {
    expect(normalizeModifiers(["a", "123", "25"])).toEqual(["25"]);
  });
});

describe("normalizeRevenueCode", () => {
  it("normalizes revenue codes", () => {
    expect(normalizeRevenueCode("450")).toBe("0450");
    expect(normalizeRevenueCode("0450")).toBe("0450");
  });

  it("returns null for invalid", () => {
    expect(normalizeRevenueCode("")).toBeNull();
    expect(normalizeRevenueCode("abc")).toBeNull();
  });
});

// ─── Currency Normalization ─────────────────────────────

describe("normalizeCurrency", () => {
  it("parses plain numbers", () => {
    expect(normalizeCurrency("100")).toBe(100);
    expect(normalizeCurrency("100.50")).toBe(100.50);
  });

  it("parses dollar signs and commas", () => {
    expect(normalizeCurrency("$1,234.56")).toBe(1234.56);
    expect(normalizeCurrency("$ 2,800")).toBe(2800);
  });

  it("handles parenthetical negatives", () => {
    expect(normalizeCurrency("($100.00)")).toBe(-100);
  });

  it("returns null for invalid", () => {
    expect(normalizeCurrency("")).toBeNull();
    expect(normalizeCurrency("N/A")).toBeNull();
  });
});

describe("normalizeUnits", () => {
  it("parses valid integers", () => {
    expect(normalizeUnits("4")).toBe(4);
    expect(normalizeUnits("1")).toBe(1);
  });

  it("defaults to 1 for invalid", () => {
    expect(normalizeUnits("")).toBe(1);
    expect(normalizeUnits("abc")).toBe(1);
  });
});

// ─── Provider Name Normalization ────────────────────────

describe("normalizeProviderName", () => {
  it("strips Dr. prefix", () => {
    expect(normalizeProviderName("Dr. Sarah Chen")).toBe("Sarah Chen");
    expect(normalizeProviderName("Dr Sarah Chen")).toBe("Sarah Chen");
  });

  it("strips degree suffixes", () => {
    expect(normalizeProviderName("Sarah Chen, MD")).toBe("Sarah Chen");
    expect(normalizeProviderName("James Wilson, DO")).toBe("James Wilson");
  });

  it("handles facility names unchanged", () => {
    expect(normalizeProviderName("Mercy General Hospital")).toBe("Mercy General Hospital");
  });

  it("handles empty input", () => {
    expect(normalizeProviderName("")).toBe("");
  });
});

// ─── Confidence Tier ────────────────────────────────────

describe("confidenceTier", () => {
  it("maps scores to tiers", () => {
    expect(confidenceTier(0.95)).toBe("high");
    expect(confidenceTier(0.75)).toBe("medium");
    expect(confidenceTier(0.50)).toBe("low");
    expect(confidenceTier(null)).toBe("unknown");
  });
});

// ─── Full Pipeline ──────────────────────────────────────

describe("normalizeBill", () => {
  beforeEach(() => resetIdCounters());

  const rawBill: RawBillInput = {
    source_document_id: "doc-001",
    source_page_start: 1,
    source_page_end: 4,
    source_snippet: "Mercy General Hospital bill",
    provider_name_raw: "Mercy General Hospital",
    facility_name_raw: "Mercy General Hospital",
    statement_date_raw: "11/15/2024",
    bill_date_raw: "",
    statement_total_raw: "$4,280.00",
    bill_format_hint: "ub04",
    lines: [
      {
        service_date_raw: "11/15/2024",
        service_date_end_raw: "",
        cpt_code_raw: "99283",
        hcpcs_code_raw: "",
        icd_codes_raw: ["S13.4XXA"],
        modifiers_raw: [],
        revenue_code_raw: "0450",
        units_raw: "1",
        billed_amount_raw: "$2,800.00",
        description_raw: "ED visit, moderate severity",
        source_page: 1,
        source_snippet: "ED visit charge",
        upstream_treatment_id: null,
        extraction_confidence_score: 0.92,
      },
      {
        service_date_raw: "11/15/2024",
        service_date_end_raw: "",
        cpt_code_raw: "70450",
        hcpcs_code_raw: "",
        icd_codes_raw: ["S13.4XXA"],
        modifiers_raw: [],
        revenue_code_raw: "0350",
        units_raw: "1",
        billed_amount_raw: "$1,480.00",
        description_raw: "CT head without contrast",
        source_page: 2,
        source_snippet: "CT head charge",
        upstream_treatment_id: null,
        extraction_confidence_score: 0.95,
      },
    ],
    extraction_model: "google/gemini-3-flash-preview",
    extraction_version: "1.0.0",
    extraction_confidence_score: 0.93,
  };

  it("produces header with correct totals", () => {
    const { header, lines } = normalizeBill(rawBill, "t-1", "c-1");
    expect(header.total_billed).toBe(4280);
    expect(header.line_count).toBe(2);
    expect(header.bill_format).toBe("ub04");
    expect(header.provider_name_normalized).toBe("Mercy General Hospital");
    expect(header.statement_date).toBe("2024-11-15");
    expect(header.review_state).toBe("draft");
    expect(header.flags).toHaveLength(0); // total matches
  });

  it("normalizes line items with reference pricing", () => {
    const { lines } = normalizeBill(rawBill, "t-1", "c-1");
    expect(lines).toHaveLength(2);

    const edLine = lines[0];
    expect(edLine.service_date).toBe("2024-11-15");
    expect(edLine.cpt_code).toBe("99283");
    expect(edLine.billed_amount).toBe(2800);
    expect(edLine.reference_amount).toBeGreaterThan(0);
    expect(edLine.icd_codes).toContain("S13.4XXA");
    expect(edLine.revenue_code).toBe("0450");
    expect(edLine.extraction_confidence).toBe("high");
  });

  it("flags total mismatch", () => {
    const mismatch = { ...rawBill, statement_total_raw: "$5,000.00" };
    const { header } = normalizeBill(mismatch, "t-1", "c-1");
    expect(header.flags.some(f => f.type === "total_mismatch")).toBe(true);
  });

  it("flags missing date of service", () => {
    const bad = {
      ...rawBill,
      lines: [{ ...rawBill.lines[0], service_date_raw: "" }],
      statement_total_raw: "$2,800.00",
    };
    const { lines } = normalizeBill(bad, "t-1", "c-1");
    expect(lines[0].flags.some(f => f.type === "missing_dos")).toBe(true);
  });

  it("flags missing code", () => {
    const bad = {
      ...rawBill,
      lines: [{ ...rawBill.lines[0], cpt_code_raw: "", hcpcs_code_raw: "" }],
      statement_total_raw: "$2,800.00",
    };
    const { lines } = normalizeBill(bad, "t-1", "c-1");
    expect(lines[0].flags.some(f => f.type === "missing_code")).toBe(true);
  });

  it("flags no line items", () => {
    const empty = { ...rawBill, lines: [], statement_total_raw: "" };
    const { header } = normalizeBill(empty, "t-1", "c-1");
    expect(header.flags.some(f => f.type === "no_line_items")).toBe(true);
  });

  it("detects duplicate lines", () => {
    const dup = {
      ...rawBill,
      lines: [rawBill.lines[0], rawBill.lines[0]],
      statement_total_raw: "$5,600.00",
    };
    const { lines } = normalizeBill(dup, "t-1", "c-1");
    const dupFlags = lines.filter(l => l.flags.some(f => f.type === "duplicate_line"));
    expect(dupFlags.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Treatment Linkage ──────────────────────────────────

describe("linkBillLinesToTreatments", () => {
  beforeEach(() => resetIdCounters());

  it("links lines by date + provider", () => {
    const rawBill: RawBillInput = {
      source_document_id: null, source_page_start: null, source_page_end: null,
      source_snippet: "", provider_name_raw: "Mercy General Hospital",
      facility_name_raw: "Mercy General Hospital",
      statement_date_raw: "", bill_date_raw: "", statement_total_raw: "",
      bill_format_hint: "ub04",
      lines: [{
        service_date_raw: "11/15/2024", service_date_end_raw: "",
        cpt_code_raw: "99283", hcpcs_code_raw: "", icd_codes_raw: [],
        modifiers_raw: [], revenue_code_raw: "", units_raw: "1",
        billed_amount_raw: "$2,800", description_raw: "ED visit",
        source_page: null, source_snippet: "",
        upstream_treatment_id: null, extraction_confidence_score: null,
      }],
      extraction_model: "test", extraction_version: "1.0.0",
      extraction_confidence_score: null,
    };

    const { lines } = normalizeBill(rawBill, "t-1", "c-1");

    const treatments = [{
      id: "rtr-001", visit_date: "2024-11-15",
      provider_name_raw: "Mercy General Hospital",
      provider_name_normalized: "Mercy General Hospital",
    }] as ReviewerTreatmentRecord[];

    const result = linkBillLinesToTreatments(lines, treatments);
    expect(result.linked).toBe(1);
    expect(lines[0].upstream_treatment_id).toBe("rtr-001");
  });
});
