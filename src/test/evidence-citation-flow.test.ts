/**
 * Evidence Citation Flow — End-to-End Test
 *
 * Verifies: create anchor → fetch by entity → resolve to citation → convert for UI
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  EvidenceAnchorRow,
  ResolvedCitation,
  CreateEvidenceAnchorParams,
  AnchorEntityType,
  BoundingBox,
} from "@/types/evidence-anchor";
import {
  anchorToCitationSource,
  resolvedToCitationSource,
} from "@/lib/citationService";

// ─── Fixtures ──────────────────────────────────────────

const TENANT_ID = "tenant-001";
const USER_ID = "user-001";
const CASE_ID = "case-001";
const DOC_ID = "doc-police-report";

function makeAnchor(overrides: Partial<EvidenceAnchorRow> = {}): EvidenceAnchorRow {
  return {
    id: "anchor-001",
    tenant_id: TENANT_ID,
    case_id: CASE_ID,
    document_id: DOC_ID,
    page_number: 3,
    quoted_text: "Vehicle 1 failed to stop at red signal.",
    character_start: 142,
    character_end: 183,
    evidence_type: "direct",
    chunk_id: "chunk-abc",
    parse_version: 1,
    processing_run_id: "run-001",
    bounding_box: null,
    anchor_entity_type: "extracted_fact",
    anchor_entity_id: "fact-001",
    anchor_module: "demandiq",
    confidence: 0.95,
    created_by: USER_ID,
    created_at: "2026-03-15T12:00:00Z",
    ...overrides,
  };
}

function makeResolved(anchor: EvidenceAnchorRow): ResolvedCitation {
  return {
    anchor,
    fileName: "Police Report #PR-2024-8812.pdf",
    documentType: "police_report",
    pageText: "TRAFFIC COLLISION REPORT — SUPPLEMENTAL\n\nVehicle 1 failed to stop at red signal...",
    parseVersion: anchor.parse_version,
    chunkText: "Vehicle 1 failed to stop at red signal, striking Vehicle 2 in the intersection.",
    provider: "lovable-ocr",
  };
}

// ─── Tests ─────────────────────────────────────────────

describe("Evidence Anchor Types", () => {
  it("should create a valid EvidenceAnchorRow with all fields", () => {
    const anchor = makeAnchor();
    expect(anchor.id).toBe("anchor-001");
    expect(anchor.character_start).toBe(142);
    expect(anchor.character_end).toBe(183);
    expect(anchor.evidence_type).toBe("direct");
    expect(anchor.anchor_entity_type).toBe("extracted_fact");
    expect(anchor.anchor_entity_id).toBe("fact-001");
    expect(anchor.anchor_module).toBe("demandiq");
    expect(anchor.confidence).toBe(0.95);
    expect(anchor.parse_version).toBe(1);
    expect(anchor.chunk_id).toBe("chunk-abc");
  });

  it("should allow nullable fields", () => {
    const anchor = makeAnchor({
      character_start: null,
      character_end: null,
      chunk_id: null,
      parse_version: null,
      bounding_box: null,
      anchor_entity_type: null,
      anchor_entity_id: null,
      anchor_module: null,
      confidence: null,
      created_by: null,
    });
    expect(anchor.character_start).toBeNull();
    expect(anchor.confidence).toBeNull();
    expect(anchor.anchor_entity_type).toBeNull();
  });

  it("should support bounding box for spatial anchoring", () => {
    const box: BoundingBox = { x: 0.1, y: 0.2, width: 0.3, height: 0.05 };
    const anchor = makeAnchor({ bounding_box: box });
    expect(anchor.bounding_box).toEqual(box);
    expect(anchor.bounding_box!.x).toBeGreaterThanOrEqual(0);
    expect(anchor.bounding_box!.x).toBeLessThanOrEqual(1);
  });
});

describe("CreateEvidenceAnchorParams", () => {
  it("should represent valid creation params", () => {
    const params: CreateEvidenceAnchorParams = {
      caseId: CASE_ID,
      documentId: DOC_ID,
      pageNumber: 3,
      quotedText: "Vehicle 1 failed to stop at red signal.",
      evidenceType: "direct",
      characterStart: 142,
      characterEnd: 183,
      chunkId: "chunk-abc",
      parseVersion: 1,
      anchorEntityType: "extracted_fact",
      anchorEntityId: "fact-001",
      anchorModule: "demandiq",
      confidence: 0.95,
    };
    expect(params.caseId).toBe(CASE_ID);
    expect(params.confidence).toBe(0.95);
    expect(params.anchorEntityType).toBe("extracted_fact");
  });

  it("should work with minimal required params", () => {
    const params: CreateEvidenceAnchorParams = {
      caseId: CASE_ID,
      documentId: DOC_ID,
      pageNumber: 1,
      quotedText: "Some text",
      evidenceType: "contextual",
    };
    expect(params.characterStart).toBeUndefined();
    expect(params.confidence).toBeUndefined();
  });
});

describe("ResolvedCitation", () => {
  it("should contain full resolution context", () => {
    const anchor = makeAnchor();
    const resolved = makeResolved(anchor);
    expect(resolved.fileName).toBe("Police Report #PR-2024-8812.pdf");
    expect(resolved.documentType).toBe("police_report");
    expect(resolved.pageText).toContain("Vehicle 1 failed to stop");
    expect(resolved.chunkText).toContain("striking Vehicle 2");
    expect(resolved.parseVersion).toBe(1);
    expect(resolved.provider).toBe("lovable-ocr");
  });

  it("should handle missing page text gracefully", () => {
    const resolved: ResolvedCitation = {
      anchor: makeAnchor(),
      fileName: "doc.pdf",
      documentType: "unknown",
      pageText: null,
      parseVersion: null,
      chunkText: null,
      provider: null,
    };
    expect(resolved.pageText).toBeNull();
    expect(resolved.provider).toBeNull();
  });
});

describe("anchorToCitationSource", () => {
  it("should convert anchor to UI citation format", () => {
    const anchor = makeAnchor();
    const source = anchorToCitationSource(anchor, "Police Report.pdf");
    expect(source.docName).toBe("Police Report.pdf");
    expect(source.page).toBe("pg. 3");
    expect(source.excerpt).toBe("Vehicle 1 failed to stop at red signal.");
    expect(source.relevance).toBe("direct");
    expect(source.documentId).toBe(DOC_ID);
    expect(source.anchorId).toBe("anchor-001");
    expect(source.parseVersion).toBe(1);
    expect(source.chunkId).toBe("chunk-abc");
  });

  it("should handle empty quoted text", () => {
    const anchor = makeAnchor({ quoted_text: "" });
    const source = anchorToCitationSource(anchor, "doc.pdf");
    expect(source.excerpt).toBeUndefined();
  });

  it("should map evidence_type to relevance", () => {
    const types = ["direct", "corroborating", "contradicting", "contextual"] as const;
    for (const t of types) {
      const anchor = makeAnchor({ evidence_type: t });
      const source = anchorToCitationSource(anchor, "doc.pdf");
      expect(source.relevance).toBe(t);
    }
  });
});

describe("resolvedToCitationSource", () => {
  it("should convert resolved citation to UI format", () => {
    const anchor = makeAnchor();
    const resolved = makeResolved(anchor);
    const source = resolvedToCitationSource(resolved);
    expect(source.docName).toBe("Police Report #PR-2024-8812.pdf");
    expect(source.page).toBe("pg. 3");
    expect(source.anchorId).toBe("anchor-001");
    expect(source.relevance).toBe("direct");
  });
});

describe("Entity anchor taxonomy", () => {
  it("should support all entity types", () => {
    const types: AnchorEntityType[] = [
      "extracted_fact",
      "issue_flag",
      "chronology_event",
      "valuation_driver",
      "negotiation_rationale",
      "litigation_support",
      "general",
    ];
    for (const t of types) {
      const anchor = makeAnchor({ anchor_entity_type: t });
      expect(anchor.anchor_entity_type).toBe(t);
    }
  });
});

describe("Citation round-trip integrity", () => {
  it("should preserve all fields through anchor → resolved → citationSource", () => {
    const anchor = makeAnchor({
      evidence_type: "contradicting",
      page_number: 7,
      quoted_text: "Pre-existing degenerative changes at L4-L5.",
      character_start: 500,
      character_end: 545,
    });

    const resolved = makeResolved(anchor);
    const source = resolvedToCitationSource(resolved);

    // Verify round-trip
    expect(source.page).toBe("pg. 7");
    expect(source.excerpt).toBe("Pre-existing degenerative changes at L4-L5.");
    expect(source.relevance).toBe("contradicting");
    expect(source.documentId).toBe(DOC_ID);
    expect(source.anchorId).toBe(anchor.id);
  });
});
