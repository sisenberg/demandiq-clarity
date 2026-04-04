import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * orchestrate-intake
 *
 * Fires after classify-document completes. Routes the document to the
 * appropriate extraction function(s), then triggers entity normalization
 * and intake package assembly.
 *
 * Idempotent: checks intake_jobs status before invoking extractors.
 */

const EXTRACTION_ROUTES: Record<string, string[]> = {
  demand_letter: ["extract-demand"],
  medical_bill: ["extract-specials"],
  itemized_statement: ["extract-specials"],
  billing_record: ["extract-specials"],
  medical_record: ["extract-treatment-timeline", "extract-injuries"],
  narrative_report: ["extract-treatment-timeline", "extract-injuries"],
  imaging_report: ["extract-injuries"],
  wage_loss_document: ["extract-specials"],
};

const JOB_TYPE_MAP: Record<string, string> = {
  "extract-demand": "demand_extraction",
  "extract-specials": "specials_extraction",
  "extract-treatment-timeline": "treatment_extraction",
  "extract-injuries": "injury_extraction",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { document_id, case_id, tenant_id } = await req.json();
    if (!document_id || !case_id || !tenant_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: document_id, case_id, tenant_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[orchestrate-intake] Starting for document:", document_id);

    // 1. Read document type
    const { data: doc, error: docErr } = await supabase
      .from("case_documents")
      .select("document_type, predicted_type, tenant_id, case_id")
      .eq("id", document_id)
      .single();

    if (docErr || !doc) {
      console.error("[orchestrate-intake] Document not found:", docErr?.message);
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const docType = doc.document_type || doc.predicted_type || "unknown";
    const extractionFunctions = EXTRACTION_ROUTES[docType] || [];

    if (extractionFunctions.length === 0) {
      console.log("[orchestrate-intake] No extraction route for type:", docType);
      return new Response(
        JSON.stringify({ success: true, message: "No extraction needed for this document type", document_type: docType }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check existing intake_jobs — skip already completed extractions (idempotent)
    const { data: existingJobs } = await supabase
      .from("intake_jobs")
      .select("job_type, status")
      .eq("document_id", document_id);

    const completedJobTypes = new Set(
      (existingJobs ?? [])
        .filter((j: any) => j.status === "completed")
        .map((j: any) => j.job_type)
    );

    // 3. Invoke extraction functions IN PARALLEL to avoid timeout
    const results: Array<{ fn: string; status: string; data?: any; error?: string }> = [];

    const extractionPromises = extractionFunctions.map(async (fn) => {
      const jobType = JOB_TYPE_MAP[fn];
      if (jobType && completedJobTypes.has(jobType)) {
        console.log(`[orchestrate-intake] Skipping ${fn} — already completed`);
        return { fn, status: "skipped" } as const;
      }

      // Update job status to running
      if (jobType) {
        await supabase
          .from("intake_jobs")
          .update({ status: "running", started_at: new Date().toISOString() })
          .eq("document_id", document_id)
          .eq("job_type", jobType)
          .eq("status", "queued");
      }

      try {
        console.log(`[orchestrate-intake] Invoking ${fn}...`);
        const fnResponse = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ document_id, case_id, tenant_id }),
        });

        if (!fnResponse.ok) {
          const errText = await fnResponse.text();
          console.error(`[orchestrate-intake] ${fn} failed:`, fnResponse.status, errText);

          if (jobType) {
            await supabase
              .from("intake_jobs")
              .update({
                status: "failed",
                error_message: `${fn} returned ${fnResponse.status}: ${errText.slice(0, 500)}`,
                completed_at: new Date().toISOString(),
              })
              .eq("document_id", document_id)
              .eq("job_type", jobType)
              .in("status", ["queued", "running"]);
          }

          return { fn, status: "failed", error: `${fnResponse.status}` };
        }

        const fnData = await fnResponse.json();
        console.log(`[orchestrate-intake] ${fn} succeeded:`, JSON.stringify(fnData).slice(0, 200));
        return { fn, status: "success", data: fnData };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[orchestrate-intake] ${fn} exception:`, errMsg);

        if (jobType) {
          await supabase
            .from("intake_jobs")
            .update({
              status: "failed",
              error_message: errMsg.slice(0, 500),
              completed_at: new Date().toISOString(),
            })
            .eq("document_id", document_id)
            .eq("job_type", jobType)
            .in("status", ["queued", "running"]);
        }

        return { fn, status: "error", error: errMsg };
      }
    });

    results.push(...await Promise.all(extractionPromises));

    // 4. After demand extraction: auto-activate first demand + sync case fields
    if (docType === "demand_letter") {
      await postDemandExtractionSync(supabase, case_id, tenant_id, document_id);
    }

    // 5. Trigger entity normalization (best-effort, non-blocking)
    try {
      await fetch(`${supabaseUrl}/functions/v1/normalize-entities`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ case_id, tenant_id }),
      });
      console.log("[orchestrate-intake] Entity normalization triggered");
    } catch (e) {
      console.warn("[orchestrate-intake] Entity normalization failed (non-fatal):", e);
    }

    // 6. Create evidence_references from extraction outputs
    await createEvidenceReferences(supabase, case_id, tenant_id, document_id, docType);

    // 7. Check if all extractions are done for the case → auto-assemble package
    await maybeAutoAssemblePackage(supabase, supabaseUrl, serviceRoleKey, case_id, tenant_id);

    console.log("[orchestrate-intake] Complete for document:", document_id);

    return new Response(
      JSON.stringify({ success: true, document_type: docType, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[orchestrate-intake] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Post-demand extraction: activate first demand + sync case fields ──

async function postDemandExtractionSync(
  supabase: any,
  caseId: string,
  tenantId: string,
  documentId: string
) {
  try {
    // Check if there's already an active demand
    const { data: activeDemand } = await supabase
      .from("demands")
      .select("id")
      .eq("case_id", caseId)
      .eq("is_active", true)
      .maybeSingle();

    if (!activeDemand) {
      // Auto-activate the most recent demand for this document
      const { data: latestDemand } = await supabase
        .from("demands")
        .select("id, claimant_name, claim_number, loss_date")
        .eq("case_id", caseId)
        .eq("source_document_id", documentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestDemand) {
        // Activate it
        await supabase
          .from("demands")
          .update({ is_active: true })
          .eq("id", latestDemand.id);

        console.log("[orchestrate-intake] Auto-activated demand:", latestDemand.id);

        // Sync case fields from demand
        const caseUpdate: Record<string, any> = {};
        if (latestDemand.claimant_name) caseUpdate.claimant = latestDemand.claimant_name;
        if (latestDemand.claim_number) caseUpdate.claim_number = latestDemand.claim_number;
        if (latestDemand.loss_date) caseUpdate.date_of_loss = latestDemand.loss_date;

        if (Object.keys(caseUpdate).length > 0) {
          await supabase
            .from("cases")
            .update(caseUpdate)
            .eq("id", caseId);
          console.log("[orchestrate-intake] Synced case fields:", Object.keys(caseUpdate));
        }
      }
    }
  } catch (e) {
    console.warn("[orchestrate-intake] Post-demand sync error (non-fatal):", e);
  }
}

// ── Create evidence_references from extraction outputs ──

async function createEvidenceReferences(
  supabase: any,
  caseId: string,
  tenantId: string,
  documentId: string,
  docType: string
) {
  try {
    if (docType === "demand_letter") {
      // Pull demand_field_extractions for this document's demand
      const { data: demand } = await supabase
        .from("demands")
        .select("id")
        .eq("case_id", caseId)
        .eq("source_document_id", documentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (demand) {
        const { data: fields } = await supabase
          .from("demand_field_extractions")
          .select("id, field_name, extracted_value, confidence, source_page, source_snippet")
          .eq("demand_id", demand.id);

        if (fields && fields.length > 0) {
          // Check existing evidence_references to avoid duplicates
          const { data: existing } = await supabase
            .from("evidence_references")
            .select("anchor_entity_id")
            .eq("case_id", caseId)
            .eq("document_id", documentId)
            .eq("anchor_module", "demandiq");

          const existingIds = new Set((existing ?? []).map((e: any) => e.anchor_entity_id));

          const refs = fields
            .filter((f: any) => !existingIds.has(f.id))
            .map((f: any) => ({
              tenant_id: tenantId,
              case_id: caseId,
              document_id: documentId,
              page_number: f.source_page ?? 1,
              quoted_text: (f.source_snippet || f.extracted_value || "").slice(0, 2000),
              confidence: f.confidence ?? null,
              anchor_entity_type: "extracted_fact",
              anchor_entity_id: f.id,
              anchor_module: "demandiq",
              field_name: f.field_name,
            }));

          if (refs.length > 0) {
            await supabase.from("evidence_references").insert(refs);
            console.log("[orchestrate-intake] Created", refs.length, "evidence_references for demand fields");
          }
        }
      }
    }

    // Specials evidence
    if (["medical_bill", "itemized_statement", "billing_record", "wage_loss_document"].includes(docType)) {
      const { data: specials } = await supabase
        .from("specials_records")
        .select("id, source_page, source_snippet, extraction_confidence, description")
        .eq("case_id", caseId)
        .eq("source_document_id", documentId);

      if (specials && specials.length > 0) {
        const { data: existing } = await supabase
          .from("evidence_references")
          .select("anchor_entity_id")
          .eq("case_id", caseId)
          .eq("document_id", documentId)
          .eq("anchor_module", "demandiq")
          .eq("anchor_entity_type", "extracted_fact");

        const existingIds = new Set((existing ?? []).map((e: any) => e.anchor_entity_id));

        const refs = specials
          .filter((s: any) => !existingIds.has(s.id))
          .map((s: any) => ({
            tenant_id: tenantId,
            case_id: caseId,
            document_id: documentId,
            page_number: s.source_page ?? 1,
            quoted_text: (s.source_snippet || s.description || "").slice(0, 2000),
            confidence: s.extraction_confidence ?? null,
            anchor_entity_type: "extracted_fact",
            anchor_entity_id: s.id,
            anchor_module: "demandiq",
            field_name: "specials_line_item",
          }));

        if (refs.length > 0) {
          await supabase.from("evidence_references").insert(refs);
          console.log("[orchestrate-intake] Created", refs.length, "evidence_references for specials");
        }
      }
    }

    // Treatment events evidence
    if (["medical_record", "narrative_report"].includes(docType)) {
      const { data: events } = await supabase
        .from("treatment_events")
        .select("id, source_page, source_snippet, extraction_confidence, event_summary")
        .eq("case_id", caseId)
        .eq("source_document_id", documentId);

      if (events && events.length > 0) {
        const { data: existing } = await supabase
          .from("evidence_references")
          .select("anchor_entity_id")
          .eq("case_id", caseId)
          .eq("document_id", documentId)
          .eq("anchor_module", "demandiq")
          .eq("anchor_entity_type", "chronology_event");

        const existingIds = new Set((existing ?? []).map((e: any) => e.anchor_entity_id));

        const refs = events
          .filter((e: any) => !existingIds.has(e.id))
          .map((e: any) => ({
            tenant_id: tenantId,
            case_id: caseId,
            document_id: documentId,
            page_number: e.source_page ?? 1,
            quoted_text: (e.source_snippet || e.event_summary || "").slice(0, 2000),
            confidence: e.extraction_confidence ?? null,
            anchor_entity_type: "chronology_event",
            anchor_entity_id: e.id,
            anchor_module: "demandiq",
            field_name: "treatment_event",
          }));

        if (refs.length > 0) {
          await supabase.from("evidence_references").insert(refs);
          console.log("[orchestrate-intake] Created", refs.length, "evidence_references for treatment events");
        }
      }
    }

    // Injury records evidence
    if (["medical_record", "narrative_report", "imaging_report"].includes(docType)) {
      const { data: injuries } = await supabase
        .from("injury_records")
        .select("id, source_page, source_snippet, extraction_confidence, injury_description")
        .eq("case_id", caseId)
        .eq("source_document_id", documentId);

      if (injuries && injuries.length > 0) {
        const { data: existing } = await supabase
          .from("evidence_references")
          .select("anchor_entity_id")
          .eq("case_id", caseId)
          .eq("document_id", documentId)
          .eq("anchor_module", "demandiq")
          .eq("anchor_entity_type", "extracted_fact");

        const existingIds = new Set((existing ?? []).map((e: any) => e.anchor_entity_id));

        const refs = injuries
          .filter((i: any) => !existingIds.has(i.id))
          .map((i: any) => ({
            tenant_id: tenantId,
            case_id: caseId,
            document_id: documentId,
            page_number: i.source_page ?? 1,
            quoted_text: (i.source_snippet || i.injury_description || "").slice(0, 2000),
            confidence: i.extraction_confidence ?? null,
            anchor_entity_type: "extracted_fact",
            anchor_entity_id: i.id,
            anchor_module: "demandiq",
            field_name: "injury_record",
          }));

        if (refs.length > 0) {
          await supabase.from("evidence_references").insert(refs);
          console.log("[orchestrate-intake] Created", refs.length, "evidence_references for injuries");
        }
      }
    }
  } catch (e) {
    console.warn("[orchestrate-intake] Evidence reference creation error (non-fatal):", e);
  }
}

// ── Auto-assemble intake package when all extractions complete ──

async function maybeAutoAssemblePackage(
  supabase: any,
  supabaseUrl: string,
  serviceRoleKey: string,
  caseId: string,
  tenantId: string
) {
  try {
    // Check if there are any pending/running extraction jobs for this case
    const { data: pendingJobs } = await supabase
      .from("intake_jobs")
      .select("id, status")
      .eq("case_id", caseId)
      .in("status", ["queued", "running"]);

    if (pendingJobs && pendingJobs.length > 0) {
      console.log("[orchestrate-intake] Still", pendingJobs.length, "pending jobs — skipping auto-assemble");
      return;
    }

    // Check if there's an active demand (required for package)
    const { data: activeDemand } = await supabase
      .from("demands")
      .select("id")
      .eq("case_id", caseId)
      .eq("is_active", true)
      .maybeSingle();

    if (!activeDemand) {
      console.log("[orchestrate-intake] No active demand — skipping auto-assemble");
      return;
    }

    // Trigger package assembly
    console.log("[orchestrate-intake] All extractions complete — triggering package assembly");
    const assembleResp = await fetch(`${supabaseUrl}/functions/v1/publish-intake-package`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        case_id: caseId,
        tenant_id: tenantId,
        action: "assemble",
      }),
    });

    // Auto-publish if assembly produced a ready_for_review package
    if (assembleResp.ok) {
      try {
        const assembleData = await assembleResp.json();
        if (assembleData?.status === "ready_for_review") {
          console.log("[orchestrate-intake] Package ready — auto-publishing to EvaluateIQ");
          await fetch(`${supabaseUrl}/functions/v1/publish-intake-package`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              case_id: caseId,
              tenant_id: tenantId,
              action: "publish",
            }),
          });
        }
      } catch (pubErr) {
        console.warn("[orchestrate-intake] Auto-publish parse error (non-fatal):", pubErr);
      }
    }
  } catch (e) {
    console.warn("[orchestrate-intake] Auto-assemble error (non-fatal):", e);
  }
}
