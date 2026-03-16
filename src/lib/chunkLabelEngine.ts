/**
 * Heuristic-based claim-aware chunk labeling engine.
 *
 * Assigns one or more labels to a chunk based on keyword/pattern matching.
 * Document type is used as a signal boost for certain labels.
 */

import type { ChunkLabel, LabelAssignment } from "@/types/chunk-retrieval";

// ── Pattern Definitions ────────────────────────────────────

interface LabelPattern {
  label: ChunkLabel;
  keywords: RegExp[];
  /** Base confidence when keywords match */
  baseConfidence: number;
  /** Document types that boost confidence */
  docTypeBoost?: Record<string, number>;
}

const LABEL_PATTERNS: LabelPattern[] = [
  {
    label: "liability",
    keywords: [
      /\bliabilit/i, /\bnegligen/i, /\bfault\b/i, /\bcomparative/i,
      /\bproximate\s+cause/i, /\bduty\s+of\s+care/i, /\bbreach/i,
      /\bcausation/i, /\bat[- ]fault/i,
    ],
    baseConfidence: 0.7,
    docTypeBoost: { demand_letter: 0.15 },
  },
  {
    label: "treatment_chronology",
    keywords: [
      /\bvisit\b/i, /\btreatment/i, /\btherapy/i, /\bdiagnos/i,
      /\b(?:MRI|CT|x-ray)\b/i, /\bsurgery/i, /\bprocedure/i,
      /\brehabilitation/i, /\bphysical\s+therapy/i, /\bfollow[- ]up/i,
      /\bchiropractic/i, /\borthopedic/i,
    ],
    baseConfidence: 0.7,
    docTypeBoost: { medical_record: 0.2, imaging_report: 0.15 },
  },
  {
    label: "specials_billing",
    keywords: [
      /\bCPT\b/i, /\bbilled?\b/i, /\bcharges?\b/i, /\binvoice/i,
      /\bbalance/i, /\bco-?pay/i, /\btotal\s+(?:medical|special)/i,
      /\b\$[\d,.]+/i, /\bitemized/i, /\bstatement/i,
    ],
    baseConfidence: 0.75,
    docTypeBoost: { medical_bill: 0.2, itemized_statement: 0.2, billing_record: 0.2 },
  },
  {
    label: "wage_loss",
    keywords: [
      /\bincome/i, /\bwages?\b/i, /\blost\s+earn/i, /\bemployment/i,
      /\bsalary/i, /\bwork\s+(?:loss|missed)/i, /\bearning\s+capacity/i,
      /\bdisabilit/i,
    ],
    baseConfidence: 0.7,
  },
  {
    label: "future_damages",
    keywords: [
      /\bfuture\s+(?:medical|treatment|care|damage|cost)/i,
      /\blife\s+care\s+plan/i, /\bprognosis/i, /\bongoing/i,
      /\bpermanent/i, /\blong[- ]term/i, /\bprojected/i,
    ],
    baseConfidence: 0.7,
    docTypeBoost: { narrative_report: 0.1, expert_report: 0.15 },
  },
  {
    label: "policy_coverage",
    keywords: [
      /\bpolicy/i, /\bcoverage/i, /\blimits?\b/i, /\bUM\b/i, /\bUIM\b/i,
      /\bdeductible/i, /\binsurance/i, /\bunderin?sured/i, /\buninsured/i,
      /\bbodily\s+injury/i,
    ],
    baseConfidence: 0.7,
  },
  {
    label: "attorney_demand",
    keywords: [
      /\bdemand/i, /\bsettlement\s+(?:demand|value)/i, /\boffer/i,
      /\bcompensation/i, /\bdamages?\s+(?:sought|claimed|requested)/i,
      /\bgeneral\s+damages/i, /\bnon[- ]economic/i,
    ],
    baseConfidence: 0.7,
    docTypeBoost: { demand_letter: 0.2 },
  },
  {
    label: "settlement_posture",
    keywords: [
      /\bcounteroffer/i, /\bnegotiat/i, /\bauthority/i, /\breserve/i,
      /\bmediation/i, /\barbitration/i, /\bsettlement\s+(?:range|posture|position)/i,
    ],
    baseConfidence: 0.65,
  },
  {
    label: "visual_evidence",
    keywords: [
      /\bphoto(?:graph)?s?\b/i, /\bimage/i, /\bexhibit/i,
      /\bradiograph/i, /\bscan\b/i, /\bvideo/i, /\bsurveillance/i,
    ],
    baseConfidence: 0.6,
    docTypeBoost: { imaging_report: 0.2 },
  },
  {
    label: "prior_injuries",
    keywords: [
      /\bpre[- ]existing/i, /\bprior\s+(?:injury|condition|treatment|history)/i,
      /\bdegenerative/i, /\bhistory\s+of\b/i, /\bprevious/i,
      /\bchronic/i, /\bbaseline/i,
    ],
    baseConfidence: 0.65,
  },
];

// ── Core Labeling ──────────────────────────────────────────

/**
 * Label a single chunk based on text content and document type.
 * Returns all matching labels with confidence scores.
 */
export function labelChunk(
  chunkText: string,
  documentType?: string
): LabelAssignment[] {
  if (!chunkText || chunkText.trim().length < 10) return [];

  const results: LabelAssignment[] = [];

  for (const pattern of LABEL_PATTERNS) {
    let matchCount = 0;
    for (const kw of pattern.keywords) {
      if (kw.test(chunkText)) matchCount++;
    }

    if (matchCount === 0) continue;

    // Scale confidence by match density (more keyword hits → higher confidence)
    const densityFactor = Math.min(matchCount / 3, 1); // cap at 3 hits
    let confidence = pattern.baseConfidence * (0.6 + 0.4 * densityFactor);

    // Apply document type boost
    if (documentType && pattern.docTypeBoost?.[documentType]) {
      confidence = Math.min(1, confidence + pattern.docTypeBoost[documentType]);
    }

    results.push({
      label: pattern.label,
      confidence: Math.round(confidence * 100) / 100,
    });
  }

  // Sort by confidence descending
  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Batch-label chunks for a document.
 */
export function labelChunksForDocument(
  chunks: { id: string; chunk_text: string }[],
  documentType?: string
): Map<string, LabelAssignment[]> {
  const result = new Map<string, LabelAssignment[]>();
  for (const chunk of chunks) {
    const labels = labelChunk(chunk.chunk_text, documentType);
    if (labels.length > 0) {
      result.set(chunk.id, labels);
    }
  }
  return result;
}
