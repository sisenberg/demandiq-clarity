import { useMemo } from "react";
import { useCasePackage } from "@/hooks/useCasePackage";
import { useUpstreamSnapshot } from "@/hooks/useUpstreamSnapshot";
import type {
  ReviewerIQInputContract,
  ReviewerDocumentRef,
} from "@/types/revieweriq";
import { REVIEWERIQ_CONTRACT_VERSION } from "@/types/revieweriq";

/**
 * Maps the upstream DemandIQ snapshot (or live case package for dev/mock)
 * into the stable ReviewerIQ input contract.
 *
 * This is the ONLY entry point ReviewerIQ uses to read upstream data.
 * It guarantees:
 *   1. Upstream data is treated as read-only.
 *   2. Document refs are slim (no raw extracted_text blobs).
 *   3. Evidence traceability is fully preserved.
 *   4. Contract is versioned for forward compatibility.
 *
 * In production, this will read from the completed DemandIQ snapshot.
 * In development, it falls back to the live mock case package.
 */
export function useReviewerIQInput(caseId: string | undefined) {
  // Try to load the upstream completed snapshot first
  const {
    data: upstreamSnapshot,
    isLoading: snapshotLoading,
  } = useUpstreamSnapshot(caseId, "demandiq");

  // Fallback: live case package (for dev/mock environments)
  const { pkg } = useCasePackage();

  const contract = useMemo((): ReviewerIQInputContract | null => {
    // Always use the case package as source for now
    // (snapshot overlay will be added when real pipeline is active)
    if (!pkg) return null;

    const documentRefs: ReviewerDocumentRef[] = pkg.documents.map((doc) => ({
      id: doc.id,
      file_name: doc.file_name,
      file_type: doc.file_type,
      page_count: doc.page_count,
      document_type: doc.document_type,
      document_status: doc.document_status,
      pipeline_stage: doc.pipeline_stage,
      has_extracted_text: !!doc.extracted_text || !!doc.extracted_at,
    }));

    return {
      contract_version: REVIEWERIQ_CONTRACT_VERSION,

      upstream_snapshot: upstreamSnapshot
        ? {
            snapshot_id: upstreamSnapshot.snapshotId,
            module_id: "demandiq",
            version: upstreamSnapshot.version,
            completed_at: upstreamSnapshot.completedAt,
          }
        : undefined,

      case_record: pkg.case_record,
      parties: pkg.parties,
      documents: documentRefs,
      source_pages: pkg.source_pages,
      injuries: pkg.injuries,
      providers: pkg.providers,
      treatments: pkg.treatments,
      billing_lines: pkg.billing_lines,
      insurance_policies: pkg.insurance_policies,
      liability_facts: pkg.liability_facts,
      timeline_events: pkg.timeline_events,
      evidence_refs: pkg.evidence_refs,
      issue_flags: pkg.issue_flags,
      demand_summary: pkg.demand_summary,
    };
  }, [pkg, upstreamSnapshot]);

  return {
    contract,
    isLoading: snapshotLoading,
    /** Whether we're reading from a completed snapshot vs live fallback */
    isFromSnapshot: !!upstreamSnapshot,
    snapshotVersion: upstreamSnapshot?.version ?? null,
  };
}

/**
 * Utility: Extract treatment-level evidence refs from the input contract.
 * Groups evidence by treatment_id for the review workspace.
 */
export function groupEvidenceByTreatment(
  contract: ReviewerIQInputContract
): Map<string, typeof contract.evidence_refs> {
  const map = new Map<string, typeof contract.evidence_refs>();

  for (const treatment of contract.treatments) {
    const refs = treatment.evidence_refs ?? [];
    map.set(treatment.id, refs);
  }

  return map;
}

/**
 * Utility: Extract provider-level evidence refs from the input contract.
 */
export function groupEvidenceByProvider(
  contract: ReviewerIQInputContract
): Map<string, typeof contract.evidence_refs> {
  const map = new Map<string, typeof contract.evidence_refs>();

  for (const provider of contract.providers) {
    // Find treatments linked to this provider
    const providerTreatments = contract.treatments.filter(
      (t) => t.provider_id === provider.id
    );
    const refs = providerTreatments.flatMap((t) => t.evidence_refs ?? []);
    map.set(provider.id, refs);
  }

  return map;
}

/**
 * Utility: Build a lookup from document_id → document ref for quick access.
 */
export function buildDocumentLookup(
  contract: ReviewerIQInputContract
): Map<string, ReviewerDocumentRef> {
  return new Map(contract.documents.map((d) => [d.id, d]));
}
