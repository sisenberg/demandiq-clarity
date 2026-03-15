/**
 * EvaluateIQ — Valuation Input State Hook
 *
 * Loads or bootstraps the demand-linked valuation input snapshot,
 * keeps local editable state in sync, and persists versioned saves.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import type {
  ValuationInputSnapshot,
  DemandOverviewInputs,
  LiabilityInputs,
  InjuryTreatmentInputs,
  EconomicDamagesInputs,
  EvaluationContextInputs,
  InjuryInputEntry,
} from "@/types/valuation-input";
import { createBlankValuationInput } from "@/types/valuation-input";

/** Hydrate a ValuationInputSnapshot from an EvaluateIntakeSnapshot */
function hydrateFromIntake(
  intake: EvaluateIntakeSnapshot,
  tenantId: string,
  userId: string | null,
): ValuationInputSnapshot {
  const base = createBlankValuationInput(
    intake.case_id,
    tenantId,
    userId,
    intake.source_module,
    intake.source_package_version,
  );

  const totalBilled = intake.medical_billing.reduce((s, b) => s + b.billed_amount, 0);
  const totalPaid = intake.medical_billing.reduce((s, b) => s + (b.paid_amount ?? 0), 0);
  const totalReviewed = intake.medical_billing.reduce((s, b) => s + (b.reviewer_recommended_amount ?? 0), 0);
  const hasReviewed = intake.medical_billing.some((b) => b.reviewer_recommended_amount !== null);

  const policyLimit = intake.policy_coverage.length > 0
    ? intake.policy_coverage.reduce((max, p) => Math.max(max, p.coverage_limit ?? 0), 0)
    : null;

  const hasAttorney = intake.upstream_concerns.some((c) =>
    c.description.toLowerCase().includes("attorney") || c.description.toLowerCase().includes("represented")
  );

  const txDates = intake.treatment_timeline
    .map((t) => t.treatment_date)
    .filter(Boolean)
    .sort() as string[];

  const injuries: InjuryInputEntry[] = intake.injuries.map((inj) => ({
    id: inj.id,
    body_part: inj.body_part,
    injury_category: inj.body_region,
    severity: inj.severity,
    is_pre_existing: inj.is_pre_existing,
    diagnosis_code: inj.diagnosis_code,
  }));

  const treatmentTypes = [...new Set(intake.treatment_timeline.map((t) => t.treatment_type))];

  base.upstream_snapshot_id = intake.snapshot_id;

  base.demand_overview = {
    ...base.demand_overview,
    claimant_name: intake.claimant.claimant_name.value || "",
    date_of_loss: intake.accident.date_of_loss.value || "",
    jurisdiction_state: intake.venue_jurisdiction.jurisdiction_state.value || "",
    venue_county: intake.venue_jurisdiction.venue_county.value || "",
    policy_limits: policyLimit,
    demand_source: intake.source_module === "revieweriq" ? "ReviewerIQ Package" : "DemandIQ Package",
    representation_status: hasAttorney ? "represented" : "unknown",
  };

  base.liability = {
    ...base.liability,
    claimant_fault_percentage: intake.comparative_negligence.claimant_negligence_percentage.value,
    negligence_notes: intake.comparative_negligence.notes.value || "",
  };

  base.injury_treatment = {
    injuries,
    treatment_types: treatmentTypes,
    treatment_start_date: txDates[0] ?? null,
    treatment_end_date: txDates.length > 1 ? txDates[txDates.length - 1] : null,
    has_surgery: intake.clinical_flags.has_surgery,
    has_injections: intake.clinical_flags.has_injections,
    has_imaging: intake.clinical_flags.has_advanced_imaging,
    has_hospitalization: treatmentTypes.includes("inpatient"),
    residual_complaints: "",
    functional_limitations: "",
    permanency_claimed: intake.clinical_flags.has_permanency_indicators,
  };

  base.economic_damages = {
    medical_specials_claimed: totalBilled,
    medical_specials_allowed: hasReviewed ? totalReviewed : totalPaid > 0 ? totalPaid : null,
    wage_loss_claimed: intake.wage_loss.total_lost_wages.value > 0 ? intake.wage_loss.total_lost_wages.value : null,
    wage_loss_allowed: null,
    future_medical_claimed: intake.future_treatment.future_medical_estimate.value > 0 ? intake.future_treatment.future_medical_estimate.value : null,
    future_medical_allowed: null,
    other_out_of_pocket: null,
  };

  const gapConcerns = intake.upstream_concerns.filter((c) => c.category === "gap").map((c) => c.description).join("; ");
  const causationConcerns = intake.upstream_concerns.filter((c) => c.category === "causation").map((c) => c.description).join("; ");
  const docConcerns = intake.upstream_concerns.filter((c) => c.category === "documentation").map((c) => c.description).join("; ");
  const preExisting = intake.injuries.filter((i) => i.is_pre_existing).map((i) => `${i.body_part}: ${i.diagnosis_description}`).join("; ");

  base.evaluation_context = {
    pre_existing_conditions: preExisting,
    gaps_in_treatment: gapConcerns,
    causation_concerns: causationConcerns,
    documentation_concerns: docConcerns,
    strengths: "",
    weaknesses: "",
    notes: "",
  };

  return base;
}

