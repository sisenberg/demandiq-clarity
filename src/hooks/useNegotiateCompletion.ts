/**
 * NegotiateIQ — Completion & Package Publishing Hook
 *
 * Publishes NegotiatePackage v1 into negotiation_packages table,
 * updates session status, writes module_completions, and audits.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { logNegotiationEvent } from "@/hooks/useNegotiateSession";
import { DependencyStatus } from "@/types";
import type { NegotiatePackagePayload, NegotiateOutcomeType } from "@/lib/negotiatePackageBuilder";

const T = (name: string) => supabase.from(name as any) as any;

export function usePublishNegotiatePackage() {
  const qc = useQueryClient();
  const { user, tenantId } = useAuth();

  return useMutation({
    mutationFn: async ({
      caseId,
      sessionId,
      payload,
      outcomeType,
      finalSettlement,
    }: {
      caseId: string;
      sessionId: string;
      payload: NegotiatePackagePayload;
      outcomeType: NegotiateOutcomeType;
      finalSettlement: number | null;
    }) => {
      if (!user || !tenantId) throw new Error("Not authenticated");

      // 1. Get next version
      const { data: existing } = await T("negotiation_packages")
        .select("version")
        .eq("case_id", caseId)
        .order("version", { ascending: false })
        .limit(1);
      const nextVersion = existing && existing.length > 0 ? existing[0].version + 1 : 1;

      // Update payload version
      const versionedPayload = { ...payload, package_version: nextVersion };

      // 2. Insert negotiation_packages
      const { data: pkgData, error: pkgError } = await T("negotiation_packages")
        .insert({
          case_id: caseId,
          tenant_id: tenantId,
          session_id: sessionId,
          version: nextVersion,
          outcome_type: outcomeType,
          final_settlement_amount: outcomeType === "settled" ? finalSettlement : null,
          package_payload: versionedPayload,
          completed_by: user.id,
          completed_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (pkgError) throw pkgError;

      // 3. Update session final fields
      const sessionUpdates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        completed_by: user.id,
      };
      if (outcomeType === "settled") {
        sessionUpdates.status = "settled";
        sessionUpdates.final_settlement_amount = finalSettlement;
      } else if (outcomeType === "transferred_forward") {
        sessionUpdates.status = "transferred_to_litiq_candidate";
      } else if (outcomeType === "impasse") {
        sessionUpdates.status = "impasse";
      } else {
        sessionUpdates.status = "closed_no_settlement";
      }
      sessionUpdates.final_outcome_notes = payload.outcome_notes;

      await T("negotiation_sessions").update(sessionUpdates).eq("id", sessionId);

      // 4. Upsert module_completions
      const { data: existingCompletion } = await T("module_completions")
        .select("id, version, status")
        .eq("case_id", caseId)
        .eq("module_id", "negotiateiq")
        .maybeSingle();

      let completionId: string;
      if (existingCompletion) {
        const newVer = existingCompletion.status === "reopened"
          ? existingCompletion.version + 1
          : existingCompletion.version;
        await T("module_completions").update({
          status: "completed",
          version: newVer,
          completed_by: user.id,
          completed_at: new Date().toISOString(),
          reopened_by: null,
          reopened_at: null,
        }).eq("id", existingCompletion.id);
        completionId = existingCompletion.id;
      } else {
        const { data: ins, error: insErr } = await T("module_completions").insert({
          tenant_id: tenantId,
          case_id: caseId,
          module_id: "negotiateiq",
          status: "completed",
          version: 1,
          completed_by: user.id,
          completed_at: new Date().toISOString(),
        }).select("id").single();
        if (insErr) throw insErr;
        completionId = ins.id;
      }

      // 5. Create module_completion_snapshots
      const { data: snapData } = await T("module_completion_snapshots").insert({
        tenant_id: tenantId,
        case_id: caseId,
        module_id: "negotiateiq",
        completion_id: completionId,
        version: nextVersion,
        snapshot_json: versionedPayload,
        created_by: user.id,
      }).select("id").single();

      // 6. Update downstream dependency state (litiq)
      const { data: deps } = await T("module_dependencies")
        .select("downstream_module_id")
        .eq("upstream_module_id", "negotiateiq");
      for (const dep of (deps ?? [])) {
        await T("module_dependency_state").upsert({
          tenant_id: tenantId,
          case_id: caseId,
          downstream_module_id: dep.downstream_module_id,
          upstream_module_id: "negotiateiq",
          dependency_status: DependencyStatus.Current,
          upstream_snapshot_id: snapData?.id ?? null,
          upstream_snapshot_version: nextVersion,
          last_synced_at: new Date().toISOString(),
          stale_since: null,
        }, { onConflict: "case_id,downstream_module_id,upstream_module_id" });
      }

      // 7. Log events
      await logNegotiationEvent({
        sessionId,
        caseId,
        tenantId,
        actorId: user.id,
        eventType: "session_completed",
        summary: `NegotiatePackage v${nextVersion} published. Outcome: ${outcomeType}${
          outcomeType === "settled" && finalSettlement != null ? ` ($${finalSettlement.toLocaleString()})` : ""
        }`,
        afterValue: {
          package_version: nextVersion,
          outcome_type: outcomeType,
          final_settlement_amount: finalSettlement,
        },
      });

      return { packageId: pkgData.id, version: nextVersion };
    },
    onSuccess: (result, { caseId }) => {
      qc.invalidateQueries({ queryKey: ["negotiate-session", caseId] });
      qc.invalidateQueries({ queryKey: ["negotiate-packages", caseId] });
      qc.invalidateQueries({ queryKey: ["module-completion", caseId, "negotiateiq"] });
      qc.invalidateQueries({ queryKey: ["module-snapshots", caseId, "negotiateiq"] });
      qc.invalidateQueries({ queryKey: ["dependency-states", caseId] });
      qc.invalidateQueries({ queryKey: ["cases", caseId] });
      toast.success(`NegotiatePackage v${result.version} published`);
    },
    onError: (err: Error) => toast.error(`Completion failed: ${err.message}`),
  });
}
