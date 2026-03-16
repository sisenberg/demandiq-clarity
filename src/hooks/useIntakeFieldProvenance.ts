import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface IntakeFieldProvenanceRow {
  id: string;
  tenant_id: string;
  case_id: string;
  intake_package_id: string | null;
  intake_package_version: number;
  section: string;
  field_name: string;
  extracted_value: string;
  corrected_value: string | null;
  final_value: string;
  source_document_id: string | null;
  source_page: number | null;
  source_snippet: string;
  reviewer_action: string;
  reviewer_user_id: string | null;
  reviewer_timestamp: string | null;
  publish_event: string;
  created_at: string;
}

export const REVIEWER_ACTION_LABEL: Record<string, string> = {
  auto_accepted: "Auto-accepted",
  human_verified: "Human Verified",
  human_corrected: "Human Corrected",
  unverified: "Unverified",
};

export const PUBLISH_EVENT_LABEL: Record<string, string> = {
  assembled: "Assembled",
  published: "Published to EvaluateIQ",
};

/** Fetch provenance records for a case, optionally filtered by version */
export function useIntakeFieldProvenance(
  caseId: string | undefined,
  version?: number
) {
  return useQuery({
    queryKey: ["intake-field-provenance", caseId, version],
    enabled: !!caseId,
    queryFn: async () => {
      let q = (supabase.from("intake_field_provenance") as any)
        .select("*")
        .eq("case_id", caseId)
        .order("section", { ascending: true })
        .order("field_name", { ascending: true });

      if (version != null) {
        q = q.eq("intake_package_version", version);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as IntakeFieldProvenanceRow[];
    },
  });
}

/** Fetch provenance for a single field */
export function useFieldProvenance(
  caseId: string | undefined,
  section: string,
  fieldName: string
) {
  return useQuery({
    queryKey: ["intake-field-provenance-single", caseId, section, fieldName],
    enabled: !!caseId && !!section && !!fieldName,
    queryFn: async () => {
      const { data, error } = await (supabase.from("intake_field_provenance") as any)
        .select("*")
        .eq("case_id", caseId)
        .eq("section", section)
        .eq("field_name", fieldName)
        .order("intake_package_version", { ascending: false });
      if (error) throw error;
      return (data ?? []) as IntakeFieldProvenanceRow[];
    },
  });
}
