import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { case_id, tenant_id, user_id, action } = await req.json();
    if (!case_id || !tenant_id) {
      return new Response(JSON.stringify({ error: "case_id and tenant_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get active demand
    const { data: demand } = await supabase
      .from("demands")
      .select("*")
      .eq("case_id", case_id)
      .eq("is_active", true)
      .maybeSingle();

    // 2. Get specials records
    const { data: specials } = await supabase
      .from("specials_records")
      .select("*")
      .eq("case_id", case_id)
      .order("date_of_service", { ascending: true });

    // 3. Get treatment events
    const { data: treatments } = await supabase
      .from("treatment_events")
      .select("*")
      .eq("case_id", case_id)
      .order("visit_date", { ascending: true });

    // 4. Get injury records
    const { data: injuries } = await supabase
      .from("injury_records")
      .select("*")
      .eq("case_id", case_id)
      .order("created_at", { ascending: true });

    // 5. Get case parties (providers)
    const { data: parties } = await supabase
      .from("case_parties")
      .select("*")
      .eq("case_id", case_id);

    // ─── Assemble specials summary ──────────────────────
    const specialsList = specials ?? [];
    const totalBilled = specialsList.reduce((s: number, r: any) => s + (r.billed_amount ?? 0), 0);
    const totalAdjusted = specialsList.reduce((s: number, r: any) => s + (r.adjustments ?? 0), 0);
    const uniqueProviders = [...new Set(specialsList.map((r: any) => r.provider_name).filter(Boolean))];

    const specialsSummary = {
      total_billed: totalBilled,
      total_adjusted: totalAdjusted,
      total_balance: totalBilled - totalAdjusted,
      bill_count: specialsList.length,
      provider_count: uniqueProviders.length,
      verified_count: specialsList.filter((r: any) => r.verification_status === "verified").length,
      lines: specialsList.map((r: any) => ({
        id: r.id,
        provider_name: r.provider_name,
        date_of_service: r.date_of_service,
        billed_amount: r.billed_amount,
        cpt_code: r.cpt_or_hcpcs_code,
        verification_status: r.verification_status,
      })),
    };

    // ─── Assemble provider list ─────────────────────────
    const providerParties = (parties ?? []).filter((p: any) => p.party_role === "provider");
    const providerList = providerParties.map((p: any) => ({
      party_id: p.id,
      name: p.full_name,
      organization: p.organization,
      role: p.party_role,
    }));

    // Add providers from specials/treatments not yet in parties
    const partyNames = new Set(providerParties.map((p: any) => p.full_name.toLowerCase()));
    for (const name of uniqueProviders) {
      if (!partyNames.has(name.toLowerCase())) {
        providerList.push({ party_id: null, name, organization: "", role: "provider" });
      }
    }

    // ─── Assemble treatment summary ─────────────────────
    const treatmentList = treatments ?? [];
    const validDates = treatmentList
      .map((t: any) => t.visit_date)
      .filter((d: string) => d && /^\d{4}/.test(d))
      .sort();

    const treatmentSummary = {
      total_events: treatmentList.length,
      first_treatment_date: validDates[0] ?? null,
      last_treatment_date: validDates[validDates.length - 1] ?? null,
      treatment_duration_days: demand?.treatment_duration_days ?? 0,
      provider_count: demand?.treatment_provider_count ?? uniqueProviders.length,
      verified_count: treatmentList.filter((t: any) => t.verification_status === "verified").length,
      event_types: treatmentList.reduce((acc: Record<string, number>, t: any) => {
        acc[t.event_type] = (acc[t.event_type] ?? 0) + 1;
        return acc;
      }, {}),
    };

    // ─── Assemble injury summary ────────────────────────
    const injuryList = injuries ?? [];
    const injurySummary = injuryList.map((inj: any) => ({
      id: inj.id,
      injury_description: inj.injury_description,
      body_part: inj.body_part,
      icd_codes: inj.icd_codes,
      diagnosis_description: inj.diagnosis_description,
      objective_support_flag: inj.objective_support_flag,
      invasive_treatment_flag: inj.invasive_treatment_flag,
      residual_symptom_flag: inj.residual_symptom_flag,
      functional_impact_flag: inj.functional_impact_flag,
      verification_status: inj.verification_status,
    }));

    // ─── Assemble clinical flags ────────────────────────
    const objectiveFlags = injuryList
      .filter((i: any) => i.objective_support_flag)
      .map((i: any) => ({ injury_id: i.id, body_part: i.body_part, detail: i.imaging_references || i.diagnosis_description }));

    const invasiveFlags = injuryList
      .filter((i: any) => i.invasive_treatment_flag)
      .map((i: any) => ({ injury_id: i.id, body_part: i.body_part, detail: i.surgery_mentions || i.injections_or_procedures }));

    const residualFlags = injuryList
      .filter((i: any) => i.residual_symptom_flag)
      .map((i: any) => ({ injury_id: i.id, body_part: i.body_part, detail: i.residual_symptom_language }));

    const functionalFlags = injuryList
      .filter((i: any) => i.functional_impact_flag)
      .map((i: any) => ({ injury_id: i.id, body_part: i.body_part, detail: i.functional_limitations || i.work_restrictions }));

    // ─── Missing data flags ─────────────────────────────
    const missingFlags: { field: string; message: string }[] = [];

    if (!demand) missingFlags.push({ field: "demand", message: "No active demand found" });
    if (specialsList.length === 0) missingFlags.push({ field: "specials", message: "No medical specials extracted" });
    if (treatmentList.length === 0) missingFlags.push({ field: "treatments", message: "No treatment events extracted" });
    if (injuryList.length === 0) missingFlags.push({ field: "injuries", message: "No injury records extracted" });
    if (demand && !demand.demand_amount) missingFlags.push({ field: "demand_amount", message: "Demand amount not captured" });
    if (demand && !demand.claimant_name) missingFlags.push({ field: "claimant_name", message: "Claimant name missing" });

    const unverifiedSpecials = specialsList.filter((r: any) => r.verification_status !== "verified").length;
    const unverifiedTreatments = treatmentList.filter((t: any) => t.verification_status !== "verified").length;
    const unverifiedInjuries = injuryList.filter((i: any) => i.verification_status !== "verified").length;

    if (unverifiedSpecials > 0) missingFlags.push({ field: "specials_unverified", message: `${unverifiedSpecials} specials record(s) unverified` });
    if (unverifiedTreatments > 0) missingFlags.push({ field: "treatments_unverified", message: `${unverifiedTreatments} treatment event(s) unverified` });
    if (unverifiedInjuries > 0) missingFlags.push({ field: "injuries_unverified", message: `${unverifiedInjuries} injury record(s) unverified` });

    // ─── Determine package status ───────────────────────
    const hasCriticalMissing = missingFlags.some((f) => ["demand", "specials", "injuries"].includes(f.field));
    const targetStatus = action === "publish"
      ? "published_to_evaluateiq"
      : hasCriticalMissing
        ? "draft"
        : "ready_for_review";

    // ─── Get current version ────────────────────────────
    const { data: existingPkg } = await supabase
      .from("intake_evaluation_packages")
      .select("id, version")
      .eq("case_id", case_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (existingPkg?.version ?? 0) + 1;

    // ─── Full package payload ───────────────────────────
    const fullPayload = {
      schema_version: "1.0.0",
      case_id,
      tenant_id,
      active_demand_id: demand?.id ?? null,
      claimant_name: demand?.claimant_name ?? "",
      represented_status: demand?.represented_status ?? "",
      attorney_name: demand?.attorney_name ?? "",
      law_firm: demand?.law_firm_name ?? "",
      demand_amount: demand?.demand_amount ?? null,
      demand_deadline: demand?.demand_deadline ?? null,
      specials_summary: specialsSummary,
      provider_list: providerList,
      treatment_summary: treatmentSummary,
      injury_summary: injurySummary,
      objective_support_flags: objectiveFlags,
      invasive_treatment_flags: invasiveFlags,
      residual_symptom_flags: residualFlags,
      functional_impact_flags: functionalFlags,
      missing_data_flags: missingFlags,
    };

    // ─── Upsert package ─────────────────────────────────
    const now = new Date().toISOString();
    const record: Record<string, unknown> = {
      tenant_id,
      case_id,
      active_demand_id: demand?.id ?? null,
      version: nextVersion,
      package_status: targetStatus,
      claimant_name: demand?.claimant_name ?? "",
      represented_status: demand?.represented_status ?? "",
      attorney_name: demand?.attorney_name ?? "",
      law_firm: demand?.law_firm_name ?? "",
      demand_amount: demand?.demand_amount ?? null,
      demand_deadline: demand?.demand_deadline ?? null,
      specials_summary: specialsSummary,
      provider_list: providerList,
      treatment_summary: treatmentSummary,
      injury_summary: injurySummary,
      objective_support_flags: objectiveFlags,
      invasive_treatment_flags: invasiveFlags,
      residual_symptom_flags: residualFlags,
      functional_impact_flags: functionalFlags,
      missing_data_flags: missingFlags,
      package_payload: fullPayload,
      assembled_at: now,
      assembled_by: user_id ?? null,
    };

    if (action === "publish") {
      record.published_at = now;
      record.published_by = user_id ?? null;
    }

    const { data: pkg, error: insertErr } = await supabase
      .from("intake_evaluation_packages")
      .insert(record)
      .select()
      .single();

    if (insertErr) throw insertErr;

    console.log(`[publish-intake-package] ${targetStatus} v${nextVersion} for case ${case_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        package_id: pkg.id,
        version: nextVersion,
        status: targetStatus,
        missing_data_flags: missingFlags,
        injury_count: injurySummary.length,
        specials_count: specialsList.length,
        treatment_count: treatmentList.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[publish-intake-package] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
