import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TreatmentEventRow {
  id: string;
  tenant_id: string;
  case_id: string;
  linked_demand_id: string | null;
  source_document_id: string | null;
  provider_name: string;
  provider_party_id: string | null;
  visit_date: string;
  event_type: string;
  specialty: string | null;
  body_part_reference: string | null;
  symptoms_or_complaints: string;
  treatment_plan_notes: string;
  event_summary: string;
  source_page: number | null;
  source_snippet: string;
  extraction_confidence: number | null;
  verification_status: string;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export const EVENT_TYPE_LABEL: Record<string, string> = {
  office_visit: "Office Visit",
  emergency: "Emergency",
  imaging: "Imaging",
  injection: "Injection",
  physical_therapy: "Physical Therapy",
  chiropractic: "Chiropractic",
  surgery: "Surgery",
  consultation: "Consultation",
  follow_up: "Follow-Up",
  diagnostic_test: "Diagnostic Test",
  medication_management: "Medication Mgmt",
  other: "Other",
};

export const EVENT_TYPE_COLOR: Record<string, string> = {
  office_visit: "bg-primary/15 text-primary",
  emergency: "bg-destructive/15 text-destructive",
  imaging: "bg-[hsl(var(--status-review))]/15 text-[hsl(var(--status-review-foreground))]",
  injection: "bg-[hsl(var(--status-approved))]/15 text-[hsl(var(--status-approved))]",
  physical_therapy: "bg-[hsl(var(--status-attention))]/15 text-[hsl(var(--status-attention))]",
  chiropractic: "bg-[hsl(var(--status-attention))]/15 text-[hsl(var(--status-attention))]",
  surgery: "bg-destructive/15 text-destructive",
  consultation: "bg-accent text-muted-foreground",
  follow_up: "bg-primary/10 text-primary",
  diagnostic_test: "bg-[hsl(var(--status-review))]/15 text-[hsl(var(--status-review-foreground))]",
  medication_management: "bg-accent text-muted-foreground",
  other: "bg-muted text-muted-foreground",
};

/** Fetch all treatment events for a case */
export function useCaseTreatmentEvents(caseId: string | undefined) {
  return useQuery({
    queryKey: ["treatment-events", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("treatment_events") as any)
        .select("*")
        .eq("case_id", caseId)
        .order("visit_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TreatmentEventRow[];
    },
  });
}

/** Update a treatment event */
export function useUpdateTreatmentEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, patch }: { eventId: string; patch: Partial<TreatmentEventRow> }) => {
      const { error } = await (supabase.from("treatment_events") as any)
        .update(patch)
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["treatment-events"] });
      toast.success("Event updated");
    },
    onError: (e) => toast.error(`Update failed: ${(e as Error).message}`),
  });
}

/** Verify a treatment event */
export function useVerifyTreatmentEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, userId }: { eventId: string; userId: string }) => {
      const { error } = await (supabase.from("treatment_events") as any)
        .update({
          verification_status: "verified",
          verified_by: userId,
          verified_at: new Date().toISOString(),
        })
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["treatment-events"] });
      toast.success("Event verified");
    },
  });
}

/** Delete a treatment event */
export function useDeleteTreatmentEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId }: { eventId: string }) => {
      const { error } = await (supabase.from("treatment_events") as any)
        .delete()
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["treatment-events"] });
      toast.success("Event deleted");
    },
  });
}

/** Trigger treatment timeline extraction for a document */
export function useTriggerTreatmentExtraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ documentId, caseId, tenantId }: {
      documentId: string; caseId: string; tenantId: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("extract-treatment-timeline", {
        body: { document_id: documentId, case_id: caseId, tenant_id: tenantId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["treatment-events"] });
      qc.invalidateQueries({ queryKey: ["demands"] });
      toast.success(`Extracted ${data?.events_created ?? 0} treatment events`);
    },
    onError: (e) => toast.error(`Extraction failed: ${(e as Error).message}`),
  });
}

/** Compute timeline aggregates */
export function computeTimelineAggregates(events: TreatmentEventRow[]) {
  const validDates = events
    .map((e) => e.visit_date)
    .filter((d) => d && /^\d{4}/.test(d))
    .sort();

  const firstDate = validDates[0] ?? null;
  const lastDate = validDates[validDates.length - 1] ?? null;
  let durationDays = 0;
  if (firstDate && lastDate) {
    const ms = new Date(lastDate).getTime() - new Date(firstDate).getTime();
    durationDays = Math.max(0, Math.round(ms / 86400000));
  }

  const uniqueProviders = new Set(events.map((e) => e.provider_name.toLowerCase().trim()).filter(Boolean));
  const verified = events.filter((e) => e.verification_status === "verified").length;

  return {
    firstDate,
    lastDate,
    durationDays,
    totalEvents: events.length,
    providerCount: uniqueProviders.size,
    verified,
    unverified: events.length - verified,
  };
}
