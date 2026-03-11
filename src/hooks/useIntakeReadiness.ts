import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DocumentRow } from "@/hooks/useDocuments";
import { INTAKE_PROCESSING_STATUSES, isIntakeComplete } from "@/lib/statuses";

// ─── Readiness States ────────────────────────────────
export type IntakeReadinessState =
  | "not_started"
  | "in_progress"
  | "attention_needed"
  | "intake_usable"
  | "reviewer_prep_ready";

export const READINESS_LABEL: Record<IntakeReadinessState, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  attention_needed: "Attention Needed",
  intake_usable: "Intake Usable",
  reviewer_prep_ready: "Ready for Review",
};

export const READINESS_BADGE: Record<IntakeReadinessState, { className: string; label: string }> = {
  not_started:        { className: "bg-accent text-muted-foreground", label: "Not Started" },
  in_progress:        { className: "bg-[hsl(var(--status-processing-bg))] text-[hsl(var(--status-processing-foreground))]", label: "In Progress" },
  attention_needed:   { className: "bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention-foreground))]", label: "Attention Needed" },
  intake_usable:      { className: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]", label: "Intake Usable" },
  reviewer_prep_ready:{ className: "bg-primary/10 text-primary", label: "Ready for Review" },
};

// ─── Attention Item ──────────────────────────────────
export interface AttentionItem {
  type: "blocker" | "warning";
  label: string;
  detail: string;
  documentId?: string;
  documentName?: string;
}

// ─── Stats ───────────────────────────────────────────
export interface IntakeReadinessStats {
  totalDocuments: number;
  processedDocuments: number;
  processingDocuments: number;
  failedDocuments: number;
  duplicateFlags: number;
  lowConfidenceFlags: number;
  conflictFlags: number;
  detectedProviders: number;
  detectedAttorneys: number;
  chronologyCandidateCount: number;
  documentsReviewed: number;
}

export interface IntakeReadinessResult {
  state: IntakeReadinessState;
  stats: IntakeReadinessStats;
  blockers: AttentionItem[];
  warnings: AttentionItem[];
  isLoading: boolean;
}

// ─── Hook ────────────────────────────────────────────
export function useIntakeReadiness(
  caseId: string | undefined,
  documents: DocumentRow[]
): IntakeReadinessResult {
  // Fetch supplementary counts from DB
  const { data: dbCounts, isLoading: countsLoading } = useQuery({
    queryKey: ["intake-readiness", caseId],
    enabled: !!caseId,
    refetchInterval: 10000,
    queryFn: async () => {
      const [dupRes, entityRes, chronoRes, metaRes] = await Promise.all([
        (supabase.from("duplicate_document_flags") as any)
          .select("id, flag_status", { count: "exact", head: false })
          .eq("case_id", caseId!)
          .eq("flag_status", "flagged"),
        (supabase.from("entity_clusters") as any)
          .select("id, entity_type")
          .eq("case_id", caseId!),
        (supabase.from("chronology_event_candidates") as any)
          .select("id", { count: "exact", head: true })
          .eq("case_id", caseId!),
        (supabase.from("document_metadata_extractions") as any)
          .select("id, confidence")
          .eq("case_id", caseId!)
          .lt("confidence", 0.5),
      ]);

      const entities = entityRes.data ?? [];
      return {
        duplicateFlags: dupRes.data?.length ?? 0,
        providers: entities.filter((e: any) => e.entity_type === "provider" || e.entity_type === "facility").length,
        attorneys: entities.filter((e: any) => e.entity_type === "attorney" || e.entity_type === "law_firm").length,
        chronologyCandidates: chronoRes.count ?? 0,
        lowConfidenceExtractions: metaRes.data?.length ?? 0,
      };
    },
  });

  return useMemo(() => {
    const counts = dbCounts ?? {
      duplicateFlags: 0,
      providers: 0,
      attorneys: 0,
      chronologyCandidates: 0,
      lowConfidenceExtractions: 0,
    };

    const total = documents.length;
    const failed = documents.filter((d) => d.document_status === "failed" || d.intake_status === "failed");
    const processing = documents.filter((d) => INTAKE_PROCESSING_STATUSES.includes(d.intake_status as any));
    const complete = documents.filter((d) => isIntakeComplete(d.intake_status) || d.document_status === "complete" || d.document_status === "extracted");
    const needsReview = documents.filter((d) => d.intake_status === "needs_review" || d.document_status === "needs_attention");
    const noText = documents.filter((d) =>
      (d.document_status === "complete" || d.document_status === "extracted") && !d.extracted_text && d.file_type === "application/pdf"
    );

    const stats: IntakeReadinessStats = {
      totalDocuments: total,
      processedDocuments: complete.length,
      processingDocuments: processing.length,
      failedDocuments: failed.length,
      duplicateFlags: counts.duplicateFlags,
      lowConfidenceFlags: counts.lowConfidenceExtractions,
      conflictFlags: needsReview.length,
      detectedProviders: counts.providers,
      detectedAttorneys: counts.attorneys,
      chronologyCandidateCount: counts.chronologyCandidates,
      documentsReviewed: complete.length,
    };

    // Build blockers & warnings
    const blockers: AttentionItem[] = [];
    const warnings: AttentionItem[] = [];

    // Blockers: extraction failures
    failed.forEach((d) => {
      blockers.push({
        type: "blocker",
        label: "Extraction Failed",
        detail: `${d.file_name} failed during processing`,
        documentId: d.id,
        documentName: d.file_name,
      });
    });

    // Blockers: missing OCR text on completed PDFs
    noText.forEach((d) => {
      blockers.push({
        type: "blocker",
        label: "Missing OCR Text",
        detail: `${d.file_name} completed but has no extracted text`,
        documentId: d.id,
        documentName: d.file_name,
      });
    });

    // Warnings: duplicates
    if (counts.duplicateFlags > 0) {
      warnings.push({
        type: "warning",
        label: "Duplicate Documents",
        detail: `${counts.duplicateFlags} potential duplicate${counts.duplicateFlags > 1 ? "s" : ""} detected`,
      });
    }

    // Warnings: low confidence extractions
    if (counts.lowConfidenceExtractions > 0) {
      warnings.push({
        type: "warning",
        label: "Low Confidence",
        detail: `${counts.lowConfidenceExtractions} extraction${counts.lowConfidenceExtractions > 1 ? "s" : ""} below 50% confidence`,
      });
    }

    // Warnings: needs review
    needsReview.forEach((d) => {
      warnings.push({
        type: "warning",
        label: "Needs Review",
        detail: `${d.file_name} requires manual review`,
        documentId: d.id,
        documentName: d.file_name,
      });
    });

    // Compute state
    let state: IntakeReadinessState = "not_started";

    if (total === 0) {
      state = "not_started";
    } else if (processing.length > 0 || (complete.length === 0 && failed.length === 0)) {
      state = "in_progress";
    } else if (blockers.length > 0) {
      state = "attention_needed";
    } else if (complete.length > 0 && failed.length === 0) {
      // Check if we have enough for reviewer prep
      const hasChronology = counts.chronologyCandidates > 0;
      const hasEntities = counts.providers > 0;
      const allComplete = complete.length === total;

      if (allComplete && hasChronology && hasEntities && warnings.length === 0) {
        state = "reviewer_prep_ready";
      } else {
        state = "intake_usable";
      }
    } else if (warnings.length > 0) {
      state = "attention_needed";
    } else {
      state = "in_progress";
    }

    return { state, stats, blockers, warnings, isLoading: countsLoading };
  }, [documents, dbCounts, countsLoading]);
}
