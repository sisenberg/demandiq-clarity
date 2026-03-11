import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Security-sensitive action types tracked in the audit system.
 * See docs/compliance/access-control-model.md §4 for the full inventory.
 */
export type AuditActionType =
  // Document lifecycle
  | "document_uploaded"
  | "document_accessed"
  | "signed_url_generated"
  // Extraction review
  | "metadata_corrected"
  | "document_type_changed"
  | "fact_reviewed"
  // Chronology
  | "chronology_status_changed"
  | "chronology_edited"
  | "chronology_merged"
  // Entity normalization
  | "entity_renamed"
  | "entity_merged"
  | "entity_split"
  | "entity_primary_set"
  // Admin / config
  | "role_changed"
  | "entitlement_changed"
  // Processing
  | "processing_triggered"
  // Export
  | "artifact_exported";

interface AuditEntry {
  actionType: AuditActionType;
  entityType: string;
  entityId: string;
  caseId?: string;
  beforeValue?: Record<string, unknown>;
  afterValue?: Record<string, unknown>;
}

export function useAuditLog() {
  const { user, tenantId } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (entry: AuditEntry) => {
      if (!user || !tenantId) return;
      const { error } = await (supabase.from("audit_events") as any).insert({
        actor_user_id: user.id,
        tenant_id: tenantId,
        action_type: entry.actionType,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        case_id: entry.caseId ?? null,
        before_value: entry.beforeValue ?? null,
        after_value: entry.afterValue ?? null,
      });
      if (error) console.error("[audit] Failed to log:", error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["audit-events"] });
    },
  });
}
