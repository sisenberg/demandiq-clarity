/**
 * NegotiateIQ — Paste Parser
 *
 * Extracts likely counteroffer amount and deadline from pasted text.
 * Never auto-commits — returns candidates for human confirmation.
 */

export interface ParsedCounterofferCandidate {
  amount: number | null;
  deadline: string | null;
  rawText: string;
  confidence: "high" | "medium" | "low";
}

// Currency patterns: $50,000  /  $50,000.00  /  50,000  /  50000
const CURRENCY_RE = /\$\s?([\d,]+(?:\.\d{1,2})?)/g;
const BARE_NUMBER_RE = /(?:(?:offer|demand|counter|settle|amount|sum)\s*(?:of|is|at|:)?\s*)(\$?\s?[\d,]+(?:\.\d{1,2})?)/gi;

// Date patterns: March 15, 2026 / 3/15/2026 / 03-15-2026 / by Friday
const DATE_PATTERNS = [
  /(?:by|before|deadline|respond\s+by|expires?|due)\s*:?\s*(\w+\s+\d{1,2},?\s*\d{4})/gi,
  /(?:by|before|deadline|respond\s+by|expires?|due)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
];

export function parseCounterofferText(text: string): ParsedCounterofferCandidate {
  const trimmed = text.trim();
  if (!trimmed) {
    return { amount: null, deadline: null, rawText: trimmed, confidence: "low" };
  }

  // Extract amounts
  const amounts: number[] = [];

  // Try contextual patterns first (higher confidence)
  let contextMatch: RegExpExecArray | null;
  const bareRe = new RegExp(BARE_NUMBER_RE.source, "gi");
  while ((contextMatch = bareRe.exec(trimmed)) !== null) {
    const cleaned = contextMatch[1].replace(/[$,\s]/g, "");
    const val = parseFloat(cleaned);
    if (!isNaN(val) && val >= 100) amounts.push(val);
  }

  // Fall back to any dollar amounts
  if (amounts.length === 0) {
    let currMatch: RegExpExecArray | null;
    const currRe = new RegExp(CURRENCY_RE.source, "g");
    while ((currMatch = currRe.exec(trimmed)) !== null) {
      const val = parseFloat(currMatch[1].replace(/,/g, ""));
      if (!isNaN(val) && val >= 100) amounts.push(val);
    }
  }

  // Pick the largest amount as most likely counteroffer
  const amount = amounts.length > 0 ? Math.max(...amounts) : null;

  // Extract deadline
  let deadline: string | null = null;
  for (const pattern of DATE_PATTERNS) {
    const re = new RegExp(pattern.source, "gi");
    const m = re.exec(trimmed);
    if (m) {
      deadline = m[1].trim();
      break;
    }
  }

  const confidence =
    amount !== null && amounts.length === 1
      ? "high"
      : amount !== null
        ? "medium"
        : "low";

  return { amount, deadline, rawText: trimmed, confidence };
}
