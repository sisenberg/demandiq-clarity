/**
 * Modifier Layer Engine — Unit Tests
 */

import { describe, it, expect } from "vitest";
import { computeModifierLayer, extractRepresentationContext, MODIFIER_DEFINITIONS } from "@/lib/modifierLayerEngine";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import { buildEvaluateIntakeSnapshot } from "@/lib/evaluateIntakeBuilder";
import { MARTINEZ_CASE_PACKAGE } from "@/data/mock/casePackage";

function makeSnapshot(): EvaluateIntakeSnapshot {
  return buildEvaluateIntakeSnapshot({
    casePackage: MOCK_CASE_PACKAGE,
    reviewerPackage: null,
    sourceModule: "demandiq",
    sourceVersion: 1,
    sourceSnapshotId: null,
    userId: "test-user",
  });
}

describe("Modifier Layer Engine", () => {
  it("produces a result with all four modifier groups", () => {
    const snap = makeSnapshot();
    const result = computeModifierLayer(snap);

    expect(result.engine_version).toBe("1.0.0");
    expect(result.group_summaries).toHaveLength(4);
    expect(result.group_summaries.map(g => g.group)).toEqual(["liability", "causation", "claim_posture", "venue_forum"]);
  });

  it("produces modifier records for every definition", () => {
    const snap = makeSnapshot();
    const result = computeModifierLayer(snap);

    // Every definition should have a corresponding modifier record
    for (const def of MODIFIER_DEFINITIONS) {
      const mod = result.modifiers.find(m => m.id === def.id);
      expect(mod, `Missing modifier: ${def.id}`).toBeDefined();
    }
  });

  it("labels each modifier with its source", () => {
    const snap = makeSnapshot();
    const result = computeModifierLayer(snap);

    for (const mod of result.modifiers) {
      expect(["system_derived", "user_entered", "supervisor_override"]).toContain(mod.source);
    }
  });

  it("tracks representation status", () => {
    const snap = makeSnapshot();
    const result = computeModifierLayer(snap);

    expect(result.representation).toBeDefined();
    expect(["represented", "unrepresented", "unknown"]).toContain(result.representation.status);
  });

  it("computes confidence degradations for missing fields", () => {
    const snap = makeSnapshot();
    // Remove jurisdiction to trigger missing venue data
    snap.venue_jurisdiction.jurisdiction_state.value = "";
    const result = computeModifierLayer(snap);

    // At least venue_severity_tier should degrade
    const venueDegrad = result.confidence_degradations.find(d => d.modifier_id === "venue_severity_tier");
    expect(venueDegrad).toBeDefined();
    expect(result.total_confidence_penalty).toBeGreaterThan(0);
  });

  it("applies supervisor overrides correctly", () => {
    const snap = makeSnapshot();
    const result = computeModifierLayer(snap, [
      {
        modifier_id: "liability_posture",
        original_value: "test",
        original_direction: "neutral",
        original_magnitude: 0,
        override_value: "Accepted — per supervisor",
        override_direction: "positive",
        override_magnitude: 10,
        override_reason: "Per claims manager review of police report",
        overridden_by: "supervisor-1",
        overridden_by_name: "Jane Supervisor",
        overridden_at: new Date().toISOString(),
      },
    ]);

    const liabMod = result.modifiers.find(m => m.id === "liability_posture");
    expect(liabMod?.source).toBe("supervisor_override");
    expect(liabMod?.effect_magnitude).toBe(10);
    expect(result.overrides).toHaveLength(1);
  });

  it("produces an audit summary", () => {
    const snap = makeSnapshot();
    const result = computeModifierLayer(snap);
    expect(result.audit_summary).toBeTruthy();
    expect(result.audit_summary).toContain("modifier(s) applied");
    expect(result.audit_summary).toContain("Representation:");
  });

  it("net effect has correct sign for negative modifiers", () => {
    const snap = makeSnapshot();
    // Force high comparative negligence
    snap.comparative_negligence.claimant_negligence_percentage.value = 50;
    const result = computeModifierLayer(snap);

    const compNeg = result.modifiers.find(m => m.id === "comparative_negligence_mod");
    expect(compNeg?.direction).toBe("negative");
    expect(compNeg?.effect_magnitude).toBeLessThan(0);
  });
});

describe("extractRepresentationContext", () => {
  it("detects represented status from upstream concerns", () => {
    const snap = makeSnapshot();
    snap.upstream_concerns.push({
      id: "rep-1",
      category: "other",
      description: "Claimant retained attorney John Smith of Smith & Associates",
      severity: "info",
      provenance: { source_module: "demandiq", source_package_version: 1, evidence_ref_ids: [], confidence: null, completeness: "complete" },
    });

    const ctx = extractRepresentationContext(snap);
    expect(ctx.status).toBe("represented");
  });

  it("detects unrepresented status", () => {
    const snap = makeSnapshot();
    snap.upstream_concerns.push({
      id: "unrep-1",
      category: "other",
      description: "Claimant is pro se / unrepresented",
      severity: "info",
      provenance: { source_module: "demandiq", source_package_version: 1, evidence_ref_ids: [], confidence: null, completeness: "complete" },
    });

    const ctx = extractRepresentationContext(snap);
    expect(ctx.status).toBe("unrepresented");
  });
});
