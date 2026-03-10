import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface CaseRow {
  id: string;
  tenant_id: string;
  title: string;
  case_number: string;
  claim_number: string;
  external_reference: string;
  claimant: string;
  insured: string;
  defendant: string;
  jurisdiction_state: string;
  priority: "low" | "normal" | "high" | "urgent";
  case_status: string;
  assigned_to: string | null;
  created_by: string;
  date_of_loss: string | null;
  created_at: string;
  updated_at: string;
}

export function useCases() {
  return useQuery({
    queryKey: ["cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CaseRow[];
    },
  });
}

export function useCase(caseId: string | undefined) {
  return useQuery({
    queryKey: ["cases", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .eq("id", caseId!)
        .single();
      if (error) throw error;
      return data as CaseRow;
    },
  });
}

export interface CreateCaseInput {
  claim_number: string;
  external_reference: string;
  claimant: string;
  insured: string;
  date_of_loss: string;
  jurisdiction_state: string;
  priority: "low" | "normal" | "high" | "urgent";
  assigned_to?: string | null;
}

export function useCreateCase() {
  const queryClient = useQueryClient();
  const { tenantId, user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateCaseInput) => {
      if (!tenantId || !user) throw new Error("Not authenticated");
      const title = `${input.claimant} v. ${input.insured}`;
      const { data, error } = await supabase
        .from("cases")
        .insert({
          tenant_id: tenantId,
          title,
          claim_number: input.claim_number,
          external_reference: input.external_reference,
          claimant: input.claimant,
          insured: input.insured,
          defendant: input.insured,
          date_of_loss: input.date_of_loss || null,
          jurisdiction_state: input.jurisdiction_state,
          priority: input.priority,
          assigned_to: input.assigned_to || null,
          created_by: user.id,
          case_status: "draft",
        })
        .select()
        .single();
      if (error) throw error;
      return data as CaseRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      toast.success("Case created");
    },
    onError: (err) => {
      toast.error(`Failed to create case: ${err.message}`);
    },
  });
}

export function useUpdateCaseStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ caseId, status }: { caseId: string; status: string }) => {
      const { error } = await supabase
        .from("cases")
        .update({ case_status: status })
        .eq("id", caseId);
      if (error) throw error;
    },
    onSuccess: (_, { caseId }) => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["cases", caseId] });
    },
  });
}
