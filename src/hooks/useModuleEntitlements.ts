import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EntitlementStatus } from "@/types";
import type { TenantModuleEntitlement } from "@/types";
import { toast } from "sonner";

/** Fetch all module entitlements for the current tenant */
export function useModuleEntitlements() {
  return useQuery({
    queryKey: ["module-entitlements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_module_entitlements")
        .select("*")
        .order("module_id");
      if (error) throw error;
      return (data ?? []) as TenantModuleEntitlement[];
    },
  });
}

/** Check if a specific module is active (enabled or trial-not-expired) */
export function isEntitlementActive(
  entitlements: TenantModuleEntitlement[],
  moduleId: string
): boolean {
  const e = entitlements.find((x) => x.module_id === moduleId);
  if (!e) return false;
  if (e.status === EntitlementStatus.Enabled) return true;
  if (e.status === EntitlementStatus.Trial) {
    if (!e.trial_ends_at) return true;
    return new Date(e.trial_ends_at) > new Date();
  }
  return false;
}

/** Get the entitlement status for a module, or null if no record */
export function getEntitlementStatus(
  entitlements: TenantModuleEntitlement[],
  moduleId: string
): EntitlementStatus | null {
  return entitlements.find((x) => x.module_id === moduleId)?.status ?? null;
}

/** Admin: upsert a module entitlement */
export function useUpsertEntitlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tenantId,
      moduleId,
      status,
      trialEndsAt,
    }: {
      tenantId: string;
      moduleId: string;
      status: EntitlementStatus;
      trialEndsAt?: string | null;
    }) => {
      const { error } = await supabase
        .from("tenant_module_entitlements")
        .upsert(
          {
            tenant_id: tenantId,
            module_id: moduleId,
            status,
            trial_ends_at: trialEndsAt ?? null,
            enabled_at: status === EntitlementStatus.Enabled ? new Date().toISOString() : undefined,
          },
          { onConflict: "tenant_id,module_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["module-entitlements"] });
      toast.success("Module entitlement updated");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