interface UseValuationInputOptions {
  caseId?: string;
  intakeSnapshot: EvaluateIntakeSnapshot | null;
  enabled: boolean;
}

interface BootstrapSnapshotResult {
  created: boolean;
  created_at: string;
  evaluation_case_id: string;
  snapshot_id: string;
  snapshot_payload: ValuationInputSnapshot;
  version: number;
}

interface AppendSnapshotResult {
  created_at: string;
  evaluation_case_id: string;
  snapshot_id: string;
  snapshot_payload: ValuationInputSnapshot;
  version: number;
}

export interface UseValuationInputReturn {
  input: ValuationInputSnapshot | null;
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
  loadError: string | null;
  saveError: string | null;
  versions: ValuationInputSnapshot[];
  updateDemandOverview: (patch: Partial<DemandOverviewInputs>) => void;
  updateLiability: (patch: Partial<LiabilityInputs>) => void;
  updateInjuryTreatment: (patch: Partial<InjuryTreatmentInputs>) => void;
  updateEconomicDamages: (patch: Partial<EconomicDamagesInputs>) => void;
  updateEvaluationContext: (patch: Partial<EvaluationContextInputs>) => void;
  save: () => Promise<boolean>;
  reload: () => Promise<void>;
}

export function useValuationInput({ caseId, intakeSnapshot, enabled }: UseValuationInputOptions): UseValuationInputReturn {
  const { tenantId, user } = useAuth();
  const [input, setInput] = useState<ValuationInputSnapshot | null>(null);
  const [versions, setVersions] = useState<ValuationInputSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const loadedCaseIdRef = useRef<string | null>(null);

  const patch = useCallback(<K extends keyof ValuationInputSnapshot>(
    section: K,
    updates: Partial<ValuationInputSnapshot[K] & object>,
  ) => {
    setSaveError(null);
    setInput((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [section]: { ...(prev[section] as object), ...updates },
        is_dirty: true,
      };
    });
  }, []);

  const updateDemandOverview = useCallback((p: Partial<DemandOverviewInputs>) => patch("demand_overview", p), [patch]);
  const updateLiability = useCallback((p: Partial<LiabilityInputs>) => patch("liability", p), [patch]);
  const updateInjuryTreatment = useCallback((p: Partial<InjuryTreatmentInputs>) => patch("injury_treatment", p), [patch]);
  const updateEconomicDamages = useCallback((p: Partial<EconomicDamagesInputs>) => patch("economic_damages", p), [patch]);
  const updateEvaluationContext = useCallback((p: Partial<EvaluationContextInputs>) => patch("evaluation_context", p), [patch]);

  const loadHistory = useCallback(async (targetCaseId: string) => {
    const { data, error } = await (supabase.from("valuation_input_snapshots") as any)
      .select("snapshot_payload")
      .eq("case_id", targetCaseId)
      .order("version", { ascending: false });

    if (error) throw error;

    const snapshots = ((data ?? []) as Array<{ snapshot_payload: ValuationInputSnapshot }>).map((row) => row.snapshot_payload);
    return {
      current: snapshots[0] ?? null,
      priorVersions: snapshots.slice(1),
    };
  }, []);

  const load = useCallback(async () => {
    if (!enabled || !caseId || !intakeSnapshot || !tenantId || !user) {
      setInput(null);
      setVersions([]);
      setLoadError(null);
      loadedCaseIdRef.current = null;
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const initialPayload = hydrateFromIntake(intakeSnapshot, tenantId, user.id);

      console.info("[EvaluateIQ] valuation input load attempt", {
        caseId,
        sourceModule: intakeSnapshot.source_module,
        upstreamSnapshotId: intakeSnapshot.snapshot_id,
      });

      const { data, error } = await (supabase.rpc("bootstrap_valuation_input_snapshot", {
        _case_id: caseId,
        _snapshot_payload: initialPayload as unknown as Record<string, unknown>,
        _source_module: intakeSnapshot.source_module,
        _source_package_version: intakeSnapshot.source_package_version,
        _upstream_snapshot_id: intakeSnapshot.snapshot_id,
      }) as any);

      if (error) throw error;

      const bootstrapResult = (Array.isArray(data) ? data[0] : data) as BootstrapSnapshotResult | null;
      const history = await loadHistory(caseId);
      const current = history.current ?? bootstrapResult?.snapshot_payload ?? initialPayload;

      setInput(current);
      setVersions(history.priorVersions);
      loadedCaseIdRef.current = caseId;

      console.info("[EvaluateIQ] valuation input load success", {
        caseId,
        createdInitialSnapshot: bootstrapResult?.created ?? false,
        version: current.version,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load saved evaluation inputs.";
      setLoadError(message);
      setInput(null);
      setVersions([]);
      console.error("[EvaluateIQ] valuation input load failed", { caseId, error });
      toast.error(`EvaluateIQ load failed: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [caseId, enabled, intakeSnapshot, loadHistory, tenantId, user]);

  useEffect(() => {
    if (!enabled || !caseId || !intakeSnapshot || !tenantId || !user) {
      setInput(null);
      setVersions([]);
      setLoadError(null);
      setSaveError(null);
      loadedCaseIdRef.current = null;
      return;
    }

    if (loadedCaseIdRef.current === caseId) return;

    void load();
  }, [caseId, enabled, intakeSnapshot, load, tenantId, user]);

  const reload = useCallback(async () => {
    loadedCaseIdRef.current = null;
    await load();
  }, [load]);

  const save = useCallback(async () => {
    if (!input || !caseId) return false;

    setIsSaving(true);
    setSaveError(null);

    try {
      console.info("[EvaluateIQ] valuation input save attempt", {
        caseId,
        currentVersion: input.version,
        upstreamSnapshotId: input.upstream_snapshot_id,
      });

      const { data, error } = await (supabase.rpc("append_valuation_input_snapshot", {
        _case_id: caseId,
        _snapshot_payload: input,
        _source_module: input.source_module,
        _source_package_version: input.source_package_version,
        _upstream_snapshot_id: input.upstream_snapshot_id,
      }) as any);

      if (error) throw error;

      const result = (Array.isArray(data) ? data[0] : data) as AppendSnapshotResult | null;
      if (!result?.snapshot_payload) {
        throw new Error("No saved snapshot was returned by the backend.");
      }

      setVersions((prev) => (input ? [input, ...prev] : prev));
      setInput(result.snapshot_payload);

      console.info("[EvaluateIQ] valuation input save success", {
        caseId,
        savedVersion: result.version,
        snapshotId: result.snapshot_id,
      });

      toast.success(`Valuation inputs saved (v${result.version})`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save evaluation inputs.";
      setSaveError(message);
      console.error("[EvaluateIQ] valuation input save failed", { caseId, error });
      toast.error(`Save failed: ${message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [caseId, input]);

  return {
    input,
    isDirty: input?.is_dirty ?? false,
    isLoading,
    isSaving,
    loadError,
    saveError,
    versions,
    updateDemandOverview,
    updateLiability,
    updateInjuryTreatment,
    updateEconomicDamages,
    updateEvaluationContext,
    save,
    reload,
  };
}
