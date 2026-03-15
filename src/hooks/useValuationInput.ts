/**
 * EvaluateIQ — Valuation Input State Hook
 *
 * Manages the editable ValuationInputSnapshot, hydrating from
 * the upstream EvaluateIntakeSnapshot and persisting versions.
 */

import { useState, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
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
  const hasReviewed = intake.medical_billing.some(b => b.reviewer_recommended_amount !== null);

  const policyLimit = intake.policy_coverage.length > 0
    ? intake.policy_coverage.reduce((max, p) => Math.max(max, p.coverage_limit ?? 0), 0)
    : null;

  // Determine representation
  const hasAttorney = intake.upstream_concerns.some(c =>
    c.description.toLowerCase().includes("attorney") || c.description.toLowerCase().includes("represented")
  );

  // Derive treatment date range
  const txDates = intake.treatment_timeline
    .map(t => t.treatment_date)
    .filter(Boolean)
    .sort() as string[];

  const injuries: InjuryInputEntry[] = intake.injuries.map(inj => ({
    id: inj.id,
    body_part: inj.body_part,
    injury_category: inj.body_region,
    severity: inj.severity,
    is_pre_existing: inj.is_pre_existing,
    diagnosis_code: inj.diagnosis_code,
  }));

  const treatmentTypes = [...new Set(intake.treatment_timeline.map(t => t.treatment_type))];

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

  // Populate context from upstream concerns
  const gapConcerns = intake.upstream_concerns.filter(c => c.category === "gap").map(c => c.description).join("; ");
  const causationConcerns = intake.upstream_concerns.filter(c => c.category === "causation").map(c => c.description).join("; ");
  const docConcerns = intake.upstream_concerns.filter(c => c.category === "documentation").map(c => c.description).join("; ");
  const preExisting = intake.injuries.filter(i => i.is_pre_existing).map(i => `${i.body_part}: ${i.diagnosis_description}`).join("; ");

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

export interface UseValuationInputReturn {
  input: ValuationInputSnapshot | null;
  isDirty: boolean;
  versions: ValuationInputSnapshot[];
  updateDemandOverview: (patch: Partial<DemandOverviewInputs>) => void;
  updateLiability: (patch: Partial<LiabilityInputs>) => void;
  updateInjuryTreatment: (patch: Partial<InjuryTreatmentInputs>) => void;
  updateEconomicDamages: (patch: Partial<EconomicDamagesInputs>) => void;
  updateEvaluationContext: (patch: Partial<EvaluationContextInputs>) => void;
  save: () => void;
  hydrate: (intake: EvaluateIntakeSnapshot, tenantId: string, userId: string | null) => void;
}

export function useValuationInput(): UseValuationInputReturn {
  const [input, setInput] = useState<ValuationInputSnapshot | null>(null);
  const [versions, setVersions] = useState<ValuationInputSnapshot[]>([]);

  const hydrate = useCallback((intake: EvaluateIntakeSnapshot, tenantId: string, userId: string | null) => {
    const hydrated = hydrateFromIntake(intake, tenantId, userId);
    setInput(hydrated);
    setVersions([]);
  }, []);

  const patch = useCallback(<K extends keyof ValuationInputSnapshot>(
    section: K,
    updates: Partial<ValuationInputSnapshot[K] & object>,
  ) => {
    setInput(prev => {
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

  const save = useCallback(() => {
    if (!input) return;
    const saved: ValuationInputSnapshot = {
      ...input,
      version: input.version + 1,
      is_dirty: false,
      last_saved_at: new Date().toISOString(),
      snapshot_id: `vi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
    setVersions(prev => [input, ...prev]);
    setInput(saved);
    toast.success(`Valuation inputs saved (v${saved.version})`);
  }, [input]);

  return {
    input,
    isDirty: input?.is_dirty ?? false,
    versions,
    updateDemandOverview,
    updateLiability,
    updateInjuryTreatment,
    updateEconomicDamages,
    updateEvaluationContext,
    save,
    hydrate,
  };
}
