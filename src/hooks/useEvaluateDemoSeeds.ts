/**
 * EvaluateIQ — Demo Seed Hook
 *
 * Provides access to seeded demo cases for deep UI testing.
 * Returns a specific seed by ID or all seeds for list views.
 */

import { useMemo } from "react";
import { EVALUATE_DEMO_SEEDS, type EvaluateDemoSeed } from "@/data/mock/evaluateSeeds";

export function useEvaluateDemoSeeds() {
  return useMemo(() => EVALUATE_DEMO_SEEDS, []);
}

export function useEvaluateDemoSeed(seedId: string | undefined): EvaluateDemoSeed | null {
  return useMemo(() => {
    if (!seedId) return null;
    return EVALUATE_DEMO_SEEDS.find(s => s.id === seedId) ?? null;
  }, [seedId]);
}
