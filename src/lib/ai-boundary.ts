/**
 * AI Data Boundary Configuration
 *
 * COMPLIANCE: Config-driven control over which edge functions are approved
 * to send data to external AI models. Each path must be explicitly approved.
 * See docs/compliance/ai-data-boundary.md.
 *
 * This file is consumed by edge functions at build/deploy time as documentation
 * and by the client for UI indicators. Edge functions enforce boundaries
 * independently via their own runtime checks.
 */

export type DataLevel = "L0" | "L1" | "L2" | "L3" | "L4";

export interface AIBoundaryEntry {
  /** Function name */
  functionName: string;
  /** Whether this path is approved for external AI data transmission */
  approved: boolean;
  /** Highest data classification level sent to AI */
  dataLevel: DataLevel;
  /** Whether a BAA/DPA is required before production use */
  requiresBAA: boolean;
  /** What data is sent */
  dataSent: string;
  /** Minimum necessary assessment */
  minimumNecessary: boolean;
  /** Notes for compliance reviewers */
  notes: string;
}

export const AI_BOUNDARY_CONFIG: Record<string, AIBoundaryEntry> = {
  "process-document": {
    functionName: "process-document",
    approved: true,
    dataLevel: "L4",
    requiresBAA: true,
    dataSent: "Raw document image bytes (base64) for OCR",
    minimumNecessary: false,
    notes:
      "Full document images required for OCR — cannot be de-identified pre-transmission. BAA with AI provider mandatory before production PHI.",
  },
  "classify-document": {
    functionName: "classify-document",
    approved: true,
    dataLevel: "L4",
    requiresBAA: true,
    dataSent: "Up to 8000 chars of extracted document text, file name",
    minimumNecessary: false,
    notes:
      "Text contains embedded PII/PHI. Consider pre-stripping SSN, phone, email before classification. File name may contain PII.",
  },
  "normalize-entities": {
    functionName: "normalize-entities",
    approved: true,
    dataLevel: "L3",
    requiresBAA: true,
    dataSent: "Extracted entity values (names, identifiers), confidence scores, document IDs",
    minimumNecessary: true,
    notes:
      "Sends structured PII values only, not raw text blocks. Lowest exposure of all AI paths.",
  },
  "generate-chronology": {
    functionName: "generate-chronology",
    approved: true,
    dataLevel: "L4",
    requiresBAA: true,
    dataSent: "Up to 20000 chars of document text, metadata, facts, claimant name, claim number",
    minimumNecessary: false,
    notes:
      "Large PHI-containing text blocks required for accurate timeline extraction. Hardest path to minimize.",
  },
} as const;

/**
 * Check whether a given AI function path is approved for data transmission.
 * Returns false for unknown/unapproved paths.
 */
export function isAIPathApproved(functionName: string): boolean {
  return AI_BOUNDARY_CONFIG[functionName]?.approved === true;
}

/**
 * Get all paths that require a BAA before production use with real PHI.
 */
export function getPathsRequiringBAA(): AIBoundaryEntry[] {
  return Object.values(AI_BOUNDARY_CONFIG).filter((entry) => entry.requiresBAA);
}
