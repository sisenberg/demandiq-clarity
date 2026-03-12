/**
 * EvaluateIQ — Calibration Corpus Hooks
 *
 * React Query hooks for importing and querying historical claims.
 * All operations are admin-only and tenant-scoped.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type {
  HistoricalClaim,
  HistoricalClaimInsert,
  CalibrationImport,
  CalibrationQueryFilters,
  CSV_FIELD_MAP,
} from "@/types/calibration";

// ─── List Historical Claims ───────────────────────────

export function useHistoricalClaims(filters?: CalibrationQueryFilters) {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["historical_claims", tenantId, filters],
    queryFn: async () => {
      let query = supabase
        .from("historical_claims")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(500);

      if (filters?.venue_state) {
        query = query.eq("venue_state", filters.venue_state);
      }
      if (filters?.attorney_name) {
        query = query.ilike("attorney_name", `%${filters.attorney_name}%`);
      }
      if (filters?.settlement_min !== undefined) {
        query = query.gte("final_settlement_amount", filters.settlement_min);
      }
      if (filters?.settlement_max !== undefined) {
        query = query.lte("final_settlement_amount", filters.settlement_max);
      }
      if (filters?.specials_min !== undefined) {
        query = query.gte("billed_specials", filters.specials_min);
      }
      if (filters?.specials_max !== undefined) {
        query = query.lte("billed_specials", filters.specials_max);
      }
      if (filters?.has_surgery !== undefined) {
        query = query.eq("has_surgery", filters.has_surgery);
      }
      if (filters?.injury_category) {
        query = query.contains("injury_categories", [filters.injury_category]);
      }
      if (filters?.provider_name) {
        query = query.contains("provider_names", [filters.provider_name]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as HistoricalClaim[];
    },
    enabled: !!tenantId,
  });
}

// ─── List Imports ─────────────────────────────────────

export function useCalibrationImports() {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["calibration_imports", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calibration_imports")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as CalibrationImport[];
    },
    enabled: !!tenantId,
  });
}

// ─── Corpus Stats ─────────────────────────────────────

export function useCorpusStats() {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["corpus_stats", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historical_claims")
        .select("id, final_settlement_amount, billed_specials, venue_state, injury_categories, has_surgery, completeness_score")
        .eq("tenant_id", tenantId!);

      if (error) throw error;
      const claims = (data ?? []) as unknown as HistoricalClaim[];

      const total = claims.length;
      const withSettlement = claims.filter((c) => c.final_settlement_amount != null).length;
      const avgSettlement = withSettlement > 0
        ? claims.reduce((s, c) => s + (c.final_settlement_amount ?? 0), 0) / withSettlement
        : 0;
      const avgCompleteness = total > 0
        ? claims.reduce((s, c) => s + c.completeness_score, 0) / total
        : 0;
      const uniqueStates = new Set(claims.map((c) => c.venue_state).filter(Boolean)).size;

      return { total, withSettlement, avgSettlement, avgCompleteness, uniqueStates };
    },
    enabled: !!tenantId,
  });
}

// ─── Import Mutation ──────────────────────────────────

export function useImportHistoricalClaims() {
  const { tenantId, user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ records, fileName, importType }: {
      records: Partial<HistoricalClaimInsert>[];
      fileName: string;
      importType: "csv" | "json";
    }) => {
      if (!tenantId || !user) throw new Error("Not authenticated");

      // 1. Create import batch
      const { data: importRow, error: impErr } = await supabase
        .from("calibration_imports")
        .insert([{
          tenant_id: tenantId,
          import_type: importType,
          file_name: fileName,
          record_count: records.length,
          status: "processing",
          imported_by: user.id,
        }] as any)
        .select()
        .single();

      if (impErr) throw impErr;
      const importId = (importRow as unknown as CalibrationImport).id;

      // 2. Process records
      let successCount = 0;
      let errorCount = 0;
      const errors: Array<{ row: number; message: string }> = [];

      for (let i = 0; i < records.length; i++) {
        const raw = records[i];
        try {
          const claim = normalizeRecord(raw, tenantId, importId);
          const { error } = await supabase
            .from("historical_claims")
            .insert([claim] as any);
          if (error) {
            errorCount++;
            errors.push({ row: i + 1, message: error.message });
          } else {
            successCount++;
          }
        } catch (e) {
          errorCount++;
          errors.push({ row: i + 1, message: String(e) });
        }
      }

      // 3. Update import batch
      await supabase
        .from("calibration_imports")
        .update({
          status: errorCount === records.length ? "failed" : "completed",
          success_count: successCount,
          error_count: errorCount,
          error_log: errors,
          completed_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq("id", importId);

      return { importId, successCount, errorCount, errors };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["historical_claims"] });
      qc.invalidateQueries({ queryKey: ["calibration_imports"] });
      qc.invalidateQueries({ queryKey: ["corpus_stats"] });
    },
  });
}

// ─── Normalization ────────────────────────────────────

function normalizeRecord(
  raw: Partial<HistoricalClaimInsert>,
  tenantId: string,
  importId: string,
): HistoricalClaimInsert {
  const completenessFields = [
    "final_settlement_amount", "loss_date", "venue_state", "attorney_name",
    "injury_categories", "billed_specials", "policy_limits", "liability_posture",
  ] as const;

  let filledCount = 0;
  for (const f of completenessFields) {
    const val = raw[f];
    if (val !== null && val !== undefined && val !== "" && !(Array.isArray(val) && val.length === 0)) {
      filledCount++;
    }
  }
  const completenessScore = Math.round((filledCount / completenessFields.length) * 100);

  const confidenceFlags: Record<string, boolean> = {};
  if (raw.final_settlement_amount != null) confidenceFlags.has_settlement = true;
  if (raw.billed_specials != null) confidenceFlags.has_specials = true;
  if (raw.loss_date) confidenceFlags.has_loss_date = true;
  if (raw.attorney_name) confidenceFlags.has_attorney = true;
  if (raw.venue_state) confidenceFlags.has_venue = true;

  return {
    tenant_id: tenantId,
    import_id: importId,
    final_settlement_amount: toNum(raw.final_settlement_amount),
    outcome_notes: raw.outcome_notes ?? "",
    loss_date: raw.loss_date ?? null,
    venue_state: raw.venue_state ?? "",
    venue_county: raw.venue_county ?? "",
    jurisdiction: raw.jurisdiction ?? "",
    claim_number: raw.claim_number ?? "",
    attorney_name: raw.attorney_name ?? "",
    attorney_firm: raw.attorney_firm ?? "",
    provider_names: toArr(raw.provider_names),
    injury_categories: toArr(raw.injury_categories),
    primary_body_parts: toArr(raw.primary_body_parts),
    has_surgery: toBool(raw.has_surgery),
    has_injections: toBool(raw.has_injections),
    has_imaging: toBool(raw.has_imaging),
    has_hospitalization: toBool(raw.has_hospitalization),
    has_permanency: toBool(raw.has_permanency),
    billed_specials: toNum(raw.billed_specials),
    reviewed_specials: toNum(raw.reviewed_specials),
    wage_loss: toNum(raw.wage_loss),
    treatment_duration_days: toInt(raw.treatment_duration_days),
    treatment_provider_count: toInt(raw.treatment_provider_count),
    policy_limits: toNum(raw.policy_limits),
    policy_type: raw.policy_type ?? "",
    liability_posture: validateLiability(raw.liability_posture),
    comparative_negligence_pct: toNum(raw.comparative_negligence_pct),
    completeness_score: completenessScore,
    confidence_flags: confidenceFlags,
    raw_source: raw as Record<string, unknown>,
    corpus_type: "calibration",
  };
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function toInt(v: unknown): number | null {
  const n = toNum(v);
  return n !== null ? Math.round(n) : null;
}

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return ["true", "yes", "1", "y"].includes(v.toLowerCase());
  return !!v;
}

function toArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) return v.split(/[;,|]/).map((s) => s.trim()).filter(Boolean);
  return [];
}

function validateLiability(v: unknown): "" | "clear" | "disputed" | "comparative" | "denied" {
  const valid = ["clear", "disputed", "comparative", "denied"];
  if (typeof v === "string" && valid.includes(v.toLowerCase())) return v.toLowerCase() as "clear" | "disputed" | "comparative" | "denied";
  return "";
}
