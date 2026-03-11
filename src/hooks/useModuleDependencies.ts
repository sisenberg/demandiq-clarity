import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { ModuleDependency, ModuleDependencyState } from "@/types";
import { DependencyStatus } from "@/types";

// ─── Queries ─────────────────────────────────────

/** Fetch the dependency graph (reference data, all modules) */
export function useModuleDependencies() {
  return useQuery({
    queryKey: ["module-dependencies"],
    staleTime: 1000 * 60 * 30, // cache 30 min, rarely changes
    queryFn: async () => {
      const { data, error } = await (supabase.from("module_dependencies") as any)
        .select("*");
      if (error) throw error;
      return (data ?? []) as ModuleDependency[];
    },
  });
}

/** Fetch all dependency states for a case */
export function useCaseDependencyStates(caseId: string | undefined) {
  return useQuery({
    queryKey: ["dependency-states", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("module_dependency_state") as any)
        .select("*")
        .eq("case_id", caseId!);
      if (error) throw error;
      return (data ?? []) as ModuleDependencyState[];
    },
  });
}

/** Get the dependency status for a specific downstream module */
export function getDependencyStatus(
  states: ModuleDependencyState[],
  downstreamModuleId: string,
  upstreamModuleId: string
): ModuleDependencyState | null {
  return states.find(
    (s) => s.downstream_module_id === downstreamModuleId && s.upstream_module_id === upstreamModuleId
  ) ?? null;
}

/** Get the upstream modules a downstream module depends on */
export function getUpstreamModules(
  dependencies: ModuleDependency[],
  downstreamModuleId: string
): string[] {
  return dependencies
    .filter((d) => d.downstream_module_id === downstreamModuleId)
    .map((d) => d.upstream_module_id);
}

/** Get the downstream modules that depend on a given upstream module */
export function getDownstreamModules(
  dependencies: ModuleDependency[],
  upstreamModuleId: string
): string[] {
  return dependencies
    .filter((d) => d.upstream_module_id === upstreamModuleId)
    .map((d) => d.downstream_module_id);
}

// ─── Mutations ───────────────────────────────────

/** Mark all downstream dependency states as stale when upstream is reopened */
export function useMarkDownstreamStale() {
  const qc = useQueryClient();
  const { tenantId } = useAuth();

  return useMutation({
    mutationFn: async ({
      caseId,
      upstreamModuleId,
    }: {
      caseId: string;
      upstreamModuleId: string;
    }) => {
      if (!tenantId) throw new Error("Not authenticated");

      // Get downstream modules from dependency graph
      const { data: deps } = await (supabase.from("module_dependencies") as any)
        .select("downstream_module_id")
        .eq("upstream_module_id", upstreamModuleId);

      const downstreamIds = (deps ?? []).map((d: any) => d.downstream_module_id);
      if (downstreamIds.length === 0) return;

      const now = new Date().toISOString();

      // Upsert dependency state for each downstream module
      for (const dsId of downstreamIds) {
        await (supabase.from("module_dependency_state") as any)
          .upsert(
            {
              tenant_id: tenantId,
              case_id: caseId,
              downstream_module_id: dsId,
              upstream_module_id: upstreamModuleId,
              dependency_status: DependencyStatus.StaleDueToUpstreamChange,
              stale_since: now,
            },
            { onConflict: "case_id,downstream_module_id,upstream_module_id" }
          );
      }
    },
    onSuccess: (_, { caseId }) => {
      qc.invalidateQueries({ queryKey: ["dependency-states", caseId] });
    },
  });
}

/** Sync a downstream module to the latest upstream snapshot (mark current) */
export function useSyncDependency() {
  const qc = useQueryClient();
  const { tenantId } = useAuth();

  return useMutation({
    mutationFn: async ({
      caseId,
      downstreamModuleId,
      upstreamModuleId,
      snapshotId,
      snapshotVersion,
    }: {
      caseId: string;
      downstreamModuleId: string;
      upstreamModuleId: string;
      snapshotId: string;
      snapshotVersion: number;
    }) => {
      if (!tenantId) throw new Error("Not authenticated");

      await (supabase.from("module_dependency_state") as any)
        .upsert(
          {
            tenant_id: tenantId,
            case_id: caseId,
            downstream_module_id: downstreamModuleId,
            upstream_module_id: upstreamModuleId,
            dependency_status: DependencyStatus.Current,
            upstream_snapshot_id: snapshotId,
            upstream_snapshot_version: snapshotVersion,
            last_synced_at: new Date().toISOString(),
            stale_since: null,
          },
          { onConflict: "case_id,downstream_module_id,upstream_module_id" }
        );
    },
    onSuccess: (_, { caseId }) => {
      qc.invalidateQueries({ queryKey: ["dependency-states", caseId] });
    },
  });
}

// ─── Status display helpers ──────────────────────

export const DEPENDENCY_STATUS_LABEL: Record<string, string> = {
  [DependencyStatus.Current]: "Current",
  [DependencyStatus.StaleDueToUpstreamChange]: "Stale — upstream changed",
  [DependencyStatus.RefreshNeeded]: "Refresh needed",
};

export const DEPENDENCY_STATUS_BADGE: Record<string, string> = {
  [DependencyStatus.Current]: "status-badge-approved",
  [DependencyStatus.StaleDueToUpstreamChange]: "status-badge-attention",
  [DependencyStatus.RefreshNeeded]: "status-badge-failed",
};
