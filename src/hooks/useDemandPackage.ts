import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DemandPackageV1,
  mapRowToDemandPackageV1,
  isDemandPackagePublished,
  validateDemandPackage,
} from "@/types/demand-package-v1";

// ─── Core query: fetch latest intake_evaluation_packages row ─────

export function useDemandPackage(caseId: string | undefined) {
  return useQuery({
    queryKey: ["demand-package", caseId],
    enabled: !!caseId,
    queryFn: async (): Promise<DemandPackageV1 | null> => {
      const { data, error } = await (supabase
        .from("intake_evaluation_packages") as any)
        .select("*")
        .eq("case_id", caseId!)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return mapRowToDemandPackageV1(data);
    },
  });
}

// ─── Published-only query ────────────────────────────

export function useDemandPackagePublished(caseId: string | undefined) {
  return useQuery({
    queryKey: ["demand-package-published", caseId],
    enabled: !!caseId,
    queryFn: async (): Promise<DemandPackageV1 | null> => {
      const { data, error } = await (supabase
        .from("intake_evaluation_packages") as any)
        .select("*")
        .eq("case_id", caseId!)
        .eq("package_status", "published_to_evaluateiq")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return mapRowToDemandPackageV1(data);
    },
  });
}

// ─── Launch eligibility for downstream modules ───────

export interface DemandPackageLaunchEligibility {
  eligible: boolean;
  package_version: number | null;
  package_id: string | null;
  blockers: string[];
}

export function useDemandPackageLaunchEligibility(
  caseId: string | undefined,
): DemandPackageLaunchEligibility {
  const { data: pkg, isLoading } = useDemandPackagePublished(caseId);

  return useMemo<DemandPackageLaunchEligibility>(() => {
    if (!caseId) {
      return { eligible: false, package_version: null, package_id: null, blockers: ["No case selected."] };
    }
    if (isLoading) {
      return { eligible: false, package_version: null, package_id: null, blockers: [] };
    }
    if (!pkg || !isDemandPackagePublished(pkg)) {
      return {
        eligible: false,
        package_version: null,
        package_id: null,
        blockers: ["A published DemandPackage is required. Complete and publish DemandIQ first."],
      };
    }

    const validation = validateDemandPackage(pkg);
    if (!validation.valid) {
      return {
        eligible: false,
        package_version: pkg.package_version,
        package_id: pkg.package_id,
        blockers: validation.blockers,
      };
    }

    return {
      eligible: true,
      package_version: pkg.package_version,
      package_id: pkg.package_id,
      blockers: [],
    };
  }, [caseId, pkg, isLoading]);
}
