/**
 * ReviewerIQ — Bill Ingestion Hook
 *
 * Manages the lifecycle of bill ingestion: raw input → normalization →
 * treatment linkage → issue flagging → state management.
 *
 * Currently operates on mock/in-memory data. Will connect to backend
 * when bill extraction edge functions are built.
 */

import { useState, useCallback, useMemo } from "react";
import type {
  RawBillInput,
  ReviewerBillHeader,
  ReviewerBillLine,
} from "@/types/reviewer-bills";
import type { ReviewerTreatmentRecord } from "@/hooks/useReviewerTreatments";
import {
  normalizeBill,
  linkBillLinesToTreatments,
  detectProviderMismatches,
  resetIdCounters,
  type NormalizationResult,
} from "@/lib/billNormalization";

// ─── Types ──────────────────────────────────────────────

export interface BillIngestionState {
  headers: ReviewerBillHeader[];
  lines: ReviewerBillLine[];
  totalIngested: number;
  totalFlagged: number;
  totalLinked: number;
  totalUnlinked: number;
}

export interface BillIngestionActions {
  /** Ingest a raw bill and normalize it */
  ingestBill: (raw: RawBillInput) => NormalizationResult;
  /** Ingest multiple bills at once */
  ingestBills: (raws: RawBillInput[]) => NormalizationResult[];
  /** Link existing lines to treatments */
  linkToTreatments: (treatments: ReviewerTreatmentRecord[]) => void;
  /** Update a line disposition */
  dispositionLine: (lineId: string, disposition: string, amount: number | null) => void;
  /** Get lines for a specific header */
  getLinesForHeader: (headerId: string) => ReviewerBillLine[];
  /** Get header by id */
  getHeader: (headerId: string) => ReviewerBillHeader | undefined;
  /** Get all flagged lines */
  getFlaggedLines: () => ReviewerBillLine[];
  /** Reset all state */
  reset: () => void;
}

// ─── Hook ───────────────────────────────────────────────

export function useBillIngestion(
  tenantId: string,
  caseId: string,
): BillIngestionState & BillIngestionActions {
  const [headers, setHeaders] = useState<ReviewerBillHeader[]>([]);
  const [lines, setLines] = useState<ReviewerBillLine[]>([]);

  const ingestBill = useCallback((raw: RawBillInput): NormalizationResult => {
    const result = normalizeBill(raw, tenantId, caseId);
    setHeaders(prev => [...prev, result.header]);
    setLines(prev => [...prev, ...result.lines]);
    return result;
  }, [tenantId, caseId]);

  const ingestBills = useCallback((raws: RawBillInput[]): NormalizationResult[] => {
    const results = raws.map(raw => normalizeBill(raw, tenantId, caseId));
    setHeaders(prev => [...prev, ...results.map(r => r.header)]);
    setLines(prev => [...prev, ...results.flatMap(r => r.lines)]);
    return results;
  }, [tenantId, caseId]);

  const linkToTreatments = useCallback((treatments: ReviewerTreatmentRecord[]) => {
    setLines(prev => {
      const copy = prev.map(l => ({ ...l, flags: [...l.flags] }));
      linkBillLinesToTreatments(copy, treatments);
      detectProviderMismatches(copy, treatments);
      return copy;
    });
  }, []);

  const dispositionLine = useCallback((lineId: string, disposition: string, amount: number | null) => {
    setLines(prev => prev.map(l =>
      l.id === lineId
        ? { ...l, disposition: disposition as any, accepted_amount: amount, reviewed_at: new Date().toISOString() }
        : l
    ));
  }, []);

  const getLinesForHeader = useCallback((headerId: string) => {
    return lines.filter(l => l.bill_header_id === headerId);
  }, [lines]);

  const getHeader = useCallback((headerId: string) => {
    return headers.find(h => h.id === headerId);
  }, [headers]);

  const getFlaggedLines = useCallback(() => {
    return lines.filter(l => l.flags.length > 0);
  }, [lines]);

  const reset = useCallback(() => {
    resetIdCounters();
    setHeaders([]);
    setLines([]);
  }, []);

  // Derived stats
  const totalFlagged = useMemo(() => lines.filter(l => l.flags.length > 0).length, [lines]);
  const totalLinked = useMemo(() => lines.filter(l => l.upstream_treatment_id).length, [lines]);
  const totalUnlinked = useMemo(() => lines.filter(l => !l.upstream_treatment_id && l.cpt_code).length, [lines]);

  return {
    headers,
    lines,
    totalIngested: headers.length,
    totalFlagged,
    totalLinked,
    totalUnlinked,
    ingestBill,
    ingestBills,
    linkToTreatments,
    dispositionLine,
    getLinesForHeader,
    getHeader,
    getFlaggedLines,
    reset,
  };
}
