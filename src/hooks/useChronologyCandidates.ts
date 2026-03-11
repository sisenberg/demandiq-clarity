import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Row types ──────────────────────────────────────────

export type ChronologyCandidateStatus = "draft" | "accepted" | "suppressed" | "merged";

export type ChronologyEventCategory =
  | "accident" | "first_treatment" | "treatment" | "imaging" | "injection"
  | "surgery" | "ime" | "demand" | "legal" | "administrative"
  | "billing" | "correspondence" | "investigation" | "representation" | "other";

export interface ChronologyCandidateRow {
  id: string;
  tenant_id: string;
  case_id: string;
  event_date: string;
  event_date_end: string | null;
  category: ChronologyEventCategory;
  label: string;
  description: string;
  confidence: number | null;
  status: ChronologyCandidateStatus;
  source_type: string;
  machine_label: string | null;
  machine_description: string | null;
  machine_date: string | null;
  machine_category: string | null;
  user_corrected_label: string | null;
  user_corrected_description: string | null;
  user_corrected_date: string | null;
  user_corrected_category: string | null;
  merged_into_id: string | null;
  source_document_id: string | null;
  source_page: number | null;
  created_at: string;
  updated_at: string;
}

export interface ChronologyEvidenceLinkRow {
  id: string;
  tenant_id: string;
  case_id: string;
  candidate_id: string;
  document_id: string;
  page_number: number | null;
  quoted_text: string;
  relevance_type: string;
  confidence: number | null;
  created_at: string;
}

// ── Labels ──────────────────────────────────────────────

export const CHRONO_CATEGORY_LABEL: Record<string, string> = {
  accident: "Accident",
  first_treatment: "First Treatment",
  treatment: "Treatment",
  imaging: "Imaging",
  injection: "Injection",
  surgery: "Surgery",
  ime: "IME",
  demand: "Demand",
  legal: "Legal",
  administrative: "Administrative",
  billing: "Billing",
  correspondence: "Correspondence",
  investigation: "Investigation",
  representation: "Representation",
  other: "Other",
};

export const CHRONO_STATUS_LABEL: Record<ChronologyCandidateStatus, string> = {
  draft: "Draft",
  accepted: "Accepted",
  suppressed: "Suppressed",
  merged: "Merged",
};

// ── Queries ──────────────────────────────────────────────

export function useCaseChronologyCandidates(caseId: string | undefined) {
  return useQuery({
    queryKey: ["chronology-candidates", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("chronology_event_candidates") as any)
        .select("*")
        .eq("case_id", caseId!)
        .order("event_date", { ascending: true });
      if (error) throw error;
      return data as ChronologyCandidateRow[];
    },
  });
}

export function useCandidateEvidenceLinks(candidateId: string | undefined) {
  return useQuery({
    queryKey: ["chronology-evidence", candidateId],
    enabled: !!candidateId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("chronology_evidence_links") as any)
        .select("*")
        .eq("candidate_id", candidateId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ChronologyEvidenceLinkRow[];
    },
  });
}

// ── Mutations ──────────────────────────────────────────────

export function useGenerateChronology() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (caseId: string) => {
      const { data, error } = await supabase.functions.invoke("generate-chronology", {
        body: { case_id: caseId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data, caseId) => {
      qc.invalidateQueries({ queryKey: ["chronology-candidates", caseId] });
      toast.success(`Generated ${data.events_generated} chronology events`);
    },
    onError: (err: Error) => {
      toast.error(`Chronology generation failed: ${err.message}`);
    },
  });
}

export function useUpdateCandidateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ candidateId, status, caseId }: { candidateId: string; status: ChronologyCandidateStatus; caseId: string }) => {
      const { error } = await (supabase.from("chronology_event_candidates") as any)
        .update({ status })
        .eq("id", candidateId);
      if (error) throw error;
      return { caseId };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["chronology-candidates", result.caseId] });
    },
  });
}

export function useEditCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ candidateId, updates, caseId }: {
      candidateId: string;
      updates: {
        user_corrected_label?: string;
        user_corrected_description?: string;
        user_corrected_date?: string;
        user_corrected_category?: string;
        label?: string;
        description?: string;
        event_date?: string;
        category?: string;
      };
      caseId: string;
    }) => {
      const { error } = await (supabase.from("chronology_event_candidates") as any)
        .update(updates)
        .eq("id", candidateId);
      if (error) throw error;
      return { caseId };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["chronology-candidates", result.caseId] });
      toast.success("Event updated");
    },
  });
}

export function useMergeCandidates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sourceId, targetId, caseId }: { sourceId: string; targetId: string; caseId: string }) => {
      const { error } = await (supabase.from("chronology_event_candidates") as any)
        .update({ status: "merged", merged_into_id: targetId })
        .eq("id", sourceId);
      if (error) throw error;
      return { caseId };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["chronology-candidates", result.caseId] });
      toast.success("Events merged");
    },
  });
}
