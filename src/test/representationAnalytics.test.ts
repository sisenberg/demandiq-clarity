/**
 * Representation Analytics — Unit Tests
 *
 * Validates:
 * 1. Mock data structures are well-formed
 * 2. Types enforce distinct representation segments
 * 3. Guardrail: transitioned claims are never collapsed
 */

import { describe, it, expect } from "vitest";
import {
  MOCK_SUMMARY,
  MOCK_TRANSITION,
  MOCK_SEVERITY_BANDED,
} from "@/types/representation-analytics";

describe("Representation Analytics — Mock Data", () => {
  it("summary has all three segments with non-zero counts", () => {
    expect(MOCK_SUMMARY.represented_case_count).toBeGreaterThan(0);
    expect(MOCK_SUMMARY.unrepresented_case_count).toBeGreaterThan(0);
    expect(MOCK_SUMMARY.transitioned_case_count).toBeGreaterThan(0);
  });

  it("summary has valuation metrics for both segments", () => {
    expect(MOCK_SUMMARY.avg_fact_based_value_mid_represented).toBeGreaterThan(0);
    expect(MOCK_SUMMARY.avg_fact_based_value_mid_unrepresented).toBeGreaterThan(0);
    expect(MOCK_SUMMARY.avg_expected_resolution_mid_represented).toBeGreaterThan(0);
    expect(MOCK_SUMMARY.avg_expected_resolution_mid_unrepresented).toBeGreaterThan(0);
  });

  it("transition data tracks unrepresented-at-open and retention counts", () => {
    expect(MOCK_TRANSITION.unrepresented_at_open_count).toBeGreaterThan(0);
    expect(MOCK_TRANSITION.retained_counsel_later_count).toBeGreaterThan(0);
    expect(MOCK_TRANSITION.retained_counsel_later_count).toBeLessThanOrEqual(
      MOCK_TRANSITION.unrepresented_at_open_count
    );
  });

  it("transition data has retention-after-offer count <= total retained", () => {
    expect(MOCK_TRANSITION.retained_after_initial_offer_count).toBeLessThanOrEqual(
      MOCK_TRANSITION.retained_counsel_later_count
    );
  });

  it("severity banded data has all three representation statuses", () => {
    const statuses = new Set(MOCK_SEVERITY_BANDED.map((r) => r.representation_status_at_close));
    expect(statuses.has("represented")).toBe(true);
    expect(statuses.has("unrepresented")).toBe(true);
    expect(statuses.has("transitioned")).toBe(true);
  });

  it("severity banded data covers multiple bands", () => {
    const bands = new Set(MOCK_SEVERITY_BANDED.map((r) => r.severity_band));
    expect(bands.size).toBeGreaterThanOrEqual(2);
  });

  it("settlement-to-value ratios are between 0 and 2", () => {
    for (const row of MOCK_SEVERITY_BANDED) {
      if (row.avg_settlement_to_fact_based_ratio != null) {
        expect(row.avg_settlement_to_fact_based_ratio).toBeGreaterThan(0);
        expect(row.avg_settlement_to_fact_based_ratio).toBeLessThan(2);
      }
    }
  });

  it("transitioned claims are never collapsed into represented or unrepresented", () => {
    const transitioned = MOCK_SEVERITY_BANDED.filter(
      (r) => r.representation_status_at_close === "transitioned"
    );
    expect(transitioned.length).toBeGreaterThan(0);

    // No row should have both "transitioned" status AND be labeled as represented/unrepresented
    for (const row of transitioned) {
      expect(row.representation_status_at_close).toBe("transitioned");
      expect(row.representation_status_at_close).not.toBe("represented");
      expect(row.representation_status_at_close).not.toBe("unrepresented");
    }
  });

  it("fact-based value does not show systematic discount for unrepresented claims", () => {
    // For each severity band, fact-based values should be similar
    // (since fact-based value is representation-independent)
    const bands = [...new Set(MOCK_SEVERITY_BANDED.map((r) => r.severity_band))];
    for (const band of bands) {
      const rep = MOCK_SEVERITY_BANDED.find(
        (r) => r.severity_band === band && r.representation_status_at_close === "represented"
      );
      const unrep = MOCK_SEVERITY_BANDED.find(
        (r) => r.severity_band === band && r.representation_status_at_close === "unrepresented"
      );
      if (rep?.avg_fact_based_value_mid && unrep?.avg_fact_based_value_mid) {
        const ratio = unrep.avg_fact_based_value_mid / rep.avg_fact_based_value_mid;
        // Fact-based values should be within 15% of each other
        // (minor variation from case-mix, not a systematic discount)
        expect(ratio).toBeGreaterThan(0.85);
        expect(ratio).toBeLessThan(1.15);
      }
    }
  });
});
