import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────

export interface EntityClusterRow {
  id: string;
  tenant_id: string;
  case_id: string;
  entity_type: string;
  display_value: string;
  canonical_value: string | null;
  confidence: number | null;
  is_primary: boolean;
  source_count: number;
  created_at: string;
  updated_at: string;
}

export interface ClusterMemberRow {
  id: string;
  tenant_id: string;
  cluster_id: string;
  extraction_id: string | null;
  raw_value: string;
  document_id: string | null;
  source_page: number | null;
  source_snippet: string;
  match_score: number | null;
  created_at: string;
}

export type EntityType = "claimant" | "attorney" | "law_firm" | "provider" | "facility" | "claim_number" | "insurer";

export const ENTITY_TYPE_LABEL: Record<string, string> = {
  claimant: "Claimants",
  attorney: "Attorneys",
  law_firm: "Law Firms",
  provider: "Providers",
  facility: "Facilities",
  claim_number: "Claim Numbers",
  insurer: "Insurers",
};

export const ENTITY_TYPE_SINGULAR: Record<string, string> = {
  claimant: "Claimant",
  attorney: "Attorney",
  law_firm: "Law Firm",
  provider: "Provider",
  facility: "Facility",
  claim_number: "Claim #",
  insurer: "Insurer",
};

// ── Queries ────────────────────────────────────────────

export function useCaseEntityClusters(caseId: string | undefined) {
  return useQuery({
    queryKey: ["entity-clusters", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("entity_clusters") as any)
        .select("*")
        .eq("case_id", caseId!)
        .order("entity_type")
        .order("is_primary", { ascending: false })
        .order("source_count", { ascending: false });
      if (error) throw error;
      return data as EntityClusterRow[];
    },
  });
}

export function useClusterMembers(clusterId: string | undefined) {
  return useQuery({
    queryKey: ["cluster-members", clusterId],
    enabled: !!clusterId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("entity_cluster_members") as any)
        .select("*")
        .eq("cluster_id", clusterId!)
        .order("match_score", { ascending: false });
      if (error) throw error;
      return data as ClusterMemberRow[];
    },
  });
}

// ── Mutations ──────────────────────────────────────────

/** Trigger entity normalization for a case */
export function useNormalizeEntities() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (caseId: string) => {
      const { data, error } = await supabase.functions.invoke("normalize-entities", {
        body: { case_id: caseId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["entity-clusters"] });
      queryClient.invalidateQueries({ queryKey: ["cluster-members"] });
      if (data?.clusters_created > 0) {
        toast.success(`Detected ${data.clusters_created} entities across ${data.members_linked} references`);
      } else {
        toast.info("No entities to normalize yet");
      }
    },
    onError: (err) => {
      toast.error(`Entity normalization failed: ${(err as Error).message}`);
    },
  });
}

/** Rename a cluster's display value */
export function useRenameCluster() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clusterId, newValue }: { clusterId: string; newValue: string }) => {
      const { error } = await (supabase.from("entity_clusters") as any)
        .update({ canonical_value: newValue, updated_at: new Date().toISOString() })
        .eq("id", clusterId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entity-clusters"] });
      toast.success("Entity renamed");
    },
  });
}

/** Set a cluster as primary for its entity type */
export function useSetPrimaryCluster() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clusterId, caseId, entityType }: {
      clusterId: string;
      caseId: string;
      entityType: string;
    }) => {
      // Clear other primaries of same type
      await (supabase.from("entity_clusters") as any)
        .update({ is_primary: false })
        .eq("case_id", caseId)
        .eq("entity_type", entityType);

      // Set this one
      await (supabase.from("entity_clusters") as any)
        .update({ is_primary: true })
        .eq("id", clusterId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entity-clusters"] });
      toast.success("Primary entity updated");
    },
  });
}

/** Merge two clusters (move all members of source into target, delete source) */
export function useMergeClusters() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sourceClusterId, targetClusterId }: {
      sourceClusterId: string;
      targetClusterId: string;
    }) => {
      // Move members
      await (supabase.from("entity_cluster_members") as any)
        .update({ cluster_id: targetClusterId })
        .eq("cluster_id", sourceClusterId);

      // Update target source_count
      const { data: members } = await (supabase.from("entity_cluster_members") as any)
        .select("id")
        .eq("cluster_id", targetClusterId);

      await (supabase.from("entity_clusters") as any)
        .update({ source_count: members?.length ?? 0 })
        .eq("id", targetClusterId);

      // Delete source cluster
      await (supabase.from("entity_clusters") as any)
        .delete()
        .eq("id", sourceClusterId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entity-clusters"] });
      queryClient.invalidateQueries({ queryKey: ["cluster-members"] });
      toast.success("Entities merged");
    },
  });
}

/** Split a member out of its cluster into a new one */
export function useSplitMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memberId, member }: {
      memberId: string;
      member: ClusterMemberRow;
    }) => {
      // Get original cluster to copy entity_type / case_id / tenant_id
      const { data: origCluster } = await (supabase.from("entity_clusters") as any)
        .select("*")
        .eq("id", member.cluster_id)
        .single();

      if (!origCluster) throw new Error("Original cluster not found");

      // Create new cluster
      const { data: newCluster, error: createErr } = await (supabase.from("entity_clusters") as any)
        .insert({
          tenant_id: origCluster.tenant_id,
          case_id: origCluster.case_id,
          entity_type: origCluster.entity_type,
          display_value: member.raw_value,
          source_count: 1,
        })
        .select("id")
        .single();

      if (createErr || !newCluster) throw new Error("Failed to create new cluster");

      // Move member
      await (supabase.from("entity_cluster_members") as any)
        .update({ cluster_id: newCluster.id })
        .eq("id", memberId);

      // Update original cluster source_count
      await (supabase.from("entity_clusters") as any)
        .update({ source_count: Math.max(0, origCluster.source_count - 1) })
        .eq("id", member.cluster_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entity-clusters"] });
      queryClient.invalidateQueries({ queryKey: ["cluster-members"] });
      toast.success("Member split into separate entity");
    },
  });
}
