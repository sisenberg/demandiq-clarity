/**
 * EvaluateIQ — Human Assumption Overrides Hook
 *
 * Manages the reviewer's adopted assumptions that override system-derived
 * inputs. Every change is tracked with who/when/why for audit compliance.
 *
 * DESIGN: Overrides are kept separate from the system-derived snapshot.
 * The original automated run is never overwritten — the UI shows both
 * the system recommendation and the human-adopted position.
 */

import { useState, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";

// ─── Override Types ────────────────────────────────────

export type MedicalBasePreference = "reviewed" | "billed";
export type VenueSeverity = "plaintiff_friendly" | "neutral" | "defense_friendly";
export type CredibilityImpact = "none" | "minor" | "moderate" | "significant";
export type PriorConditionImpact = "none" | "minor" | "moderate" | "significant";

/**
 * The full set of human-adoptable assumptions.
 * Each field is `null` when using the system default.
 */
export interface HumanAssumptionOverrides {
  /** Override liability percentage (0–100). null = use system-derived */
  liability_percentage: number | null;
  /** Override comparative negligence (0–100). null = use system-derived */
  comparative_negligence_percentage: number | null;
  /** Choose which medical base to use. null = auto (reviewed when available) */
  medical_base_preference: MedicalBasePreference | null;
  /** Override future medical estimate. null = use system-derived */
  future_medical_override: number | null;
  /** Adopt/override wage loss amount. null = use system-derived */
  wage_loss_override: number | null;
  /** Venue severity selection. null = use system-derived */
  venue_severity: VenueSeverity | null;
  /** Credibility impact. null = use system-derived */
  credibility_impact: CredibilityImpact | null;
  /** Prior condition impact. null = use system-derived */
  prior_condition_impact: PriorConditionImpact | null;
}

/** A single change entry for audit trail */
export interface AssumptionChangeEntry {
  field: keyof HumanAssumptionOverrides;
  label: string;
  previous_value: unknown;
  new_value: unknown;
  reason: string;
  changed_by: string;
  changed_by_name: string;
  changed_at: string;
}

/** The complete assumption state including change history */
export interface AssumptionState {
  overrides: HumanAssumptionOverrides;
  /** Whether any overrides differ from system defaults */
  hasOverrides: boolean;
  /** Count of active (non-null) overrides */
  activeOverrideCount: number;
  /** Full change history */
  changeLog: AssumptionChangeEntry[];
}

// ─── Selected Working Range ────────────────────────────

export interface WorkingRangeSelection {
  selected_band: "floor" | "likely" | "stretch" | "custom";
  custom_amount: number | null;
  authority_recommendation: number | null;
  reviewer_notes: string;
  manager_notes: string;
  selected_by: string | null;
  selected_by_name: string;
  selected_at: string | null;
}

// ─── Defaults ──────────────────────────────────────────

const DEFAULT_OVERRIDES: HumanAssumptionOverrides = {
  liability_percentage: null,
  comparative_negligence_percentage: null,
  medical_base_preference: null,
  future_medical_override: null,
  wage_loss_override: null,
  venue_severity: null,
  credibility_impact: null,
  prior_condition_impact: null,
};

const DEFAULT_WORKING_RANGE: WorkingRangeSelection = {
  selected_band: "likely",
  custom_amount: null,
  authority_recommendation: null,
  reviewer_notes: "",
  manager_notes: "",
  selected_by: null,
  selected_by_name: "",
  selected_at: null,
};

const FIELD_LABELS: Record<keyof HumanAssumptionOverrides, string> = {
  liability_percentage: "Liability Percentage",
  comparative_negligence_percentage: "Comparative Negligence",
  medical_base_preference: "Medical Base Preference",
  future_medical_override: "Future Medical Estimate",
  wage_loss_override: "Wage Loss Amount",
  venue_severity: "Venue Severity",
  credibility_impact: "Credibility Impact",
  prior_condition_impact: "Prior Condition Impact",
};

// ─── Hook ──────────────────────────────────────────────

export function useAssumptionOverrides() {
  const { user } = useAuth();
  const [overrides, setOverrides] = useState<HumanAssumptionOverrides>({ ...DEFAULT_OVERRIDES });
  const [changeLog, setChangeLog] = useState<AssumptionChangeEntry[]>([]);
  const [workingRange, setWorkingRangeState] = useState<WorkingRangeSelection>({ ...DEFAULT_WORKING_RANGE });

  /** Update a single override field with required reason */
  const setOverride = useCallback(
    <K extends keyof HumanAssumptionOverrides>(
      field: K,
      value: HumanAssumptionOverrides[K],
      reason: string,
    ) => {
      setOverrides((prev) => {
        const entry: AssumptionChangeEntry = {
          field,
          label: FIELD_LABELS[field],
          previous_value: prev[field],
          new_value: value,
          reason,
          changed_by: user?.id ?? "unknown",
          changed_by_name: user?.email ?? "Unknown User",
          changed_at: new Date().toISOString(),
        };
        setChangeLog((log) => [entry, ...log]);
        return { ...prev, [field]: value };
      });
    },
    [user],
  );

  /** Reset a single override back to system default */
  const resetOverride = useCallback(
    (field: keyof HumanAssumptionOverrides) => {
      setOverrides((prev) => {
        if (prev[field] === null) return prev;
        const entry: AssumptionChangeEntry = {
          field,
          label: FIELD_LABELS[field],
          previous_value: prev[field],
          new_value: null,
          reason: "Reset to system default",
          changed_by: user?.id ?? "unknown",
          changed_by_name: user?.email ?? "Unknown User",
          changed_at: new Date().toISOString(),
        };
        setChangeLog((log) => [entry, ...log]);
        return { ...prev, [field]: null };
      });
    },
    [user],
  );

  /** Reset all overrides */
  const resetAll = useCallback(() => {
    setOverrides({ ...DEFAULT_OVERRIDES });
    const entry: AssumptionChangeEntry = {
      field: "liability_percentage",
      label: "All Overrides",
      previous_value: "multiple",
      new_value: null,
      reason: "Reset all assumptions to system defaults",
      changed_by: user?.id ?? "unknown",
      changed_by_name: user?.email ?? "Unknown User",
      changed_at: new Date().toISOString(),
    };
    setChangeLog((log) => [entry, ...log]);
  }, [user]);

  /** Update working range selection */
  const setWorkingRange = useCallback(
    (update: Partial<WorkingRangeSelection>) => {
      setWorkingRangeState((prev) => ({
        ...prev,
        ...update,
        selected_by: user?.id ?? prev.selected_by,
        selected_by_name: user?.email ?? prev.selected_by_name,
        selected_at: new Date().toISOString(),
      }));
    },
    [user],
  );

  const state = useMemo<AssumptionState>(() => {
    const activeOverrideCount = Object.values(overrides).filter((v) => v !== null).length;
    return {
      overrides,
      hasOverrides: activeOverrideCount > 0,
      activeOverrideCount,
      changeLog,
    };
  }, [overrides, changeLog]);

  return {
    state,
    overrides,
    changeLog,
    workingRange,
    setOverride,
    resetOverride,
    resetAll,
    setWorkingRange,
  };
}
