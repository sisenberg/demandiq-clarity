import { describe, it, expect } from "vitest";
import { sanitizeForLogSafe } from "@/lib/safe-log";

describe("sanitizeForLogSafe", () => {
  it("returns null/undefined as-is", () => {
    expect(sanitizeForLogSafe(null)).toBe(null);
    expect(sanitizeForLogSafe(undefined)).toBe(undefined);
  });

  it("returns numbers and booleans as-is", () => {
    expect(sanitizeForLogSafe(42)).toBe(42);
    expect(sanitizeForLogSafe(true)).toBe(true);
  });

  it("passes through short strings", () => {
    expect(sanitizeForLogSafe("hello")).toBe("hello");
  });

  it("truncates long strings (>200 chars)", () => {
    const long = "x".repeat(500);
    const result = sanitizeForLogSafe(long) as string;
    expect(result).toContain("…[truncated 500 chars]");
    expect(result.length).toBeLessThan(200);
  });

  it("redacts known PII fields in objects", () => {
    const input = {
      id: "abc-123",
      claimant: "John Doe",
      ssn: "123-45-6789",
      phone: "555-1234",
      email: "test@example.com",
      extracted_text: "medical records...",
      case_status: "active",
    };
    const result = sanitizeForLogSafe(input) as Record<string, unknown>;
    expect(result.id).toBe("abc-123");
    expect(result.claimant).toBe("[REDACTED]");
    expect(result.ssn).toBe("[REDACTED]");
    expect(result.phone).toBe("[REDACTED]");
    expect(result.email).toBe("[REDACTED]");
    expect(result.extracted_text).toBe("[REDACTED]");
    // Safe-listed fields pass through
    expect(result.case_status).toBe("active");
  });

  it("handles nested objects", () => {
    const input = {
      job: {
        id: "j-1",
        metadata: {
          claimant_name: "Jane",
          page_count: 5,
        },
      },
    };
    const result = sanitizeForLogSafe(input) as any;
    expect(result.job.id).toBe("j-1");
    expect(result.job.metadata.claimant_name).toBe("[REDACTED]");
    expect(result.job.metadata.page_count).toBe(5);
  });

  it("handles arrays and caps at 20 items", () => {
    const input = Array.from({ length: 25 }, (_, i) => ({ id: `item-${i}`, full_name: "Test" }));
    const result = sanitizeForLogSafe(input) as any[];
    expect(result.length).toBe(21); // 20 items + "...more" message
    expect(result[0].full_name).toBe("[REDACTED]");
    expect(result[20]).toContain("5 more items");
  });

  it("does not redact safe-listed fields that partially match PII patterns", () => {
    const input = {
      action_type: "document_uploaded",
      entity_type: "case_document",
      document_type: "medical_record",
      file_type: "application/pdf",
      status: "completed",
    };
    const result = sanitizeForLogSafe(input) as Record<string, unknown>;
    expect(result.action_type).toBe("document_uploaded");
    expect(result.entity_type).toBe("case_document");
    expect(result.document_type).toBe("medical_record");
    expect(result.file_type).toBe("application/pdf");
    expect(result.status).toBe("completed");
  });

  it("redacts diagnosis_description and treatment_notes", () => {
    const input = {
      id: "inj-1",
      diagnosis_description: "Cervical disc herniation at C5-C6",
      treatment_notes: "Patient reports radiating pain",
    };
    const result = sanitizeForLogSafe(input) as Record<string, unknown>;
    expect(result.diagnosis_description).toBe("[REDACTED]");
    expect(result.treatment_notes).toBe("[REDACTED]");
  });

  it("handles max depth gracefully", () => {
    let obj: any = { value: "deep" };
    for (let i = 0; i < 15; i++) {
      obj = { nested: obj };
    }
    const result = sanitizeForLogSafe(obj) as any;
    // Should not throw, should truncate at depth
    expect(JSON.stringify(result)).toContain("MAX_DEPTH");
  });

  it("UUIDs remain visible (pseudonymous identifiers)", () => {
    const input = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      tenant_id: "660e8400-e29b-41d4-a716-446655440001",
      case_id: "770e8400-e29b-41d4-a716-446655440002",
    };
    const result = sanitizeForLogSafe(input) as Record<string, unknown>;
    expect(result.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(result.tenant_id).toBe("660e8400-e29b-41d4-a716-446655440001");
    expect(result.case_id).toBe("770e8400-e29b-41d4-a716-446655440002");
  });
});
