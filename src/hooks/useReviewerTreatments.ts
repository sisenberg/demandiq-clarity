import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ─── Types ──────────────────────────────────────────────

export type ReviewerVisitType =
  | "emergency" | "ems" | "inpatient" | "outpatient" | "surgery"
  | "physical_therapy" | "chiropractic" | "pain_management"
  | "radiology" | "primary_care" | "specialist" | "mental_health"
  | "operative" | "follow_up" | "ime" | "other";

export type ExtractionReviewState =
  | "draft" | "needs_review" | "accepted" | "corrected" | "rejected";

export type ExtractionConfidenceTier = "high" | "medium" | "low" | "unknown";

export interface DiagnosisEntry {
  code?: string;
  description: string;
  is_primary?: boolean;
}

export interface ProcedureEntry {
  code?: string;
  description: string;
}

export interface MedicationEntry {
  name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
}

export interface RestrictionEntry {
  type: string;
  detail: string;
}

export interface ReviewerTreatmentRecord {
  id: string;
  tenant_id: string;
  case_id: string;
  source_document_id: string | null;
  source_page_start: number | null;
  source_page_end: number | null;
  source_snippet: string;
  extraction_model: string;
  extraction_version: string;
  extracted_at: string;
  visit_type: ReviewerVisitType;
  visit_date: string | null;
  visit_date_text: string;
  service_date_start: string | null;
  service_date_end: string | null;
  is_date_ambiguous: boolean;
  provider_name_raw: string;
  provider_name_normalized: string | null;
  upstream_provider_id: string | null;
  facility_name: string;
  provider_specialty: string;
  provider_npi: string | null;
  subjective_summary: string;
  objective_findings: string;
  assessment_summary: string;
  plan_summary: string;
  diagnoses: DiagnosisEntry[];
  procedures: ProcedureEntry[];
  medications: MedicationEntry[];
  body_parts: string[];
  restrictions: RestrictionEntry[];
  follow_up_recommendations: string;
  upstream_injury_ids: string[];
  upstream_bill_ids: string[];
  total_billed: number | null;
  total_paid: number | null;
  overall_confidence: number | null;
  confidence_tier: ExtractionConfidenceTier;
  confidence_details: Record<string, number>;
  review_state: ExtractionReviewState;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_notes: string;
  is_duplicate_suspect: boolean;
  duplicate_of_record_id: string | null;
  duplicate_similarity: number | null;
  duplicate_reason: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewerExtractionJob {
  id: string;
  tenant_id: string;
  case_id: string;
  document_id: string | null;
  status: string;
  extraction_model: string;
  records_extracted: number;
  duplicates_flagged: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── Queries ────────────────────────────────────────────

export function useCaseTreatmentRecords(caseId: string | undefined) {
  return useQuery({
    queryKey: ["reviewer-treatment-records", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("reviewer_treatment_records") as any)
        .select("*")
        .eq("case_id", caseId!)
        .order("visit_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as ReviewerTreatmentRecord[];
    },
  });
}

export function useDocumentTreatmentRecords(documentId: string | undefined) {
  return useQuery({
    queryKey: ["reviewer-treatment-records", "document", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("reviewer_treatment_records") as any)
        .select("*")
        .eq("source_document_id", documentId!)
        .order("visit_date", { ascending: true });
      if (error) throw error;
      return data as ReviewerTreatmentRecord[];
    },
  });
}

export function useCaseExtractionJobs(caseId: string | undefined) {
  return useQuery({
    queryKey: ["reviewer-extraction-jobs", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("reviewer_extraction_jobs") as any)
        .select("*")
        .eq("case_id", caseId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ReviewerExtractionJob[];
    },
  });
}

// ─── Mutations ──────────────────────────────────────────

/** Trigger treatment extraction for a document */
export function useExtractTreatments() {
  const { tenantId } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, caseId }: { documentId: string; caseId: string }) => {
      const { data, error } = await supabase.functions.invoke("extract-treatments", {
        body: { document_id: documentId, case_id: caseId, tenant_id: tenantId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["reviewer-treatment-records", vars.caseId] });
      qc.invalidateQueries({ queryKey: ["reviewer-treatment-records", "document", vars.documentId] });
      qc.invalidateQueries({ queryKey: ["reviewer-extraction-jobs", vars.caseId] });
    },
  });
}

/** Update a treatment record's review state */
export function useUpdateTreatmentReview() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recordId,
      reviewState,
      notes,
    }: {
      recordId: string;
      reviewState: ExtractionReviewState;
      notes?: string;
    }) => {
      const updates: Record<string, unknown> = {
        review_state: reviewState,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      };
      if (notes !== undefined) updates.reviewer_notes = notes;

      const { error } = await (supabase.from("reviewer_treatment_records") as any)
        .update(updates)
        .eq("id", recordId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviewer-treatment-records"] });
    },
  });
}

/** Dismiss or confirm a duplicate flag */
export function useDismissDuplicate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recordId,
      dismiss,
    }: {
      recordId: string;
      dismiss: boolean;
    }) => {
      const updates = dismiss
        ? { is_duplicate_suspect: false, duplicate_reason: "Dismissed by reviewer" }
        : { review_state: "rejected" as const };

      const { error } = await (supabase.from("reviewer_treatment_records") as any)
        .update(updates)
        .eq("id", recordId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviewer-treatment-records"] });
    },
  });
}

// ─── Display helpers ────────────────────────────────────

export const VISIT_TYPE_LABEL: Record<ReviewerVisitType, string> = {
  emergency: "Emergency",
  ems: "EMS",
  inpatient: "Inpatient",
  outpatient: "Outpatient",
  surgery: "Surgery",
  physical_therapy: "Physical Therapy",
  chiropractic: "Chiropractic",
  pain_management: "Pain Management",
  radiology: "Radiology",
  primary_care: "Primary Care",
  specialist: "Specialist",
  mental_health: "Mental Health",
  operative: "Operative",
  follow_up: "Follow-Up",
  ime: "IME",
  other: "Other",
};

export const REVIEW_STATE_LABEL: Record<ExtractionReviewState, string> = {
  draft: "Draft",
  needs_review: "Needs Review",
  accepted: "Accepted",
  corrected: "Corrected",
  rejected: "Rejected",
};

export const CONFIDENCE_TIER_LABEL: Record<ExtractionConfidenceTier, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  unknown: "Unknown",
};
